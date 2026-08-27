# @youdotcom-oss/n8n-nodes-youdotcom

Add real time web search, page content extraction, AI powered deep research, finance research, and answer generation to your n8n workflows with the [You.com](https://you.com) API.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation) | [Operations](#operations) | [Credentials](#credentials) | [Usage](#usage) | [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

### Search

Search the web and news with up to date results. Supports advanced query operators (`site:`, `filetype:`, `+`, `-`, `AND`, `OR`, `NOT`), geographic/language filtering, domain allowlists/excludes/boosts, and content extraction (highlights or full page).

Great for monitoring mentions, pulling recent news, or feeding live data into AI agent workflows.

| Parameter | Description |
|-----------|-------------|
| Query | The search query (required) |
| Boost Domains | Boost ranking for these domains without excluding others (up to 500). Cannot combine with Include Domains |
| Count | Max results per section, 1-100 (default: 10) |
| Country | Two-letter country code to focus results geographically |
| Crawl Timeout | Max seconds to wait for page content with extraction, 1-60 (default: 10). Ignored when Extraction Mode is Highlights |
| Exclude Domains | Filter out results from these domains (up to 500). Cannot combine with Include Domains |
| Extraction | Controls how page content is attached to each result |
| Freshness | Filter by recency: day, week, month, or year |
| Include Domains | Restrict results to these domains, strict allowlist (up to 500). Cannot combine with Exclude Domains or Boost Domains |
| Language | BCP 47 language code for results (default: EN) |
| Offset | Pagination offset, 0-9 |
| Safe Search | Content filter: off, moderate, or strict |

**Extraction sub-options:**

| Sub-option | Description |
|------------|-------------|
| Extraction Mode | `highlights` returns query-relevant excerpts; `full_page` returns full HTML/Markdown (default: highlights) |
| Full Page > Extraction Formats | Format(s) returned for each result: markdown, HTML (default: markdown). Only shown when Extraction Mode is Full Page |

### Get Contents

Extract clean, structured content from one or more web pages. Returns page text as markdown or HTML, plus metadata like JSON-LD, OpenGraph, and Twitter Cards.

Useful for scraping product pages, pulling article text, or extracting structured data from any URL.

| Parameter | Description |
|-----------|-------------|
| URLs | One or more URLs to extract (required). Use the + button to add multiple URLs, or enter a comma-separated list |
| Crawl Timeout | Max seconds to wait for page content, 1-60 (default: 10) |
| Formats | Output formats: markdown, HTML, and/or metadata (JSON-LD, OpenGraph, Twitter Cards) |
| Max Age | Maximum allowed age of cached content in seconds. Set above 0 to enforce a freshness threshold; leave at 0 or unset for no age limit |

### Research

Get a comprehensive, cited answer to a complex question. The Research API searches the web, reads multiple sources, and synthesizes a detailed markdown response with inline numbered citations.

Perfect for competitive analysis, market research, technical due diligence, or any question that needs more than a simple search result.

| Parameter | Description |
|-----------|-------------|
| Input | The research question (required) |
| Research Effort | Controls depth and speed (see below, default: standard) |
| Background | Whether to queue the task and return a task handle immediately instead of waiting inline. Use Get Research Task to retrieve the result |
| Source Control | Beta. Controls which web sources the research agent searches (domain filters, freshness, country) |
| Output Schema | Beta. JSON Schema requesting structured JSON output. Supported with standard, deep, exhaustive, and frontier effort. Not supported with lite |

**Research Effort levels:**

| Level | Description |
|-------|-------------|
| Lite | Quick answers for straightforward questions |
| Standard | Balanced speed and depth (default) |
| Deep | More time researching and cross-referencing sources |
| Exhaustive | Most thorough option for complex research tasks |
| Frontier | Highest quality tier, requires Background mode |

### Answer

Get a synthesized answer with citations from web search results. The Answer API retrieves relevant web results and generates a concise answer with inline citations.

Great for factual questions that need a quick, sourced answer.

| Parameter | Description |
|-----------|-------------|
| Query | The search query (required, max 400 characters) |
| Freshness | Filter by recency: day, week, month, or year |
| Country | Country code for geographical focus |
| Language | BCP 47 language tag for results |
| Safe Search | Content filter: Default (server-chosen), off, moderate, or strict |
| Include Domains | Only return results from these domains (max 500). Cannot combine with Exclude or Boost |
| Exclude Domains | Filter out results from these domains (max 500). Cannot combine with Include |
| Boost Domains | Boost ranking for these domains (max 500). Cannot combine with Include |

### Finance Research

Get finance-grade research answers with citations from financial data sources. The Finance Research API is purpose-built for financial questions, with a retrieval index optimized for earnings reports, SEC filings, analyst coverage, and financial news.

| Parameter | Description |
|-----------|-------------|
| Input | The financial research question (required) |
| Finance Research Effort | Controls depth: deep (default) or exhaustive |

### Get Research Task

Poll the status of a background research task created with the Research operation's Background mode. When the task is completed, the result is included in the response. For a long-running task, put this behind a `Wait` node and loop until the status is no longer pending — this is the recommended pattern for retrieving background results, since it degrades gracefully (a poll that comes back "still running" just costs another loop iteration, nothing is ever lost to a timeout).

| Parameter | Description |
|-----------|-------------|
| Task ID | The UUID of the background research task (required) |

## Credentials

1. Go to [you.com/platform/api-keys](https://you.com/platform/api-keys) to get an API key
2. In n8n, go to Credentials and create a new "You.com API" credential
3. Paste your API key and save

### Attribution

Every API request includes an `X-Client-Info` attribution header that identifies this plugin automatically. No configuration is needed. The header looks like:

```
X-Client-Info: sdk; client=n8n-nodes-youdotcom/<version>; ua=node/unknown
```

The `sdk` channel token matches the You.com Python SDK. The `client=n8n-nodes-youdotcom/<version>` segment identifies the plugin and its version, the same convention LangChain uses (`client=langchain-youdotcom/<version>`). The `ua=node/unknown` segment reports the Node.js runtime; the version degrades to `unknown` because n8n Cloud compatibility rules forbid reading `process` in shipped source.

## Usage

1. Add the "You.com" node to your workflow
2. Select an operation (Search, Get Contents, Research, Answer, Finance Research, or Get Research Task)
3. Configure the parameters for your chosen operation
4. Run the workflow

This node also works as a tool for [AI agents in n8n](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/). Connect it to an agent node and let the agent decide when to search the web, extract page content, run deep research, or get a quick answer.

## Resources

- [You.com API docs](https://docs.you.com/)
- [n8n integration guide](https://docs.you.com/docs/integrations/n8n)
- [Web Search API reference](https://docs.you.com/docs/api-reference/search/v1-search)
- [Contents API reference](https://docs.you.com/docs/api-reference/contents)
- [Answer API reference](https://docs.you.com/docs/api-reference/answer/v1-answer)
- [Research API reference](https://docs.you.com/docs/api-reference/research/v1-research)
- [Finance Research API reference](https://docs.you.com/docs/api-reference/finance-research/v1-finance_research)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE)
