/**
 * Test Data Model — ข้อมูลทดสอบของแต่ละ field ที่ Explorer ตรวจพบ
 * แยกจาก TestCase เพราะ Tester มักเตรียม test data ก่อนแล้วนำไปใช้กับหลาย test case
 */
export type TestDataRow = {
  id: string
  module: string
  /** หน้าที่พบ field นี้ */
  sourceUrl: string
  /** ชื่อ field ที่ผู้ใช้เห็น (accessible name) */
  field: string
  /** email / password / text / select / textarea / checkbox ... */
  inputType: string
  required: boolean
  /** ค่าที่ควรผ่าน — เป็นเพียงค่าตัวอย่าง ให้ Tester แก้เป็น test data จริง */
  validValue: string
  /** ค่าที่ควรถูกปฏิเสธ — ใช้กับ test case ประเภท validation */
  invalidValue: string
  /** คำอธิบายว่าเคสนี้ตั้งใจทดสอบอะไร */
  note?: string
}
