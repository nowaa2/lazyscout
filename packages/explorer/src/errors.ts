import type { ExploreIssue, ExploreIssueCode } from '@lazyscout/core'

export function toExploreIssue(url: string, error: unknown): ExploreIssue {
  const raw = error instanceof Error ? error.message : String(error)
  const text = raw.toLowerCase()

  let code: ExploreIssueCode = 'navigation-failed'
  let message = 'could not open the page — navigation failed'

  if (text.includes('err_connection_refused') || text.includes('econnrefused')) {
    code = 'connection-refused'
    message = 'could not connect — connection refused'
  } else if (text.includes('err_name_not_resolved') || text.includes('enotfound')) {
    code = 'dns-error'
    message = 'could not resolve domain name — check the URL'
  } else if (text.includes('err_cert') || text.includes('ssl') || text.includes('err_bad_ssl')) {
    code = 'ssl-error'
    message = 'the SSL certificate of the website is invalid'
  } else if (text.includes('timeout') || text.includes('timed out')) {
    code = 'timeout'
    message = 'could not open the page — timeout'
  } else if (text.includes('crash')) {
    code = 'page-crash'
    message = 'could not open the page — page crash'
  } else if (text.includes('err_connection_timed_out')) {
    code = 'timeout'
    message = 'could not connect — connection timeout'
  } else if (text.includes('err_aborted')) {
    code = 'navigation-failed'
    message = 'could not open the page — navigation aborted'
  } else if (text.includes('executable doesn') || text.includes('browsertype.launch')) {
    code = 'browser-error'
    message = 'could not open the browser — run "npx playwright install chromium" first'
  }

  return { url, code, message }
}

export class ExplorerError extends Error {
  readonly code: ExploreIssueCode
  readonly hint?: string

  constructor(code: ExploreIssueCode, message: string, hint?: string) {
    super(message)
    this.name = 'ExplorerError'
    this.code = code
    this.hint = hint
  }
}
