import { describe, expect, mock, test } from 'bun:test'
import type { IExecuteFunctions, INode, IDataObject, INodeExecutionData } from 'n8n-workflow'
import { YouDotCom } from '../nodes/YouDotCom/YouDotCom.node.ts'

/**
 * Unit tests for the execute methods' request body construction and
 * validation logic.
 *
 * These tests mock the n8n execution context to capture the request body
 * that each operation builds, verifying:
 * - Correct fields are sent/omitted for each operation
 * - Domain mutual exclusion throws NodeOperationError
 * - Frontier effort without background throws
 * - Invalid output_schema JSON throws
 * - Empty URLs throws
 * - crawl_timeout is stripped for highlights extraction
 * - extraction takes precedence over deprecated livecrawl
 */

/** Mock node for error construction */
const mockNode: INode = {
  id: 'test-node',
  name: 'You.com',
  type: '@youdotcom-oss/n8n-nodes-youdotcom.youDotCom',
  typeVersion: 1,
  position: [0, 0],
  parameters: {},
}

/** Create a mock IExecuteFunctions that captures the HTTP request */
function createMockContext(params: Record<string, unknown>): {
  context: IExecuteFunctions
  capturedRequests: Array<{ url: string; method: string; body: unknown; qs: unknown; headers: Record<string, string> }>
} {
  const capturedRequests: Array<{ url: string; method: string; body: unknown; qs: unknown; headers: Record<string, string> }> = []

  const credentials = params.__credentials ?? {}

  const context = {
    getNode: () => mockNode,
    getNodeParameter: (name: string, _index: number, defaultValue?: unknown) => {
      if (name in params) return params[name]
      return defaultValue
    },
    getInputData: () => [{ json: {} as IDataObject }],
    getCredentials: async () => credentials,
    continueOnFail: () => false,
    helpers: {
      httpRequestWithAuthentication: mock(async function (this: IExecuteFunctions, _credName: string, opts: Record<string, unknown>) {
        capturedRequests.push({
          url: opts.url as string,
          method: opts.method as string,
          body: opts.body,
          qs: opts.qs,
          headers: opts.headers as Record<string, string>,
        })
        // Stream operation uses json: false, encoding: 'text' — returns a string.
        if (opts.json === false || opts.encoding === 'text') {
          return 'data: mock\nevent: message\n\n'
        }
        // Contents operation returns an array; all others return a single object.
        const url = opts.url as string
        if (url.includes('/contents')) {
          return [{ mock: true }]
        }
        return { mock: true }
      }),
      constructExecutionMetaData: (data: unknown[]) => {
        if (Array.isArray(data)) return data.map((json) => ({ json: json as IDataObject }))
        return [{ json: data as IDataObject }]
      },
      returnJsonArray: (data: unknown) => {
        if (Array.isArray(data)) return data as IDataObject[]
        return [data as IDataObject]
      },
    },
  } as unknown as IExecuteFunctions

  return { context, capturedRequests }
}

type CapturedRequest = { url: string; method: string; body: unknown; qs: unknown; headers: Record<string, string> }

/** Helper: run execute() with mocked context and capture requests */
async function runExecute(params: Record<string, unknown>): Promise<CapturedRequest[]> {
  const { context, capturedRequests } = createMockContext(params)
  const node = new YouDotCom()
  await node.execute.call(context)
  return capturedRequests
}

