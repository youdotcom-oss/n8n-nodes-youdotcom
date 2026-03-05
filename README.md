# @youdotcom-oss/n8n-nodes-youdotcom

Add real time web search, page content extraction, and AI powered deep research to your n8n workflows with the [You.com](https://you.com) API.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation) | [Operations](#operations) | [Credentials](#credentials) | [Usage](#usage) | [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

### Search

Search the web and news with up to date results. Supports advanced query operators (`site:`, `filetype:`, `+`, `-`, `AND`, `OR`, `NOT`) and geographic/language filtering.

Great for monitoring mentions, pulling recent news, or feeding live data into AI agent workflows.

| Parameter | Description |
|-----------|-------------|
| Query | The search query (required) |
| Count | Max results per section, 1-100 (default: 10) |
| Country | Two-letter country code to focus results geographically |
| Freshness | Filter by recency: day, week, month, or year |
| Language | BCP 47 language code for results (default: EN) |
| Livecrawl | Fetch full page content for web, news, or all results |
| Livecrawl Format | Format for livecrawled content: markdown or HTML |
| Offset | Pagination offset, 0-9 |
| Safe Search | Content filter: off, moderate, or strict |

### Get Contents

Extract clean, structured content from one or more web pages. Returns page text as markdown or HTML, plus metadata like JSON-LD, OpenGraph, and Twitter Cards.

Useful for scraping product pages, pulling article text, or extracting structured data from any URL.

| Parameter | Description |
|-----------|-------------|
| URLs | Comma-separated list of URLs to extract (required) |
| Formats | Output formats: markdown, HTML, and/or metadata (JSON-LD, OpenGraph, Twitter Cards) |
| Crawl Timeout | Timeout in seconds for page crawling, 1-60 (default: 30) |

### Research

Get a comprehensive, cited answer to a complex question. The Research API searches the web, reads multiple sources, and synthesizes a detailed markdown response with inline numbered citations.

Perfect for competitive analysis, market research, technical due diligence, or any question that needs more than a simple search result.

| Parameter | Description |
|-----------|-------------|
| Input | The research question (required) |
| Research Effort | Controls depth and speed (see below, default: standard) |

**Research Effort levels:**

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

This node also works as a tool for [AI agents in n8n](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/). Connect it to an agent node and let the agent decide when to search the web, extract page content, or run deep research.

## Resources

- [You.com API docs](https://docs.you.com/)
- [Search API reference](https://docs.you.com/api-reference/search)
- [Contents API reference](https://docs.you.com/api-reference/contents)
- [Research API reference](https://docs.you.com/api-reference/research)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE)
