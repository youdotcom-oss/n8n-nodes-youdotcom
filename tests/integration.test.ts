import { describe, expect, test } from 'bun:test'
import type { IDataObject, IExecuteFunctions, INode, INodeExecutionData } from 'n8n-workflow'
import { YouDotCom } from '../nodes/YouDotCom/YouDotCom.node.ts'

const API_KEY = process.env.YDC_API_KEY_RESEARCH ?? ''

if (!API_KEY) {
  console.log('Skipping integration tests: YDC_API_KEY_RESEARCH not set')
  process.exit(0)
}

/**
 * Build a mock IExecuteFunctions that makes real HTTP calls.
 * This exercises the actual node code path end-to-end.
 */
function buildMockContext(params: Record<string, unknown>): IExecuteFunctions {
  return {
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name: string, _itemIndex: number) => {
      if (!(name in params)) throw new Error(`Unexpected parameter: ${name}`)
      return params[name]
    },
    getNode: () => ({ name: 'You.com' }) as INode,
    continueOnFail: () => false,
    helpers: {
      httpRequestWithAuthentication: async (_cred: string, opts: IDataObject) => {
        const url = new URL(opts.url as string)
        if (opts.qs) {
          for (const [k, v] of Object.entries(opts.qs as Record<string, string>)) {
            url.searchParams.set(k, String(v))
          }
        }

        const fetchOpts: RequestInit = {
          method: opts.method as string,
          headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json',
            ...(opts.headers as Record<string, string>),
          },
        }

        if (opts.body) {
          fetchOpts.body = JSON.stringify(opts.body)
        }

        const res = await fetch(url.toString(), fetchOpts)
        return res.json()
      },
      constructExecutionMetaData: (data: INodeExecutionData[], _meta: unknown) => data,
      returnJsonArray: (data: IDataObject | IDataObject[]) =>
        (Array.isArray(data) ? data : [data]).map((json) => ({ json })) as INodeExecutionData[],
    },
  } as unknown as IExecuteFunctions
}

describe('Research API Integration', () => {
  const node = new YouDotCom()

  for (const effort of ['lite', 'standard', 'deep', 'exhaustive'] as const) {
    test(`research_effort=${effort} returns valid response`, async () => {
      const context = buildMockContext({
        operation: 'research',
        input: 'What is the tallest building in the world?',
        researchEffort: effort,
      })

      const result = await node.execute.call(context)

      // Should return one outer array with items
      expect(result).toHaveLength(1)
      // biome-ignore lint: safe after length assertion above
      const items = result[0]!
      expect(items.length).toBeGreaterThan(0)

      // biome-ignore lint: safe after length assertion above
      const json = items[0]!.json as Record<string, unknown>

      // Should have output object
      expect(json.output).toBeDefined()

      const output = json.output as Record<string, unknown>

      // Should have markdown content
      expect(typeof output.content).toBe('string')
      expect((output.content as string).length).toBeGreaterThan(0)

      // Should have content_type = "text"
      expect(output.content_type).toBe('text')

      // Should have sources array
      expect(Array.isArray(output.sources)).toBe(true)
      const sources = output.sources as Record<string, unknown>[]
      expect(sources.length).toBeGreaterThan(0)

      // Each source should have url at minimum
      for (const source of sources) {
        expect(typeof source.url).toBe('string')
        expect((source.url as string).startsWith('http')).toBe(true)
      }

      console.log(`  ${effort}: ${(output.content as string).length} chars, ${sources.length} sources`)
    }, 120_000)
  }
})
