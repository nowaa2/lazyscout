import { useEffect, useRef, useState } from 'react'
import { describeStep } from '@lazyscout/core'
import type { TestCase, TestCaseExecutionStatus } from '../types'

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
  onUpdateCell: (id: string, key: string, value: string) => void
  executionStatuses?: Record<string, 'passed' | 'failed' | 'pending'>
}

function EditableCell({
  value,
  editValue = value,
  options,
  multiline = false,
  onSave
}: {
  value: string
  editValue?: string
  options?: string[]
  multiline?: boolean
  onSave: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(editValue)

  useEffect(() => {
    if (!editing) setDraft(editValue)
  }, [editing, editValue])

  if (!editing) {
    return (
      <span className="inline-edit-value" title="Double-click to edit" onDoubleClick={() => setEditing(true)}>
        {value || '—'}
      </span>
    )
  }

  const save = () => {
    setEditing(false)
    if (draft !== editValue) onSave(draft)
  }
  const props = {
    autoFocus: true,
    value: draft,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
    onBlur: save,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') save()
      if (event.key === 'Escape') {
        setDraft(editValue)
        setEditing(false)
      }
    },
    onClick: (event: React.MouseEvent) => event.stopPropagation()
  }

  if (multiline && !options) {
    return <textarea {...props} className="inline-edit-textarea" rows={5} />
  }

  return options ? (
    <select {...props} className="inline-edit-input">
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  ) : (
    <input {...props} className="inline-edit-input" />
  )
}

