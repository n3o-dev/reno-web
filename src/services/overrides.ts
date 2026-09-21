import { readFile } from 'node:fs/promises'
import { cache } from 'react'
import { z } from 'zod'
import type { Override } from '@/rules/override'

/**
 * Corrections a person made to what the agent produced.
 *
 * Append-only and visible to the client. Reno correcting a figure quietly
 * would be worse than the agent being wrong: the client's trust rests on
 * seeing the correction and the reason for it, not on the number never
 * changing.
 *
 * Kept in a file the way client tokens are, standing in for the table the
 * ingest work will create. Nothing above this line depends on which it is.
 *
 * See docs/specs/reno-dashboard.md (AC-10).
 */
const override = z.strictObject({
  value: z.string().min(1),
  /** Shown to the client verbatim. An override without one is rejected. */
  reason: z.string().min(1),
  by: z.string().min(1),
  at: z.iso.datetime({ offset: true }),
})

const figureOverride = z.strictObject({
  figure: z.string().min(1),
  chain: z.array(override).min(1),
})

const OVERRIDES_FILE = 'fixtures/site/overrides.json'

const loadOverrides = cache(async (): Promise<ReadonlyMap<string, readonly Override<string>[]>> => {
  const raw: unknown = JSON.parse(await readFile(OVERRIDES_FILE, 'utf8'))
  const parsed = z.array(figureOverride).parse(raw)
  return new Map(parsed.map((entry) => [entry.figure, entry.chain]))
})

export async function overridesFor(figure: string): Promise<readonly Override<string>[]> {
  return (await loadOverrides()).get(figure) ?? []
}
