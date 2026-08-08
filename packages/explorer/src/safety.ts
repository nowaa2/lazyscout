/**
 * รายการคำที่บ่งชี้ว่า element อาจเปลี่ยนแปลง/ทำลายข้อมูล
 * Explorer จะ "ตรวจพบและบันทึก" element เหล่านี้ได้ แต่ห้ามคลิกเด็ดขาด
 */
const DESTRUCTIVE_KEYWORDS = [
  // English
  'delete', 'remove', 'destroy', 'erase', 'drop', 'reset',
  'purchase', 'buy', 'checkout', 'pay', 'payment', 'transfer', 'withdraw', 'refund',
  'send', 'submit order', 'place order', 'confirm payment', 'confirm order',
  'logout', 'log out', 'sign out', 'signout',
  'deactivate', 'disable account', 'delete account', 'close account',
  'unsubscribe', 'cancel subscription', 'archive', 'publish', 'approve', 'reject',
  // ไทย
  'ลบ', 'ยกเลิก', 'ชำระเงิน', 'จ่าย', 'โอน', 'ซื้อ', 'สั่งซื้อ', 'ยืนยันการชำระ',
  'ออกจากระบบ', 'ส่งข้อมูล', 'บันทึก'
]

/** ตรวจว่าข้อความบน element เข้าข่าย destructive หรือไม่ */
export function isDestructiveLabel(...labels: (string | undefined)[]): boolean {
  const haystack = labels.filter(Boolean).join(' ').toLowerCase()
  if (!haystack.trim()) return false
  return DESTRUCTIVE_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

/**
 * MVP: Explorer เดินทางด้วย link (href) เท่านั้น ไม่คลิกปุ่มและไม่ submit form
 * ทำให้ไม่มีทางเปลี่ยนสถานะข้อมูลของระบบที่กำลังทดสอบ
 */
export function canFollowLink(href: string | undefined, accessibleName: string | undefined): boolean {
  if (!href) return false
  if (isDestructiveLabel(accessibleName, href)) return false
  return true
}

export { DESTRUCTIVE_KEYWORDS }
