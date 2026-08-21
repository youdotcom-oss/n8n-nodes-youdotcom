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
const PACKAGE_VERSION = '0.4.0'

/** User-Agent string for API requests */
const USER_AGENT = `n8n-nodes-youdotcom/${PACKAGE_VERSION} (https://github.com/youdotcom-oss/n8n-nodes-youdotcom)`

/** Normalize a multi-string n8n value (string | string[] | undefined) to a trimmed string[]. */
function toStringArray(value: unknown): string[] {
  if (value == null) return []
  const arr = Array.isArray(value) ? value : [value]
  return arr.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())
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
    usableAsTool: true,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Search the web, extract content from URLs, and run multi-step research using You.com APIs',
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
            name: 'Get Contents',
            value: 'contents',
            description: 'Extract content from one or more URLs',
            action: 'Extract content from web pages',
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
        required: true,
        displayOptions: {
          show: {
            operation: ['contents'],
          },
        },
        default: '',
        placeholder: 'https://example.com, https://example.org',
        description: 'Comma-separated list of URLs to extract content from',
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
            displayName: 'Crawl Timeout',
            name: 'crawl_timeout',
            type: 'number',
            typeOptions: {
              minValue: 1,
              maxValue: 60,
            },
            default: 30,
            description: 'Timeout in seconds for page crawling (1-60)',
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
            operation: ['research'],
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
            name: 'Lite',
            value: 'lite',
            description: 'Quick answers for straightforward questions',
          },
          {
            name: 'Standard',
            value: 'standard',
            description: 'Balanced speed and depth for most questions',
          },
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
        ],
      },
    ],
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData()
    const returnData: INodeExecutionData[] = []

    // Build the X-Client-Info attribution header once from the credential.
    // The builder is permissive on the version-without-name pairing (it drops
    // client=), so enforce that guard here, mirroring the Python SDK's You.__init__.
    const credentials = await this.getCredentials('youDotComApi')
    const appName = (credentials.appName as string | undefined) ?? ''
    const appVersion = (credentials.appVersion as string | undefined) ?? ''
    if (appVersion && !appName) {
      throw new NodeOperationError(
        this.getNode(),
        'App Version requires App Name. The X-Client-Info header emits them together as client=<name>/<version>, so a version with no name has nowhere to go.',
      )
    }
    const clientInfoHeader = buildClientInfoHeader({
      appName,
      appVersion,
      appTitle: (credentials.appTitle as string | undefined) ?? '',
      appUrl: (credentials.appUrl as string | undefined) ?? '',
    })

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
    const options = context.getNodeParameter('searchOptions', itemIndex) as Record<string, unknown>

    // Domain filters (multi-string). include_domains cannot combine with
    // exclude_domains or boost_domains (the API returns 422); exclude can
    // combine with boost. Block at execution rather than round-tripping a 422.
    const includeDomains = toStringArray(options.include_domains)
    const excludeDomains = toStringArray(options.exclude_domains)
    const boostDomains = toStringArray(options.boost_domains)
    if (includeDomains.length > 0 && (excludeDomains.length > 0 || boostDomains.length > 0)) {
      throw new NodeOperationError(
        context.getNode(),
        'Include Domains cannot be combined with Exclude Domains or Boost Domains.',
        { itemIndex },
      )
    }

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
    if (options.offset !== undefined) body.offset = options.offset as number
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
    const urlsString = context.getNodeParameter('urls', itemIndex) as string
    const options = context.getNodeParameter('contentsOptions', itemIndex) as Record<string, unknown>

    // Parse comma-separated URLs and trim whitespace
    const urls = urlsString
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)

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

    const body: Record<string, string> = { input }

    if (researchEffort) {
      body.research_effort = researchEffort
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
}