function RichTextCell({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const selectionRef = useRef<Range | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [editing, value])

  if (!editing) {
    return (
      <span
        className="inline-edit-value"
        title="Double-click to edit title"
        onDoubleClick={() => setEditing(true)}
        dangerouslySetInnerHTML={{ __html: value || '—' }}
      />
    )
  }

  const rememberSelection = () => {
    const selection = window.getSelection()
    if (selection?.rangeCount) selectionRef.current = selection.getRangeAt(0).cloneRange()
  }
  const restoreSelection = () => {
    const selection = window.getSelection()
    if (selectionRef.current && selection) {
      selection.removeAllRanges()
      selection.addRange(selectionRef.current)
    }
  }
  const command = (name: string, valueArg?: string) => {
    restoreSelection()
    document.execCommand(name, false, valueArg)
    editorRef.current?.focus()
    rememberSelection()
  }
  const save = (element: HTMLDivElement) => {
    setDraft(element.innerHTML)
    setEditing(false)
    onSave(element.innerHTML)
  }

  return (
    <div className="rich-text-editor" onClick={(event) => event.stopPropagation()}>
      <div className="rich-text-toolbar">
        <button type="button" onMouseDown={() => rememberSelection()} onClick={() => command('bold')}>
          B
        </button>
        <button type="button" onMouseDown={() => rememberSelection()} onClick={() => command('italic')}>
          I
        </button>
        <input
          type="color"
          defaultValue="#1e293b"
          onMouseDown={() => rememberSelection()}
          onChange={(event) => command('foreColor', event.target.value)}
          aria-label="Text color"
        />
        <select
          defaultValue="3"
          onMouseDown={() => rememberSelection()}
          onChange={(event) => command('fontSize', event.target.value)}
          aria-label="Text size"
        >
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="5">Large</option>
          <option value="7">Huge</option>
        </select>
      </div>
      <div
        className="rich-text-content"
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: draft }}
        onBlur={(event) => {
          if (event.relatedTarget && editorRef.current?.parentElement?.contains(event.relatedTarget as Node)) return
          save(event.currentTarget)
        }}
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
      />
    </div>
  )
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
  onReorder,
  onUpdateCell,
  executionStatuses = {}
}: Props) {
  const [draggedId, setDraggedId] = useState<string>()
  const [dragOverId, setDragOverId] = useState<string>()
  const [openActionId, setOpenActionId] = useState<string>()
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TestCaseExecutionStatus>>({})
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
    <div className="test-case-table-scroll border border-slate-200">
      <table className="test-case-table border-collapse" style={{ minWidth: '2200px', width: 'max-content' }}>
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
            <th className="table-head w-56">Steps</th>
            <th className="table-head">Expected Result</th>
            <th className="table-head w-32">Automation</th>
            <th className="table-head w-48">Preconditions</th>
            <th className="table-head w-48">Notes</th>
            <th className="table-head w-40">Tags</th>
            <th className="table-head w-32">Status</th>
            <th className="table-head w-28 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((testCase) => (
            <tr
              key={testCase.id}
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
              className={`border-b border-slate-100 hover:bg-blue-50 ${dragOverId === testCase.id ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-300' : ''} ${
                activeId === testCase.id ? 'bg-blue-50' : ''
              }`}
            >
              <td
                className="table-cell drag-handle"
                draggable
                onDragStart={() => setDraggedId(testCase.id)}
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
              <td className="table-cell">
                <EditableCell
                  value={testCase.folder ?? testCase.module}
                  onSave={(value) => onUpdateCell(testCase.id, 'folder', value)}
                />
              </td>
              <td className="table-cell font-medium text-slate-900">
                <RichTextCell value={testCase.title} onSave={(value) => onUpdateCell(testCase.id, 'title', value)} />
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
                <EditableCell
                  value={testCase.type}
                  options={['positive', 'negative', 'validation']}
                  onSave={(value) => onUpdateCell(testCase.id, 'type', value)}
                />
              </td>
              <td className="table-cell">
                <EditableCell
                  value={testCase.priority}
                  options={['high', 'medium', 'low']}
                  onSave={(value) => onUpdateCell(testCase.id, 'priority', value)}
                />
              </td>
              <td className="table-cell min-w-56">
                <RichTextCell
                  value={testCase.steps.map((step, index) => `${index + 1}. ${describeStep(step)}`).join('\n')}
                  onSave={(value) => onUpdateCell(testCase.id, 'steps', value)}
                />
                <button
                  type="button"
                  className="mt-2 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpen(testCase)
                  }}
                >
                  ดู Steps
                </button>
              </td>
              <td className="table-cell max-w-md text-slate-600">
                <RichTextCell
                  value={testCase.expectedResult}
                  onSave={(value) => onUpdateCell(testCase.id, 'expectedResult', value)}
                />
              </td>
              <td className="table-cell">
                <EditableCell
                  value={testCase.automationStatus}
                  options={['ready', 'needs-data', 'needs-review', 'manual']}
                  onSave={(value) => onUpdateCell(testCase.id, 'automationStatus', value)}
                />
              </td>
              <td className="table-cell min-w-48">
                <RichTextCell
                  value={testCase.preconditions.join('\n')}
                  onSave={(value) => onUpdateCell(testCase.id, 'preconditions', value)}
                />
              </td>
              <td className="table-cell min-w-48">
                <RichTextCell
                  value={testCase.notes ?? ''}
                  onSave={(value) => onUpdateCell(testCase.id, 'notes', value)}
                />
              </td>
              <td className="table-cell min-w-40">
                <EditableCell
                  value={(testCase.tags ?? []).join(', ')}
                  onSave={(value) => onUpdateCell(testCase.id, 'tags', value)}
                />
              </td>
              <td className="table-cell">
                <EditableCell
                  value={
                    statusOverrides[testCase.id] ??
                    executionStatuses[testCase.id] ??
                    testCase.status ??
                    (testCase.automationStatus === 'ready' ? 'passed' : 'pending')
                  }
                  options={['pending', 'passed', 'failed']}
                  onSave={(value) => {
                    const status = value as TestCaseExecutionStatus
                    setStatusOverrides((current) => ({ ...current, [testCase.id]: status }))
                    onUpdateCell(testCase.id, 'status', status)
                  }}
                />
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
                          onOpen(testCase)
                          setOpenActionId(undefined)
                        }}
                      >
                        View Test Case
                      </button>
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