describe('Execute — Search request body', () => {
  test('sends POST with query in body', async () => {
    const requests = await runExecute({
      operation: 'search',
      query: 'test query',
      searchOptions: {},
      __credentials: {},
    })
    expect(requests.length).toBe(1)
    expect(requests[0].method).toBe('POST')
    expect(requests[0].url).toBe('https://ydc-index.io/v1/search')
    expect((requests[0].body as Record<string, unknown>).query).toBe('test query')
  })

  test('includes domain filters when set', async () => {
    const requests = await runExecute({
      operation: 'search',
      query: 'test',
      searchOptions: {
        include_domains: ['example.com', 'test.com'],
      },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.include_domains).toEqual(['example.com', 'test.com'])
  })

  test('includes crawl_timeout when set without highlights extraction', async () => {
    const requests = await runExecute({
      operation: 'search',
      query: 'test',
      searchOptions: { crawl_timeout: 30 },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.crawl_timeout).toBe(30)
  })

  test('strips crawl_timeout when extraction mode is highlights', async () => {
    const requests = await runExecute({
      operation: 'search',
      query: 'test',
      searchOptions: {
        crawl_timeout: 30,
        extraction: { extraction_mode: 'highlights' },
      },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.crawl_timeout).toBeUndefined()
    expect((body.extraction as Record<string, unknown>).extraction_mode).toBe('highlights')
  })

  test('sends extraction full_page with extraction_formats', async () => {
    const requests = await runExecute({
      operation: 'search',
      query: 'test',
      searchOptions: {
        extraction: {
          extraction_mode: 'full_page',
          full_page: { extraction_formats: ['markdown'] },
        },
        crawl_timeout: 15,
      },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    const extraction = body.extraction as Record<string, unknown>
    expect(extraction.extraction_mode).toBe('full_page')
    expect((extraction.full_page as Record<string, unknown>).extraction_formats).toEqual(['markdown'])
    expect(body.crawl_timeout).toBe(15)
  })

  test('omits livecrawl when extraction is set', async () => {
    const requests = await runExecute({
      operation: 'search',
      query: 'test',
      searchOptions: {
        livecrawl: 'web',
        livecrawl_formats: 'markdown',
        extraction: { extraction_mode: 'highlights' },
      },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.livecrawl).toBeUndefined()
    expect(body.livecrawl_formats).toBeUndefined()
    expect(body.extraction).toBeDefined()
  })

  test('sends livecrawl when extraction is not set', async () => {
    const requests = await runExecute({
      operation: 'search',
      query: 'test',
      searchOptions: {
        livecrawl: 'web',
        livecrawl_formats: 'markdown',
      },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.livecrawl).toBe('web')
    expect(body.livecrawl_formats).toEqual(['markdown'])
  })

  test('includes optional search params when set', async () => {
    const requests = await runExecute({
      operation: 'search',
      query: 'test',
      searchOptions: {
        count: 10,
        country: 'US',
        freshness: 'day',
        language: 'EN',
        offset: 5,
        safesearch: 'moderate',
      },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.count).toBe(10)
    expect(body.country).toBe('US')
    expect(body.freshness).toBe('day')
    expect(body.language).toBe('EN')
    expect(body.offset).toBe(5)
    expect(body.safesearch).toBe('moderate')
  })

  test('omits optional search params when not set', async () => {
    const requests = await runExecute({
      operation: 'search',
      query: 'test',
      searchOptions: {},
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.count).toBeUndefined()
    expect(body.country).toBeUndefined()
    expect(body.freshness).toBeUndefined()
    expect(body.language).toBeUndefined()
    expect(body.offset).toBeUndefined()
    expect(body.safesearch).toBeUndefined()
  })
})

describe('Execute — Search domain mutual exclusion', () => {
  test('throws when include_domains combines with exclude_domains', async () => {
    await expect(
      runExecute({
        operation: 'search',
        query: 'test',
        searchOptions: {
          include_domains: ['a.com'],
          exclude_domains: ['b.com'],
        },
        __credentials: {},
      }),
    ).rejects.toThrow('Include Domains cannot be combined')
  })

  test('throws when include_domains combines with boost_domains', async () => {
    await expect(
      runExecute({
        operation: 'search',
        query: 'test',
        searchOptions: {
          include_domains: ['a.com'],
          boost_domains: ['c.com'],
        },
        __credentials: {},
      }),
    ).rejects.toThrow('Include Domains cannot be combined')
  })

  test('allows exclude_domains with boost_domains', async () => {
    const requests = await runExecute({
      operation: 'search',
      query: 'test',
      searchOptions: {
        exclude_domains: ['b.com'],
        boost_domains: ['c.com'],
      },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.exclude_domains).toEqual(['b.com'])
    expect(body.boost_domains).toEqual(['c.com'])
  })
})

describe('Execute — Contents request body', () => {
  test('sends POST with urls array', async () => {
    const requests = await runExecute({
      operation: 'contents',
      urls: ['https://a.com', 'https://b.com'],
      contentsOptions: {},
      __credentials: {},
    })
    expect(requests[0].method).toBe('POST')
    expect(requests[0].url).toBe('https://ydc-index.io/v1/contents')
    const body = requests[0].body as Record<string, unknown>
    expect(body.urls).toEqual(['https://a.com', 'https://b.com'])
  })

  test('splits CSV string into array', async () => {
    const requests = await runExecute({
      operation: 'contents',
      urls: 'https://a.com, https://b.com',
      contentsOptions: {},
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.urls).toEqual(['https://a.com', 'https://b.com'])
  })

  test('omits max_age when 0 (default, means no limit)', async () => {
    const requests = await runExecute({
      operation: 'contents',
      urls: ['https://a.com'],
      contentsOptions: { max_age: 0 },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.max_age).toBeUndefined()
  })

  test('includes max_age when greater than 0', async () => {
    const requests = await runExecute({
      operation: 'contents',
      urls: ['https://a.com'],
      contentsOptions: { max_age: 3600 },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.max_age).toBe(3600)
  })

  test('includes crawl_timeout when set', async () => {
    const requests = await runExecute({
      operation: 'contents',
      urls: ['https://a.com'],
      contentsOptions: { crawl_timeout: 30 },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.crawl_timeout).toBe(30)
  })

  test('includes formats when set', async () => {
    const requests = await runExecute({
      operation: 'contents',
      urls: ['https://a.com'],
      contentsOptions: { formats: ['markdown', 'html'] },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.formats).toEqual(['markdown', 'html'])
  })

  test('omits formats when not set', async () => {
    const requests = await runExecute({
      operation: 'contents',
      urls: ['https://a.com'],
      contentsOptions: {},
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.formats).toBeUndefined()
  })

  test('throws when no URLs provided', async () => {
    await expect(
      runExecute({
        operation: 'contents',
        urls: '',
        contentsOptions: {},
        __credentials: {},
      }),
    ).rejects.toThrow('At least one URL is required')
  })
})

describe('Execute — Research request body', () => {
  test('sends POST with input, research_effort, and background', async () => {
    const requests = await runExecute({
      operation: 'research',
      input: 'What is AI?',
      researchEffort: 'standard',
      background: false,
      sourceControl: {},
      outputSchema: '',
      __credentials: {},
    })
    expect(requests[0].method).toBe('POST')
    expect(requests[0].url).toBe('https://api.you.com/v1/research')
    const body = requests[0].body as Record<string, unknown>
    expect(body.input).toBe('What is AI?')
    expect(body.research_effort).toBe('standard')
    expect(body.background).toBe(false)
  })

  test('throws when frontier effort is set without background', async () => {
    await expect(
      runExecute({
        operation: 'research',
        input: 'What is AI?',
        researchEffort: 'frontier',
        background: false,
        sourceControl: {},
        outputSchema: '',
        __credentials: {},
      }),
    ).rejects.toThrow('Frontier research effort requires Background mode')
  })

  test('allows frontier effort with background enabled', async () => {
    const requests = await runExecute({
      operation: 'research',
      input: 'What is AI?',
      researchEffort: 'frontier',
      background: true,
      sourceControl: {},
      outputSchema: '',
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.research_effort).toBe('frontier')
    expect(body.background).toBe(true)
  })

  test('includes source_control when set', async () => {
    const requests = await runExecute({
      operation: 'research',
      input: 'What is AI?',
      researchEffort: 'standard',
      background: false,
      sourceControl: {
        include_domains: ['arxiv.org'],
        freshness: 'month',
        country: 'US',
      },
      outputSchema: '',
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    const sc = body.source_control as Record<string, unknown>
    expect(sc.include_domains).toEqual(['arxiv.org'])
    expect(sc.freshness).toBe('month')
    expect(sc.country).toBe('US')
  })

  test('omits source_control when empty', async () => {
    const requests = await runExecute({
      operation: 'research',
      input: 'What is AI?',
      researchEffort: 'standard',
      background: false,
      sourceControl: {},
      outputSchema: '',
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.source_control).toBeUndefined()
  })

  test('includes output_schema when valid JSON is provided', async () => {
    const requests = await runExecute({
      operation: 'research',
      input: 'What is AI?',
      researchEffort: 'standard',
      background: false,
      sourceControl: {},
      outputSchema: '{"type":"object","properties":{"answer":{"type":"string"}}}',
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.output_schema).toEqual({ type: 'object', properties: { answer: { type: 'string' } } })
  })

  test('throws when output_schema is invalid JSON', async () => {
    await expect(
      runExecute({
        operation: 'research',
        input: 'What is AI?',
        researchEffort: 'standard',
        background: false,
        sourceControl: {},
        outputSchema: '{invalid json}',
        __credentials: {},
      }),
    ).rejects.toThrow('Output Schema must be valid JSON')
  })

  test('throws on source_control domain mutual exclusion', async () => {
    await expect(
      runExecute({
        operation: 'research',
        input: 'What is AI?',
        researchEffort: 'standard',
        background: false,
        sourceControl: {
          include_domains: ['a.com'],
          exclude_domains: ['b.com'],
        },
        outputSchema: '',
        __credentials: {},
      }),
    ).rejects.toThrow('Include Domains cannot be combined')
  })
})

describe('Execute — Answer request body', () => {
  test('sends POST with query', async () => {
    const requests = await runExecute({
      operation: 'answer',
      query: 'What is the capital of France?',
      answerOptions: {},
      __credentials: {},
    })
    expect(requests[0].method).toBe('POST')
    expect(requests[0].url).toBe('https://api.you.com/v1/answer')
    const body = requests[0].body as Record<string, unknown>
    expect(body.query).toBe('What is the capital of France?')
  })

  test('includes optional filters', async () => {
    const requests = await runExecute({
      operation: 'answer',
      query: 'test',
      answerOptions: {
        freshness: 'month',
        country: 'US',
        safesearch: 'moderate',
        language: 'EN',
      },
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.freshness).toBe('month')
    expect(body.country).toBe('US')
    expect(body.safesearch).toBe('moderate')
    expect(body.language).toBe('EN')
  })

  test('throws on domain mutual exclusion', async () => {
    await expect(
      runExecute({
        operation: 'answer',
        query: 'test',
        answerOptions: {
          include_domains: ['a.com'],
          exclude_domains: ['b.com'],
        },
        __credentials: {},
      }),
    ).rejects.toThrow('Include Domains cannot be combined')
  })
})

describe('Execute — Finance Research request body', () => {
  test('sends POST with input and research_effort', async () => {
    const requests = await runExecute({
      operation: 'finance_research',
      input: 'Semiconductor outlook 2026',
      financeResearchEffort: 'deep',
      __credentials: {},
    })
    expect(requests[0].method).toBe('POST')
    expect(requests[0].url).toBe('https://api.you.com/v1/finance_research')
    const body = requests[0].body as Record<string, unknown>
    expect(body.input).toBe('Semiconductor outlook 2026')
    expect(body.research_effort).toBe('deep')
  })

  test('sends exhaustive effort when selected', async () => {
    const requests = await runExecute({
      operation: 'finance_research',
      input: 'test',
      financeResearchEffort: 'exhaustive',
      __credentials: {},
    })
    const body = requests[0].body as Record<string, unknown>
    expect(body.research_effort).toBe('exhaustive')
  })
})

describe('Execute — Get Research Task request', () => {
  test('sends GET with task_id in URL path', async () => {
    const requests = await runExecute({
      operation: 'get_research_task',
      taskId: 'abc-123',
      __credentials: {},
    })
    expect(requests[0].method).toBe('GET')
    expect(requests[0].url).toBe('https://api.you.com/v1/research/abc-123')
  })

  test('encodes task_id in URL', async () => {
    const requests = await runExecute({
      operation: 'get_research_task',
      taskId: 'task with spaces',
      __credentials: {},
    })
    expect(requests[0].url).toBe('https://api.you.com/v1/research/task%20with%20spaces')
  })
})

describe('Execute — Stream Research Task request', () => {
  test('sends GET with task_id in URL and from_id as query param', async () => {
    const requests = await runExecute({
      operation: 'stream_research_task',
      taskId: 'abc-123',
      fromId: 5,
      __credentials: {},
    })
    expect(requests[0].method).toBe('GET')
    expect(requests[0].url).toBe('https://api.you.com/v1/research/abc-123/stream')
    expect(requests[0].qs).toEqual({ from_id: 5 })
  })

  test('defaults from_id to 0', async () => {
    const requests = await runExecute({
      operation: 'stream_research_task',
      taskId: 'abc-123',
      __credentials: {},
    })
    expect(requests[0].qs).toEqual({ from_id: 0 })
  })
})

describe('Execute — Attribution header in request', () => {
  test('sends X-Client-Info header with plugin identity', async () => {
    const requests = await runExecute({
      operation: 'search',
      query: 'test',
      searchOptions: {},
      __credentials: {},
    })
    expect(requests[0].headers['X-Client-Info']).toBe(
      'sdk; client=n8n-nodes-youdotcom/0.6.0; ua=node/unknown',
    )
  })

  test('header is the same regardless of credentials', async () => {
    const requests = await runExecute({
      operation: 'contents',
      urls: ['https://example.com'],
      contentsOptions: {},
      __credentials: {},
    })
    expect(requests[0].headers['X-Client-Info']).toBe(
      'sdk; client=n8n-nodes-youdotcom/0.6.0; ua=node/unknown',
    )
  })
})

describe('Execute — .node.json docs URLs', () => {
  // Read the node.json file and verify all URLs are correct
  test('all primary documentation URLs use full /docs/ paths', async () => {
    const nodeJson = await import('../nodes/YouDotCom/YouDotCom.node.json')
    const urls = (nodeJson.default?.resources?.primaryDocumentation ?? nodeJson.resources?.primaryDocumentation) as Array<{ url: string }>
    expect(urls).toBeDefined()
    expect(urls.length).toBeGreaterThan(0)
    for (const { url } of urls) {
      expect(url.startsWith('https://docs.you.com/docs/')).toBe(true)
    }
  })

  test('credential documentation URL points to n8n integration page', async () => {
    const nodeJson = await import('../nodes/YouDotCom/YouDotCom.node.json')
    const credUrls = (nodeJson.default?.resources?.credentialDocumentation ?? nodeJson.resources?.credentialDocumentation) as Array<{ url: string }>
    expect(credUrls).toBeDefined()
    expect(credUrls[0].url).toBe('https://docs.you.com/docs/integrations/n8n')
  })

  test('includes API reference URLs for all 5 APIs', async () => {
    const nodeJson = await import('../nodes/YouDotCom/YouDotCom.node.json')
    const urls = ((nodeJson.default?.resources?.primaryDocumentation ?? nodeJson.resources?.primaryDocumentation) as Array<{ url: string }>).map((u) => u.url)
    expect(urls.some((u) => u.includes('/search/'))).toBe(true)
    expect(urls.some((u) => u.includes('/contents'))).toBe(true)
    expect(urls.some((u) => u.includes('/answer/'))).toBe(true)
    expect(urls.some((u) => u.includes('/research/'))).toBe(true)
    expect(urls.some((u) => u.includes('/finance-research/'))).toBe(true)
  })
})

describe('Execute — Node documentationUrl', () => {
  test('node has documentationUrl pointing to n8n integration page', () => {
    const node = new YouDotCom()
    expect(node.description.documentationUrl).toBe('https://docs.you.com/docs/integrations/n8n')
  })
})

describe('Execute — continueOnFail', () => {
  test('pushes error item instead of throwing when continueOnFail is true', async () => {
    const { context } = createMockContext({
      operation: 'search',
      query: 'test',
      searchOptions: {
        include_domains: ['a.com'],
        exclude_domains: ['b.com'],
      },
      __credentials: {},
    })
    // Override continueOnFail to return true
    ;(context as unknown as { continueOnFail: () => boolean }).continueOnFail = () => true
    const node = new YouDotCom()
    const result = await node.execute.call(context)
    expect(result[0]).toBeDefined()
    expect(result[0].length).toBe(1)
    expect((result[0][0] as INodeExecutionData).json).toHaveProperty('error')
  })
})
