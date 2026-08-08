import type { UrlCheckResult, UrlPolicy } from '../types/url.js'
import { LOCAL_QA_POLICY } from './policy.js'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])
const CLOUD_METADATA_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal', 'metadata'])

/** ตรวจว่า hostname เป็น IP ในวง private หรือชื่อโดเมนภายในองค์กร */
export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true
  if (host.startsWith('fc') || host.startsWith('fd')) return true // IPv6 unique local
  if (host.startsWith('fe80:')) return true // IPv6 link-local

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4) return false

  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true // link-local (รวม cloud metadata)
  if (a === 127) return true
  return false
}

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase())
}

export function isCloudMetadataHostname(hostname: string): boolean {
  return CLOUD_METADATA_HOSTS.has(hostname.toLowerCase())
}

/**
 * ด่านเดียวที่ตัดสินว่า URL ที่ user ใส่มาเปิดได้หรือไม่
 *
 * ข้อจำกัดที่ตั้งใจไว้ใน MVP: ตรวจจาก hostname เท่านั้น ยังไม่ resolve DNS
 * ตอนทำ online version ต้องเพิ่ม DNS resolution + ตรวจ IP จริง (กัน DNS rebinding)
 */
export function checkTargetUrl(rawUrl: string, policy: UrlPolicy = LOCAL_QA_POLICY): UrlCheckResult {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return { ok: false, code: 'invalid-url', message: 'กรุณาใส่ URL ที่ต้องการวิเคราะห์' }
  }

  // เติม http:// ให้อัตโนมัติเมื่อ user พิมพ์แค่ host เช่น "localhost:5173"
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`

  let url: URL
  try {
    url = new URL(withProtocol)
  } catch {
    return { ok: false, code: 'invalid-url', message: `รูปแบบ URL ไม่ถูกต้อง: ${rawUrl}` }
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
