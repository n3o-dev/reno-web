/**
 * Corrections to anything the agent produced.
 *
 * Append-only: the original value is never destroyed and stays queryable, so a
 * disputed invoice can always be traced back to what the agent actually said.
 * Every override carries a written reason and is visible in the client view.
 *
 * Pure. See docs/specs/billing-and-scoring-rules.md (AC-11)
 */

export interface Override<T> {
  readonly value: T
  readonly reason: string
  readonly by: string
  readonly at: string
}

export interface Corrected<T> {
  /** What the agent produced. Never changes. */
  readonly value: T
  readonly evidence: readonly string[]
  readonly overrides?: readonly Override<T>[]
}

export function applyOverride<T>(figure: Corrected<T>, override: Override<T>): Corrected<T> {
  if (override.reason.trim().length === 0) {
    throw new Error('an override requires a written reason; it is shown to the client')
  }
  return {
    value: figure.value,
    evidence: figure.evidence,
    overrides: [...(figure.overrides ?? []), override],
  }
}

/** The value in force: the last override, or the agent's own value. */
export function effectiveValue<T>(figure: Corrected<T>): T {
  const chain = figure.overrides ?? []
  const last = chain[chain.length - 1]
  return last === undefined ? figure.value : last.value
}
