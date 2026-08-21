import { describe, expect, test } from 'bun:test'
import { buildClientInfoHeader, validateAttributionArg } from '../nodes/YouDotCom/Attribution.ts'

/**
 * Unit tests for the X-Client-Info attribution header builder.
 *
 * Ports the wire-format contract from the Python SDK 3.1.2
 * `youdotcom.utils.attribution` module. The n8n channel reports the Node.js
 * runtime in the `ua=` segment (`ua=node/<V>`) instead of the Python runtime +
 * httpx pair, and drops `client=` entirely when the caller does not identify
 * itself (channel-only default), matching the Python SDK philosophy.
 */

/** The canonical `ua=` segment. The runtime version degrades to `unknown`
 * (n8n Cloud rules forbid reading `process` in shipped source), mirroring the
 * Python SDK's defensive fallback when a version is unavailable. */
const UA_SEGMENT = 'ua=node/unknown'

describe('buildClientInfoHeader — grammar', () => {
  test('leading token is sdk', () => {
    const out = buildClientInfoHeader({})
    expect(out.startsWith('sdk; ')).toBe(true)
    expect(out.split('; ')[0]).toBe('sdk')
  })

  test('default call is channel-only (client= dropped)', () => {
    const out = buildClientInfoHeader({})
    expect(out).toBe(`sdk; ${UA_SEGMENT}`)
    expect(out).not.toContain('client=')
  })

  test('app_name only emits client=<name>', () => {
    const out = buildClientInfoHeader({ appName: 'acme-bot' })
    expect(out).toBe(`sdk; client=acme-bot; ${UA_SEGMENT}`)
  })

  test('app_name + app_version emit client=<name>/<version>', () => {
    const out = buildClientInfoHeader({ appName: 'acme-bot', appVersion: '2.4.0' })
    expect(out).toBe(`sdk; client=acme-bot/2.4.0; ${UA_SEGMENT}`)
  })

  test('canonical order is sdk, client=, title=, url=, ua=', () => {
    const out = buildClientInfoHeader({
      appName: 'acme-bot',
      appVersion: '2.4.0',
      appTitle: 'MyAgent',
      appUrl: 'https://example.com',
    })
    const parts = out.split('; ')
    expect(parts[0]).toBe('sdk')
    expect(parts[1]).toBe('client=acme-bot/2.4.0')
    expect(parts[2]).toBe('title=MyAgent')
    expect(parts[3]).toBe('url=https://example.com')
    expect(parts[4]).toBe(UA_SEGMENT)
  })

  test('no extra separators when optional segments dropped', () => {
    const out = buildClientInfoHeader({})
    expect(out).not.toContain('; ;')
    expect(out.startsWith('; ')).toBe(false)
    expect(out.endsWith('; ')).toBe(false)
    expect(out).not.toContain('=;')
  })

  test('empty string values drop their segment', () => {
    expect(buildClientInfoHeader({ appTitle: '' })).not.toContain('title=')
    expect(buildClientInfoHeader({ appUrl: '' })).not.toContain('url=')
    expect(buildClientInfoHeader({ appName: '' })).not.toContain('client=')
  })

  test('url with query string survives the segment split', () => {
    const out = buildClientInfoHeader({ appUrl: 'https://example.com?x=1&y=2' })
    const urlSeg = out.slice(out.indexOf('url=') + 'url='.length, out.indexOf('; ua='))
    expect(urlSeg).toBe('https://example.com?x=1&y=2')
  })

  test('ua segment reports the node channel with unknown version', () => {
    const out = buildClientInfoHeader({})
    const uaSeg = out.slice(out.indexOf('ua=') + 'ua='.length)
    expect(uaSeg.startsWith('node/')).toBe(true)
    expect(uaSeg).toBe('node/unknown')
  })

  test('builder is permissive: app_version without app_name drops client=', () => {
    const out = buildClientInfoHeader({ appVersion: '2.4.0' })
    expect(out).not.toContain('client=')
    expect(out).toBe(`sdk; ${UA_SEGMENT}`)
  })

  test('interior space is allowed in values', () => {
    expect(buildClientInfoHeader({ appTitle: 'Acme Bot' })).toContain('title=Acme Bot')
    expect(buildClientInfoHeader({ appName: 'acme bot' })).toContain('client=acme bot')
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
  test('invalid app_name raises', () => {
    expect(() => buildClientInfoHeader({ appName: 'acme/bot' })).toThrow('app_name')
    expect(() => buildClientInfoHeader({ appName: 'acme;bot' })).toThrow('app_name')
    expect(() => buildClientInfoHeader({ appName: 'acmé' })).toThrow('app_name')
  })

  test('invalid app_version raises', () => {
    expect(() => buildClientInfoHeader({ appName: 'acme-bot', appVersion: '2/4' })).toThrow('app_version')
    expect(() => buildClientInfoHeader({ appName: 'acme-bot', appVersion: '2;4' })).toThrow('app_version')
  })

  test('invalid app_title raises', () => {
    expect(() => buildClientInfoHeader({ appTitle: 'Evil; url=http://attacker.com' })).toThrow('app_title')
    expect(() => buildClientInfoHeader({ appTitle: 'Café Assistant' })).toThrow('app_title')
  })

  test('invalid app_url raises', () => {
    expect(() => buildClientInfoHeader({ appUrl: 'http://evil.com; title=forged' })).toThrow('app_url')
    expect(() => buildClientInfoHeader({ appUrl: 'http://café.com' })).toThrow('app_url')
  })

  test('hand-traced realistic call: integration wrapping the n8n node', () => {
    // A user wrapping the n8n node in their own app identifies themselves:
    //   X-Client-Info: sdk; client=youdotcom-temporal/1.0.1; title=Atlas; url=https://atlas.example.com; ua=node/<V>
    const out = buildClientInfoHeader({
      appName: 'youdotcom-temporal',
      appVersion: '1.0.1',
      appTitle: 'Atlas',
      appUrl: 'https://atlas.example.com',
    })
    expect(out).toBe(`sdk; client=youdotcom-temporal/1.0.1; title=Atlas; url=https://atlas.example.com; ${UA_SEGMENT}`)
    // Both headers travel: User-Agent (node's own) + X-Client-Info (this).
    expect(out.split('; ')[0]).toBe('sdk')
    expect(out).toContain('ua=node/')
  })
})
