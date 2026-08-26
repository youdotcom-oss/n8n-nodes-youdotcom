# Changelog

All notable changes to the n8n community node `@youdotcom-oss/n8n-nodes-youdotcom` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Research parity and four new operations, matching You.com Python SDK 3.1.2.**
  - **Research enhancements:** `background` (queue a task and return a handle), `source_control` collection (domain filters, freshness, country), `output_schema` (JSON Schema for structured output), and `frontier` research effort level (requires background mode). Frontier without background is blocked at execution time with a clear error.
  - **Answer** operation (`POST /v1/answer`): synthesized answer with citations from web search results. Supports freshness, country, language, safesearch, and domain filters.
  - **Finance Research** operation (`POST /v1/finance_research`): finance-grade research answers with citations from financial data sources. Supports deep and exhaustive effort levels.
  - **Get Research Task** operation (`GET /v1/research/{task_id}`): poll the status of a background research task.
  - **Stream Research Task** operation (`GET /v1/research/{task_id}/stream`): stream real-time updates for a background research task via Server-Sent Events, with a `from_id` parameter for reconnection.
- **Contents parity with You.com Python SDK 3.1.2.** The Get Contents operation now supports the following:
  - **Multi-URL input.** The URLs field now supports multiple values via the + button. Comma-separated input is still accepted as a fallback for backward compatibility.
  - **Max Age.** New `max_age` parameter (0 or greater) controlling the maximum allowed age of cached content. 0 means always re-fetch; leave unset for no age limit (use cache regardless of age).
- **Search parity with You.com Python SDK 3.1.2.** The Search operation now sends a `POST` request with a JSON body (matching the SDK) instead of a `GET` with query string, enabling the following new parameters:
  - **Include Domains**, **Exclude Domains**, **Boost Domains** — multi-string domain filters (up to 500 each). Include Domains cannot combine with Exclude Domains or Boost Domains; the node blocks this at execution time with a clear error rather than round-tripping a 422.
  - **Extraction** collection with **Extraction Mode** (`highlights` or `full_page`) and a **Full Page** sub-collection containing **Extraction Formats** (`markdown`, `html`). When Extraction is set, the deprecated Livecrawl options are omitted from the request.
  - **Crawl Timeout** — max seconds to wait for page content (1-60, default 10). Automatically omitted when Extraction Mode is Highlights (the server rejects that combination).
- **`X-Client-Info` attribution header on every outbound request.** Optional `App Name`, `App Version`, `App Title`, and `App URL` credential fields identify the calling application in the `X-Client-Info` header. Wire format: `sdk; client=<name>[/<version>][; title=<title>][; url=<url>]; ua=node/unknown`. When all four are unset, the channel-only `sdk; ua=node/unknown` header is sent, matching the You.com Python SDK philosophy where `client=` is caller identity and dropped when the caller is undeclared. Values must be printable ASCII; `;` is rejected on all fields and `/` on `App Name` and `App Version`; invalid values raise at execution time rather than being silently coerced. `App Version` requires `App Name`. The `ua=` segment reports `node/unknown` because n8n Cloud compatibility rules forbid reading the Node runtime version in shipped source, mirroring the Python SDK's defensive fallback when a version is unavailable. The existing `User-Agent` header is unchanged.

### Changed

- Bumped `package.json` version to 0.6.0 and the in-source `PACKAGE_VERSION` constant to match.
- Bumped `package.json` version to 0.5.0 and the in-source `PACKAGE_VERSION` constant to match.
- **Contents Crawl Timeout default changed from 30 to 10**, matching the Python SDK default.
- Bumped `package.json` version to 0.4.0 and the in-source `PACKAGE_VERSION` constant to match.
- **Livecrawl and Livecrawl Format are marked deprecated.** Use the new Extraction collection instead. When both Extraction and Livecrawl are set, Extraction takes precedence and Livecrawl is omitted.
- Bumped `package.json` version to 0.3.0 and the in-source `PACKAGE_VERSION` constant to match.
- Set `n8n.strict` to `false`. The strict config-integrity check forbids any `eslint.config.mjs` change, which blocked scoping the `bun:test` allowance to test files. Shipped source (`credentials/`, `nodes/`) still passes the full n8n Cloud compatibility rule set; only non-shipped test files get the scoped override.

### Fixed

- **`bun run lint` (`n8n-node lint`) now passes.** Added a scoped eslint override for `tests/**` allowing the `bun:test` import that the test runner requires. Test files are not shipped (only `dist/` is published), so the n8n Cloud compatibility rule is relaxed for them alone; shipped source (`credentials/`, `nodes/`) keeps the full rule set.
