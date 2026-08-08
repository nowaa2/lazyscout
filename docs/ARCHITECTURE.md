# Architecture

## แนวคิดหลัก

แยก 6 ส่วนออกจากกัน และ **Test Case Model ไม่ผูกกับ Playwright**
เพื่อให้เพิ่ม Cypress หรือ framework อื่นได้ภายหลังโดยไม่ต้องแก้ Explorer

```
1. Web UI (apps/web)          → รับ URL, แสดงผล, แก้ไข test case
2. API (apps/server)          → ตรวจ URL, สั่ง crawl, ส่ง CSV
3. Website Explorer           → Playwright เปิดเว็บ เก็บ element
4. Normalized Page Model      → PageInfo / UIElement / FormInfo
5. Test Case Generator        → rule-based: PageInfo[] → TestCase[]
6. CSV Export                 → TestCase[] → CSV (UTF-8 BOM)
```

## Data Flow

```
[Web UI]  AnalyzeForm
    │  POST /api/analyze { url, maxPages, maxDepth }
    ▼
[Server]  checkTargetUrl(url, policy)        ← ด่านกัน SSRF (packages/core)
    │
    ▼
[Explorer] exploreWebsite()                  ← Playwright + BFS same-origin
    │      goto → collectPageData() ใน browser → mapToPageModel()
    ▼
   PageInfo[]  +  ExploreIssue[]             ← หน้าที่เปิดไม่ได้ไม่ทำให้ job ล้ม
    │
    ▼
[Generators] generateTestCases(pages) + generateTestData(pages)   ← rule-based ไม่ใช้ AI
    │
    ▼
   AnalyzeResponse { pages, testCases, testData, issues, stats }
    │
    ▼
[Web UI]  แท็บ Test Cases / Test Data → แก้ไข/ลบ/เพิ่ม
    │  POST /api/export/csv { testCases, testData ที่แก้แล้ว }
    ▼
[Generators] exportTestCasesToCsv() → ไฟล์ .csv เดียว (สองส่วน) ดาวน์โหลด
```

จุดสำคัญ: **CSV สร้างจาก test case ที่ผู้ใช้แก้แล้ว** ไม่ใช่ผลดิบจาก generator

## โครงสร้างโฟลเดอร์

```
lazyscout/
├─ packages/
│  ├─ core/         ไม่มี dependency ภายนอกเลย — ใช้ได้ทั้ง server และ browser
│  │  └─ src/
│  │     ├─ types/       page.ts, testcase.ts, api.ts, url.ts   (แยก type ตามหัวข้อ)
│  │     ├─ url/         policy.ts, checkTargetUrl.ts, normalizeUrl.ts
│  │     └─ testcase/    describeStep.ts, createTestCase.ts
│  ├─ explorer/     ที่เดียวในระบบที่ import playwright
│  │  └─ src/
│  │     ├─ browser/domCollector.ts   โค้ดที่รันใน browser (page.evaluate)
│  │     ├─ exploreWebsite.ts         BFS crawler
│  │     ├─ mapToPageModel.ts         Raw DOM → PageInfo
│  │     ├─ safety.ts                 keyword ห้ามคลิก
│  │     └─ errors.ts                 Playwright error → ข้อความภาษาคน
│  └─ generators/
│     └─ src/
│        ├─ testcases/   generateTestCases.ts, rules.ts, targets.ts
│        ├─ csv/         exportTestCasesToCsv.ts
│        ├─ playwright/  (ที่ว่างไว้ในอนาคต — README เท่านั้น)
│        └─ cypress/     (ที่ว่างไว้ในอนาคต — README เท่านั้น)
├─ apps/
│  ├─ server/  Fastify: app.ts, config.ts, toApiError.ts, routes/
│  ├─ web/     React + Vite + Tailwind: components/, hooks/, api/, lib/, types/, styles/
│  └─ cli/     ★ แพ็กเกจที่ publish ขึ้น npm (ชื่อ lazyscout)
│              bundle ทุกอย่างข้างบนเป็นไฟล์เดียวด้วย esbuild
└─ fixtures/   เว็บไซต์ตัวอย่างสำหรับทดสอบ (ไม่มี dependency)
```

## หน้าที่ของไฟล์หลัก

### packages/core

| ไฟล์                         | ทำอะไร                                                              |
| ---------------------------- | ------------------------------------------------------------------- |
| `types/page.ts`              | `PageInfo`, `UIElement`, `FormInfo`, `ExploreResult` — Page Model กลาง |
| `types/testcase.ts`          | `TestCase`, `TestStep` (union), `TargetRef` — ไม่ผูก framework      |
| `types/api.ts`               | สัญญา request/response ที่ web กับ server ใช้ร่วมกัน                 |
| `url/checkTargetUrl.ts`      | ด่านเดียวที่ตัดสินว่า URL เปิดได้ไหม (กัน SSRF)                      |
| `url/policy.ts`              | `LOCAL_QA_POLICY` (MVP) และ `PUBLIC_SAAS_POLICY` (online version)    |
| `url/normalizeUrl.ts`        | normalize URL กันหน้าซ้ำ, เช็ค same-origin, ตั้งชื่อ module          |
| `testcase/describeStep.ts`   | แปลง structured step เป็นประโยค — ใช้ทั้งบน UI และใน CSV            |

