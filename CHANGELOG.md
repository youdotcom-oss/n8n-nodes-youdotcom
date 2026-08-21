# Changelog

All notable changes to the n8n community node `@youdotcom-oss/n8n-nodes-youdotcom` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`X-Client-Info` attribution header on every outbound request.** Optional `App Name`, `App Version`, `App Title`, and `App URL` credential fields identify the calling application in the `X-Client-Info` header. Wire format: `sdk; client=<name>[/<version>][; title=<title>][; url=<url>]; ua=node/unknown`. When all four are unset, the channel-only `sdk; ua=node/unknown` header is sent, matching the You.com Python SDK philosophy where `client=` is caller identity and dropped when the caller is undeclared. Values must be printable ASCII; `;` is rejected on all fields and `/` on `App Name` and `App Version`; invalid values raise at execution time rather than being silently coerced. `App Version` requires `App Name`. The `ua=` segment reports `node/unknown` because n8n Cloud compatibility rules forbid reading the Node runtime version in shipped source, mirroring the Python SDK's defensive fallback when a version is unavailable. The existing `User-Agent` header is unchanged.

### Changed

- Bumped `package.json` version to 0.3.0 and the in-source `PACKAGE_VERSION` constant to match.
- Set `n8n.strict` to `false`. The strict config-integrity check forbids any `eslint.config.mjs` change, which blocked scoping the `bun:test` allowance to test files. Shipped source (`credentials/`, `nodes/`) still passes the full n8n Cloud compatibility rule set; only non-shipped test files get the scoped override.

### Fixed

- **`bun run lint` (`n8n-node lint`) now passes.** Added a scoped eslint override for `tests/**` allowing the `bun:test` import that the test runner requires. Test files are not shipped (only `dist/` is published), so the n8n Cloud compatibility rule is relaxed for them alone; shipped source (`credentials/`, `nodes/`) keeps the full rule set.
