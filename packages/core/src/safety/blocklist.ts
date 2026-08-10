/**
 * Only a suggestion. Nothing here is blocked unless a Project copies it into its
 * own click filter — the bot is meant to click what a tester would click, and a
 * built-in blocklist used to cut off most of an application behind a login.
 */
export const SUGGESTED_BLOCK_KEYWORDS = [
  'delete',
  'remove',
  'destroy',
  'erase',
  'drop',
  'reset',
  'purchase',
  'buy',
  'checkout',
  'pay',
  'payment',
  'transfer',
  'withdraw',
  'refund',
  'submit order',
  'place order',
  'confirm payment',
  'confirm order',
  'deactivate',
  'disable account',
  'delete account',
  'close account',
  'unsubscribe',
  'cancel subscription',
  'revoke access',
  'reset database',

  'ลบ',
  'ชำระเงิน',
  'จ่าย',
  'โอน',
  'ซื้อ',
  'สั่งซื้อ',
  'ยืนยันการชำระ'
]

/**
 * Session-ending action labels. The explorer must never click these automatically
 * because they would invalidate the authenticated session.
 */
export const SESSION_ENDING_KEYWORDS = [
  'log out',
  'logout',
  'log out',
  'sign out',
  'signout',
  'sign out',
  'ออกจากระบบ',
  'ออกจากระบบ'
]

/**
 * Checks whether the given label indicates a session-ending action.
 */
export function isSessionEndingLabel(...labels: (string | undefined)[]): boolean {
  const haystack = labels.filter(Boolean).join(' ').toLowerCase()
  if (!haystack.trim()) return false
  return SESSION_ENDING_KEYWORDS.some((keyword) => haystack.includes(keyword.toLowerCase()))
}

/** Actions that must never be clicked automatically, regardless of project settings. */
export function isUnsafeAutoClick(...labels: (string | undefined)[]): boolean {
  return isSessionEndingLabel(...labels)
}

export const MAX_BLOCK_KEYWORDS = 100
const MAX_KEYWORD_LENGTH = 80

/** Keywords are operator input, so they arrive unsorted, mixed case, or not at all. */
export function normalizeBlockedKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const cleaned = value
    .filter((keyword): keyword is string => typeof keyword === 'string')
    .map((keyword) => keyword.trim().toLowerCase().slice(0, MAX_KEYWORD_LENGTH))
    .filter(Boolean)
  return [...new Set(cleaned)].slice(0, MAX_BLOCK_KEYWORDS)
}

/** An empty list blocks nothing, which is the default for every Project. */
export function isBlockedLabel(keywords: readonly string[], ...labels: (string | undefined)[]): boolean {
  if (keywords.length === 0) return false
  const haystack = labels.filter(Boolean).join(' ').toLowerCase()
  if (!haystack.trim()) return false
  return keywords.some((keyword) => keyword && haystack.includes(keyword.toLowerCase()))
}
