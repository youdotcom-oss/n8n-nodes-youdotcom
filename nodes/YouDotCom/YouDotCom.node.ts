import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  JsonObject,
} from 'n8n-workflow'
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow'
import { buildClientInfoHeader } from './Attribution.ts'

/** Package version for User-Agent header. Updated automatically by publish workflow. */
const PACKAGE_VERSION = '0.6.0'

/** User-Agent string for API requests */
const USER_AGENT = `n8n-nodes-youdotcom/${PACKAGE_VERSION} (https://github.com/youdotcom-oss/n8n-nodes-youdotcom)`

/** Normalize a multi-string n8n value (string | string[] | undefined) to a trimmed string[]. */
export function toStringArray(value: unknown): string[] {
  if (value == null) return []
  const arr = Array.isArray(value) ? value : [value]
  return arr.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())
}

/** Normalize URLs from a multi-string or CSV string n8n value to a trimmed string[].
 *
 * When the input is already an array (the n8n multi-string "+ button" UI), each
 * element is treated as a complete URL and trimmed. When the input is a single
 * string, it is split on commas as a CSV fallback for users who paste a list.
 * This avoids corrupting URLs that legitimately contain commas in their path or
 * query string (e.g. `https://example.com/path?a=1,2`) when the user used the
 * multi-string UI.
 */
export function toUrlList(value: unknown): string[] {
  if (value == null) return []
  // Multi-string UI produces an array — each element is a whole URL, do not split.
  if (Array.isArray(value)) return toStringArray(value)
  // Single string — split on commas as a CSV convenience.
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '')
  }
  return []
}

/** Validate domain filter mutual exclusion and return the three normalized arrays. */
function resolveDomainFilters(
  context: IExecuteFunctions,
  raw: Record<string, unknown>,
  itemIndex: number,
): { include: string[]; exclude: string[]; boost: string[] } {
  const include = toStringArray(raw.include_domains)
  const exclude = toStringArray(raw.exclude_domains)
  const boost = toStringArray(raw.boost_domains)
  if (include.length > 0 && (exclude.length > 0 || boost.length > 0)) {
    throw new NodeOperationError(
      context.getNode(),
      'Include Domains cannot be combined with Exclude Domains or Boost Domains.',
      { itemIndex },
    )
  }
  return { include, exclude, boost }
}

/**
 * You.com node for n8n - Search, Contents, and Research operations.
 *
 * NOTE: n8n framework requires class-based nodes that implement INodeType.
 */
