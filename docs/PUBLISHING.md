# การเผยแพร่ขึ้น npm

แพ็กเกจที่ publish คือ **`apps/cli`** (ชื่อบน npm: `lazyscout`) เพียงตัวเดียว
โค้ดของ `packages/*` และ `apps/server` + `apps/web` ถูก bundle รวมเข้าไปด้วย esbuild
ผู้ใช้จึงติดตั้งแพ็กเกจเดียวแล้วใช้งานได้ครบ

## ขั้นตอนก่อน publish ทุกครั้ง

```bash
npm run typecheck        # ต้องผ่าน
npm test                 # ต้องผ่าน
npm run build            # build packages + server + web + cli ตามลำดับ

cd apps/cli
npm pack --dry-run       # ดูว่าไฟล์ที่จะขึ้นไปมีอะไรบ้าง (ควรมีแค่ dist/, README, LICENSE, package.json)
```

ทดสอบเหมือนผู้ใช้จริงก่อน publish:

```bash
cd apps/cli && npm pack                     # ได้ lazyscout-x.y.z.tgz
mkdir /tmp/try && cd /tmp/try && npm init -y
npm install /path/to/lazyscout-x.y.z.tgz
npx lazyscout scan http://localhost:5500  # ต้องทำงานได้
npx lazyscout                             # ต้องเปิดหน้าเว็บได้
```

## publish

```bash
npm login                          # ครั้งแรกครั้งเดียว (เปิด 2FA ไว้ด้วย)
cd apps/cli
npm publish --access public
```

ตรวจผล: <https://www.npmjs.com/package/lazyscout>

## ออกเวอร์ชันใหม่

```bash
npm test                 # ให้แน่ใจก่อนว่าไม่พัง

cd apps/cli
npm version patch        # 0.1.0 -> 0.1.1 แก้บั๊ก ไม่เปลี่ยนวิธีใช้งาน
npm version minor        # 0.1.0 -> 0.2.0 เพิ่มความสามารถใหม่ ของเดิมยังใช้ได้เหมือนเดิม
npm version major        # 0.1.0 -> 1.0.0 เปลี่ยนแบบ breaking (เช่น เปลี่ยนชื่อคอลัมน์ CSV, ตัด flag เดิมทิ้ง)

npm publish              # prepublishOnly จะ build ใหม่ทั้งหมดให้เองอัตโนมัติ
```

> `build.mjs` ฝังเลขเวอร์ชันจาก `package.json` ลงในไฟล์ที่ build ไว้ (`__LAZYSCOUT_VERSION__`)
> ถ้าขึ้นเวอร์ชันแล้วไม่ build ใหม่ `lazyscout --version` จะแสดงเลขเก่า
> — สคริปต์ `prepublishOnly` ป้องกันเรื่องนี้ให้แล้ว จึงไม่ต้อง build เองก่อน publish

`npm version` จะสร้าง git commit + tag ให้ด้วยถ้าอยู่ใน git repo
ถ้าไม่ต้องการให้ใส่ `--no-git-tag-version`

## ผู้ใช้จะได้เวอร์ชันใหม่ยังไง

| ผู้ใช้รันแบบ | ได้เวอร์ชันใหม่ไหม |
| --- | --- |
| `npx lazyscout@latest` | ได้เสมอ ✅ |
| `npx lazyscout` | **อาจได้ของเก่า** เพราะ npx เก็บ cache ไว้ |
| ติดตั้งถาวร (`npm i -g lazyscout`) | ต้องสั่ง `npm i -g lazyscout@latest` เอง |

ดังนั้นเวลาบอกให้คนอัปเดต ให้บอกว่า `npx lazyscout@latest` เสมอ

## ถ้าปล่อยเวอร์ชันที่มีบั๊กไปแล้ว

ลบไม่ได้ (หลัง 72 ชม.) แต่เตือนผู้ใช้ได้:

```bash
npm deprecate lazyscout@0.1.1 "มีบั๊กเรื่อง X — กรุณาใช้ 0.1.2 ขึ้นไป"
```

ใครติดตั้งเวอร์ชันนั้นจะเห็นคำเตือนทันที วิธีที่ถูกคือรีบออก patch ตัวใหม่ แล้ว deprecate ตัวเก่า

## ข้อควรระวัง

| เรื่อง | รายละเอียด |
| --- | --- |
| **ถอนคืนไม่ได้** | npm ให้ `npm unpublish` ได้ภายใน 72 ชม. และต้องไม่มีใครใช้เป็น dependency หลังจากนั้นทำได้แค่ `npm deprecate` |
| **ชื่อถูกจองถาวร** | เมื่อ publish แล้วชื่อ `lazyscout` เป็นของคุณ ใครมาแย่งไม่ได้ |
| **เปิด 2FA** | ป้องกันบัญชีถูกยึดแล้วปล่อยเวอร์ชันมัลแวร์ในชื่อคุณ |
| **ตรวจ dependency** | ตอนนี้มีแค่ `fastify`, `@fastify/static`, `playwright-core` — ยิ่งน้อยยิ่งปลอดภัยต่อ supply chain |
| **provenance** | ถ้าย้ายไป publish ผ่าน GitHub Actions ใช้ `npm publish --provenance` เพื่อให้ npm แสดงว่า build มาจาก commit ไหน |

## ทำไมไม่ publish `packages/*` แยก

- ผู้ใช้ต้องติดตั้งแพ็กเกจเดียว ไม่ต้องจัดการเวอร์ชันให้ตรงกัน 4 ตัว
- ไม่ต้องจด npm organization สำหรับ scope `@lazyscout/`
- ถ้าวันหนึ่งอยากให้คนอื่นเอา `@lazyscout/core` ไปเขียน generator เอง ค่อยแยก publish ทีหลังได้
  โดยไม่กระทบผู้ใช้ CLI เดิม
