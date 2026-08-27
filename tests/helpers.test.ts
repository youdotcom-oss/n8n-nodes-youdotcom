import { describe, expect, test } from 'bun:test'
import { parseSseEvents, toStringArray, toUrlList } from '../nodes/YouDotCom/YouDotCom.node.ts'

/**
 * Unit tests for the helper functions used by the You.com n8n node.
 *
 * These functions normalize n8n's flexible input types (string, string[],
 * undefined, CSV strings) into clean arrays for the API request body.
 */

describe('toStringArray', () => {
  test('returns empty array for null/undefined', () => {
    expect(toStringArray(null)).toEqual([])
    expect(toStringArray(undefined)).toEqual([])
  })

  test('wraps a single string', () => {
    expect(toStringArray('example.com')).toEqual(['example.com'])
  })

  test('passes through a string array', () => {
    expect(toStringArray(['a.com', 'b.com'])).toEqual(['a.com', 'b.com'])
  })

  test('trims whitespace', () => {
    expect(toStringArray(['  a.com  ', 'b.com'])).toEqual(['a.com', 'b.com'])
  })

  test('drops empty strings', () => {
    expect(toStringArray(['', '  ', 'a.com'])).toEqual(['a.com'])
  })

  test('drops non-string elements', () => {
    expect(toStringArray(['a.com', 123, null, undefined, 'b.com'])).toEqual(['a.com', 'b.com'])
  })

  test('returns empty array for non-array non-string input', () => {
    expect(toStringArray(123)).toEqual([])
    expect(toStringArray({})).toEqual([])
    expect(toStringArray(true)).toEqual([])
  })
})

describe('toUrlList', () => {
  test('returns empty array for null/undefined', () => {
    expect(toUrlList(null)).toEqual([])
    expect(toUrlList(undefined)).toEqual([])
  })

  test('wraps a single URL string', () => {
    expect(toUrlList('https://example.com')).toEqual(['https://example.com'])
  })

  test('passes through a string array', () => {
    expect(toUrlList(['https://a.com', 'https://b.com'])).toEqual(['https://a.com', 'https://b.com'])
  })

  test('splits a CSV string into individual URLs', () => {
    expect(toUrlList('https://a.com, https://b.com,https://c.com')).toEqual([
      'https://a.com',
      'https://b.com',
      'https://c.com',
    ])
  })

  test('treats each element in an array as a complete URL (no splitting)', () => {
    expect(toUrlList(['https://a.com, https://b.com', 'https://c.com'])).toEqual([
      'https://a.com, https://b.com',
      'https://c.com',
    ])
  })

  test('trims whitespace around URLs', () => {
    expect(toUrlList('  https://a.com  ,  https://b.com  ')).toEqual(['https://a.com', 'https://b.com'])
  })

  test('drops empty segments from CSV', () => {
    expect(toUrlList('https://a.com, , https://b.com')).toEqual(['https://a.com', 'https://b.com'])
  })

  test('drops non-string elements', () => {
    expect(toUrlList([123, 'https://a.com', null, 'https://b.com'])).toEqual(['https://a.com', 'https://b.com'])
  })

  test('returns empty array for all-empty input', () => {
    expect(toUrlList(['', '  '])).toEqual([])
  })

  test('handles a single URL with no commas', () => {
    expect(toUrlList('https://en.wikipedia.org/wiki/Paris')).toEqual(['https://en.wikipedia.org/wiki/Paris'])
  })

  test('preserves URLs with commas in query string when passed as array', () => {
    expect(toUrlList(['https://example.com/path?a=1,2,3'])).toEqual(['https://example.com/path?a=1,2,3'])
  })
})

describe('parseSseEvents', () => {
  test('returns empty array for empty input', () => {
    expect(parseSseEvents('')).toEqual([])
  })

  test('parses a single event with a JSON data payload', () => {
    expect(parseSseEvents('event: task.progress\ndata: {"step":1}\n\n')).toEqual([
      { event: 'task.progress', data: { step: 1 } },
    ])
  })

  test('parses multiple events separated by a blank line', () => {
    expect(parseSseEvents('data: {"a":1}\n\ndata: {"a":2}\n\n')).toEqual([
      { event: 'message', data: { a: 1 } },
      { event: 'message', data: { a: 2 } },
    ])
  })

  test('defaults event to "message" when no event field is present', () => {
    expect(parseSseEvents('data: {"ok":true}\n\n')).toEqual([{ event: 'message', data: { ok: true } }])
  })

  test('keeps non-JSON data as raw text', () => {
    expect(parseSseEvents('data: not json\n\n')).toEqual([{ event: 'message', data: 'not json' }])
  })

  test('joins multiple data lines with a newline before parsing', () => {
    expect(parseSseEvents('data: line one\ndata: line two\n\n')).toEqual([
      { event: 'message', data: 'line one\nline two' },
    ])
  })

  test('captures the id field for reconnection', () => {
    expect(parseSseEvents('id: 42\nevent: task.done\ndata: {"result":"ok"}\n\n')).toEqual([
      { id: '42', event: 'task.done', data: { result: 'ok' } },
    ])
  })

  test('ignores comment lines starting with a colon', () => {
    expect(parseSseEvents(':heartbeat\n\ndata: {"a":1}\n\n')).toEqual([{ event: 'message', data: { a: 1 } }])
  })

  test('does not dispatch an id-only frame with no data, but its id persists to the next dispatched event', () => {
    expect(parseSseEvents('id: 7\n\ndata: {"a":1}\n\n')).toEqual([{ id: '7', event: 'message', data: { a: 1 } }])
  })

  test('does not dispatch an event-only frame with no data', () => {
    expect(parseSseEvents('event: ping\n\ndata: {"a":1}\n\n')).toEqual([{ event: 'message', data: { a: 1 } }])
  })

  test('id persists across events until a new id is sent (SSE last-event-ID semantics)', () => {
    const raw = ['id: 1', 'data: {"a":1}', '', 'data: {"a":2}', '', 'id: 2', 'data: {"a":3}', ''].join('\n')
    expect(parseSseEvents(raw)).toEqual([
      { id: '1', event: 'message', data: { a: 1 } },
      { id: '1', event: 'message', data: { a: 2 } },
      { id: '2', event: 'message', data: { a: 3 } },
    ])
  })

  test('handles CRLF line endings', () => {
    expect(parseSseEvents('event: ping\r\ndata: {"a":1}\r\n\r\n')).toEqual([{ event: 'ping', data: { a: 1 } }])
  })

  test('filters out keep-alive ping comments interspersed between real events (live API shape)', () => {
    const raw = [
      'id: 0',
      'event: connected',
      'data: {"type": "connected", "task_id": "abc-123", "status": "running"}',
      '',
      ': ping - 2026-08-26 20:28:36.688791',
      '',
      ': ping - 2026-08-26 20:28:51.689578',
      '',
      'id: 4',
      'event: response.done',
      'data: {"seq_id": 4, "type": "response.done", "response": {"finished": true}}',
      '',
    ].join('\n')

    expect(parseSseEvents(raw)).toEqual([
      { id: '0', event: 'connected', data: { type: 'connected', task_id: 'abc-123', status: 'running' } },
      { id: '4', event: 'response.done', data: { seq_id: 4, type: 'response.done', response: { finished: true } } },
    ])
  })
})
