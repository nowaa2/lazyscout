import { parseArgs } from 'node:util'
import { runScan } from './commands/scan.js'
import { runServe } from './commands/serve.js'
import { VERSION } from './version.js'

const HELP = `
LazyScout ${VERSION} — วิเคราะห์เว็บไซต์แล้วสร้าง Draft Test Case ให้ Software Tester

การใช้งาน
  npx lazyscout                        เปิดหน้าเว็บสำหรับใช้งาน (แนะนำ)
  npx lazyscout scan <url>             สแกนแล้วบันทึกผลเป็นไฟล์ ไม่ต้องเปิดเบราว์เซอร์

ตัวเลือกของ scan
  --csv <ไฟล์>        บันทึก test case + test data เป็น CSV (ค่าเริ่มต้น: lazyscout-testcases.csv)
  --json <ไฟล์>       บันทึกผลดิบทั้งหมดเป็น JSON
  --max-pages <n>     จำนวนหน้าสูงสุด (ค่าเริ่มต้น 20)
  --max-depth <n>     ความลึกสูงสุด (ค่าเริ่มต้น 3)

ตัวเลือกของการเปิดหน้าเว็บ
  --port <n>          พอร์ตที่ต้องการ (ค่าเริ่มต้น 4321)
  --no-open           ไม่ต้องเปิดเบราว์เซอร์ให้อัตโนมัติ

ตัวอย่าง
  npx lazyscout
  npx lazyscout scan http://localhost:5173
  npx lazyscout scan https://example.com --max-pages 10 --csv report.csv

Explorer สำรวจเฉพาะ origin เดียวกัน เดินด้วยลิงก์เท่านั้น ไม่คลิกปุ่มและไม่ submit form
`

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
      csv: { type: 'string' },
      json: { type: 'string' },
      'max-pages': { type: 'string' },
      'max-depth': { type: 'string' },
      port: { type: 'string' },
      // parseArgs ของ Node ไม่แปลง --no-open ให้เอง ต้องประกาศเป็น option แยก
      'no-open': { type: 'boolean', default: false }
    }
  })

  if (values.version) {
    console.log(VERSION)
    return
  }

  const command = positionals[0]

  if (values.help || command === 'help') {
    console.log(HELP)
    return
  }

  switch (command) {
    case undefined:
    case 'serve':
      await runServe({ port: values.port ? Number(values.port) : undefined, open: !values['no-open'] })
      return

    case 'scan': {
      const url = positionals[1]
      if (!url) {
        console.error('ต้องระบุ URL เช่น: npx lazyscout scan http://localhost:5173')
        process.exitCode = 1
        return
      }
      await runScan({
        url,
        csvPath: values.csv,
        jsonPath: values.json,
        maxPages: values['max-pages'] ? Number(values['max-pages']) : undefined,
        maxDepth: values['max-depth'] ? Number(values['max-depth']) : undefined
      })
      return
    }

    default:
      console.error(`ไม่รู้จักคำสั่ง "${command}" — ดูวิธีใช้ด้วย: npx lazyscout --help`)
      process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  // ข้อความ error ต้องอ่านรู้เรื่อง ไม่โยน stack trace ใส่หน้าผู้ใช้
  const message = error instanceof Error ? error.message : String(error)
  const hint = error && typeof error === 'object' && 'hint' in error ? String(error.hint) : undefined

  console.error(`\n✖ ${message}`)
  if (hint) console.error(`  ${hint}`)
  process.exitCode = 1
})
