import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow'

/**
 * You.com API credentials for n8n.
 *
 * NOTE: n8n framework requires class-based credentials that implement ICredentialType.
 */
export class YouDotComApi implements ICredentialType {
  name = 'youDotComApi'
  displayName = 'You.com API'
  icon = { light: 'file:youdotcom.svg', dark: 'file:youdotcom.svg' } as const
  documentationUrl = 'https://docs.you.com/get-started/quickstart'
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description:
        'Your You.com API key. Get one at <a href="https://you.com/platform/api-keys" target="_blank">you.com/platform/api-keys</a>',
    },
    {
      displayName: 'App Name',
      name: 'appName',
      type: 'string',
      default: '',
      description:
        'Optional. Identifies your application in the X-Client-Info attribution header as client=<name>[/<version>]. Must be printable ASCII with no semicolons or slashes. Leave blank to send the channel-only header.',
    },
    {
      displayName: 'App Version',
      name: 'appVersion',
      type: 'string',
      default: '',
      description:
        'Optional. Paired with App Name as client=<name>/<version>. Requires App Name. Must be printable ASCII with no semicolons or slashes.',
    },
    {
      displayName: 'App Title',
      name: 'appTitle',
      type: 'string',
      default: '',
      description:
        'Optional. Caller-facing application title, sent as the title= segment. Must be printable ASCII with no semicolons.',
    },
    {
      displayName: 'App URL',
      name: 'appUrl',
      type: 'string',
      default: '',
      description:
        'Optional. Caller-facing application URL, sent as the url= segment. Must be printable ASCII with no semicolons.',
    },
  ]

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'X-API-Key': '={{$credentials.apiKey}}',
      },
    },
  }

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://ydc-index.io',
      url: '/v1/search',
      method: 'GET',
      qs: {
        query: 'test',
        count: 1,
      },
    },
  }
}
