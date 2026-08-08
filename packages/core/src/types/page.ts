/**
 * Normalized Page Model
 * โครงสร้างกลางที่อธิบาย "หน้าเว็บหนึ่งหน้า" หลังจาก Explorer สำรวจเสร็จ
 * ไฟล์นี้ต้องไม่ import อะไรจาก Playwright เพื่อให้ layer อื่นใช้ต่อได้อิสระ
 */

/** กลุ่มของ element ตามการใช้งานจริงของ Tester */
export type UIElementKind = 'link' | 'button' | 'input' | 'textarea' | 'select'

/**
 * ข้อมูล element หนึ่งชิ้นที่เพียงพอต่อการสร้าง automation ภายหลัง
 * ลำดับความสำคัญของ locator: accessibleName (role+name) > name/id > cssSelector
 */
export type UIElement = {
  kind: UIElementKind
  /** ARIA role เช่น 'button' | 'link' | 'textbox' | 'combobox' | 'checkbox' */
  role: string
  /** ชื่อที่ screen reader อ่านได้ — ใช้เป็น locator หลัก (getByRole(role, { name })) */
  accessibleName: string
  /** ข้อความที่มองเห็นภายใน element */
  text?: string
  tagName: string
  inputType?: string
  placeholder?: string
  name?: string
  id?: string
  href?: string
  /** ตัวเลือกทั้งหมดของ <select> */
  options?: string[]
  required: boolean
  disabled: boolean
  /** ใช้เมื่อไม่มี accessible name ที่เชื่อถือได้ */
  cssSelector: string
  /** true = ตรงกับ safety keyword (เช่น Delete, Pay) → Explorer ห้ามคลิก */
  destructive: boolean
}

export type FormInfo = {
  id?: string
  name?: string
  action?: string
  method?: string
  accessibleName?: string
  fields: UIElement[]
  submitButtons: UIElement[]
}

export type PageInfo = {
  /** URL ที่ Explorer ร้องขอ (normalize แล้ว) */
  url: string
  /** URL จริงหลัง redirect */
  finalUrl: string
  title: string
  /** ระยะห่างจากหน้าเริ่มต้น (0 = หน้าแรก) */
  depth: number
  statusCode?: number
  headings: string[]
  links: UIElement[]
  buttons: UIElement[]
  inputs: UIElement[]
  textareas: UIElement[]
  selects: UIElement[]
  forms: FormInfo[]
}

export type ExploreIssueCode =
  | 'invalid-url'
  | 'blocked-url'
  | 'connection-refused'
  | 'dns-error'
  | 'ssl-error'
  | 'timeout'
  | 'page-crash'
  | 'http-error'
  | 'navigation-failed'
  | 'browser-error'
  | 'unknown'

/** ปัญหาที่เกิดระหว่างสำรวจ — บันทึกไว้แต่ไม่ทำให้ทั้ง job ล้ม */
export type ExploreIssue = {
  url: string
  code: ExploreIssueCode
  message: string
}

export type ExploreOptions = {
  maxPages: number
  maxDepth: number
  /** timeout ต่อหนึ่งหน้า (ms) */
  pageTimeoutMs: number
  /** timeout รวมของทั้ง job (ms) */
  totalTimeoutMs: number
}

export type ExploreStats = {
  /** เบราว์เซอร์ที่ใช้จริง เช่น "Google Chrome" — ช่วยตอนหาสาเหตุปัญหา */
  browser?: string
  pagesVisited: number
  /** จำนวน URL ที่ถูกตัดออกเพราะเกิน limit หรือ origin ไม่ตรง */
  urlsSkipped: number
  durationMs: number
  limitReached: 'max-pages' | 'max-depth' | 'total-timeout' | 'none'
}

export type ExploreResult = {
  startUrl: string
  origin: string
  pages: PageInfo[]
  issues: ExploreIssue[]
  stats: ExploreStats
}
