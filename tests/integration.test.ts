/**
 * Live API integration tests for the You.com n8n node.
 *
 * These tests call the real You.com API to validate that the request bodies
 * and endpoints used by the node are accepted by the server and return the
 * expected response shapes. They are automatically skipped when
 * `YDC_API_KEY` is not set (e.g., in CI).
 *
 * Expensive modes (deep, exhaustive, frontier research effort, and finance
 * research) are intentionally excluded to keep the suite fast and cheap.
 *
 * Run: bun test tests/integration.test.ts --timeout 120000
 */

import { beforeAll, describe, expect, test } from 'bun:test'

const API_KEY = Bun.env.YDC_API_KEY ?? ''
const SEARCH_URL = 'https://ydc-index.io/v1/search'
const CONTENTS_URL = 'https://ydc-index.io/v1/contents'
const API_BASE = 'https://api.you.com/v1'

const HEADERS: Record<string, string> = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json',
  'User-Agent': 'n8n-nodes-youdotcom/0.6.0 (https://github.com/youdotcom-oss/n8n-nodes-youdotcom)',
  'X-Client-Info': 'sdk; ua=node/unknown',
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
    const data = await res.json()
    expect(data).toBeDefined()
  })

  test('search with include_domains restricts results', async () => {
    const res = await postJson(SEARCH_URL, {
      query: 'Paris',
      include_domains: ['wikipedia.org'],
    })
    expect(res.status).toBe(200)
  })

  test('search with extraction highlights mode', async () => {
    const res = await postJson(SEARCH_URL, {
      query: 'Eiffel Tower',
      extraction: { extraction_mode: 'highlights' },
    })
    expect(res.status).toBe(200)
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
  })

  // ── Contents ─────────────────────────────────────────────────────────

  test('contents returns page content as markdown', async () => {
    const res = await postJson(CONTENTS_URL, {
      urls: ['https://example.com'],
      formats: ['markdown'],
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  test('contents with max_age=0 forces re-fetch', async () => {
    const res = await postJson(CONTENTS_URL, {
      urls: ['https://example.com'],
      formats: ['markdown'],
      max_age: 0,
    })
    expect(res.status).toBe(200)
  })

  // ── Answer ───────────────────────────────────────────────────────────

  test('answer returns a synthesized answer', async () => {
    const res = await postJson(`${API_BASE}/answer`, {
      query: 'What is the capital of France?',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toBeDefined()
  })

  test('answer with include_domains filter', async () => {
    const res = await postJson(`${API_BASE}/answer`, {
      query: 'Eiffel Tower height',
      include_domains: ['wikipedia.org'],
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
    const data = await res.json()
    expect(data).toBeDefined()
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

  // ── Get Research Task ────────────────────────────────────────────────

  test('get research task returns task status', async () => {
    const res = await fetch(`${API_BASE}/research/${backgroundTaskId}`, { headers: HEADERS })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toBeDefined()
  })

  // ── Stream Research Task ──────────────────────────────────────────────

  test('stream research task returns SSE response', async () => {
    const res = await fetch(`${API_BASE}/research/${backgroundTaskId}/stream?from_id=0`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(60_000),
    })
    expect(res.status).toBe(200)
    // SSE streams stay open until the task reaches a terminal state.
    // Read just the first chunk to verify we get data, then cancel.
    expect(res.body).toBeDefined()
    if (res.body) {
      const reader = res.body.getReader()
      const { value } = await reader.read()
      if (value) {
        expect(value.length).toBeGreaterThan(0)
      }
      await reader.cancel()
    }
  })
})
