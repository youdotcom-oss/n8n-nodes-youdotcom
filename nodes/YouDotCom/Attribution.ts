/**
 * Build the `X-Client-Info` attribution header value for outbound API requests.
 *
 * Ports the wire-format contract from the You.com Python SDK 3.1.2
 * `youdotcom.utils.attribution` module. Emits a caller-identity header so the
 * analytics layer can distinguish SDK/plugin traffic from other sources. SDK
 * traffic is uniquely identified by the leading literal `sdk`.
 *
 * Grammar (segments joined by `"; "`):
 *
 *     sdk[; client=<name>[/<version>]][; title=<title>][; url=<url>]; ua=node/unknown
 *
 * Optional segments are dropped entirely (no leading/trailing `"; "`, no empty
 * `=`) when their value is falsy. Values must be printable ASCII (`\x20`–`\x7e`)
 * excluding `;`, and `app_name` / `app_version` additionally exclude `/`; this is
 * validated here as defense-in-depth and rejected (not silently coerced), the
 * same philosophy as the Python SDK.
 *
 * The `ua=` segment reports `node/unknown`: the n8n Cloud compatibility rules
 * forbid reading the Node runtime version (`process`/`globalThis`/`node:process`)
 * in shipped source, so the version degrades to `unknown`, mirroring the Python
 * SDK's defensive `httpx/unknown` fallback. The node's own package version
 * travels in the `User-Agent` header, not here.
 */

/** Leading literal that identifies the traffic source (the channel). */
const SOURCE_TOKEN = 'sdk'

/** Human-readable reasons for the delimiter characters the validator rejects. */
const DELIMITER_REASONS: Record<string, string> = {
  ';': 'the segment delimiter',
  '/': 'the client=<name>/<version> delimiter',
}

/**
 * Validate an attribution header argument.
 *
 * Allows printable ASCII (`\x20`–`\x7e`) except `;` (always rejected because it
 * separates segments) and any extra characters in `options.forbidden`. Rejects
 * non-strings, non-ASCII, control characters, delimiters, and leading/trailing
 * whitespace to prevent segment forgery, header injection, and encoding errors.
 *
 * @param name - Parameter name for error messages (e.g. `"app_title"`).
 * @param value - Value to validate.
 * @param options.forbidden - Extra delimiter characters to reject, in addition
 *   to `;`. `app_name` / `app_version` pass `"/"` because the `client=<name>/<version>`
 *   value is split on `/` downstream, so a `/` inside either half corrupts both.
 * @throws {Error} If `value` is not a string, contains non-ASCII or control
 *   characters, has leading/trailing whitespace, or contains `;` or any
 *   character in `options.forbidden`.
 */
export function validateAttributionArg(name: string, value: string, options?: { forbidden?: string }): void {
  if (typeof value !== 'string') {
    throw new Error(
      `${name} must be a string; got ${value === null ? 'null' : typeof value}. ` +
        'Every attribution value is interpolated into the header verbatim, so a non-string would corrupt the segment.',
    )
  }
  if (value !== value.trim()) {
    throw new Error(`${name} must not have leading or trailing whitespace; got ${JSON.stringify(value)}`)
  }
  // `;` is unconditional: it is the delimiter this validator exists to protect,
  // so an override must never be able to drop it.
  const rejected = `;${options?.forbidden ?? ''}`
  let i = 0
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    if (code < 0x20 || code > 0x7e) {
      throw new Error(
        `${name} must be printable ASCII; got ${JSON.stringify(ch)} (U+${code.toString(16).toUpperCase().padStart(4, '0')}) at position ${i}`,
      )
    }
    if (rejected.includes(ch)) {
      throw new Error(
        `${name} must not contain ${JSON.stringify(ch)} (${DELIMITER_REASONS[ch] ?? 'a delimiter'}); found at position ${i}`,
      )
    }
    i++
  }
}

/** Optional attribution arguments for {@link buildClientInfoHeader}. */
export interface AttributionArgs {
  /** Optional caller application name, emitted as the `client=` segment. */
  appName?: string
  /** Optional version paired with `appName` as `client=<name>/<version>`. */
  appVersion?: string
  /** Optional caller-facing application title, emitted as the `title=` segment. */
  appTitle?: string
  /** Optional caller-facing application URL, emitted as the `url=` segment. */
  appUrl?: string
}

/**
 * Build the `X-Client-Info` header value for an outbound API request.
 *
 * @param args - Optional attribution values. Falsy values drop their segment
 *   entirely. `appVersion` is ignored when `appName` is falsy (the builder stays
 *   permissive so it can never be the thing that raises mid-request; the
 *   version-without-name pairing guard is enforced at the call site, mirroring
 *   the Python SDK's `You.__init__`).
 * @returns The header value to send over the wire.
 * @throws {Error} If any argument contains non-ASCII characters, control
 *   characters, or a delimiter (`;` for all of them, plus `/` for `appName` and
 *   `appVersion`).
 */
export function buildClientInfoHeader(args: AttributionArgs): string {
  const { appName, appVersion, appTitle, appUrl } = args
  const parts: string[] = [SOURCE_TOKEN]

  if (appName) {
    validateAttributionArg('app_name', appName, { forbidden: '/' })
    let client = appName
    if (appVersion) {
      validateAttributionArg('app_version', appVersion, { forbidden: '/' })
      client = `${client}/${appVersion}`
    }
    parts.push(`client=${client}`)
  }

  if (appTitle) {
    validateAttributionArg('app_title', appTitle)
    parts.push(`title=${appTitle}`)
  }

  if (appUrl) {
    validateAttributionArg('app_url', appUrl)
    parts.push(`url=${appUrl}`)
  }

  // The Node.js runtime version is not readable in n8n-Cloud-compatible shipped
  // source: the community-node rules forbid the `process`/`globalThis` globals
  // and the `node:process` import. Degrade to `unknown`, mirroring the Python
  // SDK's defensive `httpx/unknown` fallback when a version is unavailable. The
  // channel (`sdk`) and caller (`client=`) segments carry the useful analytics
  // dimensions; the runtime version is constant across n8n Cloud traffic.
  parts.push('ua=node/unknown')

  return parts.join('; ')
}
