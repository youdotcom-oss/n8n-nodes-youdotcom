import { describe, expect, test } from 'bun:test'
import { buildClientInfoHeader, validateAttributionArg } from '../nodes/YouDotCom/Attribution.ts'

/**
 * Unit tests for the X-Client-Info attribution header builder.
 *
 * The n8n plugin emits a fixed header that identifies itself automatically:
 *
 *     sdk; client=n8n-nodes-youdotcom/<version>; ua=node/unknown
 *
 * No user configuration is needed. The data team can filter n8n plugin traffic
 * on `client=n8n-nodes-youdotcom/` within the `X-Client-Info` header.
 */

/** Plugin version used in tests. */
const PLUGIN_VERSION = '0.6.0'

/** The canonical header value for the test version. */
const EXPECTED_HEADER = `sdk; client=n8n-nodes-youdotcom/${PLUGIN_VERSION}; ua=node/unknown`

describe('buildClientInfoHeader — grammar', () => {
  test('leading token is sdk', () => {
    const out = buildClientInfoHeader({ pluginVersion: PLUGIN_VERSION })
    expect(out.startsWith('sdk; ')).toBe(true)
    expect(out.split('; ')[0]).toBe('sdk')
  })

  test('default call emits plugin identity and runtime', () => {
    const out = buildClientInfoHeader({ pluginVersion: PLUGIN_VERSION })
    expect(out).toBe(EXPECTED_HEADER)
  })

  test('client segment contains plugin name and version', () => {
    const out = buildClientInfoHeader({ pluginVersion: PLUGIN_VERSION })
    expect(out).toContain(`client=n8n-nodes-youdotcom/${PLUGIN_VERSION}`)
  })

  test('ua segment reports node runtime with unknown version', () => {
    const out = buildClientInfoHeader({ pluginVersion: PLUGIN_VERSION })
    expect(out).toContain('ua=node/unknown')
  })

  test('canonical order is sdk, client=, ua=', () => {
    const out = buildClientInfoHeader({ pluginVersion: PLUGIN_VERSION })
    const parts = out.split('; ')
    expect(parts[0]).toBe('sdk')
    expect(parts[1]).toBe(`client=n8n-nodes-youdotcom/${PLUGIN_VERSION}`)
    expect(parts[2]).toBe('ua=node/unknown')
  })

  test('no extra separators', () => {
    const out = buildClientInfoHeader({ pluginVersion: PLUGIN_VERSION })
    expect(out).not.toContain('; ;')
    expect(out.startsWith('; ')).toBe(false)
    expect(out.endsWith('; ')).toBe(false)
    expect(out).not.toContain('=;')
  })

  test('different version produces different header', () => {
    const out = buildClientInfoHeader({ pluginVersion: '1.0.0' })
    expect(out).toBe('sdk; client=n8n-nodes-youdotcom/1.0.0; ua=node/unknown')
    expect(out).not.toBe(EXPECTED_HEADER)
  })
})

describe('validateAttributionArg — validation rules', () => {
  test('rejects semicolon regardless of forbidden override', () => {
    expect(() => validateAttributionArg('x', 'a;b')).toThrow('the segment delimiter')
    expect(() => validateAttributionArg('x', 'a;b', { forbidden: '' })).toThrow('the segment delimiter')
    expect(() => validateAttributionArg('x', 'a;b', { forbidden: '/' })).toThrow('the segment delimiter')
  })

  test('forbidden is additive: "/" rejected only when forbidden includes it', () => {
    expect(() => validateAttributionArg('app_name', 'a/b', { forbidden: '/' })).toThrow(
      'the client=<name>/<version> delimiter',
    )
    // "/" is allowed when not forbidden (only ";" is always-on)
    expect(() => validateAttributionArg('app_title', 'a/b')).not.toThrow()
  })

  test('rejects non-ASCII characters', () => {
    expect(() => validateAttributionArg('app_title', 'Café Assistant')).toThrow('app_title')
    expect(() => validateAttributionArg('app_title', '検索アシスタント')).toThrow('printable ASCII')
  })

  test('rejects control characters', () => {
    expect(() => validateAttributionArg('app_title', 'null\x00byte')).toThrow('printable ASCII')
    expect(() => validateAttributionArg('app_title', 'line\nbreak')).toThrow('printable ASCII')
    expect(() => validateAttributionArg('app_title', 'line\rbreak')).toThrow('printable ASCII')
  })

  test('rejects leading or trailing whitespace', () => {
    expect(() => validateAttributionArg('app_name', ' ')).toThrow('whitespace')
    expect(() => validateAttributionArg('app_name', '  ')).toThrow('whitespace')
    expect(() => validateAttributionArg('app_name', ' acme')).toThrow('whitespace')
    expect(() => validateAttributionArg('app_name', 'acme ')).toThrow('whitespace')
    expect(() => validateAttributionArg('app_name', '\t')).toThrow('whitespace')
  })

  test('rejects non-string values, naming the parameter', () => {
    expect(() => validateAttributionArg('app_title', 123 as unknown as string)).toThrow('app_title must be a string')
    expect(() => validateAttributionArg('app_title', ['a', 'b'] as unknown as string)).toThrow(
      'app_title must be a string',
    )
  })

  test('accepts valid printable ASCII', () => {
    expect(() => validateAttributionArg('app_title', 'MyAgent')).not.toThrow()
    expect(() => validateAttributionArg('app_title', 'Special&Chars!')).not.toThrow()
    expect(() => validateAttributionArg('app_name', 'acme-bot', { forbidden: '/' })).not.toThrow()
  })
})

describe('buildClientInfoHeader — validation surfaces through the builder', () => {
  test('plugin version with semicolon raises', () => {
    expect(() => buildClientInfoHeader({ pluginVersion: '0.6;0' })).toThrow('pluginVersion')
  })

  test('plugin version with slash raises', () => {
    expect(() => buildClientInfoHeader({ pluginVersion: '0.6/0' })).toThrow('pluginVersion')
  })

  test('plugin version with non-ASCII raises', () => {
    expect(() => buildClientInfoHeader({ pluginVersion: '0.6.é' })).toThrow('pluginVersion')
  })

  test('hand-traced realistic call matches expected wire format', () => {
    // What every n8n request looks like on the wire:
    //   X-Client-Info: sdk; client=n8n-nodes-youdotcom/0.6.0; ua=node/unknown
    //   User-Agent: n8n-nodes-youdotcom/0.6.0 (https://github.com/youdotcom-oss/n8n-nodes-youdotcom)
    const out = buildClientInfoHeader({ pluginVersion: PLUGIN_VERSION })
    expect(out).toBe(EXPECTED_HEADER)
    expect(out.split('; ')[0]).toBe('sdk')
    expect(out).toContain('ua=node/')
  })
})
