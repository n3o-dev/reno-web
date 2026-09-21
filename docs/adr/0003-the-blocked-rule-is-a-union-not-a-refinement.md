# The blocked-citation rule is modelled as a union, not a Zod refinement

`state: "blocked"` requires a non-null `blocked_reason_message_id`. The natural Zod expression
is `.refine()`, and it was rejected: refinements do not survive `z.toJSONSchema()`. A refinement
would enforce the rule for the dashboard while silently dropping it from
`contract/*.schema.json` — the artifact the agent team builds against — so the two sides would
disagree about the single most gameable rule in the system.

Modelling it as a union of two genuine shapes emits `anyOf` and keeps the rule enforceable on
both sides.

## Consequences

An uncited block is unrepresentable in typed code, which makes the runtime guard in
`closureStats` unreachable from a typed path. The guard stays anyway, for records arriving
unvalidated from a live agent, and its test uses a documented `@ts-expect-error` to say so.