export class YouDotCom implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'You.com',
    name: 'youDotCom',
    icon: 'file:youdotcom.svg',
    group: ['transform'],
    version: 1,
    documentationUrl: 'https://docs.you.com/docs/integrations/n8n',
    usableAsTool: true,
    subtitle: '={{$parameter["operation"]}}',
    description:
      'Search the web, extract content from URLs, get answers with citations, run multi-step research, and manage background research tasks using You.com APIs',
    defaults: {
      name: 'You.com',
    },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'youDotComApi',
        required: true,
      },
    ],
    properties: [
      // ====================
      // Operation Selection
      // ====================
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Answer',
            value: 'answer',
            description: 'Get a synthesized answer with citations from web search results',
            action: 'Get an answer with citations',
          },
          {
            name: 'Finance Research',
            value: 'finance_research',
            description: 'Get finance-grade research answers with citations from financial data sources',
            action: 'Research a financial question',
          },
          {
            name: 'Get Contents',
            value: 'contents',
            description: 'Extract content from one or more URLs',
            action: 'Extract content from web pages',
          },
          {
            name: 'Get Research Task',
            value: 'get_research_task',
            description: 'Poll the status of a background research task',
            action: 'Get a research task status',
          },
          {
            name: 'Research',
            value: 'research',
            description: 'Get a comprehensive, cited answer to a complex question',
            action: 'Research a complex question',
          },
          {
            name: 'Search',
            value: 'search',
            description: 'Search the web and news using You.com',
            action: 'Search the web and news',
          },
          {
            name: 'Stream Research Task',
            value: 'stream_research_task',
            description: 'Stream real-time updates for a background research task',
            action: 'Stream a research task',
          },
        ],
        default: 'search',
      },

      // ====================
      // Search Parameters
      // ====================
      {
        displayName: 'Query',
        name: 'query',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['search'],
          },
        },
        default: '',
        placeholder: 'e.g., AI news site:github.com filetype:pdf',
        description:
          'The search query. Supports operators: site: (domain), filetype: (file type), + (require), - (exclude), AND, OR, NOT. Example: Python OR PyTorch -TensorFlow filetype:pdf',
      },
      {
        displayName: 'Search Options',
        name: 'searchOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            operation: ['search'],
          },
        },
        options: [
          {
            displayName: 'Boost Domains',
            name: 'boost_domains',
            type: 'string',
            typeOptions: {
              multipleValues: true,
            },
            default: '',
            description:
              'Boost ranking for these domains without excluding others (up to 500). Cannot combine with Include Domains. Can combine with Exclude Domains.',
          },
          {
            displayName: 'Count',
            name: 'count',
            type: 'number',
            typeOptions: {
              minValue: 1,
              maxValue: 100,
            },
            default: 10,
            description: 'Maximum number of search results to return per section (web and news)',
          },
          {
            displayName: 'Country',
            name: 'country',
            type: 'options',
            default: '',
            description: 'Country code that determines the geographical focus of results',
            options: [
              { name: 'Any', value: '' },
              { name: 'Argentina', value: 'AR' },
              { name: 'Australia', value: 'AU' },
              { name: 'Austria', value: 'AT' },
              { name: 'Belgium', value: 'BE' },
              { name: 'Brazil', value: 'BR' },
              { name: 'Canada', value: 'CA' },
              { name: 'Chile', value: 'CL' },
              { name: 'China', value: 'CN' },
              { name: 'Denmark', value: 'DK' },
              { name: 'Finland', value: 'FI' },
              { name: 'France', value: 'FR' },
              { name: 'Germany', value: 'DE' },
              { name: 'Hong Kong', value: 'HK' },
              { name: 'India', value: 'IN' },
              { name: 'Indonesia', value: 'ID' },
              { name: 'Italy', value: 'IT' },
              { name: 'Japan', value: 'JP' },
              { name: 'Malaysia', value: 'MY' },
              { name: 'Mexico', value: 'MX' },
              { name: 'Netherlands', value: 'NL' },
              { name: 'New Zealand', value: 'NZ' },
              { name: 'Norway', value: 'NO' },
              { name: 'Philippines', value: 'PH' },
              { name: 'Poland', value: 'PL' },
              { name: 'Portugal', value: 'PT' },
              { name: 'Russia', value: 'RU' },
              { name: 'Saudi Arabia', value: 'SA' },
              { name: 'South Africa', value: 'ZA' },
              { name: 'South Korea', value: 'KR' },
              { name: 'Spain', value: 'ES' },
              { name: 'Sweden', value: 'SE' },
              { name: 'Switzerland', value: 'CH' },
              { name: 'Taiwan', value: 'TW' },
              { name: 'Turkey', value: 'TR' },
              { name: 'United Kingdom', value: 'GB' },
              { name: 'United States', value: 'US' },
            ],
          },
          {
            displayName: 'Crawl Timeout',
            name: 'crawl_timeout',
            type: 'number',
            typeOptions: {
              minValue: 1,
              maxValue: 60,
            },
            default: 10,
            description:
              'Maximum seconds to wait for page content when extraction (Full Page) or the deprecated Livecrawl is enabled (1-60, default 10). Ignored when Extraction Mode is Highlights.',
          },
          {
            displayName: 'Exclude Domains',
            name: 'exclude_domains',
            type: 'string',
            typeOptions: {
              multipleValues: true,
            },
            default: '',
            description:
              'Filter out results from these domains (up to 500). Cannot combine with Include Domains. Can combine with Boost Domains.',
          },
          {
            displayName: 'Extraction',
            name: 'extraction',
            type: 'collection',
            placeholder: 'Add extraction',
            default: {},
            description:
              'Controls how page content is attached to each result. Preferred over the deprecated Livecrawl options; when set, Livecrawl is omitted from the request.',
            options: [
              {
                displayName: 'Extraction Mode',
                name: 'extraction_mode',
                type: 'options',
                default: 'highlights',
                description: 'Highlights returns query-relevant excerpts; full_page returns full HTML/Markdown',
                options: [
                  {
                    name: 'Highlights',
                    value: 'highlights',
                    description: 'Query-relevant excerpts in results.web[].contents.highlights',
                  },
                  {
                    name: 'Full Page',
                    value: 'full_page',
                    description: 'Full HTML/Markdown in results.web[].contents.html / .markdown',
                  },
                ],
              },
              {
                displayName: 'Full Page',
                name: 'full_page',
                type: 'collection',
                placeholder: 'Add full page options',
                default: {},
                displayOptions: {
                  show: {
                    extraction_mode: ['full_page'],
                  },
                },
                options: [
                  {
                    displayName: 'Extraction Formats',
                    name: 'extraction_formats',
                    type: 'multiOptions',
                    default: ['markdown'],
                    description: 'Format(s) returned for each result (default markdown)',
                    options: [
                      { name: 'Markdown', value: 'markdown' },
                      { name: 'HTML', value: 'html' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            displayName: 'Freshness',
            name: 'freshness',
            type: 'options',
            default: '',
            description: 'Filter results by recency',
            options: [
              { name: 'Any Time', value: '' },
              { name: 'Past Day', value: 'day' },
              { name: 'Past Month', value: 'month' },
              { name: 'Past Week', value: 'week' },
              { name: 'Past Year', value: 'year' },
            ],
          },
          {
            displayName: 'Include Domains',
            name: 'include_domains',
            type: 'string',
            typeOptions: {
              multipleValues: true,
            },
            default: '',
            description:
              'Restrict results to these domains (strict allowlist, up to 500). Cannot combine with Exclude Domains or Boost Domains.',
          },
          {
            displayName: 'Language',
            name: 'language',
            type: 'options',
            default: 'EN',
            description: 'Language of the web results (BCP 47 format)',
            options: [
              { name: 'Arabic', value: 'AR' },
              { name: 'Bengali', value: 'BN' },
              { name: 'Bulgarian', value: 'BG' },
              { name: 'Catalan', value: 'CA' },
              { name: 'Chinese (Simplified)', value: 'ZH-HANS' },
              { name: 'Chinese (Traditional)', value: 'ZH-HANT' },
              { name: 'Croatian', value: 'HR' },
              { name: 'Czech', value: 'CS' },
              { name: 'Danish', value: 'DA' },
              { name: 'Dutch', value: 'NL' },
              { name: 'English', value: 'EN' },
              { name: 'English (UK)', value: 'EN-GB' },
              { name: 'Estonian', value: 'ET' },
              { name: 'Finnish', value: 'FI' },
              { name: 'French', value: 'FR' },
              { name: 'Galician', value: 'GL' },
              { name: 'German', value: 'DE' },
              { name: 'Greek', value: 'EL' },
              { name: 'Gujarati', value: 'GU' },
              { name: 'Hebrew', value: 'HE' },
              { name: 'Hindi', value: 'HI' },
              { name: 'Hungarian', value: 'HU' },
              { name: 'Icelandic', value: 'IS' },
              { name: 'Italian', value: 'IT' },
              { name: 'Japanese', value: 'JP' },
              { name: 'Kannada', value: 'KN' },
              { name: 'Korean', value: 'KO' },
              { name: 'Latvian', value: 'LV' },
              { name: 'Lithuanian', value: 'LT' },
              { name: 'Malay', value: 'MS' },
              { name: 'Malayalam', value: 'ML' },
              { name: 'Marathi', value: 'MR' },
              { name: 'Norwegian', value: 'NB' },
              { name: 'Polish', value: 'PL' },
              { name: 'Portuguese (Brazil)', value: 'PT-BR' },
              { name: 'Portuguese (Portugal)', value: 'PT-PT' },
              { name: 'Punjabi', value: 'PA' },
              { name: 'Romanian', value: 'RO' },
              { name: 'Russian', value: 'RU' },
              { name: 'Serbian', value: 'SR' },
              { name: 'Slovak', value: 'SK' },
              { name: 'Slovenian', value: 'SL' },
              { name: 'Spanish', value: 'ES' },
              { name: 'Swedish', value: 'SV' },
              { name: 'Tamil', value: 'TA' },
              { name: 'Telugu', value: 'TE' },
              { name: 'Thai', value: 'TH' },
              { name: 'Turkish', value: 'TR' },
              { name: 'Ukrainian', value: 'UK' },
              { name: 'Vietnamese', value: 'VI' },
            ],
          },
          {
            displayName: 'Livecrawl',
            name: 'livecrawl',
            type: 'options',
            default: '',
            description: 'Deprecated; use Extraction instead. Fetch and return full page content for search results.',
            options: [
              { name: 'None', value: '' },
              { name: 'Web Results Only', value: 'web' },
              { name: 'News Results Only', value: 'news' },
              { name: 'All Results', value: 'all' },
            ],
          },
          {
            displayName: 'Livecrawl Format',
            name: 'livecrawl_formats',
            type: 'options',
            default: 'markdown',
            description:
              'Deprecated; use Extraction (Full Page, Extraction Formats) instead. Format for livecrawled content.',
            displayOptions: {
              show: {
                livecrawl: ['web', 'news', 'all'],
              },
            },
            options: [
              { name: 'HTML', value: 'html' },
              { name: 'Markdown', value: 'markdown' },
            ],
          },
          {
            displayName: 'Offset',
            name: 'offset',
            type: 'number',
            typeOptions: {
              minValue: 0,
              maxValue: 9,
            },
            default: 0,
            description:
              'Pagination offset. Calculated in multiples of count. For example, if count=5 and offset=1, results 5-10 are returned.',
          },
          {
            displayName: 'Safe Search',
            name: 'safesearch',
            type: 'options',
            default: 'moderate',
            description: 'Content moderation filter level',
            options: [
              { name: 'Off', value: 'off' },
              { name: 'Moderate', value: 'moderate' },
              { name: 'Strict', value: 'strict' },
            ],
          },
        ],
      },

      // ====================
      // Contents Parameters
      // ====================
      {
        displayName: 'URLs',
        name: 'urls',
        type: 'string',
        typeOptions: {
          multipleValues: true,
        },
        required: true,
        displayOptions: {
          show: {
            operation: ['contents'],
          },
        },
        default: '',
        placeholder: 'https://example.com',
        description:
          'One or more URLs to extract content from. Use the + button to add multiple URLs, or enter a comma-separated list.',
      },
      {
        displayName: 'Contents Options',
        name: 'contentsOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            operation: ['contents'],
          },
        },
        options: [
          {
            displayName: 'Crawl Timeout',
            name: 'crawl_timeout',
            type: 'number',
            typeOptions: {
              minValue: 1,
              maxValue: 60,
            },
            default: 10,
            description: 'Maximum time in seconds to wait for page content (1-60, default 10)',
          },
          {
            displayName: 'Formats',
            name: 'formats',
            type: 'multiOptions',
            default: ['markdown'],
            description: 'Output formats to return for each URL',
            options: [
              {
                name: 'Markdown',
                value: 'markdown',
                description: 'Clean text content in Markdown format',
              },
              {
                name: 'HTML',
                value: 'html',
                description: 'Full HTML content with layout preserved',
              },
              {
                name: 'Metadata',
                value: 'metadata',
                description: 'Structured metadata (JSON-LD, OpenGraph, Twitter Cards)',
              },
            ],
          },
          {
            displayName: 'Max Age',
            name: 'max_age',
            type: 'number',
            typeOptions: {
              minValue: 0,
            },
            default: 0,
            description:
              'Maximum allowed age of cached content in seconds. Set above 0 to enforce a freshness threshold; leave at 0 or unset for no age limit (use cache regardless of age).',
          },
        ],
      },

      // ====================
      // Research Parameters
      // ====================
      {
        displayName: 'Input',
        name: 'input',
        type: 'string',
        required: true,
        typeOptions: {
          rows: 4,
        },
        displayOptions: {
          show: {
            operation: ['research', 'finance_research'],
          },
        },
        default: '',
        placeholder: 'e.g., Which global cities improved air quality the most over the past 10 years?',
        description: 'The research question or complex query requiring in-depth investigation',
      },
      {
        displayName: 'Research Effort',
        name: 'researchEffort',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['research'],
          },
        },
        default: 'standard',
        description: 'Controls the depth and time spent on research',
        options: [
          {
            name: 'Deep',
            value: 'deep',
            description: 'More time researching and cross-referencing sources',
          },
          {
            name: 'Exhaustive',
            value: 'exhaustive',
            description: 'Most thorough option for complex research tasks',
          },
          {
            name: 'Frontier',
            value: 'frontier',
            description: 'Highest quality tier, requires background mode',
          },
          {
            name: 'Lite',
            value: 'lite',
            description: 'Quick answers for straightforward questions',
          },
          {
            name: 'Standard',
            value: 'standard',
            description: 'Balanced speed and depth for most questions',
          },
        ],
      },
      {
        displayName: 'Background',
        name: 'background',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['research'],
          },
        },
        default: false,
        description:
          'Whether to queue a research task and return a task handle immediately instead of waiting for the result inline. Use Get Research Task or Stream Research Task to retrieve the result.',
      },
      {
        displayName: 'Source Control',
        name: 'sourceControl',
        type: 'collection',
        placeholder: 'Add source control',
        default: {},
        displayOptions: {
          show: {
            operation: ['research'],
          },
        },
        description: 'Beta. Controls which web sources the research agent searches and visits.',
        options: [
          {
            displayName: 'Boost Domains',
            name: 'boost_domains',
            type: 'string',
            typeOptions: {
              multipleValues: true,
            },
            default: '',
            description:
              'Boost results from these domains without excluding other domains (max 500). Cannot combine with Include Domains.',
          },
          {
            displayName: 'Country',
            name: 'country',
            type: 'string',
            default: '',
            placeholder: 'e.g., US',
            description: 'ISO 3166-1 alpha-2 country code to geographically focus web results',
          },
          {
            displayName: 'Exclude Domains',
            name: 'exclude_domains',
            type: 'string',
            typeOptions: {
              multipleValues: true,
            },
            default: '',
            description:
              'Never return results from these domains (max 500). Also blocks browsing. Cannot combine with Include Domains.',
          },
          {
            displayName: 'Freshness',
            name: 'freshness',
            type: 'options',
            default: '',
            description: 'Filter results by recency',
            options: [
              { name: 'Any Time', value: '' },
              { name: 'Past Day', value: 'day' },
              { name: 'Past Month', value: 'month' },
              { name: 'Past Week', value: 'week' },
              { name: 'Past Year', value: 'year' },
            ],
          },
          {
            displayName: 'Include Domains',
            name: 'include_domains',
            type: 'string',
            typeOptions: {
              multipleValues: true,
            },
            default: '',
            description:
              'Only return results from these domains (max 500). Cannot combine with Exclude Domains or Boost Domains.',
          },
        ],
      },
      {
        displayName: 'Output Schema',
        name: 'outputSchema',
        type: 'string',
        typeOptions: {
          rows: 10,
        },
        displayOptions: {
          show: {
            operation: ['research'],
          },
        },
        default: '',
        placeholder: '{"type":"object","properties":{...},"required":[...]}',
        description:
          'Beta. JSON Schema requesting structured JSON output. Supported with standard, deep, and exhaustive effort. Not supported with lite.',
      },
      {
        displayName: 'Finance Research Effort',
        name: 'financeResearchEffort',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['finance_research'],
          },
        },
        default: 'deep',
        description: 'Controls the depth and time spent on financial research',
        options: [
          {
            name: 'Deep',
            value: 'deep',
            description: 'More time researching and cross-referencing sources (default)',
          },
          {
            name: 'Exhaustive',
            value: 'exhaustive',
            description: 'Most thorough option for complex financial research tasks',
          },
        ],
      },
      {
        displayName: 'Query',
        name: 'query',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['answer'],
          },
        },
        default: '',
        placeholder: 'e.g., What is the capital of France?',
        description:
          'The search query used to retrieve relevant web results (max 400 characters). Search operators are not supported.',
      },
      {
        displayName: 'Answer Options',
        name: 'answerOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            operation: ['answer'],
          },
        },
        description: 'Optional filters for the answer operation',
        options: [
          {
            displayName: 'Boost Domains',
            name: 'boost_domains',
            type: 'string',
            typeOptions: {
              multipleValues: true,
            },
            default: '',
            description:
              'Boost results from these domains without excluding other domains (max 500). Cannot combine with Include Domains.',
          },
          {
            displayName: 'Country',
            name: 'country',
            type: 'string',
            default: '',
            placeholder: 'e.g., US',
            description: 'Country code that determines the geographical focus of results',
          },
          {
            displayName: 'Exclude Domains',
            name: 'exclude_domains',
            type: 'string',
            typeOptions: {
              multipleValues: true,
            },
            default: '',
            description: 'Never return results from these domains (max 500). Cannot combine with Include Domains.',
          },
          {
            displayName: 'Freshness',
            name: 'freshness',
            type: 'options',
            default: '',
            description: 'Filter results by recency',
            options: [
              { name: 'Any Time', value: '' },
              { name: 'Past Day', value: 'day' },
              { name: 'Past Month', value: 'month' },
              { name: 'Past Week', value: 'week' },
              { name: 'Past Year', value: 'year' },
            ],
          },
          {
            displayName: 'Include Domains',
            name: 'include_domains',
            type: 'string',
            typeOptions: {
              multipleValues: true,
            },
            default: '',
            description:
              'Only return results from these domains (max 500). Cannot combine with Exclude Domains or Boost Domains.',
          },
          {
            displayName: 'Language',
            name: 'language',
            type: 'string',
            default: '',
            placeholder: 'e.g., EN',
            description: 'BCP 47 language tag for the web results',
          },
          {
            displayName: 'Safe Search',
            name: 'safesearch',
            type: 'options',
            default: '',
            description: 'Content moderation filter level',
            options: [
              { name: 'Default', value: '' },
              { name: 'Off', value: 'off' },
              { name: 'Moderate', value: 'moderate' },
              { name: 'Strict', value: 'strict' },
            ],
          },
        ],
      },
      {
        displayName: 'Task ID',
        name: 'taskId',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['get_research_task', 'stream_research_task'],
          },
        },
        default: '',
        placeholder: 'e.g., abc12345-...',
        description: 'The UUID of the background research task to poll or stream',
      },
      {
        displayName: 'From ID',
        name: 'fromId',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['stream_research_task'],
          },
        },
        default: 0,
        description: 'Resume from a sequence number for reconnection (default 0)',
      },
    ],
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData()
    const returnData: INodeExecutionData[] = []

    // Build the X-Client-Info attribution header once. The header is fully
    // automatic — the plugin name and version are compile-time constants, so
    // there is no user-supplied input to validate or fail on.
    const clientInfoHeader = buildClientInfoHeader({ pluginVersion: PACKAGE_VERSION })

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i)

        if (operation === 'search') {
          const response = await YouDotCom.#executeSearch(this, i, clientInfoHeader)
          const executionData = this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(response), {
            itemData: { item: i },
          })
          returnData.push(...executionData)
        } else if (operation === 'contents') {
          const response = await YouDotCom.#executeContents(this, i, clientInfoHeader)
          const executionData = this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(response), {
            itemData: { item: i },
          })
          returnData.push(...executionData)
        } else if (operation === 'research') {
          const response = await YouDotCom.#executeResearch(this, i, clientInfoHeader)
          const executionData = this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(response), {
            itemData: { item: i },
          })
          returnData.push(...executionData)
        } else if (operation === 'answer') {
          const response = await YouDotCom.#executeAnswer(this, i, clientInfoHeader)
          const executionData = this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(response), {
            itemData: { item: i },
          })
          returnData.push(...executionData)
        } else if (operation === 'finance_research') {
          const response = await YouDotCom.#executeFinanceResearch(this, i, clientInfoHeader)
          const executionData = this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(response), {
            itemData: { item: i },
          })
          returnData.push(...executionData)
        } else if (operation === 'get_research_task') {
          const response = await YouDotCom.#executeGetResearchTask(this, i, clientInfoHeader)
          const executionData = this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(response), {
            itemData: { item: i },
          })
          returnData.push(...executionData)
        } else if (operation === 'stream_research_task') {
          const response = await YouDotCom.#executeStreamResearchTask(this, i, clientInfoHeader)
          const executionData = this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(response), {
            itemData: { item: i },
          })
          returnData.push(...executionData)
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: (error as Error).message,
            },
            pairedItem: { item: i },
          })
          continue
        }
        throw new NodeApiError(this.getNode(), error as JsonObject, {
          itemIndex: i,
        })
      }
    }

    return [returnData]
  }

  /**
   * Execute Search operation
   *
   * @param context - n8n execution context with helper methods
   * @param itemIndex - Index of the current item being processed
   * @returns Search results from You.com API
   */
  static async #executeSearch(
    context: IExecuteFunctions,
    itemIndex: number,
    clientInfoHeader: string,
  ): Promise<IDataObject> {
    const query = context.getNodeParameter('query', itemIndex) as string
    const options = context.getNodeParameter('searchOptions', itemIndex, {}) as Record<string, unknown>

    const {
      include: includeDomains,
      exclude: excludeDomains,
      boost: boostDomains,
    } = resolveDomainFilters(context, options, itemIndex)

    // extraction takes precedence over the deprecated livecrawl/livecrawl_formats.
    const extraction = options.extraction as
      | { extraction_mode?: string; full_page?: { extraction_formats?: string[] } }
      | undefined
    const extractionMode = extraction?.extraction_mode
    const hasExtraction = extractionMode != null

    const body: Record<string, unknown> = { query }

    if (options.count) body.count = options.count as number
    if (options.country) body.country = options.country as string
    if (options.freshness) body.freshness = options.freshness as string
    if (options.language) body.language = options.language as string
    if (options.offset) body.offset = options.offset as number
    if (options.safesearch) body.safesearch = options.safesearch as string
    if (includeDomains.length > 0) body.include_domains = includeDomains
    if (excludeDomains.length > 0) body.exclude_domains = excludeDomains
    if (boostDomains.length > 0) body.boost_domains = boostDomains

    if (hasExtraction) {
      const extractionBody: Record<string, unknown> = { extraction_mode: extractionMode }
      const fullPage = extraction?.full_page
      if (extractionMode === 'full_page' && fullPage?.extraction_formats) {
        extractionBody.full_page = { extraction_formats: fullPage.extraction_formats }
      }
      body.extraction = extractionBody
    } else if (options.livecrawl) {
      // Deprecated; omitted when extraction is set.
      body.livecrawl = options.livecrawl as string
      if (options.livecrawl_formats) body.livecrawl_formats = [options.livecrawl_formats as string]
    }

    // crawl_timeout is invalid alongside extraction_mode == "highlights" (the
    // server rejects it); omit it in that case. Otherwise send when set.
    const stripCrawlTimeout = extractionMode === 'highlights'
    if (options.crawl_timeout != null && !stripCrawlTimeout) {
      body.crawl_timeout = options.crawl_timeout as number
    }

    const rawResponse = await context.helpers.httpRequestWithAuthentication.call(context, 'youDotComApi', {
      method: 'POST',
      url: 'https://ydc-index.io/v1/search',
      headers: {
        'User-Agent': USER_AGENT,
        'X-Client-Info': clientInfoHeader,
      },
      body,
      json: true,
    })

    return rawResponse as IDataObject
  }

  /**
   * Execute Contents operation
   *
   * @param context - n8n execution context with helper methods
   * @param itemIndex - Index of the current item being processed
   * @returns Content extracted from URLs
   */
  static async #executeContents(
    context: IExecuteFunctions,
    itemIndex: number,
    clientInfoHeader: string,
  ): Promise<IDataObject[]> {
    const urlsRaw = context.getNodeParameter('urls', itemIndex)
    const options = context.getNodeParameter('contentsOptions', itemIndex, {}) as Record<string, unknown>

    // Normalize URLs from multi-string or CSV string input
    const urls = toUrlList(urlsRaw)

    if (urls.length === 0) {
      throw new NodeOperationError(context.getNode(), 'At least one URL is required', { itemIndex })
    }

    // Build request body
    const body: Record<string, unknown> = { urls }

    const formats = options.formats as string[] | undefined
    if (formats && formats.length > 0) {
      body.formats = formats
    }
    if (options.crawl_timeout) {
      body.crawl_timeout = options.crawl_timeout
    }
    if (options.max_age != null && (options.max_age as number) > 0) {
      body.max_age = options.max_age
    }

    const rawResponse = await context.helpers.httpRequestWithAuthentication.call(context, 'youDotComApi', {
      method: 'POST',
      url: 'https://ydc-index.io/v1/contents',
      headers: {
        'User-Agent': USER_AGENT,
        'X-Client-Info': clientInfoHeader,
      },
      body,
      json: true,
    })

    return rawResponse as IDataObject[]
  }

  /**
   * Execute Research operation
   *
   * @param context - n8n execution context with helper methods
   * @param itemIndex - Index of the current item being processed
   * @returns Research answer with citations and sources from You.com API
   */
  static async #executeResearch(
    context: IExecuteFunctions,
    itemIndex: number,
    clientInfoHeader: string,
  ): Promise<IDataObject> {
    const input = context.getNodeParameter('input', itemIndex) as string
    const researchEffort = context.getNodeParameter('researchEffort', itemIndex) as string
    const background = context.getNodeParameter('background', itemIndex, false) as boolean

    // frontier effort requires background mode (server returns 422 otherwise)
    if (researchEffort === 'frontier' && !background) {
      throw new NodeOperationError(
        context.getNode(),
        'Frontier research effort requires Background mode. Enable Background or choose a different effort level.',
        { itemIndex },
      )
    }

    const body: Record<string, unknown> = { input, research_effort: researchEffort, background }

    // source_control collection
    const sourceControl = context.getNodeParameter('sourceControl', itemIndex, {}) as Record<string, unknown>
    const scBody: Record<string, unknown> = {}
    const {
      include: includeDomains,
      exclude: excludeDomains,
      boost: boostDomains,
    } = resolveDomainFilters(context, sourceControl, itemIndex)
    if (includeDomains.length > 0) scBody.include_domains = includeDomains
    if (excludeDomains.length > 0) scBody.exclude_domains = excludeDomains
    if (boostDomains.length > 0) scBody.boost_domains = boostDomains
    if (sourceControl.freshness) scBody.freshness = sourceControl.freshness
    if (sourceControl.country) scBody.country = sourceControl.country
    if (Object.keys(scBody).length > 0) body.source_control = scBody

    // output_schema (JSON string → object)
    const outputSchema = context.getNodeParameter('outputSchema', itemIndex, '') as string
    if (outputSchema.trim()) {
      try {
        body.output_schema = JSON.parse(outputSchema)
      } catch {
        throw new NodeOperationError(context.getNode(), 'Output Schema must be valid JSON.', { itemIndex })
      }
    }

    const rawResponse = await context.helpers.httpRequestWithAuthentication.call(context, 'youDotComApi', {
      method: 'POST',
      url: 'https://api.you.com/v1/research',
      headers: {
        'User-Agent': USER_AGENT,
        'X-Client-Info': clientInfoHeader,
      },
      body,
      json: true,
    })

    return rawResponse as IDataObject
  }

  /**
   * Execute Answer operation
   */
  static async #executeAnswer(
    context: IExecuteFunctions,
    itemIndex: number,
    clientInfoHeader: string,
  ): Promise<IDataObject> {
    const query = context.getNodeParameter('query', itemIndex) as string
    const options = context.getNodeParameter('answerOptions', itemIndex, {}) as Record<string, unknown>

    const body: Record<string, unknown> = { query }

    const {
      include: includeDomains,
      exclude: excludeDomains,
      boost: boostDomains,
    } = resolveDomainFilters(context, options, itemIndex)
    if (includeDomains.length > 0) body.include_domains = includeDomains
    if (excludeDomains.length > 0) body.exclude_domains = excludeDomains
    if (boostDomains.length > 0) body.boost_domains = boostDomains
    if (options.freshness) body.freshness = options.freshness
    if (options.country) body.country = options.country
    if (options.language) body.language = options.language
    if (options.safesearch) body.safesearch = options.safesearch

    const rawResponse = await context.helpers.httpRequestWithAuthentication.call(context, 'youDotComApi', {
      method: 'POST',
      url: 'https://api.you.com/v1/answer',
      headers: {
        'User-Agent': USER_AGENT,
        'X-Client-Info': clientInfoHeader,
      },
      body,
      json: true,
    })

    return rawResponse as IDataObject
  }

  /**
   * Execute Finance Research operation
   */
  static async #executeFinanceResearch(
    context: IExecuteFunctions,
    itemIndex: number,
    clientInfoHeader: string,
  ): Promise<IDataObject> {
    const input = context.getNodeParameter('input', itemIndex) as string
    const researchEffort = context.getNodeParameter('financeResearchEffort', itemIndex) as string

    const body: Record<string, unknown> = { input, research_effort: researchEffort }

    const rawResponse = await context.helpers.httpRequestWithAuthentication.call(context, 'youDotComApi', {
      method: 'POST',
      url: 'https://api.you.com/v1/finance_research',
      headers: {
        'User-Agent': USER_AGENT,
        'X-Client-Info': clientInfoHeader,
      },
      body,
      json: true,
    })

    return rawResponse as IDataObject
  }

  /**
   * Execute Get Research Task operation
   */
  static async #executeGetResearchTask(
    context: IExecuteFunctions,
    itemIndex: number,
    clientInfoHeader: string,
  ): Promise<IDataObject> {
    const taskId = context.getNodeParameter('taskId', itemIndex) as string

    const rawResponse = await context.helpers.httpRequestWithAuthentication.call(context, 'youDotComApi', {
      method: 'GET',
      url: `https://api.you.com/v1/research/${encodeURIComponent(taskId)}`,
      headers: {
        'User-Agent': USER_AGENT,
        'X-Client-Info': clientInfoHeader,
      },
      json: true,
    })

    return rawResponse as IDataObject
  }

  /**
   * Execute Stream Research Task operation
   */
  static async #executeStreamResearchTask(
    context: IExecuteFunctions,
    itemIndex: number,
    clientInfoHeader: string,
  ): Promise<IDataObject> {
    const taskId = context.getNodeParameter('taskId', itemIndex) as string
    const fromId = context.getNodeParameter('fromId', itemIndex, 0) as number

    const rawResponse = await context.helpers.httpRequestWithAuthentication.call(context, 'youDotComApi', {
      method: 'GET',
      url: `https://api.you.com/v1/research/${encodeURIComponent(taskId)}/stream`,
      headers: {
        'User-Agent': USER_AGENT,
        'X-Client-Info': clientInfoHeader,
      },
      qs: { from_id: fromId },
      json: false,
      encoding: 'text',
    })

    return { stream: String(rawResponse) } as IDataObject
  }
}
