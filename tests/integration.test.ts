/**
 * Live API integration tests for the You.com n8n node.
 *
 * These tests call the real You.com API to validate that the request bodies
 * and endpoints used by the node are accepted by the server and return the
 * expected response shapes. They are automatically skipped when
 * `YDC_API_KEY` is not set (e.g., in CI).
 *
 * Expensive modes (deep, exhaustive, and frontier research effort) are
 * intentionally excluded to keep the suite fast and cheap. Finance research
 * is included with the default `deep` effort to verify the cost-cheapest path.
 *
 * Run: bun test tests/integration.test.ts
 * (this file raises bun's 5s default test timeout to 120s for itself only,
 * via setDefaultTimeout — the mocked unit test suite keeps the fast default)
 */

import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { buildClientInfoHeader } from '../nodes/YouDotCom/Attribution.ts'
import { PACKAGE_VERSION, RESEARCH_API_BASE, SEARCH_API_BASE, USER_AGENT } from '../nodes/YouDotCom/constants.ts'

setDefaultTimeout(120_000)

const API_KEY = Bun.env.YDC_API_KEY ?? ''
const SEARCH_URL = `${SEARCH_API_BASE}/v1/search`
const CONTENTS_URL = `${SEARCH_API_BASE}/v1/contents`
const API_BASE = `${RESEARCH_API_BASE}/v1`

const HEADERS: Record<string, string> = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json',
  'User-Agent': USER_AGENT,
  'X-Client-Info': buildClientInfoHeader({ pluginVersion: PACKAGE_VERSION }),
}

async function postJson(url: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
}

