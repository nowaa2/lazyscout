import { isBlockedLabel } from '@lazyscout/core'

export { isBlockedLabel, normalizeBlockedKeywords, SUGGESTED_BLOCK_KEYWORDS, MAX_BLOCK_KEYWORDS } from '@lazyscout/core'

export function canFollowLink(
  href: string | undefined,
  accessibleName: string | undefined,
  keywords: readonly string[] = []
): boolean {
  if (!href) return false
  return !isBlockedLabel(keywords, accessibleName, href)
}
