import { useState } from 'react'
import { SUGGESTED_BLOCK_KEYWORDS } from '@lazyscout/core'
import type { ClickFilter } from '../hooks/useClickFilter'

type Props = {
  filter: ClickFilter
  onChange: (filter: ClickFilter) => void
}

const toText = (keywords: string[]) => keywords.join('\n')
const toKeywords = (text: string) => text.split(/[\n,]/).map((keyword) => keyword.trim())

export function ClickFilterPanel({ filter, onChange }: Props) {
  const [text, setText] = useState(() => toText(filter.keywords))

  const commit = (nextText: string, enabled = filter.enabled) => {
    setText(nextText)
    onChange({ enabled, keywords: toKeywords(nextText) })
  }

  return (
    <div className="settings-notice settings-notice-stacked click-filter-panel">
      <b>Click safeguards {filter.enabled ? 'ON' : 'OFF'}</b>
      <span>
        Suggested destructive actions are blocked by default. Explorer skips them and an Automation run stops instead of
        clicking. Logout and sign-out actions remain available for QA testing.
      </span>

      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={filter.enabled}
          onChange={(event) => onChange({ ...filter, enabled: event.target.checked })}
        />
        <span>Block controls whose label contains one of these words</span>
      </label>

      {filter.enabled && (
        <>
          <textarea
            className="click-filter-input"
            rows={5}
            value={text}
            onChange={(event) => commit(event.target.value)}
            placeholder={'delete\npay now\ntransfer'}
          />
          <p className="click-filter-help">
            One word per line. Matching ignores case and looks at the label, title, name, id and link URL of a control.
          </p>
          <div className="recorder-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => commit(toText([...new Set([...filter.keywords, ...SUGGESTED_BLOCK_KEYWORDS])]))}
            >
              Add suggested words
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => commit('')}>
              Clear list
            </button>
          </div>
        </>
      )}
    </div>
  )
}
