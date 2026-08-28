import { describe, expect, test } from 'bun:test'
import { toStringArray, toUrlList } from '../nodes/YouDotCom/YouDotCom.node.ts'

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
