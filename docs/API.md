# API

Base URL: `http://127.0.0.1:4000` (Vite proxy `/api` ไปให้อัตโนมัติตอน dev)

## POST /api/analyze

สำรวจเว็บไซต์แล้วสร้าง draft test case (ทำงานแบบ synchronous — MVP ยังไม่ใช้ queue)

**Request**

```json
{ "url": "http://localhost:5173", "maxPages": 20, "maxDepth": 3 }
```

| field      | ค่าเริ่มต้น | ขอบเขต                                                            |
| ---------- | ----------- | ----------------------------------------------------------------- |
| `url`      | (จำเป็น)    | http/https — ใส่แค่ `localhost:5173` ก็ได้ ระบบเติม `http://` ให้ |
| `maxPages` | 20          | 1–20                                                              |
| `maxDepth` | 3           | 0–3                                                               |

**Response 200**

```json
{
  "startUrl": "http://localhost:5500/",
  "origin": "http://localhost:5500",
  "pages": [{ "url": "...", "title": "Login", "inputs": [], "buttons": [], "links": [], "forms": [] }],
  "testCases": [{ "id": "TC-LOGIN-001", "module": "LOGIN", "steps": [] }],
  "testData": [
    {
      "id": "TD-LOGIN-001",
      "module": "LOGIN",
      "field": "Email",
      "inputType": "email",
      "required": true,
      "validValue": "qa.tester@example.com",
      "invalidValue": "invalid-email"
    }
  ],
  "issues": [{ "url": "...", "code": "http-error", "message": "เซิร์ฟเวอร์ตอบกลับ HTTP 404" }],
  "stats": { "pagesVisited": 6, "urlsSkipped": 1, "durationMs": 3420, "limitReached": "none" }
}
```

`issues` = หน้าที่เปิดไม่สำเร็จ แต่ **ไม่ทำให้ทั้ง job ล้ม** — หน้าอื่นยังถูกสำรวจต่อ

## POST /api/export/csv

รับ test case (และ test data ถ้ามี) ที่ Tester แก้ไขแล้วจาก UI แล้วคืนไฟล์ CSV

```json
{
  "testCases": [{ "id": "TC-LOGIN-001", "...": "" }],
  "testData": [{ "id": "TD-LOGIN-001", "...": "" }]
}
```

ตอบกลับเป็น `text/csv; charset=utf-8` พร้อม UTF-8 BOM — ไฟล์เดียวมีสองส่วน

```
TC_ID, Module, Title, Preconditions, Test_Steps, Expected_Result, Type, Priority, Automation_Status, Source_URL
...แถวของ test case...
                                          ← บรรทัดว่างคั่น
"TEST DATA"                               ← หัวข้อของส่วนที่สอง
TD_ID, Module, Field, Input_Type, Required, Valid_Value, Invalid_Value, Note, Source_URL
...แถวของ test data...
```

`testData` เป็น optional — ถ้าไม่ส่งมา จะได้เฉพาะส่วน test case เหมือนเดิม

## GET /api/health

```json
{ "status": "ok", "version": "0.3.3", "workspaceRoot": "C:\\Users\\Example\\LazyScout" }
```

## GET /api/versions

คืนค่าเวอร์ชันที่กำลังรันและรายการเวอร์ชันที่เผยแพร่ล่าสุดสูงสุด 20 รายการจาก npm Registry สำหรับ Version Center ก่อนเปิด Project

```json
{
  "packageName": "lazyscout",
  "currentVersion": "0.3.3",
  "latestVersion": "0.2.0",
  "updateAvailable": false,
  "registryAvailable": true,
  "versions": [{ "version": "0.2.0", "tags": ["latest"] }]
}
```

## POST /api/versions/install

ติดตั้ง LazyScout เวอร์ชันที่เลือกแบบ global โดยรับเฉพาะเลขเวอร์ชันที่มีอยู่จริงใน npm Registry ไม่รับชื่อ package หรือ argument ของคำสั่งจากผู้ใช้