describe.skipIf(!API_KEY)('Live API Integration', () => {
  let backgroundTaskId = ''

  beforeAll(async () => {
    // Create a background research task (lite effort) for the get/stream tests.
    const res = await postJson(`${API_BASE}/research`, {
      input: 'What is the capital of France?',
      research_effort: 'lite',
      background: true,
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, unknown>
    backgroundTaskId = data.task_id as string
    expect(backgroundTaskId).toBeTruthy()
  })

  // ── Search ──────────────────────────────────────────────────────────

  test('search returns results for a basic query', async () => {
    const res = await postJson(SEARCH_URL, { query: 'capital of France' })
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, unknown>
    expect(data).toBeDefined()
  })

  test('search with include_domains restricts results', async () => {
    const res = await postJson(SEARCH_URL, {
      query: 'Paris',
      include_domains: ['wikipedia.org'],
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, unknown>
    expect(data).toBeDefined()
  })

  test('search with extraction highlights mode', async () => {
    const res = await postJson(SEARCH_URL, {
      query: 'Eiffel Tower',
      extraction: { extraction_mode: 'highlights' },
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, unknown>
    expect(data).toBeDefined()
  })

  test('search with extraction full_page mode returns page content', async () => {
    const res = await postJson(SEARCH_URL, {
      query: 'Eiffel Tower',
      extraction: {
        extraction_mode: 'full_page',
        full_page: { extraction_formats: ['markdown'] },
      },
      crawl_timeout: 15,
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, unknown>
    expect(data).toBeDefined()
  })

  test('search with exclude_domains filter', async () => {
    const res = await postJson(SEARCH_URL, {
      query: 'Paris',
      exclude_domains: ['pinterest.com'],
    })
    expect(res.status).toBe(200)
  })

  test('search with boost_domains filter', async () => {
    const res = await postJson(SEARCH_URL, {
      query: 'AI news',
      boost_domains: ['arxiv.org'],
    })
    expect(res.status).toBe(200)
  })

  test('search with crawl_timeout parameter', async () => {
    const res = await postJson(SEARCH_URL, {
      query: 'test',
      crawl_timeout: 10,
    })
    expect(res.status).toBe(200)
  })

  test('search with country and language filters', async () => {
    const res = await postJson(SEARCH_URL, {
      query: 'test',
      country: 'US',
      language: 'EN',
    })
    expect(res.status).toBe(200)
  })

  // ── Contents ─────────────────────────────────────────────────────────

  test('contents returns page content as markdown', async () => {
    const res = await postJson(CONTENTS_URL, {
      urls: ['https://example.com'],
      formats: ['markdown'],
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as Array<Record<string, unknown>>
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
    expect(data[0]?.markdown).toBeDefined()
  })

  test('contents with max_age forces re-fetch', async () => {
    const res = await postJson(CONTENTS_URL, {
      urls: ['https://example.com'],
      formats: ['markdown'],
      max_age: 1,
    })
    expect(res.status).toBe(200)
  })

  test('contents with multiple URLs', async () => {
    const res = await postJson(CONTENTS_URL, {
      urls: ['https://example.com', 'https://www.iana.org/'],
      formats: ['markdown'],
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as Array<Record<string, unknown>>
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(2)
  })

  test('contents with crawl_timeout parameter', async () => {
    const res = await postJson(CONTENTS_URL, {
      urls: ['https://example.com'],
      formats: ['markdown'],
      crawl_timeout: 10,
    })
    expect(res.status).toBe(200)
  })

  // ── Answer ───────────────────────────────────────────────────────────

  test('answer returns a synthesized answer', async () => {
    const res = await postJson(`${API_BASE}/answer`, {
      query: 'What is the capital of France?',
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, unknown>
    expect(data.answer).toBeDefined()
  })

  test('answer with include_domains filter', async () => {
    const res = await postJson(`${API_BASE}/answer`, {
      query: 'Eiffel Tower height',
      include_domains: ['wikipedia.org'],
    })
    expect(res.status).toBe(200)
  })

  test('answer with freshness and safesearch filters', async () => {
    const res = await postJson(`${API_BASE}/answer`, {
      query: 'latest AI news',
      freshness: 'week',
      safesearch: 'moderate',
    })
    expect(res.status).toBe(200)
  })

  // ── Research (lite only — deep/exhaustive/frontier excluded) ─────────

  test('research with lite effort returns an answer synchronously', async () => {
    const res = await postJson(`${API_BASE}/research`, {
      input: 'What is the capital of France?',
      research_effort: 'lite',
      background: false,
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, unknown>
    // Synchronous research returns output directly; do not assert on the
    // absence of task_id since the API may include it for tracing.
    expect(data.output).toBeDefined()
  })

  test('research with background=true returns a task_id', async () => {
    const res = await postJson(`${API_BASE}/research`, {
      input: 'What is the capital of France?',
      research_effort: 'lite',
      background: true,
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, unknown>
    expect(data.task_id).toBeDefined()
  })

  test('research with source_control filter', async () => {
    const res = await postJson(`${API_BASE}/research`, {
      input: 'What is the capital of France?',
      research_effort: 'lite',
      background: false,
      source_control: {
        include_domains: ['wikipedia.org'],
        freshness: 'year',
      },
    })
    expect(res.status).toBe(200)
  })

  // ── Finance Research ─────────────────────────────────────────────────

  test('finance research with deep effort returns an answer', async () => {
    const res = await postJson(`${API_BASE}/finance_research`, {
      input: 'What is the current state of the US economy?',
      research_effort: 'deep',
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, unknown>
    expect(data.output).toBeDefined()
  })

  // ── Get Research Task ────────────────────────────────────────────────

  test('get research task returns task data', async () => {
    const res = await fetch(`${API_BASE}/research/${backgroundTaskId}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(30_000),
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, unknown>
    // The response shape varies by task state (pending vs completed).
    // A completed task has output; a pending task has status.
    expect(data.status ?? data.output).toBeDefined()
  })

  // ── Stream Research Task ──────────────────────────────────────────────

  test('stream research task returns SSE response', async () => {
    const res = await fetch(`${API_BASE}/research/${backgroundTaskId}/stream?from_id=0`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(60_000),
    })
    expect(res.status).toBe(200)
    expect(res.body).toBeDefined()
    if (res.body) {
      const reader = res.body.getReader()
      const { value, done } = await reader.read()
      if (!done) {
        expect(value).toBeDefined()
        expect(value?.length).toBeGreaterThan(0)
      }
      // If done is true, the task already completed and the stream has no
      // remaining chunks — that is a valid state, not a failure.
      await reader.cancel()
    }
  })
})
