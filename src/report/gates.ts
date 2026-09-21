import type { RecordSource } from '@/contract/source'
import type { Sql } from '@/db/client'

/**
 * What has to be true before a pack may be generated.
 *
 * Generation refuses rather than producing a pack that is quietly wrong.
 * Each refusal names the thing to fix, because a gate that only says "no" is
 * a gate people learn to work around.
 *
 * See docs/specs/monthly-report-pack.md
 */

export interface Gate {
  readonly id: 'roster_confirmed' | 'aliases_decided' | 'blocks_cited'
  readonly label: string
  readonly passed: boolean
  /** Why it is not passed, naming what to fix. Empty when it is. */
  readonly detail: string
}

export interface Confirmation {
  readonly confirmedBy: string
  readonly confirmedAt: string
}

export async function monthConfirmation(
  sql: Sql,
  siteId: string,
  month: string,
): Promise<Confirmation | null> {
  const rows = await sql<{ display_name: string; confirmed_at: string }>(
    `SELECT a.display_name, c.confirmed_at
     FROM month_confirmations c JOIN accounts a ON a.account_id = c.confirmed_by
     WHERE c.site_id = $1 AND c.month = $2`,
    [siteId, month],
  )
  const row = rows[0]
  return row === undefined
    ? null
    : { confirmedBy: row.display_name, confirmedAt: String(row.confirmed_at) }
}

export async function confirmMonth(
  sql: Sql,
  siteId: string,
  month: string,
  accountId: string,
): Promise<void> {
  await sql(
    `INSERT INTO month_confirmations (site_id, month, confirmed_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (site_id, month) DO UPDATE
       SET confirmed_by = EXCLUDED.confirmed_by, confirmed_at = now()`,
    [siteId, month, accountId],
  )
}

/**
 * Names in a line-up the agent could not resolve to a person.
 *
 * An unmerged `Dame` and `Damme` are two people in the roster export and one
 * person on site, so the headcount — and the invoice — is wrong. A name is a
 * candidate when the line-up carries no `person_id` for it and it matches
 * nothing in the personnel master.
 */
export function aliasCandidates(source: RecordSource): readonly string[] {
  const known = new Set<string>()
  for (const person of source.people) {
    known.add(person.canonical_name.toLowerCase())
    for (const alias of person.aliases) known.add(alias.toLowerCase())
  }

  const undecided = new Set<string>()
  for (const lineup of source.lineups) {
    for (const entry of lineup.entries) {
      if (entry.person_id !== null) continue
      if (known.has(entry.name_raw.toLowerCase())) continue
      undecided.add(entry.name_raw)
    }
  }
  return [...undecided].sort()
}

/** Blocked records carrying no citation. Unrepresentable in typed code, checked anyway. */
export function uncitedBlocks(source: RecordSource): readonly string[] {
  const out: string[] = []
  for (const complaint of source.complaints) {
    if (complaint.state === 'blocked' && complaint.blocked_reason_message_id === null) {
      out.push(complaint.record_id)
    }
  }
  for (const order of source.workOrders) {
    if (order.state === 'blocked' && order.blocked_reason_message_id === null) {
      out.push(order.record_id)
    }
  }
  return out
}

export interface GateInput {
  readonly source: RecordSource
  readonly confirmation: Confirmation | null
  readonly month: string
}

export function checkGates({ source, confirmation, month }: GateInput): readonly Gate[] {
  const candidates = aliasCandidates(source)
  const uncited = uncitedBlocks(source)

  return [
    {
      id: 'roster_confirmed',
      label: 'Roster confirmed for the month',
      passed: confirmation !== null,
      detail:
        confirmation === null
          ? `Nobody has confirmed the roster for ${month}. BAPP cannot generate against claimed attendance alone.`
          : '',
    },
    {
      id: 'aliases_decided',
      label: 'Every alias decided',
      passed: candidates.length === 0,
      detail:
        candidates.length === 0
          ? ''
          : `${candidates.length} name(s) not resolved to a person: ${candidates.join(', ')}`,
    },
    {
      id: 'blocks_cited',
      label: 'Every blocked record cites its reason',
      passed: uncited.length === 0,
      detail: uncited.length === 0 ? '' : `uncited: ${uncited.join(', ')}`,
    },
  ]
}

export class GenerationRefused extends Error {
  constructor(readonly failed: readonly Gate[]) {
    super(failed.map((gate) => gate.detail).join(' '))
    this.name = 'GenerationRefused'
  }
}

export function assertGatesPassed(gates: readonly Gate[]): void {
  const failed = gates.filter((gate) => !gate.passed)
  if (failed.length > 0) throw new GenerationRefused(failed)
}
