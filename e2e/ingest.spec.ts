import { expect, test } from '@playwright/test'

/**
 * The route adapter over `ingest`.
 *
 * The rules themselves are covered in tests/ingest against a real Postgres;
 * what is checked here is that the HTTP layer reaches them — the status
 * codes, and the order the checks happen in.
 */
const BODY = { records: [] }

test.describe('POST /api/records', () => {
  test('refuses an unauthenticated caller before anything else', async ({ request }) => {
    const response = await request.post('/api/records', { data: BODY })
    expect(response.status()).toBe(401)
    // Not 503: a caller with no token must not learn how this is configured.
    expect(await response.json()).toEqual({ error: 'unauthorized' })
  })

  test('refuses an unknown token', async ({ request }) => {
    const response = await request.post('/api/records', {
      data: BODY,
      headers: { authorization: 'Bearer not-a-real-token-at-all' },
    })
    expect(response.status()).toBe(401)
  })

  test('is not reachable by GET', async ({ request }) => {
    expect((await request.get('/api/records')).status()).toBe(405)
  })
})

test.describe('DELETE /api/records/:id', () => {
  test('refuses an unauthenticated caller', async ({ request }) => {
    const response = await request.delete('/api/records/cmp_1')
    expect(response.status()).toBe(401)
  })
})
