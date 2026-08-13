import type { CoverageEntry, CoverageReason, CoverageReport, UIElement, UIPattern } from '../types/page.js'
import { elementIdentity, matchPattern } from './catalog.js'

/**
 * Records what happened to every discovered element so a run can be judged on
 * coverage rather than on the number of Test Cases it happened to produce.
 *
 * The first reason recorded for an element wins. An element is only counted as
 * `tested` once, so re-visiting a state cannot inflate the numbers.
 */
export class CoverageTracker {
  private readonly entries = new Map<string, CoverageEntry>()
  private modalStates = 0
  private casesGenerated = 0
  private casesDeduplicated = 0

  /** Register an element as discovered. Safe to call repeatedly. */
  discover(element: UIElement, stateId?: string): string {
    const pattern = element.uiPattern ?? matchPattern(element).pattern
    const id = element.elementId ?? elementIdentity(element, pattern)
    if (!this.entries.has(id)) {
      this.entries.set(id, {
        elementId: id,
        pattern,
        reason: element.disabled ? 'disabled' : pattern === 'unknown' ? 'unknown-pattern' : 'skipped-limit',
        stateId,
        locator: element.cssSelector,
        name: element.accessibleName || element.name || element.id
      })
    }
    return id
  }

  /**
   * Record the outcome for an element. `tested` is terminal — a later skip for
   * the same element cannot downgrade it.
   */
  record(elementId: string, reason: CoverageReason, detail?: string): void {
    const entry = this.entries.get(elementId)
    if (!entry) return
    if (entry.reason === 'tested' && reason !== 'tested') return
    entry.reason = reason
    if (detail) entry.detail = detail
  }

  countModalState(): void {
    this.modalStates += 1
  }

  countCase(deduplicated = false): void {
    if (deduplicated) this.casesDeduplicated += 1
    else this.casesGenerated += 1
  }

  report(): CoverageReport {
    return buildCoverageReport([...this.entries.values()], {
      modalStates: this.modalStates,
      casesGenerated: this.casesGenerated,
      casesDeduplicated: this.casesDeduplicated
    })
  }
}

const BLOCKED: readonly CoverageReason[] = ['blocked-destructive', 'blocked-session-ending', 'blocked-filter']
const SKIPPED: readonly CoverageReason[] = ['skipped-limit', 'skipped-duplicate', 'not-visible', 'disabled', 'failed']

export function buildCoverageReport(
  entries: CoverageEntry[],
  totals: { modalStates?: number; casesGenerated?: number; casesDeduplicated?: number } = {}
): CoverageReport {
  const byPattern = new Map<UIPattern, { discovered: number; tested: number }>()
  for (const entry of entries) {
    const bucket = byPattern.get(entry.pattern) ?? { discovered: 0, tested: 0 }
    bucket.discovered += 1
    if (entry.reason === 'tested') bucket.tested += 1
    byPattern.set(entry.pattern, bucket)
  }

  return {
    elementsDiscovered: entries.length,
    knownPatterns: entries.filter((entry) => entry.pattern !== 'unknown').length,
    tested: entries.filter((entry) => entry.reason === 'tested').length,
    skipped: entries.filter((entry) => SKIPPED.includes(entry.reason)).length,
    blocked: entries.filter((entry) => BLOCKED.includes(entry.reason)).length,
    unknown: entries.filter((entry) => entry.reason === 'unknown-pattern').length,
    modalStates: totals.modalStates ?? 0,
    casesGenerated: totals.casesGenerated ?? 0,
    casesDeduplicated: totals.casesDeduplicated ?? 0,
    byPattern: [...byPattern.entries()]
      .map(([pattern, bucket]) => ({ pattern, ...bucket }))
      .sort((left, right) => right.discovered - left.discovered),
    entries
  }
}
