import { useState, type FormEvent } from 'react'

type Props = {
  loading: boolean
  onAnalyze: (url: string, maxPages: number, maxDepth: number) => void
}

/** ฟอร์มหลัก: Target URL + ปุ่ม Analyze Website */
export function AnalyzeForm({ loading, onAnalyze }: Props) {
  const [url, setUrl] = useState('http://localhost:5173')
  const [maxPages, setMaxPages] = useState(20)
  const [maxDepth, setMaxDepth] = useState(3)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!url.trim() || loading) return
    onAnalyze(url.trim(), maxPages, maxDepth)
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="field-label" htmlFor="target-url">
            Target URL
          </label>
          <input
            id="target-url"
            className="field"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="http://localhost:5173"
            autoComplete="off"
          />
        </div>

        <div className="w-full md:w-28">
          <label className="field-label" htmlFor="max-pages">
            Max pages
          </label>
          <input
            id="max-pages"
            className="field"
            type="number"
            min={1}
            max={20}
            value={maxPages}
            onChange={(event) => setMaxPages(Number(event.target.value))}
          />
        </div>

        <div className="w-full md:w-28">
          <label className="field-label" htmlFor="max-depth">
            Max depth
          </label>
          <input
            id="max-depth"
            className="field"
            type="number"
            min={0}
            max={3}
            value={maxDepth}
            onChange={(event) => setMaxDepth(Number(event.target.value))}
          />
        </div>

        <button type="submit" className="btn btn-primary md:w-44" disabled={loading}>
          {loading ? 'กำลังวิเคราะห์...' : 'Analyze Website'}
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Explorer จะสำรวจเฉพาะ origin เดียวกัน ไม่คลิกปุ่ม ไม่ submit form
        และไม่แตะ action ที่อาจเปลี่ยนข้อมูล
      </p>
    </form>
  )
}
