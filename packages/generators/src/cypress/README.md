# Cypress Generator (ยังไม่ implement ใน V0.1)

โฟลเดอร์นี้กันที่ไว้สำหรับ `TestCase[] → *.cy.ts`

ใช้ `TestStep` ชุดเดียวกับ Playwright generator เพียงเปลี่ยนการ map:

| TestStep    | Cypress                                       |
| ----------- | --------------------------------------------- |
| `navigate`  | `cy.visit(url)`                               |
| `click`     | `cy.findByRole(role, { name }).click()`       |
| `fill`      | `cy.findByRole(role, { name }).type(value)`   |
| `assertUrl` | `cy.url().should('include', urlContains)`     |

เพราะ `TestCase` เป็น framework-independent จึงไม่ต้องแก้ `packages/explorer`
หรือ `packages/core` เมื่อเพิ่ม generator ตัวใหม่
