import type { UrlPolicy } from '../types/url.js'

export const LOCAL_QA_POLICY: UrlPolicy = {
  allowedProtocols: ['http:', 'https:'],
  allowLoopback: true,
  allowPrivateNetwork: true,
  allowCloudMetadata: false
}

export const PUBLIC_SAAS_POLICY: UrlPolicy = {
  allowedProtocols: ['http:', 'https:'],
  allowLoopback: false,
  allowPrivateNetwork: false,
  allowCloudMetadata: false
}
