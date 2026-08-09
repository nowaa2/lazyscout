const SENSITIVE_NAMES = [
  'password',
  'passwd',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'client_secret',
  'session',
  'sessionid'
]

const SENSITIVE_NAME_PATTERN = SENSITIVE_NAMES.map((name) => name.replace('-', '[-_]?').replace('_', '[-_]?')).join('|')
const ASSIGNMENT_NAME_PATTERN = SENSITIVE_NAMES.filter((name) => name !== 'authorization')
  .map((name) => name.replace('-', '[-_]?').replace('_', '[-_]?'))
  .join('|')

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function redactSensitiveText(value: string, knownSecrets: readonly string[] = []): string {
  let redacted = value
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1***')
    .replace(/(bearer\s+)[A-Za-z0-9._~+/-]{8,}/gi, '$1***')
    .replace(new RegExp(`((?:${ASSIGNMENT_NAME_PATTERN})["']?\\s*[:=]\\s*["']?)[^"'\\s,;}]+`, 'gi'), '$1***')
    .replace(new RegExp(`([?&](?:${SENSITIVE_NAME_PATTERN})=)[^&#\\s]*`, 'gi'), '$1***')

  for (const secret of knownSecrets) {
    if (secret.length < 3) continue
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), 'g'), '***')
  }
  return redacted
}

export function redactUrl(value: string): string {
  try {
    const url = new URL(value)
    if (url.username) url.username = '***'
    if (url.password) url.password = '***'
    for (const key of [...url.searchParams.keys()]) {
      const normalized = key.toLowerCase().replace(/-/g, '_')
      if (SENSITIVE_NAMES.some((name) => normalized.includes(name.replace(/-/g, '_')))) url.searchParams.set(key, '***')
    }
    return url.toString()
  } catch {
    return redactSensitiveText(value)
  }
}
