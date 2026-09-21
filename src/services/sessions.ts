import { randomBytes } from 'node:crypto'
import type { Sql } from '@/db/client'
import { hashPassword, verifyPassword } from './passwords'

/**
 * Sign-in, sessions and the throttle on guessing.
 *
 * No HTTP here: the route handlers are adapters, so every rule below is
 * testable against a real database without a server, and the rules cannot
 * differ between the test and the deployment.
 *
 * See docs/specs/reno-auth.md
 */

export { SESSION_COOKIE } from './session-cookie'
const SESSION_DAYS = 14

/** Five failures in this window and the account waits (AC-9). */
export const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15

export interface Account {
  readonly account_id: string
  readonly email: string
  readonly display_name: string
}

const normaliseEmail = (email: string): string => email.trim().toLowerCase()

/** Creates an account, or resets the password of one that exists (AC-12). */
export async function upsertAccount(
  sql: Sql,
  email: string,
  displayName: string,
  password: string,
): Promise<Account> {
  const rows = await sql<Account>(
    `INSERT INTO accounts (account_id, email, display_name, password_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           display_name = EXCLUDED.display_name,
           disabled_at = NULL
     RETURNING account_id, email, display_name`,
    [
      `acc_${randomBytes(9).toString('hex')}`,
      normaliseEmail(email),
      displayName,
      await hashPassword(password),
    ],
  )
  const account = rows[0]
  if (account === undefined) throw new Error('account was not written')
  return account
}

export type SignInResult =
  | { readonly ok: true; readonly sessionId: string; readonly account: Account }
  | { readonly ok: false; readonly reason: 'refused' }
  | { readonly ok: false; readonly reason: 'throttled'; readonly waitMinutes: number }

/**
 * Signs in, or refuses.
 *
 * A wrong password and an unknown email are refused identically, and a
 * missing account still pays for a hash: answering faster for an email that
 * does not exist tells an attacker which addresses are real (AC-3).
 */
export async function signIn(sql: Sql, email: string, password: string): Promise<SignInResult> {
  const address = normaliseEmail(email)

  const recent = await sql<{ failures: string }>(
    `SELECT count(*) AS failures FROM login_attempts
     WHERE email = $1 AND failed_at > now() - ($2 || ' minutes')::interval`,
    [address, String(WINDOW_MINUTES)],
  )
  if (Number(recent[0]?.failures ?? 0) >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'throttled', waitMinutes: WINDOW_MINUTES }
  }

  const found = await sql<Account & { password_hash: string }>(
    `SELECT account_id, email, display_name, password_hash FROM accounts
     WHERE email = $1 AND disabled_at IS NULL`,
    [address],
  )
  const account = found[0]

  // A hash is computed either way, so an unknown email costs the same as a
  // wrong password.
  const stored =
    account?.password_hash ??
    'scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAA=='
  const correct = await verifyPassword(password, stored)

  if (account === undefined || !correct) {
    await sql('INSERT INTO login_attempts (email) VALUES ($1)', [address])
    return { ok: false, reason: 'refused' }
  }

  await sql('DELETE FROM login_attempts WHERE email = $1', [address])
  const sessionId = randomBytes(32).toString('base64url')
  await sql(
    `INSERT INTO sessions (session_id, account_id, expires_at)
     VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [sessionId, account.account_id, String(SESSION_DAYS)],
  )
  return {
    ok: true,
    sessionId,
    account: {
      account_id: account.account_id,
      email: account.email,
      display_name: account.display_name,
    },
  }
}

/** The person this session belongs to, or null when it is unknown or expired. */
export async function accountForSession(sql: Sql, sessionId: string): Promise<Account | null> {
  if (sessionId === '') return null
  const rows = await sql<Account>(
    `SELECT a.account_id, a.email, a.display_name
     FROM sessions s JOIN accounts a USING (account_id)
     WHERE s.session_id = $1 AND s.expires_at > now() AND a.disabled_at IS NULL`,
    [sessionId],
  )
  return rows[0] ?? null
}

export async function signOut(sql: Sql, sessionId: string): Promise<void> {
  await sql('DELETE FROM sessions WHERE session_id = $1', [sessionId])
}
