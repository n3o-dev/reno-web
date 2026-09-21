# reno-dashboard

## Goal
One web dashboard for Living World Alam Sutera where every figure Reno and the client argue
about is on screen, in English, and clicks through to the WhatsApp message that produced it.

Depends on [agent-data-contract](./agent-data-contract.md),
[billing-and-scoring-rules](./billing-and-scoring-rules.md) and
[rkb-workbook-io](./rkb-workbook-io.md). Produces the inputs for
[monthly-report-pack](./monthly-report-pack.md).

## Non-goals
- **The agent.** It exists. This reads its records and nothing more.
- **Multi-tenant configuration.** Bespoke and single-tenant. Reno's area taxonomy, three-shift pattern, six-sheet RKB and Rapor Pimpro weights are hardcoded, not settings.
- **More than one site on day one.** LWAS only. The data model carries `site_id` so a second group is configuration rather than a rewrite, but no site switcher ships.
- **Roles inside Reno.** One Reno view. Everyone at Reno sees everything, including the Pimpro's draft score and the anti-fraud queue.
- **Any percentage other than RKB realisation.** Daily routine work is indexed as evidence and never scored.
- **Client write access.** The client view is read-only, with no comment boxes. Client actions stay in WhatsApp.
- **Planning.** No RKB editor. The R column is read-only.
- **Per-cleaner payroll.** Only the client-facing slot deduction.
- **Backfill.** The dashboard shows whatever history the agent already holds.
- **Media storage.** Photos are rendered from the agent's references.
- **A translation layer.** English only.

## Surfaces

**Reno** signs in and sees everything.

**Client** opens a tokenized link, one per site, revocable, designed for a phone held inside
WhatsApp. It shows the same numbers from the same source, minus the two internal screens and
the anti-fraud panel.

## Screens

| # | Screen | Client sees it | What it answers |
|---|---|---|---|
| 1 | Today | yes | What is happening on site right now |
| 2 | Complaints | yes | What was raised, who caused it, what is still open |
| 3 | Work Orders | yes | What the client asked for and whether it was delivered on time |
| 4 | RKB Realisation | yes | What was planned, what was done, what was blocked |
| 5 | Manpower & Billing | yes, minus the anti-fraud panel | Who was on site and what the client owes |
| 6 | Report Quality | **no** | Where Reno's own reporting is failing |
| 7 | Pimpro Scorecard | **no** | The SOP form, part auto-filled |
| 8 | Monthly Report | yes | The pack, assembled |

Plus a personnel master admin screen (people, aliases, contracted slots per area per shift).

**1 · Today** — current shift; manpower present against contracted per area; open complaints
and work orders ranked by time left, with blocked items shown as paused; RKB rows due today
and whether they have landed.

**2 · Complaints** — the funnel from raised to closed with photo; the two medians side by side
and never merged; cause split as within and outside Reno's control; area-by-day heatmap;
repeat tracker showing the escalation ladder as a visible state, so a Toilet LT2 path is
legible on day one rather than arriving as a formal complaint on day three.

**3 · Work Orders** — each client request with its title, source document, requester, due
date and closing evidence; delivered-on-time count for the month. Replaces the recap the site
admin types by hand today.

**4 · RKB Realisation** — a faithful mirror of the workbook: sheet, block, job row, R and A per
day, with `JUMLAH` / `REALISASI` / `PERSENTASI` computed live. Blocked cells read *blocked*
and link to the message that justifies them. Gross and net realisation both shown. The plan
is frozen for the month (ADR-0004): job rows keep their positional ids, and an upload whose
job-row structure differs from the month in progress is refused rather than absorbed.

**5 · Manpower & Billing** — contracted slots against filled slots per area per shift per day;
Off Day, Sakit, Alfa and Izin broken out; unfilled slot-days flagged replaced or not; ending
at the amount payable. Beside it, Reno-only, the anti-fraud queue: names in the Line-up that
appear in no report all shift, a name listed in two areas, a headcount that disagrees with the
names listed, and alias candidates awaiting a human decision. Labelled as signals to check,
never as proof.

**6 · Report Quality** — group activity for the period (messages, photos, work reports per
day); validation pass rate and the defect breakdown: no area, no caption, marked done with no
complaint, photo reused, photo sent over one hour and over three hours after capture, photo
taken before the complaint existed. Before-and-after coverage as a count and a share of
reports. Per-reporter scorecard. Duplicate photos shown side by side, since that is the only
way the accusation is safe to make.

**7 · Pimpro Scorecard** — the SOP form with A.1, A.3, C.3 and D.3 filled from data and the
other nine left blank and marked human input. Weighted total marked provisional until complete.

