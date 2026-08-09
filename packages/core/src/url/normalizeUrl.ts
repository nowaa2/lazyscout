const NON_PAGE_EXTENSIONS = [
  '.pdf',
  '.zip',
  '.rar',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.mp4',
  '.mp3',
  '.avi',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.csv',
  '.exe',
  '.dmg'
]

export function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl)
  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  url.searchParams.sort()

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }
  return url.toString()
}

export function isSameOrigin(candidate: string, origin: string): boolean {
  try {
    return new URL(candidate).origin === origin
  } catch {
    return false
  }
}

export function isCrawlableUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const path = url.pathname.toLowerCase()
    return !NON_PAGE_EXTENSIONS.some((ext) => path.endsWith(ext))
  } catch {
    return false
  }
}

export function moduleNameFromUrl(rawUrl: string): string {
  try {
    const { pathname } = new URL(rawUrl)
    const segments = pathname.split('/').filter(Boolean).slice(0, 2)
    if (segments.length === 0) return 'HOME'

    const name = segments
      .join('-')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^a-zA-Z0-9ก-๙-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toUpperCase()

    return name || 'HOME'
  } catch {
    return 'PAGE'
  }
}
