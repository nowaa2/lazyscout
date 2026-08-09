export type UrlPolicy = {
  allowedProtocols: string[]

  allowLoopback: boolean

  allowPrivateNetwork: boolean

  allowCloudMetadata: boolean
}

export type UrlCheckResult =
  { ok: true; url: URL } | { ok: false; code: 'invalid-url' | 'blocked-url'; message: string }