**8 · Monthly Report** — see [monthly-report-pack](./monthly-report-pack.md).

## Acceptance criteria

- **AC-1**: All eight screens plus the personnel master render from fixture data with no network calls. `pnpm test:e2e` passes against the fixture set.
- **AC-2**: Every figure on every screen opens an evidence panel naming at least one source message with its sender, timestamp and photo where one exists. `pnpm test:evidence` walks every element carrying `data-figure` and fails on any whose evidence panel resolves to zero messages.
- **AC-3**: The client link hides Report Quality, Pimpro Scorecard and the anti-fraud panel. `pnpm test:e2e -- client-visibility` asserts no element carrying `data-reno-only` is present in the client DOM, and that routing directly to those paths under a client token returns 404.
- **AC-4**: A client token is scoped to one site and revocable. Tests assert a token for site A cannot read site B, and that a revoked token returns 401.
- **AC-5**: All interface strings are English. `pnpm lint:i18n` fails on any hardcoded Indonesian UI string outside the allowlist of contractual terms (`RKB`, `BAPP`, `MCP`, `Rapor Pimpro`, `Pimpro`, `JUMLAH`, `REALISASI`, `PERSENTASI`, `Off Day`, `Sakit`, `Alfa`, `Izin`). Data values are exempt.
- **AC-6**: The client view is read-only. `pnpm test:e2e -- client-readonly` asserts the client DOM contains no `form`, `input`, `textarea` or `button[type=submit]` outside navigation and export.
- **AC-7**: RKB realisation is the only percentage rendered as a completion figure. `pnpm test:e2e -- single-percentage` asserts no element carrying `data-figure-kind="completion"` exists outside the RKB screen and the sections that quote it.
- **AC-8**: Blocked complaints and work orders render as blocked with their citation reachable in one click, and their clock displayed as paused rather than counting down. Asserted per entity type.

  *Amended: RKB job rows are removed from this criterion because **no record type can express a blocked job row**. Complaints and work orders carry `state: "blocked"` with a mandatory citation; `rkb_match` carries no state at all, so nothing the agent can emit would ever set one. The consequence is worth stating plainly: **net realisation is arithmetically identical to gross** and will stay so until the contract gains such a record. The RKB screen says this where the figure appears rather than presenting two numbers that cannot diverge. Closing it properly means adding a record type to [agent-data-contract](./agent-data-contract.md) — raised with the user, not decided here.*
- **AC-9**: Attendance is labelled `claimed` or `admin-confirmed` everywhere it appears and never `verified`. `pnpm lint:i18n` fails on the string `verified` in any attendance context.
- **AC-10**: Every overridden value renders with its reason and its override chain, in both the Reno and client views. A test applies an override to a fixture and asserts the reason string appears in both DOMs.
- **AC-11**: Charts pass the data-viz gates: categorical hues assigned in fixed order and never cycled, no dual-axis chart, a legend present for two or more series, a table view available on every chart, and a validated palette in both light and dark. `pnpm test:viz` runs the palette validator against the shipped palette in both modes and asserts zero FAILs.
- **AC-12**: The client view is usable at 390px wide. `pnpm test:e2e -- mobile` runs the client screens at that viewport and asserts no horizontal overflow and no tap target under 44px.
- **AC-13**: Records with low `confidence` render visibly distinguished and are never dropped. A test injects a 0.4-confidence complaint and asserts it appears and carries a confidence marker.
- **AC-14**: `pnpm build` succeeds, `pnpm typecheck` reports no errors, and `pnpm lint` is clean.
- **AC-15**: Over 10–13 September 2026 the screens render the case-study deck's published figures exactly — per-day messages, photos, work reports, complaints, answered and closed-with-photo; reply and closure medians; before-after coverage; the defect breakdown; photos sent over three hours after capture; duplicate pairs; and the seven repeat areas. `pnpm test:e2e -- deck-parity` reads each figure off the rendered DOM and compares it to `scripts/fixtures/published-figures.ts`. The deck is the source of truth: a mismatch is a dashboard defect, never a reason to edit the figure.
- **AC-16**: The RKB plan is frozen for the month. The workbook's job-row structure is fingerprinted on upload, and an upload whose structure differs from the month in progress is refused with a message naming the rows that were inserted, deleted or reordered. Changed wording alone is accepted. A test uploads a workbook with a row inserted mid-month and asserts the refusal names that row; a second uploads the same workbook with one activity reworded and asserts it is accepted.

## Verification
```
pnpm typecheck
pnpm lint
pnpm lint:i18n
pnpm test
pnpm test:viz
pnpm test:evidence
pnpm test:e2e
pnpm build
```
