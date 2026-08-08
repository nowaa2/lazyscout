# LazyScout

เครื่องมือช่วย Software Tester วิเคราะห์เว็บไซต์แล้วสร้าง **Draft Test Case** และ **Test Data**
อัตโนมัติ พร้อม export เป็น CSV เปิดใน Excel / Google Sheets ได้ทันที

**ทำงานในเครื่องคุณเอง** — ไม่ต้องสมัครสมาชิก ไม่ต้องล็อกอิน ไม่ส่งข้อมูลออกไปไหน
จึงสแกน `http://localhost` และระบบภายในองค์กรได้

```bash
npx lazyscout
```

---

## ใช้งาน

### เปิดหน้าเว็บ (แนะนำ)

```bash
npx lazyscout
```

เปิดหน้าจอที่ `http://localhost:4321` ให้อัตโนมัติ → ใส่ URL → กด **Analyze Website**
→ แก้ไข test case ในตาราง → **Export CSV**

### โหมดบรรทัดคำสั่ง (เหมาะกับ CI)

```bash
npx lazyscout scan http://localhost:5173
npx lazyscout scan https://example.com --max-pages 10 --csv report.csv --json raw.json
```

| ตัวเลือก | ความหมาย |
| --- | --- |
| `--csv <ไฟล์>` | บันทึก test case + test data เป็น CSV (ค่าเริ่มต้น `lazyscout-testcases.csv`) |
| `--json <ไฟล์>` | บันทึกผลดิบทั้งหมด (page model + test case + test data) |
| `--max-pages <n>` | จำนวนหน้าสูงสุด (ค่าเริ่มต้น 20) |
| `--max-depth <n>` | ความลึกสูงสุด (ค่าเริ่มต้น 3) |
| `--port <n>` | พอร์ตของหน้าเว็บ (ค่าเริ่มต้น 4321) |
| `--no-open` | ไม่ต้องเปิดเบราว์เซอร์ให้อัตโนมัติ |

---

## ได้อะไรออกมา

**Test Cases** — สร้างจากสิ่งที่ตรวจพบจริงบนหน้าเว็บ

```
TC-LOGIN-001  positive/ready         Login page displays required controls
TC-LOGIN-002  validation/needs-review  Email is required
TC-LOGIN-003  validation/needs-review  Password is required
TC-LOGIN-004  positive/needs-data    Submit Login form with valid data
TC-LOGIN-005  positive/ready         Navigate to Register
```

**Test Data** — ค่าที่ควรผ่าน/ควรถูกปฏิเสธของแต่ละช่องกรอก

```
TD-LOGIN-001  Email     email     required  qa.tester@example.com  invalid-email
TD-LOGIN-002  Password  password  required  Passw0rd!23            123
```

**CSV** — ไฟล์เดียวมีทั้งสองส่วน มี UTF-8 BOM ภาษาไทยไม่เพี้ยนใน Excel

```
TC_ID, Module, Title, Preconditions, Test_Steps, Expected_Result, Type, Priority, Automation_Status, Source_URL
```

---

## ความปลอดภัย

เครื่องมือนี้ออกแบบให้ยิงใส่ระบบที่กำลังพัฒนาได้อย่างปลอดภัย

- **ไม่คลิกปุ่มและไม่ submit form** — เดินทางด้วยลิงก์ (`href`) เท่านั้น จึงไม่เปลี่ยนแปลงข้อมูลของระบบ
- **ตรวจพบ action อันตราย แต่ไม่แตะ** — Delete, Payment, Logout ฯลฯ จะถูกบันทึกเป็น test case แบบ `manual` ให้ทดสอบด้วยมือ
- **สำรวจเฉพาะ origin เดียวกัน** ไม่ออกไปโดเมนอื่น
- จำกัด 20 หน้า / ลึก 3 ชั้น / มี timeout และกันการวนลูป

## ไม่เดา expected result

ถ้าระบบไม่มีหลักฐานว่า behavior จริงคืออะไร จะไม่แต่งขึ้นมาเอง แต่จะเขียนว่า

> Verify that the result is displayed according to application requirements (needs review by tester).

แล้วตั้งสถานะเป็น `needs-review` — **ผลลัพธ์คือ Draft ที่ Tester ต้องตรวจ ไม่ใช่ test case ที่ถูกต้อง 100%**

---

## ความต้องการของระบบ

- **Node.js 20 ขึ้นไป**
- **Google Chrome หรือ Microsoft Edge** อย่างใดอย่างหนึ่ง (เครื่องส่วนใหญ่มีอยู่แล้ว)

แพ็กเกจนี้ใช้ `playwright-core` จึงไม่ดาวน์โหลดเบราว์เซอร์ 150MB ตอนติดตั้ง แต่จะหาเบราว์เซอร์
ในเครื่องคุณตามลำดับ: Chromium ของ Playwright → Chrome → Edge

ถ้าไม่มีสักตัว ติดตั้งด้วย:

```bash
npx playwright install chromium
```

> **Windows:** ถ้าใช้ `cmd.exe` รุ่นเก่าแล้วภาษาไทยแสดงไม่ถูก ให้พิมพ์ `chcp 65001` ก่อน
> หรือใช้ Windows Terminal / PowerShell 7 ซึ่งรองรับ UTF-8 อยู่แล้ว

---

## แผนในอนาคต

โครงสร้างภายในแยก Test Case Model ออกจาก Playwright โดยสิ้นเชิง จึงเพิ่มสิ่งเหล่านี้ได้
โดยไม่ต้องแก้ตัวสำรวจเว็บ:

- `TestCase[]` → Playwright `.spec.ts`
- `TestCase[]` → Cypress `.cy.ts`

## License

MIT
