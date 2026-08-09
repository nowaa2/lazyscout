# Safety & Security

## 1. Explorer ห้ามทำอะไรบ้าง

กฎที่บังคับใน MVP (`packages/explorer/src/safety.ts` + `exploreWebsite.ts`):

- **เดินทางด้วย link `href` เท่านั้น** — ไม่คลิกปุ่ม ไม่ submit form เลย
  จึงไม่มีทางไปกระตุ้น action ที่เปลี่ยนข้อมูลของระบบที่กำลังทดสอบ
- ไม่เดินตาม link ที่ข้อความเข้าข่าย destructive (เช่น `/logout`, "Delete")
- Same origin เท่านั้น — ไม่ออกไป external domain
- ข้ามไฟล์ที่ไม่ใช่หน้าเว็บ (.pdf, .zip, .png …)

element ที่เข้าข่าย destructive จะถูก **ตรวจพบและบันทึกไว้** (`UIElement.destructive = true`)
แล้วสร้างเป็น test case ที่ `automationStatus: "manual"` แทนการคลิก

### Keyword ที่ถือว่า destructive

```
delete, remove, destroy, erase, drop, reset,
purchase, buy, checkout, pay, payment, transfer, withdraw, refund,
send, submit order, place order, confirm payment, confirm order,
logout, log out, sign out, deactivate, delete account, close account,
unsubscribe, cancel subscription, archive, publish, approve, reject,
ลบ, ยกเลิก, ชำระเงิน, จ่าย, โอน, ซื้อ, สั่งซื้อ, ยืนยันการชำระ, ออกจากระบบ, ส่งข้อมูล, บันทึก
```

แก้ไขรายการได้ที่ `DESTRUCTIVE_KEYWORDS` ในไฟล์เดียว

## 2. ขอบเขตการ crawl

| ข้อจำกัด         | ค่า                                                           | บังคับที่                          |
| ---------------- | ------------------------------------------------------------- | ---------------------------------- |
| จำนวนหน้าสูงสุด  | 20                                                            | `exploreWebsite` + `config.limits` |
| ความลึกสูงสุด    | 3                                                             | เดียวกัน                           |
| timeout ต่อหน้า  | 20 วินาที                                                     | `page.goto`                        |
| timeout ทั้ง job | 120 วินาที                                                    | ตรวจทุกครั้งก่อนเปิดหน้าใหม่       |
| กันวนลูป         | `Set` ของ URL ที่ normalize แล้ว + ตรวจ URL หลัง redirect ซ้ำ |

## 3. SSRF

> **หมายเหตุสำคัญ:** ตั้งแต่เปลี่ยนมาเผยแพร่เป็น CLI บน npm ความเสี่ยง SSRF แทบหมดไป
> เพราะเบราว์เซอร์รันบนเครื่องของผู้ใช้เอง และผู้ใช้เป็นคนพิมพ์ URL เอง
> — ไม่มีเซิร์ฟเวอร์ของเราที่ถูกหลอกให้ยิงเข้าเครือข่ายภายในของใคร
> ส่วนด้านล่างนี้ยังคงไว้สำหรับกรณีที่วันหนึ่งจะทำเวอร์ชันโฮสต์บนคลาวด์

ผู้ใช้ใส่ URL เองได้ ระบบจึงรวม logic การตรวจไว้ที่ **จุดเดียว**:
`packages/core/src/url/checkTargetUrl.ts` โดยรับ `UrlPolicy` เข้ามา

```ts
LOCAL_QA_POLICY // MVP: อนุญาต localhost + private IP (จุดประสงค์หลักของ local QA tool)
PUBLIC_SAAS_POLICY // online version: บล็อก localhost, private IP, metadata
```

สลับได้ด้วย environment variable โดยไม่ต้องแก้โค้ด:

```bash
LAZYSCOUT_MODE=public npm run dev:server
```

สิ่งที่ถูกบล็อกเสมอไม่ว่าโหมดไหน: protocol ที่ไม่ใช่ http/https และ cloud metadata endpoint
(`169.254.169.254`, `metadata.google.internal`)

### ข้อจำกัดที่ต้องแก้ก่อนขึ้น online จริง

ตอนนี้ตรวจจาก **hostname เท่านั้น ยังไม่ resolve DNS** — จึงยังกัน DNS rebinding
(โดเมนสาธารณะที่ชี้กลับมา 127.0.0.1) ไม่ได้ ก่อนเปิดใช้งานออนไลน์ต้องเพิ่ม:

1. resolve DNS แล้วตรวจ IP จริงทุกตัวที่ได้
2. ตรวจซ้ำหลัง redirect ทุกครั้ง
3. จำกัด rate ต่อผู้ใช้ และแยก browser ไปรันในเครื่อง/คอนเทนเนอร์ที่ไม่มีสิทธิ์เข้าเครือข่ายภายใน

## 4. Automation runner

- Structured Test Steps เป็น input หลักของ runner
- Source ที่แก้ใน editor ถูก parse เป็น Playwright statement ที่ whitelist ไว้ ไม่ได้ส่งเข้า `eval` หรือ `new Function`
- รองรับเฉพาะ navigation, locator ที่กำหนด, click, fill, select, wait ที่มี limit และ assertions
- statement ที่ไม่รู้จักจะ fail closed
- ก่อน click จะตรวจ locator name, aria-label, title, name, id และ visible text เพื่อ block action ที่ดู destructive
- จำกัดจำนวน steps, source size, timeout ต่อ action และจำนวน log lines
- logs และ error ผ่าน shared redaction utility

## 5. API และ Load Test

- API observations เก็บ method, URL ที่ redact แล้ว, status, duration และ content type โดยไม่เก็บ request/response body
- API Check รันอัตโนมัติเฉพาะ GET, HEAD และ OPTIONS
- POST, PUT, PATCH และ DELETE เป็น observation-only และต้องให้ Tester ตรวจด้วยเครื่องมือที่เหมาะสม
- Load Test ส่ง GET เท่านั้น มี hard limits และต้องยืนยันว่ามีสิทธิ์ทดสอบ target

## 6. Credentials และ artifacts

- Project Settings credentials อยู่ใน memory และหายเมื่อ refresh
- environment variables เป็นวิธีที่แนะนำสำหรับ runner
- Projects, results, screenshots, Bug Reports, reports และ logs อยู่ใน file-backed workspace ซึ่งไม่ใช่ encrypted vault
- screenshot, trace, video, HAR, API dump และ Bug evidence อาจมีข้อมูลอ่อนไหว ต้อง redact ก่อนแชร์
- directory ของ artifacts ทั่วไปถูกเพิ่มไว้ใน `.gitignore` แต่ผู้ใช้ยังต้องตรวจ `git status` และ `git diff --cached` ก่อน push
