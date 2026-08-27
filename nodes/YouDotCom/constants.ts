/**
 * Values shared across the node, credentials, and Attribution modules.
 * Kept in their own module (not YouDotCom.node.ts) so importing them doesn't
 * pull the entire node — its UI schema, dropdown option lists, and execute
 * logic — into the credentials bundle.
 */

/** npm package short name, used in the User-Agent header and the X-Client-Info `client=` segment. */
export const PLUGIN_NAME = 'n8n-nodes-youdotcom'

/** Base URL for the Search and Contents endpoints. Also used by the credential Test request. */
export const SEARCH_API_BASE = 'https://ydc-index.io'

/** Base URL for the Research, Answer, and Finance Research endpoints. */
export const RESEARCH_API_BASE = 'https://api.you.com'
