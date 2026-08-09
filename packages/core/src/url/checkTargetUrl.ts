import type { UrlCheckResult, UrlPolicy } from '../types/url.js'
import { LOCAL_QA_POLICY } from './policy.js'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])
const CLOUD_METADATA_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal', 'metadata'])

export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true
  if (host.startsWith('fc') || host.startsWith('fd')) return true
  if (host.startsWith('fe80:')) return true

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4) return false

  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 127) return true
  return false
}

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase())
}

export function isCloudMetadataHostname(hostname: string): boolean {
  return CLOUD_METADATA_HOSTS.has(hostname.toLowerCase())
}

export function checkTargetUrl(rawUrl: string, policy: UrlPolicy = LOCAL_QA_POLICY): UrlCheckResult {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return { ok: false, code: 'invalid-url', message: 'กรุณาใส่ URL ที่ต้องการวิเคราะห์' }
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`

  let url: URL
  try {
    url = new URL(withProtocol)
  } catch {
    return { ok: false, code: 'invalid-url', message: 'รูปแบบ URL ไม่ถูกต้อง' }
  }

  if (!policy.allowedProtocols.includes(url.protocol)) {
    return {
      ok: false,
      code: 'blocked-url',
      message: `รองรับเฉพาะ ${policy.allowedProtocols.join(', ')} เท่านั้น (ได้รับ ${url.protocol})`
    }
  }

  if (!url.hostname) {
    return { ok: false, code: 'invalid-url', message: 'URL ไม่มีชื่อโฮสต์' }
  }

  if (url.username || url.password) {
    return { ok: false, code: 'blocked-url', message: 'ไม่อนุญาตให้ใส่ credentials ไว้ใน URL' }
  }

  if (!policy.allowCloudMetadata && isCloudMetadataHostname(url.hostname)) {
    return { ok: false, code: 'blocked-url', message: 'ไม่อนุญาตให้เข้าถึง cloud metadata endpoint' }
  }

  if (!policy.allowLoopback && isLoopbackHostname(url.hostname)) {
    return { ok: false, code: 'blocked-url', message: 'ไม่อนุญาตให้เข้าถึง localhost' }
  }

  if (!policy.allowPrivateNetwork && isPrivateHostname(url.hostname)) {
    return { ok: false, code: 'blocked-url', message: 'ไม่อนุญาตให้เข้าถึงเครือข่ายภายใน (private IP)' }
  }

  return { ok: true, url }
}
