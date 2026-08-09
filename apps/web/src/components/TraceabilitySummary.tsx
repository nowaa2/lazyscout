import { useMemo } from 'react'
import type { TestCase } from '../types'

export function TraceabilitySummary({ testCases }: { testCases: TestCase[] }) {
  const requirements = useMemo(() => {
    const map = new Map<string, TestCase[]>()
    for (const testCase of testCases)
      for (const requirement of testCase.requirements ?? [])
        map.set(requirement, [...(map.get(requirement) ?? []), testCase])
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right))
  }, [testCases])
  const linkedCases = testCases.filter((testCase) => (testCase.requirements?.length ?? 0) > 0).length
  const unlinkedCases = testCases.length - linkedCases
  if (!testCases.length) return null
  return (
    <section className="traceability-summary">
      <div className="traceability-summary-head">
        <div>
          <p className="eyebrow">Requirements traceability</p>
          <h3>Coverage at a glance</h3>
        </div>
        <span>{requirements.length} requirements</span>
      </div>
      <div className="traceability-kpis">
        <div>
          <b>{linkedCases}</b>
          <span>Linked cases</span>
        </div>
        <div>
          <b>{unlinkedCases}</b>
          <span>Without requirement</span>
        </div>
        <div>
          <b>{requirements.length ? Math.round((linkedCases / testCases.length) * 100) : 0}%</b>
          <span>Case coverage</span>
        </div>
      </div>
      {requirements.length ? (
        <div className="traceability-list">
          {requirements.slice(0, 8).map(([requirement, cases]) => (
            <div key={requirement}>
              <span title={requirement}>{requirement}</span>
              <b>
                {cases.length} case{cases.length === 1 ? '' : 's'}
              </b>
            </div>
          ))}
          {requirements.length > 8 && <small>+ {requirements.length - 8} more requirements</small>}
        </div>
      ) : (
        <p className="traceability-empty">
          Add a Jira ID, GitLab issue or merge request URL, ticket, or requirement URL to a Test Case to track coverage
          here.
        </p>
      )}
    </section>
  )
}
