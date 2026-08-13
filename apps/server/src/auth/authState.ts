import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { BrowserContext, Page } from 'playwright-core'
import { readSessionStorage, writeSessionStorage } from '@lazyscout/explorer'

/**
 * Reusable authentication state.
 *
 * A Chromium profile directory alone is not enough to carry a login between
 * runs: session cookies — the ones without an Expires or Max-Age, which is what
 * most applications use to hold a refresh token — live in memory and are gone
 * the moment the browser closes. `context.storageState()` serialises every
 * cookie, session ones included, so a snapshot survives where the profile does
 * not.
 *
 * Nothing here logs or returns a cookie value, a token, or a header. Only
 * counts, names of origins, and timestamps ever leave this module.
 */

/** Shape Playwright accepts back through `newContext({ storageState })`. */
export type StorageState = {
  cookies: Array<{ name: string; domain: string; path: string; expires: number }>
  origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>
}

/** Per-origin sessionStorage, which `storageState()` does not include. */
export type SessionStorageSnapshot = Array<{ origin: string; items: Array<{ name: string; value: string }> }>

export type AuthSnapshot = {
  storageState: StorageState
  sessionStorage: SessionStorageSnapshot
}

export type AuthStatusName = 'not-configured' | 'recorded' | 'verifying' | 'ready' | 'expired' | 'invalid'

export type AuthMeta = {
  status: AuthStatusName
  capturedAt?: string
  verifiedAt?: string
  /** Counts only — never the values themselves. */
  cookieCount?: number
  sessionCookieCount?: number
  originCount?: number
  sessionStorageOriginCount?: number
  indexedDb?: boolean
  /** Whether the browser that captured this snapshot was headless. */
  capturedHeadless?: boolean
  /** Path used to prove the snapshot still works. */
  verifiedPath?: string
  detail?: string
}

const EMPTY_META: AuthMeta = { status: 'not-configured' }

function authDirectory(projectDirectory: string): string {
  return join(projectDirectory, 'auth')
}

export function authStatePath(projectDirectory: string): string {
  return join(authDirectory(projectDirectory), 'storage-state.json')
}

export function authMetaPath(projectDirectory: string): string {
  return join(authDirectory(projectDirectory), 'meta.json')
}

