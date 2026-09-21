import { timingSafeEqual } from 'node:crypto'

/**
 * Who may write records.
 *
 * One token per agent, from the environment, never from a file in the repo.
 * The token is the whole credential, so it is compared in constant time and
 * never appears in a log line, an error body or a stack trace — an error
 * that echoes the credential it rejected hands it to whoever reads the logs.
 *
 * Format: `INGEST_TOKENS="lwas:<token>,ggb:<token>"`. The site prefix is what
 * scopes a token, so a compromised agent cannot write into a site it does
 * not serve (AC-9).
 */
export interface AgentToken {
  readonly siteId: string
}

function parse(raw: string): ReadonlyMap<string, string> {
  const pairs = new Map<string, string>()
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim()
    if (trimmed === '') continue
    const at = trimmed.indexOf(':')
    if (at <= 0) continue
    pairs.set(trimmed.slice(at + 1), trimmed.slice(0, at))
  }
  return pairs
}

function matches(candidate: string, known: string): boolean {
  const a = Buffer.from(candidate)
  const b = Buffer.from(known)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** The site this token may write to, or null. */
export function resolveAgentToken(header: string | null, env: string | undefined): AgentToken | null {
  if (header === null || env === undefined || env.trim() === '') return null
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) return null
  const candidate = header.slice(prefix.length).trim()
  if (candidate === '') return null

  for (const [token, siteId] of parse(env)) {
    if (matches(candidate, token)) return { siteId }
  }
  return null
}
