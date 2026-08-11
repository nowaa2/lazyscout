import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

const riskyPaths = [
  ['environment file', /(^|\/)\.env(?:\.|$)/i],
  ['database file', /\.(?:db|sqlite|sqlite3)$/i],
  ['browser authentication state', /(^|\/)(?:storage[-_]?state|auth|session|user)(?:\.[^/]*)?\.json$/i],
  ['HAR capture', /\.har$/i],
  [
    'test artifact',
    /(^|\/)(?:playwright-report|test-results|traces|videos|screenshots|workspace|local-data|user-data)\//i
  ]
]

const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['bearer token', /\bBearer\s+[A-Za-z0-9._~+/-]{20,}={0,2}\b/i],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/]
]

const allowedPublicAssets = [/^apps\/site\/public\/screenshots\//i]

const findings = []

for (const file of files) {
  const normalized = file.replace(/\\/g, '/')
  if (normalized !== '.env.example' && !allowedPublicAssets.some((pattern) => pattern.test(normalized))) {
    for (const [rule, pattern] of riskyPaths) {
      if (pattern.test(normalized)) findings.push({ file: normalized, rule })
    }
  }

  let stats
  try {
    stats = statSync(file)
  } catch {
    continue
  }
  if (!stats.isFile() || stats.size > 2_000_000) continue

  let content
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  if (content.includes('\0')) continue
  for (const [rule, pattern] of secretPatterns) {
    if (pattern.test(content)) findings.push({ file: normalized, rule })
  }
}

const uniqueFindings = [...new Map(findings.map((finding) => [`${finding.file}:${finding.rule}`, finding])).values()]
if (uniqueFindings.length > 0) {
  console.error('Potential sensitive data detected:')
  for (const finding of uniqueFindings) console.error(`- ${finding.file} (${finding.rule})`)
  console.error('Review or remove these files before committing or publishing.')
  process.exit(1)
}

console.log(`Secret safety check passed for ${files.length} repository files.`)
