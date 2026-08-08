import type { PageInfo, TestDataRow, UIElement } from '@lazyscout/core'
import { makeTestDataId } from '@lazyscout/core'
import { assignModules } from '../moduleNames.js'
import { labelOf, sampleValueFor } from '../testcases/targets.js'

function inputTypeOf(field: UIElement): string {
  if (field.kind === 'select') return 'select'
  if (field.kind === 'textarea') return 'textarea'
  return field.inputType || 'text'
}

function invalidValueFor(field: UIElement): { value: string; note: string } {
  const type = inputTypeOf(field)

  switch (type) {
    case 'email':
      return { value: 'invalid-email', note: 'Tests email format validation.' }
    case 'password':
      return { value: '123', note: 'Tests minimum length/complexity — confirm the real rule with the specification.' }
    case 'number':
    case 'range':
      return { value: 'abc', note: 'Tests that non-numeric input is rejected.' }
    case 'tel':
      return { value: '12', note: 'Tests phone number length — confirm the real format with the specification.' }
    case 'date':
      return { value: '2026-13-45', note: 'Tests that an out-of-range date is rejected.' }
    case 'url':
      return { value: 'not-a-url', note: 'Tests URL format validation.' }
    case 'select':
      return { value: '(no option selected)', note: 'Tests the case where no option is selected.' }
    case 'checkbox':
    case 'radio':
      return { value: '(not selected)', note: 'Tests the case where the option is not selected.' }
    default:
      return {
        value: '(empty)',
        note: field.required
          ? 'Tests the required-field rule.'
          : 'Field is not marked required — confirm with the specification whether validation applies.'
      }
  }
}

function validValueFor(field: UIElement): string {
  if (field.kind === 'select') return field.options?.find(Boolean) ?? '(first option)'
  if (field.inputType === 'checkbox' || field.inputType === 'radio') return '(selected)'
  return sampleValueFor(field)
}

export function generateTestData(pages: PageInfo[]): TestDataRow[] {
  const moduleByUrl = assignModules(pages)
  const rows: TestDataRow[] = []

  for (const page of pages) {
    const module = moduleByUrl.get(page.url) ?? 'PAGE'
    const seenFields = new Set<string>()
    let sequence = 0

    const fields = [...page.inputs, ...page.textareas, ...page.selects]

    for (const field of fields) {
      const name = labelOf(field)
      if (!name || seenFields.has(name)) continue
      seenFields.add(name)

      const invalid = invalidValueFor(field)
      sequence++

      rows.push({
        id: makeTestDataId(module, sequence),
        module,
        sourceUrl: page.finalUrl,
        field: name,
        inputType: inputTypeOf(field),
        required: field.required,
        validValue: validValueFor(field),
        invalidValue: invalid.value,
        note: invalid.note
      })
    }
  }

  return rows
}
