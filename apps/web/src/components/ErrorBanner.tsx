type Props = {
  message: string
  hint?: string
}

export function ErrorBanner({ message, hint }: Props) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-700">{message}</p>
      {hint && <p className="mt-1 text-sm text-red-600">{hint}</p>}
    </div>
  )
}
