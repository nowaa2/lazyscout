/** Policy สำหรับตรวจ URL ก่อนให้ browser เปิด (ป้องกัน SSRF ตอนทำ online version) */
export type UrlPolicy = {
  allowedProtocols: string[]
  /** localhost, 127.0.0.1, ::1 */
  allowLoopback: boolean
  /** 10.x, 192.168.x, 172.16-31.x, *.local, *.internal */
  allowPrivateNetwork: boolean
  /** 169.254.169.254 และ endpoint ของ cloud metadata */
  allowCloudMetadata: boolean
}

export type UrlCheckResult =
  | { ok: true; url: URL }
  | { ok: false; code: 'invalid-url' | 'blocked-url'; message: string }
