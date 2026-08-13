import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * One holder at a time per Project auth profile.
 *
 * An application that rotates refresh tokens issues a new one and revokes the
 * old on every use. Two runs sharing one snapshot therefore destroy each
 * other's session — and a server that detects the reuse may revoke the whole
 * token family. The lock makes that impossible by default rather than leaving
 * it to the operator to remember.
 *
 * The lock is a file so it also holds between the server and a separate CLI
 * process, and it carries a pid and a timestamp so a crashed holder cannot
 * block the Project forever.
 */

export type AuthLockHolder = 'scout' | 'recorder' | 'runner' | 'login-browser'

export type AuthLockInfo = {
  holder: AuthLockHolder
  pid: number
  since: string
}

export class AuthProfileBusyError extends Error {
  readonly code = 'auth-profile-busy'
  constructor(readonly current: AuthLockInfo) {
    super(
      `The authenticated profile is in use by ${current.holder} (pid ${current.pid}). ` +
        'Running two of them against one saved session makes an application that rotates refresh tokens sign both out.'
    )
    this.name = 'AuthProfileBusyError'
  }
}

/** A holder that has not released within this long is treated as crashed. */
const STALE_AFTER_MS = 15 * 60 * 1000

function lockPath(projectDirectory: string): string {
  return join(projectDirectory, 'auth', 'lock.json')
}

function isAlive(pid: number): boolean {
  if (pid === process.pid) return true
  try {
    // Signal 0 performs the permission and existence check without delivering.
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** The lock file exactly as written, with no staleness judgement applied. */
async function readRawLock(projectDirectory: string): Promise<AuthLockInfo | undefined> {
  try {
    const raw = JSON.parse(await readFile(lockPath(projectDirectory), 'utf8')) as AuthLockInfo
    return raw?.pid && raw.since ? raw : undefined
  } catch {
    return undefined
  }
}

/** The lock as an acquirer sees it: a crashed or ancient holder does not count. */
async function readLock(projectDirectory: string): Promise<AuthLockInfo | undefined> {
  const raw = await readRawLock(projectDirectory)
  if (!raw) return undefined
  const age = Date.now() - new Date(raw.since).getTime()
  if (age > STALE_AFTER_MS || !isAlive(raw.pid)) return undefined
  return raw
}

/**
 * Take the lock, returning a release function. Throws {@link AuthProfileBusyError}
 * when another live holder has it.
 */
export async function acquireAuthLock(
  projectDirectory: string,
  holder: AuthLockHolder,
  options: { log?: (message: string) => void } = {}
): Promise<() => Promise<void>> {
  const current = await readLock(projectDirectory)
  if (current) throw new AuthProfileBusyError(current)

  const info: AuthLockInfo = { holder, pid: process.pid, since: new Date().toISOString() }
  const path = lockPath(projectDirectory)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(info, null, 2)}\n`, { mode: 0o600 })
  options.log?.(`[Auth] Profile locked by ${holder}`)

  let released = false
  return async () => {
    if (released) return
    released = true
    // Only clear a lock this process still owns. The raw file is read rather
    // than the filtered view: a successor's lock must survive our release even
    // if that successor would itself be judged stale.
    const held = await readRawLock(projectDirectory)
    if (held && held.pid !== process.pid) return
    await rm(path, { force: true }).catch(() => undefined)
    options.log?.(`[Auth] Profile released by ${holder}`)
  }
}

export async function currentAuthLock(projectDirectory: string): Promise<AuthLockInfo | undefined> {
  return readLock(projectDirectory)
}

export async function clearAuthLock(projectDirectory: string): Promise<void> {
  await rm(lockPath(projectDirectory), { force: true }).catch(() => undefined)
}
