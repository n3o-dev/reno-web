import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveToken } from '@/services/tokens'

/**
 * The client link is the whole credential, so the production one cannot live
 * in the repository. `CLIENT_TOKENS_FILE` points the resolver at a file
 * mounted beside the container; the committed fixture is only the default.
 */
const COMMITTED = 'lwas-2f8c41d6a9b34e07'

afterEach(() => {
  delete process.env['CLIENT_TOKENS_FILE']
})

async function tokensFile(contents: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'reno-tokens-'))
  const path = join(dir, 'client-tokens.json')
  await writeFile(path, JSON.stringify(contents), 'utf8')
  return path
}

describe('client links', () => {
  it('reads the committed fixture when no file is named', async () => {
    expect((await resolveToken(COMMITTED))?.site_id).toBe('lwas')
  })

  it('reads the named file instead, and the committed token stops working', async () => {
    process.env['CLIENT_TOKENS_FILE'] = await tokensFile([
      { token: 'lwas-deployed-0123456789', site_id: 'lwas', label: 'LWAS', revoked: false },
    ])

    expect((await resolveToken('lwas-deployed-0123456789'))?.label).toBe('LWAS')
    expect(await resolveToken(COMMITTED)).toBeNull()
  })

  it('refuses a revoked link in the named file', async () => {
    process.env['CLIENT_TOKENS_FILE'] = await tokensFile([
      { token: 'lwas-retired-0123456789', site_id: 'lwas', label: 'old', revoked: true },
    ])

    expect(await resolveToken('lwas-retired-0123456789')).toBeNull()
  })
})
