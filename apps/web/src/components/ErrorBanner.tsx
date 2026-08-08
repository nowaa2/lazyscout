type Props = {
  message: string
  hint?: string
}

/** แสดง error ที่มนุษย์อ่านเข้าใจ (server ไม่เคยส่ง stack trace มาให้) */
export function ErrorBanner({ message, hint }: Props) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-700">{message}</p>
      {hint && <p className="mt-1 text-sm text-red-600">{hint}</p>}
    </div>
  )
}
