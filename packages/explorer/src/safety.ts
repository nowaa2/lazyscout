

const DESTRUCTIVE_KEYWORDS = [

  'delete', 'remove', 'destroy', 'erase', 'drop', 'reset',
  'purchase', 'buy', 'checkout', 'pay', 'payment', 'transfer', 'withdraw', 'refund',
  'send', 'submit order', 'place order', 'confirm payment', 'confirm order',
  'logout', 'log out', 'sign out', 'signout',
  'deactivate', 'disable account', 'delete account', 'close account',
  'unsubscribe', 'cancel subscription', 'archive', 'publish', 'approve', 'reject',

  'ลบ', 'ยกเลิก', 'ชำระเงิน', 'จ่าย', 'โอน', 'ซื้อ', 'สั่งซื้อ', 'ยืนยันการชำระ',
  'ออกจากระบบ', 'ส่งข้อมูล', 'บันทึก'
]

export function isDestructiveLabel(...labels: (string | undefined)[]): boolean {
  const haystack = labels.filter(Boolean).join(' ').toLowerCase()
  if (!haystack.trim()) return false
  return DESTRUCTIVE_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

export function canFollowLink(href: string | undefined, accessibleName: string | undefined): boolean {
  if (!href) return false
  if (isDestructiveLabel(accessibleName, href)) return false
  return true
}

export { DESTRUCTIVE_KEYWORDS }
