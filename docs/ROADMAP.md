# Roadmap

## V0.1 (เสร็จแล้ว)

- [x] Phase 1 — URL Analyzer: ใส่ URL → Playwright เปิด → คืน title/heading/link/button/input/textarea/select/form
- [x] Phase 2 — Website Explorer: BFS, same-origin, max 20 หน้า, depth 3, timeout, กันวนลูป, error ต่อหน้าไม่ล้มทั้ง job
- [x] Phase 3 — Core Test Case Model (framework independent)
- [x] Phase 4 — Rule-Based Generator (ไม่มี AI)
- [x] Phase 5 — Test Case Review UI: ตาราง, edit, delete, add, select, search, filter, รายละเอียด
- [x] Phase 6 — CSV Export (UTF-8 BOM, รองรับ comma/newline/ภาษาไทย)
- [x] เพิ่มเติมหลัง V0.1 — ตาราง Test Data (แท็บแยก, แก้ไขในช่องได้, รวมใน CSV ไฟล์เดียวกัน)

## จงใจยังไม่ทำใน V0.1

AI / OpenAI / Claude API · Cypress · Selenium · Authentication · Supabase · Database ·
Cloudflare · Docker · Redis · Queue · Payment · User Account · SaaS ·
Jira / GitHub / GitLab integration

## ขั้นถัดไปที่โครงสร้างรองรับไว้แล้ว

### 1. Playwright Generator

เพิ่ม `packages/generators/src/playwright/generatePlaywrightSpec.ts`
รับ `TestCase[]` แล้ว map `TestStep` เป็นโค้ด (ตารางการ map อยู่ใน README ของโฟลเดอร์นั้น)
**ไม่ต้องแก้ `packages/explorer` เลย**

### 2. Cypress Generator

รูปแบบเดียวกับข้อ 1 เพราะ `TestCase` ไม่ผูกกับ framework ใด

### 3. Online Version

- เปลี่ยนเป็น `LAZYSCOUT_MODE=public` (มีอยู่แล้ว)
- เพิ่ม DNS resolution + ตรวจ IP จริง ใน `checkTargetUrl` — ดู [SAFETY.md](SAFETY.md)
- ตอนนั้นค่อยพิจารณา job queue เพราะการ crawl ใช้เวลานาน

### 4. สิ่งที่ Explorer ยังไม่ทำ

- ไม่คลิกปุ่มเพื่อเปิด tab / modal / menu (MVP เดินด้วย link เท่านั้นเพื่อความปลอดภัย)
  ถ้าจะเพิ่ม ต้องคลิกเฉพาะ element ที่ `destructive === false` และเก็บ page state แยกจาก URL
- ไม่รองรับหน้าที่ต้อง login (ยังไม่มีการจัดการ session)
