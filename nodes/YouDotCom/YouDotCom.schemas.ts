import { z } from 'zod'

/**
 * Search operation options schema
 *
 * @remarks
 * Validates search parameters from n8n node configuration
 */
export const SearchOptionsSchema = z.object({
  count: z.number().int().min(1).max(100).optional().describe('Number of search results to return (1-100)'),
  country: z.string().optional().describe('Two-letter country code to filter results (e.g., US, GB)'),
  freshness: z.enum(['day', 'week', 'month', 'year']).optional().describe('Filter results by recency'),
  language: z.string().optional().describe('BCP 47 language code to filter results (e.g., en, es, fr)'),
  livecrawl: z.enum(['web', 'news', 'all']).optional().describe('Type of content to crawl in real-time'),
  livecrawl_formats: z.enum(['html', 'markdown']).optional().describe('Format for live-crawled content'),
  offset: z.number().int().min(0).max(9).optional().describe('Pagination offset for search results (0-9)'),
  safesearch: z.enum(['off', 'moderate', 'strict']).optional().describe('Safe search filtering level'),
})

export type SearchOptions = z.infer<typeof SearchOptionsSchema>

/**
 * Search API response schema
 *
 * @remarks
 * Validates response structure from You.com Search API.
 * Uses passthrough() to preserve all API fields (snippets, page_age, etc.)
 */
const WebResultSchema = z
  .object({
    url: z.string().describe('URL of the search result'),
    title: z.string().describe('Title of the search result'),
    description: z.string().describe('Description snippet of the search result'),
    snippets: z.array(z.string()).optional().describe('Content snippets'),
    page_age: z.string().optional().describe('Publication timestamp'),
  })
  .passthrough()

const NewsResultSchema = z
  .object({
    url: z.string().describe('URL of the news article'),
    title: z.string().describe('Title of the news article'),
    description: z.string().describe('Description snippet of the news article'),
    page_age: z.string().optional().describe('Publication timestamp'),
  })
  .passthrough()

const MetadataSchema = z
  .object({
    search_uuid: z.string().optional().describe('Unique search request ID'),
    query: z.string().optional().describe('Query that was searched'),
    latency: z.number().optional().describe('Latency in seconds'),
  })
  .passthrough()

export const SearchResponseSchema = z
  .object({
    results: z
      .object({
        web: z.array(WebResultSchema).optional().describe('Web search results'),
        news: z.array(NewsResultSchema).optional().describe('News search results'),
      })
      .passthrough(),
    metadata: MetadataSchema.optional(),
  })
  .passthrough()

export type SearchResponse = z.infer<typeof SearchResponseSchema>

/**
 * Contents operation options schema
 *
 * @remarks
 * Validates content extraction parameters from n8n node configuration
 */
export const ContentsOptionsSchema = z.object({
  formats: z
    .array(z.enum(['markdown', 'html', 'metadata']))
    .optional()
    .describe('Output formats for extracted content'),
  crawl_timeout: z.number().int().min(1).max(60).optional().describe('Timeout in seconds for content crawling (1-60)'),
})

export type ContentsOptions = z.infer<typeof ContentsOptionsSchema>

/**
 * Contents API response schema
 *
 * @remarks
 * Validates response structure from You.com Contents API.
 * Uses passthrough() to preserve all API fields.
 */
export const ContentsResponseSchema = z.array(
  z
    .object({
      url: z.string().url().describe('URL of the extracted content'),
      markdown: z.string().optional().describe('Content in Markdown format'),
      html: z.string().optional().describe('Content in HTML format'),
      metadata: z.record(z.string(), z.unknown()).optional().describe('Metadata extracted from the page'),
    })
    .passthrough(),
)

export type ContentsResponse = z.infer<typeof ContentsResponseSchema>
