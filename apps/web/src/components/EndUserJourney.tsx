import { useLanguage } from '../i18n'

type JourneyStep = {
  label: string
  description: string
  complete: boolean
  action: string
  onClick: () => void
}

export function EndUserJourney({
  pages,
  testCases,
  recordedCases,
  completedRuns,
  onScout,
  onReview,
  onRecord,
  onRun,
  onExport
}: {
  pages: number
  testCases: number
  recordedCases: number
  completedRuns: number
  onScout: () => void
  onReview: () => void
  onRecord: () => void
  onRun: () => void
  onExport: () => void
}) {
  const { language } = useLanguage()
  const th = language === 'th'
  const steps: JourneyStep[] = [
    {
      label: th ? 'สำรวจเว็บไซต์' : 'Scout the website',
      description: pages
        ? th
          ? `ค้นพบ ${pages} หน้า`
          : `${pages} pages discovered`
        : th
          ? 'ใส่ URL แล้วให้ LazyScout สร้าง Test Case ชุดแรก'
          : 'Enter a URL and let LazyScout discover the first Test Cases.',
      complete: pages > 0,
      action: pages ? (th ? 'สำรวจอีกครั้ง' : 'Scout again') : th ? 'เริ่ม Scout' : 'Start Scout',
      onClick: onScout
    },
    {
      label: th ? 'ตรวจทาน Test Case' : 'Review Test Cases',
      description: testCases
        ? th
          ? `มี ${testCases} Test Case พร้อมให้ตรวจทาน`
          : `${testCases} Test Cases are ready to review.`
        : th
          ? 'ตรวจชื่อ ขั้นตอน และผลลัพธ์ที่คาดหวัง'
          : 'Review titles, steps, and expected results.',
      complete: testCases > 0,
      action: th ? 'เปิด Test Case' : 'Open Test Cases',
      onClick: onReview
    },
    {
      label: th ? 'Record Flow ที่ขาด' : 'Record missing flows',
      description: recordedCases
        ? th
          ? `บันทึกแล้ว ${recordedCases} Flow`
          : `${recordedCases} recorded flow${recordedCases === 1 ? '' : 's'} saved.`
        : th
          ? 'บันทึก Login หรือขั้นตอนงานที่ Scout คาดเดาไม่ได้'
          : 'Record login or business actions that Scout cannot infer.',
      complete: recordedCases > 0,
      action: 'Record Flow',
      onClick: onRecord
    },
    {
      label: th ? 'รัน Automation' : 'Run Automation',
      description: completedRuns
        ? th
          ? `รันแล้ว ${completedRuns} Test Case`
          : `${completedRuns} Test Case${completedRuns === 1 ? '' : 's'} executed.`
        : th
          ? 'รัน Test Case ที่เลือกด้วย Playwright CLI'
          : 'Run selected Test Cases with the Playwright CLI.',
      complete: completedRuns > 0,
      action: th ? 'เปิด Automation' : 'Open Automation',
      onClick: onRun
    },
    {
      label: th ? 'ส่ง Test Case ให้ทีม' : 'Share the Test Cases',
      description: th
        ? 'Export Test Case ที่ตรวจแล้วเป็น CSV เพื่อส่งให้ทีม'
        : 'Export the reviewed Test Cases as a CSV file for your team.',
      complete: false,
      action: 'Export CSV',
      onClick: onExport
    }
  ]

  return (
    <section className="journey-card" aria-labelledby="journey-title">
      <header>
        <div>
          <p className="eyebrow">{th ? 'ขั้นตอนที่แนะนำ' : 'Recommended workflow'}</p>
          <h3 id="journey-title">{th ? 'ต่อไปควรทำอะไร?' : 'What should I do next?'}</h3>
        </div>
        <span>
          {steps.filter((step) => step.complete).length}/4 {th ? 'ขั้นตอนพร้อมแล้ว' : 'setup steps complete'}
        </span>
      </header>
      <div className="journey-steps">
        {steps.map((step, index) => (
          <article className={step.complete ? 'is-complete' : ''} key={step.label}>
            <span className="journey-number">{step.complete ? '✓' : index + 1}</span>
            <div>
              <b>{step.label}</b>
              <small>{step.description}</small>
            </div>
            <button type="button" onClick={step.onClick}>
              {step.action} <span>→</span>
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
