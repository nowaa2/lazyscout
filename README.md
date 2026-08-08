# LazyScout v0.1 — monorepo

> **ผู้ใช้ทั่วไปไม่ต้องโคลน repo นี้** — เรียกใช้ผ่าน npm ได้เลย:
> ```bash
> npx lazyscout                              # เปิดหน้าเว็บใช้งาน
> npx lazyscout scan http://localhost:5173   # โหมดบรรทัดคำสั่ง
> ```
> เอกสารสำหรับผู้ใช้อยู่ที่ [apps/cli/README.md](apps/cli/README.md) (คือหน้าที่แสดงบน npm)
> ส่วนไฟล์นี้เป็นคู่มือสำหรับคนพัฒนาตัวเครื่องมือ


เครื่องมือช่วย Software Tester วิเคราะห์เว็บไซต์ด้วย Playwright แล้วสร้าง **Draft Test Case** อัตโนมัติ
ตรวจ/แก้ไขบนหน้าเว็บ แล้ว export เป็น CSV

```
URL → Analyze → Playwright สำรวจเว็บไซต์ → Pages/Buttons/Inputs/Links/Forms
    → Draft Test Cases + Test Data → ตารางให้ Edit/Delete/Add → Export CSV
```

ผลลัพธ์แสดงเป็น 2 แท็บ: **Test Cases** (ขั้นตอนการทดสอบ) และ **Test Data**
(ค่า valid/invalid ของแต่ละ field) — Export CSV ได้ทั้งสองส่วนในไฟล์เดียว

> Draft Test Case คือ "ร่างให้ Tester ตรวจ" ไม่ใช่ test case ที่ถูกต้อง 100%
> เมื่อระบบไม่มีหลักฐานว่า behavior จริงคืออะไร จะไม่เดา แต่จะตั้งสถานะเป็น `needs-review`

## ติดตั้ง

```bash
cd lazyscout
npm install
npx playwright install chromium   # ดาวน์โหลด browser ครั้งแรกครั้งเดียว
npm run build:packages            # build packages/core, explorer, generators
```

## รัน (เปิด 2 terminal)

```bash
# terminal 1 — API (Fastify)
npm run dev:server      # http://127.0.0.1:4000

# terminal 2 — Web UI (Vite)
npm run dev:web         # http://localhost:5173
```

เปิด <http://localhost:5173> → ใส่ Target URL → กด **Analyze Website**

### ลองกับเว็บไซต์ตัวอย่าง

```bash
node fixtures/serve.mjs   # http://localhost:5500 (login / register / products / cart)
```

แล้วใส่ `http://localhost:5500` ในช่อง Target URL

## คำสั่งอื่น

| คำสั่ง                   | ทำอะไร                                        |
| ------------------------ | --------------------------------------------- |
| `npm run typecheck`      | ตรวจ TypeScript ทั้ง repo                     |
| `npm test`               | build packages แล้วรัน unit test (vitest)     |
| `npm run build`          | build ทุกอย่าง (packages + server + web + cli)|
| `npm run cli`            | รัน CLI ที่ build แล้ว เช่น `npm run cli -- scan http://localhost:5500` |
| `npm run clean`          | ลบผลลัพธ์ build ของ packages                  |

## เอกสารเพิ่มเติม

| ไฟล์                                     | เนื้อหา                                    |
| ---------------------------------------- | ------------------------------------------ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | โครงสร้างโปรเจกต์ + data flow + หน้าที่ของแต่ละไฟล์ |
| [docs/API.md](docs/API.md)               | REST API และรูปแบบ error                    |
| [docs/SAFETY.md](docs/SAFETY.md)         | กฎความปลอดภัยของ Explorer และ SSRF policy   |
| [docs/TEST-CASE-MODEL.md](docs/TEST-CASE-MODEL.md) | Test Case Model และกฎการสร้าง test case |
| [docs/PUBLISHING.md](docs/PUBLISHING.md) | วิธี publish ขึ้น npm และข้อควรระวัง        |
| [docs/ROADMAP.md](docs/ROADMAP.md)       | สิ่งที่ยังไม่ทำใน V0.1 และแผนถัดไป          |

## ขอบเขตของ V0.1

ทำแล้ว: Playwright explorer, rule-based generator, ตารางรีวิว, CSV export
ยังไม่ทำ (ตั้งใจ): AI, Cypress, Login, Database, Docker, Queue, Cloud deployment
