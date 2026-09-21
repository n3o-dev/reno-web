import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/db/client'
import { hashPassword, verifyPassword } from '@/services/passwords'
import {
  accountForSession,
  signIn,
  signOut,
  upsertAccount,
  MAX_ATTEMPTS,
} from '@/services/sessions'
import { testDatabase } from '../support/pglite'

const EMAIL = 'sarwedi@renno.co.id'
const PASSWORD = 'living world alam sutera 2026'

let db: Database
beforeEach(async () => {
  db = await testDatabase()
  await upsertAccount(db.sql, EMAIL, 'Sarwedi', PASSWORD)
})

describe('AC-4 · a password is never stored in the clear', () => {
  it('stores a salted scrypt hash and nothing resembling the password', async () => {
    const rows = await db.sql<{ password_hash: string }>(
      'SELECT password_hash FROM accounts WHERE email = $1',
      [EMAIL],
    )
    const stored = rows[0]?.password_hash ?? ''
    expect(stored).not.toContain(PASSWORD)
    expect(stored.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword(PASSWORD, stored)).toBe(true)
  })

  it('salts, so the same password hashes differently every time', async () => {
    const [a, b] = [await hashPassword(PASSWORD), await hashPassword(PASSWORD)]
    expect(a).not.toBe(b)
    expect(await verifyPassword(PASSWORD, b)).toBe(true)
  })

  it('refuses a password too short to be the only door', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/at least 12/)
  })

  it('treats a malformed stored hash as a failed sign-in, not a crash', async () => {
    expect(await verifyPassword(PASSWORD, 'nonsense')).toBe(false)
    expect(await verifyPassword(PASSWORD, 'scrypt$1$2$3')).toBe(false)
  })

  it('writes no log line while signing in', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    )
    try {
      await signIn(db.sql, EMAIL, PASSWORD)
      await signIn(db.sql, EMAIL, 'wrong password entirely')
      expect(spies.flatMap((s) => s.mock.calls.flat().map(String))).toEqual([])
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })
})

describe('AC-3 · a wrong password and an unknown email look the same', () => {
  it('refuses both identically', async () => {
    const wrong = await signIn(db.sql, EMAIL, 'not the password at all')
    const unknown = await signIn(db.sql, 'nobody@renno.co.id', PASSWORD)
    expect(wrong).toEqual({ ok: false, reason: 'refused' })
    expect(unknown).toEqual({ ok: false, reason: 'refused' })
  })

  it('accepts the address however it was typed', async () => {
    const result = await signIn(db.sql, '  SARWEDI@Renno.co.id ', PASSWORD)
    expect(result.ok).toBe(true)
  })
})

describe('AC-6, AC-7 · a session is only as good as its row', () => {
  it('resolves to the person who signed in', async () => {
    const result = await signIn(db.sql, EMAIL, PASSWORD)
    if (!result.ok) throw new Error('sign-in should have succeeded')
    expect(await accountForSession(db.sql, result.sessionId)).toMatchObject({
      email: EMAIL,
      display_name: 'Sarwedi',
    })
  })

  it('stops working the moment the row is deleted', async () => {
    const result = await signIn(db.sql, EMAIL, PASSWORD)
    if (!result.ok) throw new Error('sign-in should have succeeded')
    await signOut(db.sql, result.sessionId)
    expect(await accountForSession(db.sql, result.sessionId)).toBeNull()
  })

  it('refuses a forged id', async () => {
    expect(await accountForSession(db.sql, 'made-up-session-id')).toBeNull()
    expect(await accountForSession(db.sql, '')).toBeNull()
  })

  it('refuses an expired session', async () => {
    const result = await signIn(db.sql, EMAIL, PASSWORD)
    if (!result.ok) throw new Error('sign-in should have succeeded')
    await db.sql(`UPDATE sessions SET expires_at = now() - interval '1 second'`, [])
    expect(await accountForSession(db.sql, result.sessionId)).toBeNull()
  })

  it('refuses a session whose account was disabled', async () => {
    const result = await signIn(db.sql, EMAIL, PASSWORD)
    if (!result.ok) throw new Error('sign-in should have succeeded')
    await db.sql('UPDATE accounts SET disabled_at = now()', [])
    expect(await accountForSession(db.sql, result.sessionId)).toBeNull()
  })

  it('gives each sign-in its own session', async () => {
    const first = await signIn(db.sql, EMAIL, PASSWORD)
    const second = await signIn(db.sql, EMAIL, PASSWORD)
    if (!first.ok || !second.ok) throw new Error('sign-in should have succeeded')
    expect(first.sessionId).not.toBe(second.sessionId)
    // Signing out of one device does not sign out of the other.
    await signOut(db.sql, first.sessionId)
    expect(await accountForSession(db.sql, second.sessionId)).not.toBeNull()
  })
})