```json
{ "version": "0.2.0" }
```

หลังติดตั้งต้องปิด Terminal เดิมแล้วรัน `lazyscout` ใหม่ เพราะ process ปัจจุบันยังใช้โค้ดของเวอร์ชันเดิมอยู่

## POST /api/automation/run

รัน structured Test Steps หรือ edited Playwright source ที่อยู่ใน statement whitelist เท่านั้น ไม่ evaluate JavaScript อิสระ

ขีดจำกัดหลัก:

- 100 steps
- source 200,000 characters
- 20 seconds ต่อ action
- 250 log lines
- Cypress runner ตอบ `unsupported`; Cypress รองรับเฉพาะ code generation

ถ้าส่ง `projectId` ระบบจะบันทึก log ของ run ลง `projects/<project-id>/logs/`

## POST /api/automation/stop

รับ `{ "runId": "..." }` เพื่อปิด browser ของ run ที่กำลังทำงาน

## POST /api/api-check/run

รัน observed API เฉพาะ GET, HEAD และ OPTIONS หลังผ่าน URL policy ส่วน POST, PUT, PATCH และ DELETE จะถูก block เป็น review-only

## POST /api/load-test/run

GET load test ขนาดเล็ก ต้องส่ง `confirmed: true` จำกัด virtual users สูงสุด 20, requests ต่อ user สูงสุด 100 และ timeout ต่อ request 15 วินาที

## File Workspace API

CLI จะสร้าง workspace ที่ `~/LazyScout` ก่อนเปิด UI หรือใช้ path จาก `--workspace <path>`

- `GET /api/workspace` คืน path และ Projects ที่โหลดจากไฟล์
- `POST /api/workspace/open` เปิด workspace ด้วย file manager ของระบบ
- `PUT /api/workspace/projects/:projectId` บันทึก Project พร้อม JSON และ CSV
- `DELETE /api/workspace/projects/:projectId` ย้าย Project ไป `backups/`
- `GET/POST/DELETE /api/workspace/projects/:projectId/screenshots` จัดการภาพที่ผู้ใช้สั่งจับ
- `GET/PUT/DELETE /api/workspace/projects/:projectId/bugs` จัดการ Bug Report
- `GET/PUT /api/workspace/projects/:projectId/automation` จัดการโค้ดที่แก้เอง
- `POST /api/workspace/projects/:projectId/reports` บันทึก HTML report

ชื่อ Project, ไฟล์ และ path ผ่าน validation และทุก path ต้องอยู่ภายใน workspace เท่านั้น

## รูปแบบ Error

ทุก error ตอบกลับด้วยรูปแบบเดียวกัน และ **ไม่มี stack trace**

```json
{ "error": { "code": "connection-refused", "message": "เชื่อมต่อไม่ได้ ...", "hint": "ตรวจสอบว่า URL ถูกต้อง ..." } }
```

| code                 | HTTP | เกิดเมื่อ                                              |
| -------------------- | ---- | ------------------------------------------------------ |
| `invalid-url`        | 400  | URL ผิดรูปแบบ / ไม่ได้ใส่ URL                          |
| `blocked-url`        | 400  | protocol ไม่รองรับ, cloud metadata, ถูกบล็อกโดย policy |
| `connection-refused` | 502  | เว็บไซต์ไม่ได้เปิดอยู่                                 |
| `dns-error`          | 502  | หาโดเมนไม่พบ                                           |
| `ssl-error`          | 502  | ใบรับรอง SSL มีปัญหา                                   |
| `timeout`            | 502  | เปิดหน้าไม่ทันเวลา                                     |
| `page-crash`         | 502  | หน้าเว็บทำให้ browser ค้าง                             |
| `browser-error`      | 502  | ยังไม่ได้ `npx playwright install chromium`            |
| `internal-error`     | 500  | error อื่นที่ไม่คาดคิด                                 |
