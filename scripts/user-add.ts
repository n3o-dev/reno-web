/**
 * Creates a Reno account, or resets one.
 *
 * `pnpm user:add sarwedi@renno.co.id "Sarwedi"` — the password is generated
 * and printed once. There is no reset-by-email because there is no mail
 * service; running this again on the same address issues a new password.
 */
import { randomBytes } from 'node:crypto'
import { connectTo } from '@/db/connect'
import { migrate } from '@/db/migrate'
import { upsertAccount } from '@/services/sessions'

const [email, displayName] = process.argv.slice(2)
if (email === undefined || displayName === undefined) {
  console.error('usage: pnpm user:add <email> "<display name>"')
  process.exit(1)
}

const url = process.env['DATABASE_URL']
if (url === undefined || url.trim() === '') {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

// Four words' worth of entropy, in a shape someone can retype over the phone.
const password = randomBytes(18).toString('base64url')

const db = connectTo(url)
try {
  await migrate(db.sql, db.exec)
  const account = await upsertAccount(db.sql, email, displayName, password)
  console.log(`account ${account.email} (${account.display_name})`)
  console.log(`password: ${password}`)
  console.log('Shown once. Send it over a channel that is not this terminal.')
} finally {
  await db.close()
}