describe('AC-9 · guessing is slowed', () => {
  it('throttles after five failures and says how long', async () => {
    for (let n = 0; n < MAX_ATTEMPTS; n++) {
      // oxlint-disable-next-line no-await-in-loop -- the throttle counts attempts in order
      expect((await signIn(db.sql, EMAIL, `guess ${n}`)).ok).toBe(false)
    }
    const sixth = await signIn(db.sql, EMAIL, PASSWORD)
    expect(sixth).toEqual({ ok: false, reason: 'throttled', waitMinutes: 15 })
  })

  it('throttles the account, not everyone', async () => {
    await upsertAccount(db.sql, 'other@renno.co.id', 'Amartha', PASSWORD)
    for (let n = 0; n < MAX_ATTEMPTS; n++) {
      // oxlint-disable-next-line no-await-in-loop -- the throttle counts attempts in order
      await signIn(db.sql, EMAIL, `guess ${n}`)
    }
    expect((await signIn(db.sql, 'other@renno.co.id', PASSWORD)).ok).toBe(true)
  })

  it('forgets the failures once a sign-in succeeds', async () => {
    await signIn(db.sql, EMAIL, 'wrong once')
    await signIn(db.sql, EMAIL, 'wrong twice')
    expect((await signIn(db.sql, EMAIL, PASSWORD)).ok).toBe(true)
    const left = await db.sql<{ count: string }>(
      'SELECT count(*) AS count FROM login_attempts WHERE email = $1',
      [EMAIL],
    )
    expect(Number(left[0]?.count)).toBe(0)
  })
})

describe('AC-12 · accounts are created and reset by command', () => {
  it('updates rather than duplicating when the email already exists', async () => {
    await upsertAccount(db.sql, EMAIL, 'Sarwedi', 'a completely new password')
    const rows = await db.sql<{ count: string }>(
      'SELECT count(*) AS count FROM accounts WHERE email = $1',
      [EMAIL],
    )
    expect(Number(rows[0]?.count)).toBe(1)
    expect((await signIn(db.sql, EMAIL, 'a completely new password')).ok).toBe(true)
    expect((await signIn(db.sql, EMAIL, PASSWORD)).ok).toBe(false)
  })

  it('re-enables an account that was disabled', async () => {
    await db.sql('UPDATE accounts SET disabled_at = now()', [])
    await upsertAccount(db.sql, EMAIL, 'Sarwedi', PASSWORD)
    expect((await signIn(db.sql, EMAIL, PASSWORD)).ok).toBe(true)
  })
})

describe('AC-13 · server code can name who is asking', () => {
  it('resolves a session to the person, ready to be recorded as the author', async () => {
    const result = await signIn(db.sql, EMAIL, PASSWORD)
    if (!result.ok) throw new Error('sign-in should have succeeded')

    // What a route handler does before writing anything: turn the cookie
    // into a person. The override chain's `by` becomes this rather than a
    // constant once there is a write path to attach it to.
    const author = await accountForSession(db.sql, result.sessionId)
    expect(author?.display_name).toBe('Sarwedi')
    expect(author?.display_name).not.toBe('Reno')
  })
})