### packages/explorer

| ไฟล์                       | ทำอะไร                                                                   |
| -------------------------- | ------------------------------------------------------------------------ |
| `exploreWebsite.ts`        | BFS: max 20 หน้า, depth 3, timeout, กันวนลูป, redirect, error ต่อหน้า     |
| `browser/domCollector.ts`  | รันใน browser: หา accessible name จาก aria-label/label/text ก่อน selector |
| `mapToPageModel.ts`        | เติมผลตรวจ safety ให้ element แล้วแปลงเป็น `PageInfo`                     |
| `safety.ts`                | keyword destructive (delete/pay/logout/ลบ/ชำระเงิน …) — ตรวจได้ ห้ามคลิก  |
| `errors.ts`                | `ERR_CONNECTION_REFUSED` ฯลฯ → ข้อความที่ user เข้าใจ                     |

### packages/generators

| ไฟล์                        | ทำอะไร                                                            |
| --------------------------- | ----------------------------------------------------------------- |
| `testcases/generateTestCases.ts` | เรียกทุก rule, ออก TC ID ให้เรียงต่อเนื่อง                  |
| `testcases/rules.ts`        | 5 กฎ: page structure, required field, form submit, navigation, destructive |
| `testcases/targets.ts`      | `UIElement → TargetRef` (role+name ก่อน selector) และค่าตัวอย่าง    |
| `testdata/generateTestData.ts` | ตาราง Test Data: 1 แถว/1 field พร้อมค่า valid/invalid ตามชนิด input |
| `moduleNames.ts`            | ตั้งชื่อ module จาก URL — ใช้ร่วมกันให้ test case กับ test data ตรงกัน |
| `csv/exportTestCasesToCsv.ts` | CSV ตาม RFC 4180 + UTF-8 BOM (test case + test data ในไฟล์เดียว)  |

### apps/server

| ไฟล์                    | ทำอะไร                                             |
| ----------------------- | -------------------------------------------------- |
| `app.ts`                | ประกอบ Fastify + route + not-found handler          |
| `config.ts`             | port, url policy (`LAZYSCOUT_MODE`), limit ของ crawl |
| `routes/analyze.ts`     | `POST /api/analyze` — ตรวจ URL → crawl → generate   |
| `routes/exportCsv.ts`   | `POST /api/export/csv` — รับ test case ที่แก้แล้ว   |
| `toApiError.ts`         | error ภายใน → response ที่ไม่มี stack trace          |

### apps/cli (แพ็กเกจบน npm)

| ไฟล์                     | ทำอะไร                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| `src/index.ts`           | อ่าน argument ด้วย `util.parseArgs` (built-in ของ Node) แล้วแยกคำสั่ง |
| `src/commands/serve.ts`  | เปิด Fastify + เสิร์ฟหน้าเว็บที่ build แล้ว + หาพอร์ตว่างให้อัตโนมัติ |
| `src/commands/scan.ts`   | โหมด CLI ล้วน: crawl → generate → เขียน CSV/JSON (ใช้ใน CI ได้)      |
| `src/openInBrowser.ts`   | เปิดเบราว์เซอร์ตาม OS (start / open / xdg-open)                      |
| `build.mjs`              | esbuild bundle โค้ด workspace ทั้งหมดเป็นไฟล์เดียว + คัดลอกหน้าเว็บ   |

### apps/web

| ไฟล์                          | ทำอะไร                                                  |
| ----------------------------- | ------------------------------------------------------- |
| `App.tsx`                     | ประกอบทุกส่วนและถือ state ของ filter / detail / editor  |
| `api/client.ts`               | เรียก API + แปลง error เป็นข้อความ + ดาวน์โหลด CSV       |
| `hooks/useAnalyze.ts`         | state ของการ analyze (idle/loading/success/error)       |
| `hooks/useTestCases.ts`       | รายการ test case ที่แก้ไขได้ + การเลือกแถว              |
| `hooks/useTestData.ts`        | ตาราง test data ที่แก้ไขได้ (คู่ขนานกับ useTestCases)   |
| `lib/filterTestCases.ts`      | search + filter ของทั้งสองตาราง                          |
| `components/TestDataTable.tsx`  | ตาราง Test Data แบบแก้ไขในช่องได้ทันที (inline edit)  |
| `components/ExploreSummary.tsx` | หน้าที่พบ + element ที่เจอ + หน้าที่เปิดไม่ได้         |
| `components/TestCaseTable.tsx`  | ตารางรีวิว                                            |
| `components/TestCaseDetail.tsx` | Preconditions / Steps / Expected Result                |
| `components/TestCaseEditor.tsx` | ฟอร์มแก้ไข (แก้คำอธิบาย step โดยไม่ทิ้ง structured data) |
| `styles/index.css`            | CSS กลาง (`.btn`, `.field`, `.card`, `.badge`, ตาราง)   |

## ทำไมถึงเป็น monorepo แบบนี้

- `core` ไม่มี dependency → import ได้ทั้งฝั่ง Node และ browser
- `explorer` เป็นที่เดียวที่รู้จัก Playwright → เปลี่ยน crawler ได้โดยไม่กระทบ generator
- `generators` รับแค่ `PageInfo[]`/`TestCase[]` → เพิ่ม Playwright/Cypress generator ได้โดยไม่แตะ explorer
