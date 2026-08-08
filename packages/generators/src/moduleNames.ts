import type { PageInfo } from '@lazyscout/core'
import { moduleNameFromUrl } from '@lazyscout/core'

export function assignModules(pages: PageInfo[]): Map<string, string> {
  const result = new Map<string, string>()
  const used = new Map<string, number>()

  for (const page of pages) {
    const base = moduleNameFromUrl(page.finalUrl)
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    result.set(page.url, count === 0 ? base : `${base}-${count + 1}`)
  }

  return result
}
