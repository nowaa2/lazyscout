import { useEffect, useRef, useState } from 'react'
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
  onReorder: (draggedId: string, targetId: string) => void
}

export function TestCaseTable({
  testCases,
  selectedIds,
  activeId,
  onToggleSelect,
  onToggleAll,
  onOpen,
  onEdit,
  onDelete,
  onReorder
}: Props) {
  const [draggedId, setDraggedId] = useState<string>()
  const [dragOverId, setDragOverId] = useState<string>()
  const [openActionId, setOpenActionId] = useState<string>()
  const actionMenuRef = useRef<HTMLDivElement>(null)
  const allSelected = testCases.length > 0 && testCases.every((item) => selectedIds.includes(item.id))

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) setOpenActionId(undefined)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenActionId(undefined)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  if (testCases.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-500">No Test Cases match the current filters.</p>
  }

  return (
    <div className="overflow-x-auto border border-slate-200">
      <table className="w-full border-collapse">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="table-head w-10">Move</th>
            <th className="table-head w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onToggleAll(allSelected ? [] : testCases.map((item) => item.id))}
                aria-label="Select all"
              />
            </th>
            <th className="table-head w-32">TC ID</th>
            <th className="table-head w-28">Folder</th>
            <th className="table-head">Title</th>
            <th className="table-head w-24">Type</th>
            <th className="table-head w-24">Priority</th>
            <th className="table-head">Expected Result</th>
            <th className="table-head w-32">Automation</th>
            <th className="table-head w-28 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((testCase) => (
            <tr
              key={testCase.id}
              draggable
              onDragStart={() => setDraggedId(testCase.id)}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOverId(testCase.id)
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (draggedId) onReorder(draggedId, testCase.id)
                setDraggedId(undefined)
                setDragOverId(undefined)
              }}
              onDragEnd={() => {
                setDraggedId(undefined)
                setDragOverId(undefined)
              }}
              onClick={() => {
                setOpenActionId(undefined)
                onOpen(testCase)
              }}
              className={`cursor-pointer border-b border-slate-100 hover:bg-blue-50 ${dragOverId === testCase.id ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-300' : ''} ${
                activeId === testCase.id ? 'bg-blue-50' : ''
              }`}
            >
              <td
                className="table-cell drag-handle"
                onClick={(event) => event.stopPropagation()}
                title="Drag to reorder"
              >
                ⠿
              </td>
              <td className="table-cell" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(testCase.id)}
                  onChange={() => onToggleSelect(testCase.id)}
                  aria-label={`Select ${testCase.id}`}
                />
              </td>
              <td className="table-cell font-mono text-xs">{testCase.id}</td>
              <td className="table-cell">{testCase.folder ?? testCase.module}</td>
              <td className="table-cell font-medium text-slate-900">
                {testCase.title}
                {(testCase.tags?.length || testCase.requirements?.length) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {testCase.tags?.slice(0, 3).map((tag) => (
                      <span key={tag} className="tag-chip">
                        {tag}
                      </span>
                    ))}
                    {testCase.requirements?.slice(0, 2).map((requirement) => (
                      <span key={requirement} className="requirement-chip">
                        {requirement}
                      </span>
                    ))}
                  </div>
                )}
              </td>
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
              <td className="table-cell text-center" onClick={(event) => event.stopPropagation()}>
                <div className="action-menu-wrap" ref={openActionId === testCase.id ? actionMenuRef : undefined}>
                  <button
                    type="button"
                    className="action-menu-trigger"
                    aria-label={`Actions for ${testCase.id}`}
                    aria-expanded={openActionId === testCase.id}
                    onClick={() => setOpenActionId((current) => (current === testCase.id ? undefined : testCase.id))}
                  >
                    ⋯
                  </button>
                  {openActionId === testCase.id && (
                    <div className="action-menu">
                      <button
                        type="button"
                        onClick={() => {
                          onEdit(testCase)
                          setOpenActionId(undefined)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          onDelete(testCase.id)
                          setOpenActionId(undefined)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
