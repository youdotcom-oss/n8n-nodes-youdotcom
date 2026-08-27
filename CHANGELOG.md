# Changelog

All notable changes to the n8n community node `@youdotcom-oss/n8n-nodes-youdotcom` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Research parity and three new operations, matching You.com Python SDK 3.1.2.**
  - **Research enhancements:** `background` (queue a task and return a handle), `source_control` collection (domain filters, freshness, country), `output_schema` (JSON Schema for structured output), and `frontier` research effort level (requires background mode). Frontier without background is blocked at execution time with a clear error.
  - **Answer** operation (`POST /v1/answer`): synthesized answer with citations from web search results. Supports freshness, country, language, safesearch, and domain filters.
  - **Finance Research** operation (`POST /v1/finance_research`): finance-grade research answers with citations from financial data sources. Supports deep and exhaustive effort levels.
  - **Get Research Task** operation (`GET /v1/research/{task_id}`): poll the status of a background research task. Combine with a `Wait` node in a loop to retrieve a Background research result — the recommended pattern for long-running tasks, since a poll that comes back "still running" just costs another loop iteration.
- **Contents parity with You.com Python SDK 3.1.2.** The Get Contents operation now supports the following:
  - **Multi-URL input.** The URLs field now supports multiple values via the + button. Comma-separated input is still accepted as a fallback for backward compatibility.
  - **Max Age.** New `max_age` parameter (0 or greater) controlling the maximum allowed age of cached content. Set above 0 to enforce a freshness threshold; leave at 0 or unset for no age limit (use cache regardless of age).
- **Search parity with You.com Python SDK 3.1.2.** The Search operation now sends a `POST` request with a JSON body (matching the SDK) instead of a `GET` with query string, enabling the following new parameters:
  - **Include Domains**, **Exclude Domains**, **Boost Domains** — multi-string domain filters (up to 500 each). Include Domains cannot combine with Exclude Domains or Boost Domains; the node blocks this at execution time with a clear error rather than round-tripping a 422.
  - **Extraction** collection with **Extraction Mode** (`highlights` or `full_page`) and a **Full Page** sub-collection containing **Extraction Formats** (`markdown`, `html`), replacing the removed Livecrawl options (see Removed below).
  - **Crawl Timeout** — max seconds to wait for page content (1-60, default 10). Automatically omitted when Extraction Mode is Highlights (the server rejects that combination).
- **Example workflows.** Added five importable n8n workflow JSON files under `examples/` demonstrating Search (with domain filters), Get Contents (multi-URL), Answer, Research (background + Get Research Task), and Finance Research.
- **`X-Client-Info` attribution header on every outbound request.** The header is automatic and requires no user configuration. Wire format: `sdk; client=n8n-nodes-youdotcom/<version>; ua=node/unknown`. The `sdk` channel token matches the You.com Python SDK. The `client=n8n-nodes-youdotcom/<version>` segment identifies the plugin and its version, the same convention LangChain uses. The `ua=node/unknown` segment reports the Node.js runtime; the version degrades to `unknown` because n8n Cloud compatibility rules forbid reading `process` in shipped source. The existing `User-Agent` header is unchanged.

### Changed

- Bumped `package.json` version to 0.6.0 and the in-source `PACKAGE_VERSION` constant to match.
- **Contents Crawl Timeout default changed from 30 to 10**, matching the Python SDK default.
- Set `n8n.strict` to `false`. The strict config-integrity check forbids any `eslint.config.mjs` change, which blocked scoping the `bun:test` allowance to test files. Shipped source (`credentials/`, `nodes/`) still passes the full n8n Cloud compatibility rule set; only non-shipped test files get the scoped override.

### Removed

- **Search's Livecrawl and Livecrawl Format parameters.** Replaced by the new Extraction collection; existing workflows that set Livecrawl must switch to Extraction (Full Page) to keep receiving full-page content.

### Fixed

- **`bun run lint` (`n8n-node lint`) now passes.** Added a scoped eslint override for `tests/**` allowing the `bun:test` import that the test runner requires. Test files are not shipped (only `dist/` is published), so the n8n Cloud compatibility rule is relaxed for them alone; shipped source (`credentials/`, `nodes/`) keeps the full rule set.
