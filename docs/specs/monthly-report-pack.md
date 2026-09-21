# monthly-report-pack

## Goal
Turn the dashboard's data into the month-end documents Reno has to produce anyway: the RKB
workbook with realisation filled in, a client report, and the BAPP pack carrying the amount
payable — as a button, not a second system.

Depends on [reno-dashboard](./reno-dashboard.md),
[billing-and-scoring-rules](./billing-and-scoring-rules.md) and
[rkb-workbook-io](./rkb-workbook-io.md).

## Non-goals
- **A legal e-signature.** Client sign-off is captured as a WhatsApp confirmation the agent records. Nothing here claims legal weight.
- **Sending the pack.** Generating and downloading only. Delivery stays in WhatsApp and email, as today.
- **Inventing the sections the data cannot fill.** Training records live in Renno Grow Hub and the action plan is written by a person. Both are marked and left for a human.
- **A new report layout.** The RKB export writes into Reno's existing workbook. The client report follows the sections the SOP and the QBR already ask for.
- **Quarterly automation.** The QBR export reuses the same data but is generated on demand, not scheduled.

## What the pack contains

The RKB workbook downloads as a file. The client report is a print view at
`/print/<month>` — the same model the screens render, laid out for A4, saved
to PDF from the browser.

| Section | Source | Output |
|---|---|---|
| RKB realisation | RKB workbook + `rkb_match` records | xlsx, written into Reno's existing template |
| Complaint summary | complaint records, cause split, closure evidence, repeat areas | report section + evidence appendix |
| Work orders delivered | work order records | report section |
| Manpower and billing | Line-up records, slot master, deduction rules | BAPP pack, carries the amount payable |
| Before-after gallery | work reports flagged `is_before_after` | report section, also feeds the QBR |
| Training completed | **external** — Renno Grow Hub | placeholder, attached by a person |
| Action plan | **human** — written by the Project Coordinator | placeholder section |
| Client sign-off | WhatsApp confirmation captured by the agent | logged, append-only |

## Gates before generation

- The roster must be confirmed for the month. BAPP cannot generate against claimed attendance alone.
- Every unresolved alias candidate must be decided. An unmerged `Dame` / `Damme` would double-count a person in the roster export.
- Any complaint or RKB row still in `blocked` at month end must carry its citation. Generation fails on a blocked record without one.

## Acceptance criteria

- **AC-1**: The RKB export writes A values into Reno's own workbook and the result opens in Excel with sheet names, block structure, shading and formulas unchanged. Asserted by the round-trip test in [rkb-workbook-io](./rkb-workbook-io.md) plus `pnpm test:report` on the generated file.
- **AC-2**: Every figure in the generated client report traces to at least one `source_message_id`. `pnpm test:report` walks the report model and fails on any figure with empty evidence.
- **AC-3**: The complaint section shows the cause split, and the amount payable is unaffected by complaint count. A test generates two packs differing only in complaint volume and asserts the BAPP figure is identical.
- **AC-4**: The BAPP figure equals gross less unreplaced slot-day deductions, and the pack shows the arithmetic. A test asserts the printed components sum to the printed total.

  *Rate: Rp 5.000.000 per person per month, confirmed by the user. A missed slot-day deducts a thirtieth of it — also confirmed, and printed on the pack so the basis is visible rather than assumed. The five-day week does not change the divisor: the site is covered seven days with staff rotating their days off, which is what `Off Day` is for and why it never deducts.*

  *The contracted headcount is **assumed from the line-ups** until Reno supplies the real table, and `slots_source` in `fixtures/site/contract.json` records that. Every amount derived from an assumed table renders as provisional, on the screen and on the pack. The assumption is load-bearing — the rosters list the same people on both shifts, so whether the site is 37 people or 74 is the open question, and at this rate that is Rp 185.000.000 against Rp 370.000.000 a month.*
- **AC-5**: Generation is blocked until the roster is confirmed. A test attempts generation on an unconfirmed month and asserts a named refusal identifying the month.
- **AC-6**: Generation is blocked while any alias candidate is undecided. A test asserts the refusal names the undecided candidates.
- **AC-7**: Generation is blocked by a `blocked` record without a citation. A test asserts the refusal names the record.
- **AC-8**: Training and action plan render as explicitly unfilled placeholders, never as empty or zero. A test asserts both sections carry a human-input marker in the output.
- **AC-9**: The pack produces the RKB xlsx as a downloadable file and the client report as a print view, and two exports of the same month agree cell for cell. `pnpm test:report` exports twice and asserts identical sheet names, identical cell values and identical styles.

  *(Amended twice, both times because the original could not be satisfied honestly.*

  *No server-side PDF. Generating one means shipping Chromium to the VPS — roughly 300MB for a button pressed once a month — and the print view saves to PDF from the browser in one step. Decided with the user; revisit if the pack ever needs to be generated unattended, for instance to email itself.*

  *Not byte-stable. `writeActuals` rebuilds the zip archive, so entry timestamps move between runs and two exports of identical data differ as bytes while being identical as a spreadsheet. Comparing contents is the check that means something; comparing checksums would only have measured the clock.)*
- **AC-10**: A QBR export produces the three things SOP/OPS/001 IV.C.1 asks for: cleanliness score graphs, attendance data, and before-after photos, over a three-month range. A test generates a QBR for a three-month fixture window and asserts all three sections are present and non-empty.

## Verification
```
pnpm typecheck
pnpm test:report
```
