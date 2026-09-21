# billing-and-scoring-rules

## Goal
A pure calculation layer that turns agent records into the three numbers Reno and the client
argue about: the amount payable, the complaint SLA state, and the Rapor Pimpro scores the
agent is allowed to fill in.

## Non-goals
- Rendering. This layer returns values and their evidence; it draws nothing.
- Scoring daily routine work. Daily reports are indexed as evidence and never produce a percentage.
- Computing per-cleaner salary. The group carries no hours and no overtime, so individual payroll is out of scope; only the client-facing slot deduction is computed.
- Inventing a score for a Rapor Pimpro indicator the records cannot evidence. Unscored stays unscored.
- Writing to the RKB plan. R values are read-only input.

## Rules

### Slot billing
- The billing unit is the **Slot**: one area, one shift, one day.
- Contracted slots per area per shift come from a master maintained in the dashboard by the site admin. There is no contract document to import.
- A slot is **filled** if at least the contracted number of names appears for that area and shift in that day's Line-up. It bills in full regardless of whose name filled it.
- An **unfilled, unreplaced** slot-day deducts pro-rata against the monthly per-manpower rate.
- `Off Day` never deducts. `Sakit`, `Izin` and `Alfa` deduct only where the slot went unfilled.
- Complaints never touch the invoice. Billing is manpower.

### Complaint and work order clocks
- A Complaint runs a 24-hour clock from `raised_at`, per SOP/OPS/001 A.3.
- A Work Order runs to its client-set `due_date`, not to a 24-hour clock.
- Entering `blocked` pauses the clock. Leaving `blocked` resumes it. Elapsed time excludes every blocked interval.
- A record in `blocked` without `blocked_reason_message_id` is invalid input, not a zero-duration block.
- Two separate medians are reported and never merged: time to first answer, and time to `closed_with_photo`.

### Cause split
- Client-facing views group `cause` into **within Reno's control** (`hk_standard`) and **outside Reno's control** (everything else), each still itemised.
- Reno-facing KPI figures use the gross count including every cause. No Reno screen shows a filtered total as the headline.

### RKB realisation
- Gross realisation = sum(A) / sum(R) across the rows in scope.
- Net realisation = sum(A) / (sum(R) − sum(blocked R)).
- Both are always returned together. A caller cannot obtain one without the other.
- Rapor Pimpro A.1 scores against net realisation.

### Rapor Pimpro auto-fill
Only four of thirteen indicators are derivable. All others return `null` and are labelled human input.

| Indicator | Rule |
|---|---|
| A.1 Eksekusi Realisasi Rencana Kerja | 5 at net realisation 100%, 3 below 100%, 1 below 60% |
| A.3 Penyelesaian Komplain | 5 at zero complaints or all closed under 24h, 3 where any exceeded 24h or any area repeated, 1 where the client issued an SP |
| C.3 Kedisiplinan Tim | 5 where every contracted slot-day was filled, 3 with one or two unfilled slot-days, 1 above that |
| D.3 Kualitas Laporan | 5 where validation passes and before-after is complete, 3 on frequent revision or thin documentation, 1 where any duplicate photo or fabricated data is detected |
- Section average uses only scored indicators. The weighted total is marked provisional while any indicator is null.
- Bands: 4.5–5.0 A, 3.0–4.4 B, 1.0–2.9 C.

### Overrides
- Any computed value may be overridden by a Reno user with a written reason.
- Overrides are append-only. The original value is never destroyed and remains queryable.
- Every override is visible in the client view, labelled as reclassified with its reason.
- A computation returns both the effective value and the override chain that produced it.

## Acceptance criteria

- **AC-1**: Every exported function is pure — same input, same output, no clock and no I/O. `pnpm test:rules` includes a test that calls each exported function twice with frozen input and asserts deep equality.
- **AC-2**: Given the LWAS fixtures, the rules layer returns complaint medians of 3 minutes to first answer and 41 minutes to close with photo, a slowest close of 16h 50m, and 29 of 75 closed with photo. Asserted by `pnpm test:rules`.
- **AC-3**: A complaint that spends time in `blocked` has that interval excluded from elapsed time. A test constructs a complaint blocked for 6 hours inside a 30-hour span and asserts elapsed time is 24 hours, not 30.
- **AC-4**: A record in `blocked` with a null `blocked_reason_message_id` throws. A test asserts the throw and its message.
- **AC-5**: `computeRealisation()` returns both `gross` and `net`; there is no code path returning only one. A test asserts both keys are always present, and that net excludes blocked R.
- **AC-6**: A filled slot bills in full regardless of the names in it. A test swaps every name in a Line-up while keeping the headcount and asserts the amount payable is unchanged.
- **AC-7**: An unfilled unreplaced slot-day deducts pro-rata, and an `Off Day` never deducts. Two tests, one per case.
- **AC-8**: Complaints do not affect the amount payable. A test adds 40 complaints to a fixture month and asserts the amount payable is byte-identical.
- **AC-9**: `computeRapor()` returns `null` for all nine non-derivable indicators and a number for exactly A.1, A.3, C.3 and D.3. A test asserts the exact set of non-null keys.
- **AC-10**: The weighted total is flagged `provisional: true` while any indicator is null. A test asserts the flag flips to false only when all thirteen carry a score.
- **AC-11**: Applying an override preserves the prior value and appends to the chain. A test applies two successive overrides and asserts the chain has length 2 and the original value is still readable.
- **AC-12**: Every returned figure carries an `evidence` array of at least one `source_message_id`. A test walks every value in a full-month computation and fails on any with an empty evidence array.

## Verification
```
pnpm typecheck
pnpm test:rules
```
