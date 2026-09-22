import { readFile } from 'node:fs/promises'
import { timingSafeEqual } from 'node:crypto'
import { cache } from 'react'
import { z } from 'zod'

/**
 * Client links.
 *
 * One link per site, revocable, and scoped to that site alone. The link is
 * the whole credential — it is pasted into a WhatsApp group, so it is
 * treated as a bearer token: never logged, compared in constant time, and
 * carrying read access to one site and nothing else.
 *
 * See docs/specs/reno-dashboard.md (AC-3, AC-4, AC-6).
 */
const clientToken = z.strictObject({
  token: z.string().min(16),
  site_id: z.string().min(1),
  label: z.string().min(1),
  revoked: z.boolean(),
})

export type ClientToken = z.infer<typeof clientToken>

const TOKENS_FILE = 'fixtures/site/client-tokens.json'

/**
 * The deployed link is not the committed one. The file in the repository is a
 * fixture — anyone who can read the repository can read it — so a deployment
 * points `CLIENT_TOKENS_FILE` at a file mounted beside the container and the
 * committed token stops working the moment it does.
 */
function tokensFile(): string {
  const named = process.env['CLIENT_TOKENS_FILE']
  return named === undefined || named.trim() === '' ? TOKENS_FILE : named
}

const loadTokens = cache(async (): Promise<readonly ClientToken[]> => {
  const raw: unknown = JSON.parse(await readFile(tokensFile(), 'utf8'))
  return z.array(clientToken).parse(raw)
})

/**
 * Constant-time comparison. A plain `===` leaks the length of the matching
 * prefix through timing, which is enough to walk a token character by
 * character given enough requests.
 */
function matches(candidate: string, known: string): boolean {
  const a = Buffer.from(candidate)
  const b = Buffer.from(known)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** The site this link may read, or null when the link is unknown or revoked. */
export async function resolveToken(candidate: string): Promise<ClientToken | null> {
  const tokens = await loadTokens()
  const found = tokens.find((t) => matches(candidate, t.token))
  if (found === undefined || found.revoked) return null
  return found
}
