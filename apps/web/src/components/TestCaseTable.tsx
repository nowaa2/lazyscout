import type { TestCase } from '../types'
import { AutomationBadge, PriorityBadge, TypeBadge } from './Badges'

type Props = {
  testCases: TestCase[]
  selectedIds: string[]
  activeId?: string
  onToggleSelect: (id: string) => void
  onToggleAll: (ids: string[]) => void
  onOpen: (testCase: TestCase) => void
  onEdit: (testCase: TestCase) => void
  onDelete: (id: string) => void
}

/** ตาราง Test Case สำหรับรีวิว — คลิกที่แถวเพื่อดูรายละเอียด */
export function TestCaseTable({
  testCases,
  selectedIds,
  activeId,
  onToggleSelect,
  onToggleAll,
  onOpen,
  onEdit,
  onDelete
}: Props) {
  const allSelected = testCases.length > 0 && testCases.every((item) => selectedIds.includes(item.id))

  if (testCases.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-500">ไม่มี test case ที่ตรงกับเงื่อนไข</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="table-head w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onToggleAll(allSelected ? [] : testCases.map((item) => item.id))}
                aria-label="เลือกทั้งหมด"
              />
            </th>
            <th className="table-head w-32">TC ID</th>
            <th className="table-head w-28">Module</th>
            <th className="table-head">Title</th>
            <th className="table-head w-24">Type</th>
            <th className="table-head w-24">Priority</th>
            <th className="table-head">Expected Result</th>
            <th className="table-head w-32">Automation</th>
            <th className="table-head w-28">Actions</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((testCase) => (
            <tr
              key={testCase.id}
              onClick={() => onOpen(testCase)}
              className={`cursor-pointer border-b border-slate-100 hover:bg-blue-50 ${
                activeId === testCase.id ? 'bg-blue-50' : ''
              }`}
            >
              <td className="table-cell" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(testCase.id)}
                  onChange={() => onToggleSelect(testCase.id)}
                  aria-label={`เลือก ${testCase.id}`}
                />
              </td>
              <td className="table-cell font-mono text-xs">{testCase.id}</td>
              <td className="table-cell">{testCase.module}</td>
              <td className="table-cell font-medium text-slate-900">{testCase.title}</td>
              <td className="table-cell">
                <TypeBadge value={testCase.type} />
              </td>
              <td className="table-cell">
                <PriorityBadge value={testCase.priority} />
              </td>
              <td className="table-cell max-w-md text-slate-600">{testCase.expectedResult}</td>
              <td className="table-cell">
                <AutomationBadge value={testCase.automationStatus} />
              </td>
              <td className="table-cell" onClick={(event) => event.stopPropagation()}>
                <div className="flex gap-1">
                  <button type="button" className="btn btn-secondary px-2 py-1" onClick={() => onEdit(testCase)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger px-2 py-1"
                    onClick={() => onDelete(testCase.id)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
