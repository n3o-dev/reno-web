import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/**
 * Password hashing.
 *
 * `scrypt` from the standard library rather than bcrypt or argon2: it is
 * memory-hard, it is already here, and the alternatives are native modules
 * that have to compile on the VPS. Walking the ladder — the platform does
 * this one.
 *
 * See docs/specs/reno-auth.md (AC-4).
 */
// Hand-wrapped rather than promisified: `promisify` picks the two-argument
// overload and drops the options, which is where the cost parameters live.
const scryptAsync = (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error !== null) reject(error)
      else resolve(key)
    })
  })

/** OWASP's floor for scrypt at the time of writing. */
const COST = 2 ** 16
const BLOCK_SIZE = 8
const PARALLELISATION = 1
const KEY_LENGTH = 64
const SALT_LENGTH = 16

interface Cost {
  readonly N: number
  readonly r: number
  readonly p: number
}

const CURRENT: Cost = { N: COST, r: BLOCK_SIZE, p: PARALLELISATION }

/** scrypt's own limits. A stored value outside them is not a hash we wrote. */
const plausible = ({ N, r, p }: Cost): boolean =>
  Number.isInteger(N) &&
  Number.isInteger(r) &&
  Number.isInteger(p) &&
  N > 1 &&
  (N & (N - 1)) === 0 &&
  N <= 2 ** 22 &&
  r > 0 &&
  r <= 32 &&
  p > 0 &&
  p <= 16

const derive = async (password: string, salt: Buffer, cost: Cost): Promise<Buffer> => {
  return scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    ...cost,
    // scrypt needs more than node's default 32 MB scratch buffer, and more
    // again if the cost is ever raised.
    maxmem: Math.max(256 * 1024 * 1024, 256 * cost.N * cost.r * 2),
  })
}

/** `scrypt$<N>$<r>$<p>$<salt base64>$<key base64>` — parameters travel with the hash. */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error('a password must be at least 12 characters; this one is the only door')
  }
  const salt = randomBytes(SALT_LENGTH)
  const key = await derive(password, salt, CURRENT)
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELISATION}$${salt.toString('base64')}$${key.toString('base64')}`
}

/**
 * Constant-time verification.
 *
 * Returns false rather than throwing on a malformed stored value: a hash
 * written by an older format is a failed sign-in, not a crash that takes the
 * login page down.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, costText, blockText, parallelText, saltText, keyText] = parts
  if (saltText === undefined || keyText === undefined) return false

  /*
   * The cost comes from the stored hash, not from the module constants.
   * Reading the parameters and then ignoring them — which this did — means
   * that the day anyone raises COST, every existing password silently stops
   * verifying and the whole team is locked out with a "wrong password"
   * message and nothing to diagnose.
   */
  const cost: Cost = { N: Number(costText), r: Number(blockText), p: Number(parallelText) }
  if (!plausible(cost)) return false

  const salt = Buffer.from(saltText, 'base64')
  const expected = Buffer.from(keyText, 'base64')
  if (salt.length === 0 || expected.length === 0) return false

  const actual = await derive(password, salt, cost)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}
