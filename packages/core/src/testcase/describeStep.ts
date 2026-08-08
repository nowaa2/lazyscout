import type { TargetRef, TestStep } from '../types/testcase.js'

/** แปลง TargetRef เป็นข้อความสั้น ๆ ที่มนุษย์อ่านรู้เรื่อง */
export function describeTarget(target: TargetRef): string {
  const name = target.name || target.label || target.text || target.placeholder
  if (name && target.role) return `${target.role} "${name}"`
  if (name) return `"${name}"`
  if (target.cssSelector) return `element (${target.cssSelector})`
  return 'element'
}

/**
 * แปลง structured step เป็นประโยคสำหรับแสดงใน UI และ export CSV
 * เก็บ logic ไว้ที่เดียวเพื่อให้ตารางบนเว็บกับไฟล์ CSV อ่านเหมือนกันเสมอ
 */
export function describeStep(step: TestStep): string {
  if (step.description) return step.description

  switch (step.type) {
    case 'navigate':
      return `Navigate to ${step.url}`
    case 'click':
      return `Click ${describeTarget(step.target)}`
    case 'fill':
      return `Enter "${step.value}" in ${describeTarget(step.target)}`
    case 'select':
      return `Select "${step.option}" from ${describeTarget(step.target)}`
    case 'assertVisible':
      return `Verify that ${describeTarget(step.target)} is visible`
    case 'assertText':
      return step.target
        ? `Verify that ${describeTarget(step.target)} shows "${step.text}"`
        : `Verify that the page shows "${step.text}"`
    case 'assertUrl':
      return `Verify that the URL contains "${step.urlContains}"`
    case 'manual':
      return step.description
  }
}

/** รวมทุก step เป็นข้อความหลายบรรทัดแบบมีลำดับ (ใช้ในคอลัมน์ Test_Steps ของ CSV) */
export function describeSteps(steps: TestStep[]): string {
  return steps.map((step, index) => `${index + 1}. ${describeStep(step)}`).join('\n')
}
