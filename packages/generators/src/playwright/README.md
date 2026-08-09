# Playwright Generator (ยังไม่ implement ใน V0.1)

โฟลเดอร์นี้กันที่ไว้สำหรับ `TestCase[] → *.spec.ts`

วิธีเพิ่มในอนาคต (ไม่ต้องแก้ `explorer` เลย):

1. สร้าง `generatePlaywrightSpec.ts` ที่รับ `TestCase[]` จาก `@lazyscout/core`
2. map `TestStep` แต่ละชนิดเป็นโค้ด Playwright:

| TestStep        | Playwright                                              |
| --------------- | ------------------------------------------------------- |
| `navigate`      | `await page.goto(url)`                                  |
| `click`         | `await page.getByRole(role, { name }).click()`          |
| `fill`          | `await page.getByRole(role, { name }).fill(value)`      |
| `select`        | `await page.getByRole(role, { name }).selectOption()`   |
| `assertVisible` | `await expect(...).toBeVisible()`                       |
| `assertText`    | `await expect(page.getByText(text)).toBeVisible()`      |
| `assertUrl`     | `await expect(page).toHaveURL(new RegExp(urlContains))` |
| `manual`        | ใส่เป็น `// TODO:` comment                              |

3. ข้าม test case ที่ `automationStatus` เป็น `manual` หรือ `needs-review`
4. export ฟังก์ชันเพิ่มใน `src/index.ts`
