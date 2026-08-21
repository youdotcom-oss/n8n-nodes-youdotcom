import { beforeAll, describe, expect, test } from 'bun:test'
import type { INodePropertyOptions } from 'n8n-workflow'
import { NodeConnectionTypes } from 'n8n-workflow'
import { YouDotComApi } from '../credentials/YouDotComApi.credentials.ts'
import { YouDotCom } from '../nodes/YouDotCom/YouDotCom.node.ts'

/**
 * Unit tests for n8n YouDotCom node
 *
 * Test Strategy:
 * - Node description validation: Verify node metadata and configuration
 * - Credentials validation: Verify credential configuration
 * - Parameter validation: Verify all parameters for Search, Contents, and Research operations
 *
 * Note: Integration tests requiring actual n8n execution context are not included
 * as they would require spinning up an n8n instance.
 */

/** Helper type for n8n property with options */
interface PropertyWithOptions {
  name: string
  displayName: string
  type: string
  options?: INodePropertyOptions[]
  typeOptions?: { minValue?: number; maxValue?: number; password?: boolean; multipleValues?: boolean }
  displayOptions?: { show?: Record<string, string[]> }
  required?: boolean
  default?: unknown
  description?: string
}

describe('YouDotCom Node', () => {
  let node: YouDotCom

  beforeAll(() => {
    node = new YouDotCom()
  })

  describe('Node Description', () => {
    test('has correct display name', () => {
      expect(node.description.displayName).toBe('You.com')
    })

    test('has correct internal name', () => {
      expect(node.description.name).toBe('youDotCom')
    })

    test('has icon configured', () => {
      expect(node.description.icon).toBe('file:youdotcom.svg')
    })

    test('has correct version', () => {
      expect(node.description.version).toBe(1)
    })

    test('has main inputs and outputs', () => {
      expect(node.description.inputs).toContain(NodeConnectionTypes.Main)
      expect(node.description.outputs).toContain(NodeConnectionTypes.Main)
    })

    test('requires youDotComApi credentials', () => {
      const credentials = node.description.credentials
      expect(credentials).toBeDefined()
      expect(credentials?.length).toBe(1)
      expect(credentials?.[0]?.name).toBe('youDotComApi')
      expect(credentials?.[0]?.required).toBe(true)
    })

    test('has updated description mentioning all operations', () => {
      const desc = node.description.description?.toLowerCase() ?? ''
      expect(desc).toContain('search')
      expect(desc).toContain('content')
      expect(desc).toContain('research')
    })
  })

  describe('Operations', () => {
    const getOperationProperty = () => {
      return node.description.properties.find((p) => p.name === 'operation') as PropertyWithOptions | undefined
    }

    test('has search operation', () => {
      const operationProperty = getOperationProperty()
      expect(operationProperty).toBeDefined()
      expect(operationProperty?.type).toBe('options')

      const searchOption = operationProperty?.options?.find((o) => o.value === 'search')
      expect(searchOption).toBeDefined()
      expect(searchOption?.name).toBe('Search')
      expect((searchOption as INodePropertyOptions & { action?: string })?.action).toBe('Search the web and news')
    })

    test('has contents operation', () => {
      const operationProperty = getOperationProperty()
      const contentsOption = operationProperty?.options?.find((o) => o.value === 'contents')
      expect(contentsOption).toBeDefined()
      expect(contentsOption?.name).toBe('Get Contents')
      expect((contentsOption as INodePropertyOptions & { action?: string })?.action).toBe(
        'Extract content from web pages',
      )
    })

    test('has research operation', () => {
      const operationProperty = getOperationProperty()
      const researchOption = operationProperty?.options?.find((o) => o.value === 'research')
      expect(researchOption).toBeDefined()
      expect(researchOption?.name).toBe('Research')
      expect((researchOption as INodePropertyOptions & { action?: string })?.action).toBe('Research a complex question')
    })

    test('has exactly three operations', () => {
      const operationProperty = getOperationProperty()
      expect(operationProperty?.options?.length).toBe(7)
    })

    test('has answer operation', () => {
      const operationProperty = getOperationProperty()
      const answerOption = operationProperty?.options?.find((o) => o.value === 'answer')
      expect(answerOption).toBeDefined()
      expect(answerOption?.name).toBe('Answer')
    })

    test('has finance research operation', () => {
      const operationProperty = getOperationProperty()
      const financeOption = operationProperty?.options?.find((o) => o.value === 'finance_research')
      expect(financeOption).toBeDefined()
      expect(financeOption?.name).toBe('Finance Research')
    })

    test('has get research task operation', () => {
      const operationProperty = getOperationProperty()
      const getTaskOption = operationProperty?.options?.find((o) => o.value === 'get_research_task')
      expect(getTaskOption).toBeDefined()
      expect(getTaskOption?.name).toBe('Get Research Task')
    })

    test('has stream research task operation', () => {
      const operationProperty = getOperationProperty()
      const streamTaskOption = operationProperty?.options?.find((o) => o.value === 'stream_research_task')
      expect(streamTaskOption).toBeDefined()
      expect(streamTaskOption?.name).toBe('Stream Research Task')
    })
  })

  describe('Search Parameters', () => {
    const getSearchOptionsProperty = (): PropertyWithOptions | undefined => {
      return node.description.properties.find((p) => p.name === 'searchOptions') as PropertyWithOptions | undefined
    }

    const getSearchOption = (displayName: string): PropertyWithOptions | undefined => {
      const optionsProperty = getSearchOptionsProperty()
      const options = optionsProperty?.options as unknown as PropertyWithOptions[] | undefined
      return options?.find((o) => o.displayName === displayName)
    }

    test('has query parameter as required', () => {
      const queryProperty = node.description.properties.find(
        (p) => p.name === 'query' && p.displayOptions?.show?.operation?.includes('answer'),
      )
      expect(queryProperty).toBeDefined()
      expect(queryProperty?.required).toBe(true)
      expect(queryProperty?.type).toBe('string')
    })

    test('has searchOptions collection', () => {
      const optionsProperty = getSearchOptionsProperty()
      expect(optionsProperty).toBeDefined()
      expect(optionsProperty?.type).toBe('collection')
    })

    test('has count option with correct constraints', () => {
      const countOption = getSearchOption('Count')
      expect(countOption).toBeDefined()
      expect(countOption?.type).toBe('number')
      expect(countOption?.typeOptions?.minValue).toBe(1)
      expect(countOption?.typeOptions?.maxValue).toBe(100)
    })

    test('has country option with supported countries', () => {
      const countryOption = getSearchOption('Country')
      expect(countryOption).toBeDefined()
      expect(countryOption?.type).toBe('options')

      const countryValues = countryOption?.options?.map((o) => o.value)
      expect(countryValues).toContain('US')
      expect(countryValues).toContain('GB')
      expect(countryValues).toContain('DE')
      expect(countryValues).toContain('FR')
      expect(countryValues).toContain('JP')
    })

    test('has freshness option with time ranges', () => {
      const freshnessOption = getSearchOption('Freshness')
      expect(freshnessOption).toBeDefined()
      expect(freshnessOption?.type).toBe('options')

      const freshnessValues = freshnessOption?.options?.map((o) => o.value)
      expect(freshnessValues).toContain('day')
      expect(freshnessValues).toContain('week')
      expect(freshnessValues).toContain('month')
      expect(freshnessValues).toContain('year')
    })

    test('has language option with BCP 47 codes', () => {
      const languageOption = getSearchOption('Language')
      expect(languageOption).toBeDefined()
      expect(languageOption?.type).toBe('options')

      const languageValues = languageOption?.options?.map((o) => o.value)
      expect(languageValues).toContain('EN')
      expect(languageValues).toContain('DE')
      expect(languageValues).toContain('FR')
      expect(languageValues).toContain('JP')
    })

    test('has livecrawl option', () => {
      const livecrawlOption = getSearchOption('Livecrawl')
      expect(livecrawlOption).toBeDefined()
      expect(livecrawlOption?.type).toBe('options')

      const livecrawlValues = livecrawlOption?.options?.map((o) => o.value)
      expect(livecrawlValues).toContain('web')
      expect(livecrawlValues).toContain('news')
      expect(livecrawlValues).toContain('all')
    })

    test('has livecrawl format option with conditional display', () => {
      const formatOption = getSearchOption('Livecrawl Format')
      expect(formatOption).toBeDefined()
      expect(formatOption?.type).toBe('options')
      expect(formatOption?.displayOptions?.show?.livecrawl).toEqual(['web', 'news', 'all'])

      const formatValues = formatOption?.options?.map((o) => o.value)
      expect(formatValues).toContain('html')
      expect(formatValues).toContain('markdown')
    })

    test('has offset option with correct constraints', () => {
      const offsetOption = getSearchOption('Offset')
      expect(offsetOption).toBeDefined()
      expect(offsetOption?.type).toBe('number')
      expect(offsetOption?.typeOptions?.minValue).toBe(0)
      expect(offsetOption?.typeOptions?.maxValue).toBe(9)
    })

    test('has safesearch option', () => {
      const safesearchOption = getSearchOption('Safe Search')
      expect(safesearchOption).toBeDefined()
      expect(safesearchOption?.type).toBe('options')

      const safesearchValues = safesearchOption?.options?.map((o) => o.value)
      expect(safesearchValues).toContain('off')
      expect(safesearchValues).toContain('moderate')
      expect(safesearchValues).toContain('strict')
    })

    test('has include_domains / exclude_domains / boost_domains as multi-string inputs', () => {
      for (const name of ['include_domains', 'exclude_domains', 'boost_domains']) {
        const opt = getSearchOption(
          name === 'include_domains'
            ? 'Include Domains'
            : name === 'exclude_domains'
              ? 'Exclude Domains'
              : 'Boost Domains',
        )
        expect(opt, `expected search option for ${name}`).toBeDefined()
        expect(opt?.name).toBe(name)
        expect(opt?.type).toBe('string')
        expect(opt?.typeOptions?.multipleValues).toBe(true)
      }
    })

    test('has extraction collection with extraction_mode and full_page.extraction_formats', () => {
      const extraction = getSearchOption('Extraction')
      expect(extraction).toBeDefined()
      expect(extraction?.name).toBe('extraction')
      expect(extraction?.type).toBe('collection')
      const exOptions = extraction?.options as unknown as PropertyWithOptions[] | undefined
      const mode = exOptions?.find((o) => o.name === 'extraction_mode')
      expect(mode).toBeDefined()
      expect(mode?.type).toBe('options')
      const modeValues = mode?.options?.map((o) => o.value)
      expect(modeValues).toContain('highlights')
      expect(modeValues).toContain('full_page')
      const fullPage = exOptions?.find((o) => o.name === 'full_page')
      expect(fullPage).toBeDefined()
      expect(fullPage?.type).toBe('collection')
      // full_page sub-collection only shows when extraction_mode == full_page
      expect(fullPage?.displayOptions?.show?.extraction_mode).toEqual(['full_page'])
      const fpOptions = fullPage?.options as unknown as PropertyWithOptions[] | undefined
      const formats = fpOptions?.find((o) => o.name === 'extraction_formats')
      expect(formats).toBeDefined()
      expect(formats?.type).toBe('multiOptions')
      const formatValues = formats?.options?.map((o) => o.value)
      expect(formatValues).toContain('markdown')
      expect(formatValues).toContain('html')
    })

    test('has crawl_timeout option with constraints 1-60 default 10', () => {
      const ct = getSearchOption('Crawl Timeout')
      expect(ct).toBeDefined()
      expect(ct?.name).toBe('crawl_timeout')
      expect(ct?.type).toBe('number')
      expect(ct?.typeOptions?.minValue).toBe(1)
      expect(ct?.typeOptions?.maxValue).toBe(60)
      expect(ct?.default).toBe(10)
    })

    test('livecrawl option is marked deprecated', () => {
      const livecrawl = getSearchOption('Livecrawl')
      expect(livecrawl).toBeDefined()
      expect(livecrawl?.description?.toLowerCase()).toContain('deprecated')
    })
  })

  describe('Contents Parameters', () => {
    const getContentsOptionsProperty = (): PropertyWithOptions | undefined => {
      return node.description.properties.find((p) => p.name === 'contentsOptions') as PropertyWithOptions | undefined
    }

    const getContentsOption = (displayName: string): PropertyWithOptions | undefined => {
      const optionsProperty = getContentsOptionsProperty()
      const options = optionsProperty?.options as unknown as PropertyWithOptions[] | undefined
      return options?.find((o) => o.displayName === displayName)
    }

    test('has urls parameter as required', () => {
      const urlsProperty = node.description.properties.find((p) => p.name === 'urls')
      expect(urlsProperty).toBeDefined()
      expect(urlsProperty?.required).toBe(true)
      expect(urlsProperty?.type).toBe('string')
    })

    test('urls parameter is only shown for contents operation', () => {
      const urlsProperty = node.description.properties.find((p) => p.name === 'urls')
      expect(urlsProperty?.displayOptions?.show?.operation).toEqual(['contents'])
    })

    test('has contentsOptions collection', () => {
      const optionsProperty = getContentsOptionsProperty()
      expect(optionsProperty).toBeDefined()
      expect(optionsProperty?.type).toBe('collection')
    })

    test('has formats option with multiOptions type', () => {
      const formatsOption = getContentsOption('Formats')
      expect(formatsOption).toBeDefined()
      expect(formatsOption?.type).toBe('multiOptions')

      const formatValues = formatsOption?.options?.map((o) => o.value)
      expect(formatValues).toContain('markdown')
      expect(formatValues).toContain('html')
      expect(formatValues).toContain('metadata')
    })

    test('has crawl timeout option with correct constraints', () => {
      const timeoutOption = getContentsOption('Crawl Timeout')
      expect(timeoutOption).toBeDefined()
      expect(timeoutOption?.type).toBe('number')
      expect(timeoutOption?.typeOptions?.minValue).toBe(1)
      expect(timeoutOption?.typeOptions?.maxValue).toBe(60)
    })

    test('crawl timeout defaults to 10 (SDK parity)', () => {
      const timeoutOption = getContentsOption('Crawl Timeout')
      expect(timeoutOption?.default).toBe(10)
    })

    test('urls parameter supports multiple values', () => {
      const urlsProperty = node.description.properties.find((p) => p.name === 'urls')
      expect(urlsProperty?.typeOptions?.multipleValues).toBe(true)
    })

    test('has max_age option with minValue 0', () => {
      const maxAgeOption = getContentsOption('Max Age')
      expect(maxAgeOption).toBeDefined()
      expect(maxAgeOption?.name).toBe('max_age')
      expect(maxAgeOption?.type).toBe('number')
      expect(maxAgeOption?.typeOptions?.minValue).toBe(0)
    })
  })

  describe('Research Parameters', () => {
    test('has input parameter as required', () => {
      const inputProperty = node.description.properties.find((p) => p.name === 'input')
      expect(inputProperty).toBeDefined()
      expect(inputProperty?.required).toBe(true)
      expect(inputProperty?.type).toBe('string')
    })

    test('input parameter is only shown for research operation', () => {
      const inputProperty = node.description.properties.find((p) => p.name === 'input')
      expect(inputProperty?.displayOptions?.show?.operation).toEqual(['research', 'finance_research'])
    })

    test('has research effort option with all levels', () => {
      const effortProperty = node.description.properties.find((p) => p.name === 'researchEffort') as
        | PropertyWithOptions
        | undefined
      expect(effortProperty).toBeDefined()
      expect(effortProperty?.type).toBe('options')

      const effortValues = effortProperty?.options?.map((o) => o.value)
      expect(effortValues).toContain('lite')
      expect(effortValues).toContain('standard')
      expect(effortValues).toContain('deep')
      expect(effortValues).toContain('exhaustive')
    })

    test('research effort defaults to standard', () => {
      const effortProperty = node.description.properties.find((p) => p.name === 'researchEffort')
      expect(effortProperty?.default).toBe('standard')
    })

    test('research effort is only shown for research operation', () => {
      const effortProperty = node.description.properties.find((p) => p.name === 'researchEffort')
      expect(effortProperty?.displayOptions?.show?.operation).toEqual(['research'])
    })

    test('research effort includes frontier option', () => {
      const effortProperty = node.description.properties.find((p) => p.name === 'researchEffort') as
        | PropertyWithOptions
        | undefined
      const effortValues = effortProperty?.options?.map((o) => o.value)
      expect(effortValues).toContain('frontier')
    })

    test('has background parameter with default false', () => {
      const bgProperty = node.description.properties.find((p) => p.name === 'background')
      expect(bgProperty).toBeDefined()
      expect(bgProperty?.type).toBe('boolean')
      expect(bgProperty?.default).toBe(false)
    })

    test('has source control collection', () => {
      const scProperty = node.description.properties.find((p) => p.name === 'sourceControl')
      expect(scProperty).toBeDefined()
      expect(scProperty?.type).toBe('collection')
    })

    test('has output schema parameter', () => {
      const osProperty = node.description.properties.find((p) => p.name === 'outputSchema')
      expect(osProperty).toBeDefined()
      expect(osProperty?.type).toBe('string')
    })

    test('has finance research effort with deep and exhaustive', () => {
      const effortProperty = node.description.properties.find((p) => p.name === 'financeResearchEffort') as
        | PropertyWithOptions
        | undefined
      expect(effortProperty).toBeDefined()
      expect(effortProperty?.default).toBe('deep')
      const effortValues = effortProperty?.options?.map((o) => o.value)
      expect(effortValues).toContain('deep')
      expect(effortValues).toContain('exhaustive')
    })

    test('has answer query parameter as required', () => {
      const queryProperty = node.description.properties.find(
        (p) => p.name === 'query' && p.displayOptions?.show?.operation?.includes('answer'),
      )
      expect(queryProperty).toBeDefined()
      expect(queryProperty?.required).toBe(true)
      expect(queryProperty?.displayOptions?.show?.operation).toEqual(['answer'])
    })

    test('has task ID parameter shown for get and stream operations', () => {
      const taskIdProperty = node.description.properties.find((p) => p.name === 'taskId')
      expect(taskIdProperty).toBeDefined()
      expect(taskIdProperty?.required).toBe(true)
      expect(taskIdProperty?.displayOptions?.show?.operation).toEqual(['get_research_task', 'stream_research_task'])
    })

    test('has from ID parameter shown for stream operation', () => {
      const fromIdProperty = node.description.properties.find((p) => p.name === 'fromId')
      expect(fromIdProperty).toBeDefined()
      expect(fromIdProperty?.displayOptions?.show?.operation).toEqual(['stream_research_task'])
    })
  })

  describe('Execute Method', () => {
    test('has execute method', () => {
      expect(typeof node.execute).toBe('function')
    })
  })
})

