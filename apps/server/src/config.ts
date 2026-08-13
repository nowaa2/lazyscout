import { LOCAL_QA_POLICY, PUBLIC_SAAS_POLICY, type UrlPolicy } from '@lazyscout/core'

/**
 * One browser mode for every flow.
 *
 * Signing in, recording, scouting and running used to disagree — the login
 * browser was headed while everything that reused the session was headless.
 * An application that ties a session to the browser it was issued to will
 * reject the second one, so the mode is configured once here and shared.
 * Set `LAZYSCOUT_HEADED=1` to run everything visibly.
 */
export const headedBrowser = /^(1|true|yes)$/i.test(process.env.LAZYSCOUT_HEADED ?? '')

export const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 4000),
  urlPolicy: (process.env.LAZYSCOUT_MODE === 'public' ? PUBLIC_SAAS_POLICY : LOCAL_QA_POLICY) as UrlPolicy,
  /** Shared by Open login browser, Recorder, Scout and the Test runner. */
  headless: !headedBrowser,
  limits: {
    maxPages: 20,
    maxDepth: 3
  }
}

export function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback
  return Math.min(Math.max(Math.trunc(value), min), max)
}
