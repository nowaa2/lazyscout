

export type TestDataRow = {
  id: string
  module: string

  sourceUrl: string

  field: string

  inputType: string
  required: boolean

  validValue: string

  invalidValue: string

  note?: string
}
