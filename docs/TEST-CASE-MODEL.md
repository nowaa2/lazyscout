# Test Case Model & Generator Rules

## Model (packages/core/src/types/testcase.ts)

```ts
type TestCase = {
  id: string // TC-LOGIN-001
  module: string // มาจาก path ของ URL
  title: string
  preconditions: string[]
  steps: TestStep[] // structured data ไม่ใช่ string
  expectedResult: string
  type: 'positive' | 'negative' | 'validation'
  priority: 'low' | 'medium' | 'high'
  automationStatus: 'ready' | 'needs-data' | 'needs-review' | 'manual'
  sourceUrl: string // หลักฐานว่ามาจากหน้าไหน
  notes?: string // ข้อความจาก generator ถึง Tester
}
```

### TestStep เป็น union ไม่ใช่ string

```ts
type TestStep =
  | { type: 'navigate'; url: string }
  | { type: 'click'; target: TargetRef }
  | { type: 'fill'; target: TargetRef; value: string }
  | { type: 'select'; target: TargetRef; option: string }
  | { type: 'assertVisible'; target: TargetRef }
  | { type: 'assertText'; target?: TargetRef; text: string }
  | { type: 'assertUrl'; urlContains: string }
  | { type: 'manual'; description: string } // ยังไม่รู้ behavior — ห้ามเดา
```

`TargetRef` ให้ความสำคัญกับ accessibility ก่อน CSS selector เสมอ:

```ts
{ role: 'button', name: 'Login' }        // ดี — generate ได้ทั้ง Playwright และ Cypress
{ cssSelector: 'form > div:nth-of-type(3) > input' }  // fallback เมื่อไม่มี accessible name
```

ทุก step มี `description?` เพิ่มได้สำหรับมนุษย์ — ตอนแก้ไขบน UI ระบบจะเขียนทับเฉพาะ `description`
เพื่อไม่ให้ข้อมูล role/name ที่ใช้ generate automation ในอนาคตหายไป

## กฎการสร้าง test case (packages/generators/src/testcases/rules.ts)

| กฎ                | สร้างเมื่อ                                     | ผลลัพธ์                                  | automationStatus                                               |
| ----------------- | ---------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| 1. Page structure | หน้ามี control ที่มีชื่ออย่างน้อย 1 ตัว        | `<Page> page displays required controls` | `ready`                                                        |
| 2. Required field | form มีปุ่ม submit และมีช่องกรอกข้อความ        | `<Field> is required`                    | `needs-review`                                                 |
| 3. Form submit    | form มี field + ปุ่ม submit ที่ไม่ destructive | `Submit <form> with valid data`          | `needs-data`                                                   |
| 4. Navigation     | link ภายใน origin เดียวกันที่มีชื่อ            | `Navigate to <Link>`                     | `ready` ถ้า Explorer เคยเปิดหน้าปลายทาง ไม่งั้น `needs-review` |
| 5. Destructive    | element ตรงกับ safety keyword                  | `Verify "<name>" action (manual)`        | `manual`                                                       |

จำกัด 15 test case ต่อหน้า (ปรับได้ที่ `DEFAULT_GENERATE_OPTIONS`)

## หลักการ "ห้ามเดา"

ระบบจะเขียน expected result ก็ต่อเมื่อ **มีหลักฐานจากสิ่งที่ตรวจพบจริง** เท่านั้น เช่น

- กฎ 1 → รู้ว่า element มีอยู่จริง จึงเขียน "All N controls detected on the page are visible."
- กฎ 4 → Explorer เปิดหน้าปลายทางแล้วและรู้ title จึงเขียนชื่อหน้าปลายทางได้

ถ้าไม่รู้ behavior จริง (เช่น กด submit แล้วเกิดอะไร) จะใช้ประโยคกลาง

```
Verify that the result is displayed according to application requirements (needs review by tester).
```

พร้อมตั้ง `automationStatus: 'needs-review'` และใส่เหตุผลไว้ใน `notes` เช่น
`No "required" attribute found — confirm with the specification whether this field is mandatory.`

## ตัวอย่างผลจริง (หน้า /login ของ fixtures)

```
TC-LOGIN-001 | positive/medium/ready        | Login page displays required controls
TC-LOGIN-002 | validation/high/needs-review | Email is required
TC-LOGIN-003 | validation/high/needs-review | Password is required
TC-LOGIN-004 | positive/high/needs-data     | Submit Login form with valid data
TC-LOGIN-005 | positive/low/ready           | Navigate to Register
TC-LOGIN-006 | positive/low/ready           | Navigate to Forgot Password
```

## Test Data Model

ตาราง Test Data แยกจาก Test Case เพราะ Tester มักเตรียมข้อมูลก่อน แล้วนำไปใช้กับหลาย test case

```ts
type TestDataRow = {
  id: string // TD-LOGIN-001
  module: string // ชื่อเดียวกับ module ของ test case (ใช้ assignModules ตัวเดียวกัน)
  sourceUrl: string
  field: string // accessible name ของ field
  inputType: string // email / password / text / select / checkbox ...
  required: boolean
  validValue: string // ค่าที่ควรผ่าน
  invalidValue: string // ค่าที่ควรถูกปฏิเสธ
  note?: string // เคสนี้ตั้งใจทดสอบอะไร
}
```

สร้างจาก field ทุกช่องที่ Explorer พบ (1 แถว/1 field ตัดชื่อซ้ำภายใน module เดียวกัน)
ค่าที่เสนอมาจาก **ชนิดของ input เท่านั้น ไม่ใช่กฎจริงของระบบ**:

| Input type     | Valid Value             | Invalid Value          | ตั้งใจทดสอบ         |
| -------------- | ----------------------- | ---------------------- | ------------------- |
| email          | `qa.tester@example.com` | `invalid-email`        | รูปแบบอีเมล         |
| password       | `Passw0rd!23`           | `123`                  | ความยาว/ความซับซ้อน |
| number         | `1`                     | `abc`                  | ค่าที่ไม่ใช่ตัวเลข  |
| date           | `2026-01-01`            | `2026-13-45`           | วันที่นอกช่วง       |
| url            | `https://example.com`   | `not-a-url`            | รูปแบบ URL          |
| select         | ตัวเลือกแรกที่พบจริง    | `(no option selected)` | กรณีไม่เลือก        |
| checkbox/radio | `(selected)`            | `(not selected)`       | กรณีไม่ติ๊ก         |
| text/textarea  | `test data`             | `(empty)`              | กฎ required         |

ถ้า field ไม่มี attribute `required` จะเขียนใน `note` ว่า
`Field is not marked required — confirm with the specification whether validation applies.`
ตามหลัก "ห้ามเดา" เดียวกับ test case

## CSV Export

- ไฟล์เดียวมีสองส่วน: test case ก่อน แล้วคั่นด้วยบรรทัดว่าง + หัวข้อ `"TEST DATA"` แล้วตามด้วยตาราง test data
- ครอบทุกค่าด้วย `"` เสมอ และ escape `"` เป็น `""` (RFC 4180)
- ขึ้นต้นไฟล์ด้วย UTF-8 BOM เพื่อให้ Excel บน Windows อ่านภาษาไทยไม่เพี้ยน
- คั่นบรรทัดด้วย CRLF, ส่วน newline ภายในเซลล์ยังคงเป็น `\n` (Excel/Sheets แสดงเป็นหลายบรรทัดในเซลล์เดียว)
- `Test_Steps` แปลงจาก structured step ด้วย `describeSteps()` ตัวเดียวกับที่ UI ใช้แสดง