async function writeJsonPrivate(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  // mode 0600: the snapshot is credential-equivalent material.
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

/**
 * Wait until the sign-in has stopped changing the browser's storage.
 *
 * Polls for a stable cookie signature rather than sleeping for a fixed time:
 * an app that redirects, exchanges a code and then sets its real cookie would
 * otherwise be captured mid-flight. Only cookie names, domains and expiry
 * flags form the signature — values are never read into it.
 */
export async function waitForAuthSettle(
  context: BrowserContext,
  page: Page | undefined,
  options: { pollMs?: number; stableSamples?: number; timeoutMs?: number; log?: (message: string) => void } = {}
): Promise<void> {
  const pollMs = options.pollMs ?? 250
  const stableSamples = options.stableSamples ?? 3
  const timeoutMs = options.timeoutMs ?? 10_000
  const startedAt = Date.now()

  options.log?.('[Auth] Waiting for session stabilization')
  await page?.waitForLoadState('networkidle', { timeout: Math.min(5_000, timeoutMs) }).catch(() => undefined)

  let previous = ''
  let stable = 0
  while (Date.now() - startedAt < timeoutMs) {
    const cookies = await context.cookies().catch(() => [])
    const signature = cookies
      .map((cookie) => `${cookie.domain}|${cookie.path}|${cookie.name}|${cookie.expires > 0 ? 'p' : 's'}`)
      .sort()
      .join(',')
    if (signature === previous) {
      stable += 1
      if (stable >= stableSamples) return
    } else {
      previous = signature
      stable = 0
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
}

/** sessionStorage is per-tab and absent from storageState, so it is read directly. */
async function captureSessionStorage(context: BrowserContext): Promise<SessionStorageSnapshot> {
  const snapshot: SessionStorageSnapshot = []
  for (const page of context.pages()) {
    if (page.isClosed()) continue
    try {
      const origin = new URL(page.url()).origin
      if (!origin.startsWith('http')) continue
      if (snapshot.some((entry) => entry.origin === origin)) continue
      const items = await page.evaluate(readSessionStorage)
      if (items.length) snapshot.push({ origin, items })
    } catch {
      // A page can navigate or close mid-capture; skip it rather than fail.
    }
  }
  return snapshot
}

/**
 * Serialise the authenticated context. IndexedDB is included when the installed
 * Playwright supports the option, since some applications keep their tokens
 * there; older versions simply reject the argument and are retried without it.
 */
export async function captureAuthSnapshot(
  context: BrowserContext,
  options: { log?: (message: string) => void } = {}
): Promise<{ snapshot: AuthSnapshot; indexedDb: boolean }> {
  let indexedDb = true
  let storageState: StorageState
  try {
    storageState = (await context.storageState({ indexedDB: true } as Parameters<
      BrowserContext['storageState']
    >[0])) as StorageState
  } catch {
    indexedDb = false
    storageState = (await context.storageState()) as StorageState
  }
  const sessionStorage = await captureSessionStorage(context)
  options.log?.('[Auth] Storage state captured')
  return { snapshot: { storageState, sessionStorage }, indexedDb }
}

function describe(snapshot: AuthSnapshot, indexedDb: boolean, capturedHeadless: boolean): AuthMeta {
  const cookies = snapshot.storageState.cookies ?? []
  return {
    status: 'recorded',
    capturedAt: new Date().toISOString(),
    cookieCount: cookies.length,
    // Expiry <= 0 means the cookie dies with the browser — exactly the kind a
    // profile directory loses and this snapshot preserves.
    sessionCookieCount: cookies.filter((cookie) => !(cookie.expires > 0)).length,
    originCount: (snapshot.storageState.origins ?? []).length,
    sessionStorageOriginCount: snapshot.sessionStorage.length,
    indexedDb,
    capturedHeadless
  }
}

/** Persist the snapshot next to the Project, readable only by this user. */
export async function saveAuthSnapshot(
  projectDirectory: string,
  snapshot: AuthSnapshot,
  options: { indexedDb: boolean; capturedHeadless: boolean; log?: (message: string) => void }
): Promise<AuthMeta> {
  const meta = describe(snapshot, options.indexedDb, options.capturedHeadless)
  await writeJsonPrivate(authStatePath(projectDirectory), snapshot)
  await writeJsonPrivate(authMetaPath(projectDirectory), meta)
  options.log?.('[Auth] Auth snapshot saved')
  return meta
}

export async function loadAuthSnapshot(projectDirectory: string): Promise<AuthSnapshot | undefined> {
  const snapshot = await readJson<AuthSnapshot | undefined>(authStatePath(projectDirectory), undefined)
  if (!snapshot?.storageState) return undefined
  return { storageState: snapshot.storageState, sessionStorage: snapshot.sessionStorage ?? [] }
}

export async function readAuthMeta(projectDirectory: string): Promise<AuthMeta> {
  return readJson<AuthMeta>(authMetaPath(projectDirectory), EMPTY_META)
}

export async function updateAuthMeta(projectDirectory: string, patch: Partial<AuthMeta>): Promise<AuthMeta> {
  const next = { ...(await readAuthMeta(projectDirectory)), ...patch }
  await writeJsonPrivate(authMetaPath(projectDirectory), next)
  return next
}

export async function clearAuthSnapshot(projectDirectory: string): Promise<void> {
  await rm(authDirectory(projectDirectory), { recursive: true, force: true })
}

/**
 * Re-apply the parts of a snapshot that `newContext({ storageState })` cannot:
 * sessionStorage, which is per-tab and therefore never part of storageState.
 */
export async function restoreSessionStorage(
  context: BrowserContext,
  sessionStorage: SessionStorageSnapshot
): Promise<void> {
  if (sessionStorage.length === 0) return
  await context.addInitScript(writeSessionStorage, sessionStorage)
}

/**
 * Prove the restored snapshot still authenticates, by opening a protected path
 * and checking the application did not send us back to a sign-in screen.
 */
export async function verifyAuthState(
  page: Page,
  protectedUrl: string,
  options: { timeoutMs?: number; log?: (message: string) => void } = {}
): Promise<{ ok: boolean; landedOn: string; detail?: string }> {
  options.log?.('[Auth] Verifying protected state')
  try {
    await page.goto(protectedUrl, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs ?? 20_000 })
  } catch (error) {
    return { ok: false, landedOn: page.url(), detail: error instanceof Error ? error.message : 'navigation failed' }
  }
  const landedOn = page.url()
  if (looksLikeSignIn(landedOn, protectedUrl)) {
    return { ok: false, landedOn, detail: 'redirected to a sign-in page' }
  }
  return { ok: true, landedOn }
}

/**
 * Only treats a sign-in path as a failure when it is somewhere the request did
 * not ask to go — verifying against the sign-in page itself is not a failure.
 */
export function looksLikeSignIn(landedOn: string, requested: string): boolean {
  try {
    const landedPath = new URL(landedOn).pathname.toLowerCase()
    const requestedPath = new URL(requested, landedOn).pathname.toLowerCase()
    const isSignIn = /\/(login|signin|sign-in|auth)(\/|$)/.test(landedPath)
    return isSignIn && !/\/(login|signin|sign-in|auth)(\/|$)/.test(requestedPath)
  } catch {
    return false
  }
}
