# @youdotcom-oss/n8n-nodes-youdotcom

This is an n8n community node for the [You.com](https://you.com) API. It provides web search, content extraction, and multi-step research capabilities for your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation) | [Operations](#operations) | [Credentials](#credentials) | [Usage](#usage) | [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

### Search

Search the web and news using You.com. Supports advanced query operators (`site:`, `filetype:`, `+`, `-`, `AND`, `OR`, `NOT`) and filtering by country, language, freshness, and safe search level. Optionally livecrawl results to get full page content in markdown or HTML.

### Get Contents

Extract content from one or more URLs. Returns cleaned markdown, full HTML, and/or structured metadata (JSON-LD, OpenGraph, Twitter Cards). Configurable crawl timeout.

### Research

Get a comprehensive, cited answer to a complex question. The Research API performs multi-step investigation and returns a markdown answer with inline numbered citations and a list of sources.

**Research Effort** controls depth and speed:

| Level | Description |
|-------|-------------|
| Lite | Quick answers for straightforward questions |
| Standard | Balanced speed and depth (default) |
| Deep | More time researching and cross-referencing sources |
| Exhaustive | Most thorough option for complex research tasks |

## Credentials

1. Go to [you.com/platform/api-keys](https://you.com/platform/api-keys) to get an API key
2. In n8n, go to Credentials and create a new "You.com API" credential
3. Paste your API key and save

## Usage

1. Add the "You.com" node to your workflow
2. Select an operation (Search, Get Contents, or Research)
3. Configure the parameters for your chosen operation
4. Run the workflow

The node is also usable as a tool for AI agents in n8n.

## Resources

- [You.com API docs](https://docs.you.com/)
- [Search API reference](https://docs.you.com/api-reference/search)
- [Contents API reference](https://docs.you.com/api-reference/search/contents)
- [Research API reference](https://docs.you.com/api-reference/research)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE)
