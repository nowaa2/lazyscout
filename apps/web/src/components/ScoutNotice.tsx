type Props = { message: string; detail: string; onClose: () => void }

export function ScoutNotice({ message, detail, onClose }: Props) {
  return <div className="scout-notice" role="alert">
    <div className="scout-notice-icon">!</div>
    <div><b>{message}</b><p>{detail}</p></div>
    <button type="button" onClick={onClose} aria-label="Dismiss notice">×</button>
  </div>
}
