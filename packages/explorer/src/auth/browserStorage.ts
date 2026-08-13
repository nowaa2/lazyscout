/**
 * Browser-side halves of the auth snapshot.
 *
 * `context.storageState()` covers cookies, localStorage and — on a recent
 * enough Playwright — IndexedDB, but never sessionStorage, which belongs to a
 * tab rather than to the profile. These two functions are serialised into the
 * page to carry it across, and live here because this package is the one
 * compiled with DOM types.
 */

export type SessionStorageItem = { name: string; value: string }
export type SessionStorageOrigin = { origin: string; items: SessionStorageItem[] }

/** Read the current origin's sessionStorage. Runs inside the page. */
export function readSessionStorage(): SessionStorageItem[] {
  try {
    const items: SessionStorageItem[] = []
    for (let index = 0; index < window.sessionStorage.length; index++) {
      const name = window.sessionStorage.key(index)
      if (name === null) continue
      items.push({ name, value: window.sessionStorage.getItem(name) ?? '' })
    }
    return items
  } catch {
    // Storage can be denied by the page's own policy.
    return []
  }
}

/**
 * Re-apply sessionStorage for whichever origin the document belongs to. Runs
 * as an init script so it lands before the application's own boot code reads
 * the value it is looking for.
 */
export function writeSessionStorage(origins: SessionStorageOrigin[]): void {
  try {
    const match = origins.find((entry) => entry.origin === window.location.origin)
    if (!match) return
    for (const item of match.items) window.sessionStorage.setItem(item.name, item.value)
  } catch {
    // Never break the site under test over a restore.
  }
}