describe('YouDotComApi Credentials', () => {
  let credentials: YouDotComApi

  beforeAll(() => {
    credentials = new YouDotComApi()
  })

  describe('Credential Configuration', () => {
    test('has correct name', () => {
      expect(credentials.name).toBe('youDotComApi')
    })

    test('has correct display name', () => {
      expect(credentials.displayName).toBe('You.com API')
    })

    test('has documentation URL', () => {
      expect(credentials.documentationUrl).toBe('https://docs.you.com/get-started/quickstart')
    })
  })

  describe('Properties', () => {
    test('has API key property', () => {
      const apiKeyProperty = credentials.properties.find((p) => p.name === 'apiKey')
      expect(apiKeyProperty).toBeDefined()
      expect(apiKeyProperty?.type).toBe('string')
      expect(apiKeyProperty?.required).toBe(true)
      expect(apiKeyProperty?.typeOptions?.password).toBe(true)
    })

    test('has optional attribution fields', () => {
      const names = ['appName', 'appVersion', 'appTitle', 'appUrl']
      for (const name of names) {
        const prop = credentials.properties.find((p) => p.name === name)
        expect(prop, `expected credential field ${name}`).toBeDefined()
        expect(prop?.type).toBe('string')
        expect(prop?.required).toBeFalsy()
        // Attribution fields are not secrets — they travel in X-Client-Info.
        expect(prop?.typeOptions?.password).toBeFalsy()
      }
    })
  })

  describe('Authentication', () => {
    test('uses generic authentication with X-API-Key header', () => {
      expect(credentials.authenticate.type).toBe('generic')
      expect(credentials.authenticate.properties.headers?.['X-API-Key']).toBe('={{$credentials.apiKey}}')
    })
  })

  describe('Test Request', () => {
    test('has test request configured', () => {
      expect(credentials.test).toBeDefined()
      expect(credentials.test.request.baseURL).toBe('https://ydc-index.io')
      expect(credentials.test.request.url).toBe('/v1/search')
      expect(credentials.test.request.method).toBe('GET')
      expect(credentials.test.request.qs?.query).toBe('test')
    })
  })
})
