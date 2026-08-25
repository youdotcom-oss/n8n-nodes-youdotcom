/**
 * Build the `X-Client-Info` attribution header value for outbound API requests.
 *
 * Emits a caller-identity header so the analytics layer can distinguish traffic
 * sources. The n8n plugin is identified by:
 *
 * - The leading literal `sdk` (shared channel token for all You.com SDK/plugin
 *   traffic, matching the Python SDK).
 * - The `client=n8n-nodes-youdotcom/<version>` segment, which names this plugin
 *   and its version — the same convention LangChain uses
 *   (`client=langchain-youdotcom/<version>`).
 * - The `ua=node/unknown` segment, reporting the Node.js runtime. The n8n Cloud
 *   compatibility rules forbid reading `process`/`globalThis`/`node:process` in
 *   shipped source, so the runtime version degrades to `unknown`, mirroring the
 *   Python SDK's defensive `httpx/unknown` fallback.
 *
 * Grammar (segments joined by `"; "`):
 *
 *     sdk; client=n8n-nodes-youdotcom/<version>; ua=node/unknown
 *
 * The header is fully automatic — no user configuration needed. The plugin
 * version is passed in by the caller, keeping this module decoupled from the
 * node file's `PACKAGE_VERSION` constant.
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
 * @param name - Parameter name for error messages (e.g. `"pluginVersion"`).
 * @param value - Value to validate.
 * @param options.forbidden - Extra delimiter characters to reject, in addition
 *   to `;`. `pluginVersion` passes `"/"` because the `client=<name>/<version>`
 *   value is split on `/` downstream, so a `/` inside the version corrupts both.
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

/** Arguments for {@link buildClientInfoHeader}. */
export interface AttributionArgs {
  /** Plugin version, emitted as `client=n8n-nodes-youdotcom/<version>`. */
  pluginVersion: string
}

/** The fixed client name for this plugin, emitted in the `client=` segment. */
const CLIENT_NAME = 'n8n-nodes-youdotcom'

/**
 * Build the `X-Client-Info` header value for an outbound API request.
 *
 * @param args - Plugin version for the `client=` segment.
 * @returns The header value to send over the wire.
 * @throws {Error} If the plugin version contains non-ASCII characters, control
 *   characters, or a delimiter (`;` or `/`).
 */
export function buildClientInfoHeader(args: AttributionArgs): string {
  validateAttributionArg('pluginVersion', args.pluginVersion, { forbidden: '/' })

  const parts: string[] = [
    SOURCE_TOKEN,
    `client=${CLIENT_NAME}/${args.pluginVersion}`,
  ]

  // The Node.js runtime version is not readable in n8n-Cloud-compatible shipped
  // source: the community-node rules forbid the `process`/`globalThis` globals
  // and the `node:process` import. Degrade to `unknown`, mirroring the Python
  // SDK's defensive `httpx/unknown` fallback when a version is unavailable.
  parts.push('ua=node/unknown')

  return parts.join('; ')
}
