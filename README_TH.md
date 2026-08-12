# LazyScout

LazyScout คือผู้ช่วย QA แบบ Local-first สำหรับสำรวจเว็บไซต์ สร้าง Draft Test Case และสร้างโค้ด Automation สำหรับ Playwright/Cypress

> Stop rewriting QA work.

[อ่าน README หลักภาษาอังกฤษ](README.md)

## ใช้ทำอะไรได้บ้าง

- สำรวจหน้าเว็บ Form และ controls ด้วย Playwright
- ตรวจพบ Modal, Dialog, Tab, Dropdown และ Accordion จากโครงสร้างหน้า
- สร้างและแก้ไข Draft Test Case/Test Data ภาษาอังกฤษหรือไทย
- Import Test Case จาก CSV, XLSX และ JSON
- Import ภาพเพื่อช่วยสร้าง Test Case ด้วย OCR
- Export CSV, HTML/PDF Test Summary และ Bug Report ZIP
- Generate โค้ด Playwright และ Cypress
- รัน Test Case ที่รองรับด้วย Playwright บนเครื่อง พร้อม logs และ screenshot ที่ผู้ใช้สั่งจับผ่านโค้ดเอง
- ตรวจ XHR/fetch และรัน API checks เฉพาะ GET, HEAD และ OPTIONS

Cypress ในเวอร์ชันนี้รองรับการสร้างโค้ด แต่ยังไม่รองรับการรันใน LazyScout

## เริ่มต้นใช้งาน

ต้องใช้ Node.js 20 ขึ้นไป และมี Chrome, Edge หรือ Playwright Chromium

```bash
npx lazyscout@latest
```

ก่อนใช้งานครั้งแรก ให้ติดตั้ง Playwright Chromium ด้วย:

```bash
npx playwright install chromium
```

ถ้าใช้ Ubuntu หรือ Linux ให้ติดตั้ง system dependencies เพิ่มด้วย:

```bash
npx playwright install --with-deps chromium
```

LazyScout จะสร้าง `~/LazyScout` ให้อัตโนมัติ หากต้องการเลือกตำแหน่งเอง:

```bash
npx lazyscout@latest --workspace D:\\QA\\LazyScout
```

ถ้ายังไม่มี browser ที่รองรับ:

```bash
npx playwright install chromium
```

สแกนผ่าน CLI:

```bash
npx lazyscout@latest scan http://localhost:5173
npx lazyscout@latest scan https://example.com --max-pages 10 --csv report.csv
```

ไม่มีคำสั่ง `analyze` ใน CLI ปัจจุบัน คำสั่งที่รองรับคือ `scan`

## Local-first

Playwright และ local runner ทำงานบนเครื่องผู้ใช้ จึงเข้าถึง localhost, DEV, UAT, VPN หรือ intranet ได้ถ้าเครื่องนั้นเข้า environment ได้

LazyScout สร้าง workspace ที่ `~/LazyScout` อัตโนมัติก่อนเปิด UI โดย Projects, Test Cases, CSV, Automation, Screenshots, Bug Reports, Reports และ Logs จะแยกเป็นโฟลเดอร์ของแต่ละ Project สามารถเปลี่ยนตำแหน่งด้วย `npx lazyscout --workspace <path>` ส่วน `localStorage` ใช้เฉพาะการตั้งค่าหน้าจอขนาดเล็ก

Credentials ที่กรอกใน Project Settings จะอยู่ใน memory และหายเมื่อ refresh หน้า Workspace ไม่ได้เข้ารหัส จึงไม่ควรเก็บ secret หรือข้อมูล production

Version Center จะติดต่อ npm Registry เพื่อดูรายการเวอร์ชัน

## คำเตือนด้านความปลอดภัย

> ห้าม commit credentials จริง, production data, browser authentication state, Playwright trace, screenshot, HAR หรือ API dump ที่มีข้อมูลอ่อนไหว

> ใช้ synthetic test data whenever possible

> ตรวจ Draft Test Case และ automation code ก่อนรันกับระบบสำคัญทุกครั้ง

**Local runner รันโค้ด Playwright จริง ไม่ใช่ sandbox** — source ที่ generate ไว้หรือที่แก้ใน Code Editor
จะถูกเขียนลงไฟล์ `.spec.ts` ชั่วคราวแล้วรันด้วย `@playwright/test` CLI ตัวจริง
โค้ดนั้นรันด้วยสิทธิ์เท่ากับ process ของ LazyScout จึงต้องอ่านทบทวนก่อนกด Run เสมอ

Server bind ที่ `127.0.0.1` และไม่มี authentication ใครยิงถึง API ได้ = รันโค้ดในสิทธิ์ของผู้ใช้ได้
อย่าเปิด port ออกผ่าน tunnel / port forward / reverse proxy อย่าตั้ง `HOST` เป็น address ที่ไม่ใช่ loopback
และอย่ารันเป็น service ที่ใช้ร่วมกันหลายคน (`LAZYSCOUT_MODE=public` เปลี่ยนแค่ URL policy ไม่ได้ sandbox runner)

Screenshot, video, trace, network metadata, form values และ Bug evidence อาจมีข้อมูลส่วนตัวหรือข้อมูลภายใน แม้ `.gitignore` จะช่วยกันไฟล์เหล่านี้ไว้ ผู้ใช้ยังต้องตรวจไฟล์ก่อนส่งให้ผู้อื่น

ควรทดสอบใน DEV, UAT, sandbox หรือ test environment ก่อน production และต้องได้รับอนุญาตก่อน Scout, Run API Check หรือ Load Test เว็บไซต์ใด ๆ

อ่านเพิ่มเติมที่ [SECURITY.md](SECURITY.md) และ [docs/SAFETY.md](docs/SAFETY.md)

## Test Data

ใช้ข้อมูลตัวอย่าง เช่น `qa@example.com`, `Example User` และค่าที่สร้างขึ้นเพื่อทดสอบเท่านั้น ห้ามนำบัญชีลูกค้า พนักงาน ข้อมูลส่วนบุคคล Token หรือ Session จริงมาใส่ repository

ตัวแปร environment ที่รองรับ:

```text
LAZYSCOUT_TEST_EMAIL
LAZYSCOUT_TEST_USERNAME
LAZYSCOUT_TEST_PASSWORD
LAZYSCOUT_API_TOKEN
```

## ข้อจำกัด

- Test Case ที่สร้างเป็น Draft และต้องให้ Tester ตรวจ
- Explorer ยังไม่กดเปิดทุก Modal/Tab/Dropdown ให้อัตโนมัติ
- Local runner รองรับ Playwright เท่านั้น และรัน test code แบบไม่มี sandbox บนเครื่องผู้ใช้
- API ภายในเครื่องไม่มี authentication จึงต้อง bind อยู่ที่ loopback เท่านั้น
- Load Test เป็น GET runner ขนาดเล็ก ไม่ใช่ JMeter หรือ production load-testing platform
- Project ไม่ sync ข้ามเครื่อง
- Online/public mode ยังไม่พร้อมใช้งานเป็น hosted service

## ผู้พัฒนา

สร้างโดย **nowzaa** — [GitHub](https://github.com/nowaa2)

## License

[MIT](LICENSE)
