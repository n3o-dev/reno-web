# rkb-workbook-io

## Goal
Read Reno's monthly RKB workbook exactly as they author it, and write the realised A values
back into a file they can open without noticing anything changed except the numbers.

## Non-goals
- Authoring or editing the plan. The R columns are read-only. Faisal keeps building next month's RKB in Excel.
- Normalising Reno's sheet structure. The workbook stays as it is; the reader adapts to it.
- Supporting arbitrary workbooks. This reads the RKB shape, and fails loudly on anything else.
- Matching Work Reports to job rows. That is the agent's job, delivered as `rkb_match` records.

## The workbook as it actually is

`RKB_JULI_2026.xlsx`, six sheets, **144 job rows across 21 blocks**:

| Sheet | Job rows | Blocks |
|---|---|---|
| Koridor dalam | 39 | 7 |
| Toilet | 25 | 5 |
| Car park | 36 | 6 |
| Facade | 7 | 1 |
| Ruang Utility | 29 | 1 |
| Food court | 8 | 1 |

> **Counted, not inferred.** The Ruang Utility sheet numbers its `NO` column 1–30 but skips 5,
> so it holds 29 rows, not 30. A reader that trusts the `NO` column rather than counting rows
> gets this wrong — an earlier draft of this spec did exactly that and said 145 / 20.

Every sheet carries 31 day-columns, each a paired R and A cell. Below each block sit three
computed rows: `JUMLAH MCP`, `REALISASI MCP`, `PERSENTASI (%)`.

**Three column layouts, not one.** This is the part that breaks a naive reader:

| Layout | Sheets | Columns | Day grid starts |
|---|---|---|---|
| A | Koridor dalam, Toilet, Car park, Food court | `NO`, `AREA / LOKASI`, `JENIS PEKERJAAN` | column D |
| B | Facade | `NO`, `AREA`, `PEKERJAAN`, `PROGRES` | column F |
| C | Ruang Utility | `NO`, `AREA`, `ZONA`, `PROGRES` | column F |

Layouts B and C carry a fourth descriptive column and shift the whole day grid one column right.

**Facade is not a per-day tick.** Its sheet carries a date-banded access-equipment schedule
in free text (spider boom lift days 1–6, car gondola south 7–11, car gondola west 13–17, roof
access main lobby 18–22, roof access north lobby 23–27, scaffolding 28–29, panoramic lift
30–31) and a rain-contingency substitution list of six fallback jobs. Both are parsed and
surfaced, because they are the evidence behind a blocked Facade row.

Weekend and national holiday columns are shaded, and the existing workbook already contains
`#DIV/0!` in `PERSENTASI` where `JUMLAH MCP` is zero. Neither is an error to fix.

## Acceptance criteria

- **AC-1**: The reader parses all six sheets of `fixtures/rkb/RKB_JULI_2026.xlsx` and yields exactly 144 job rows across 21 blocks, with per-sheet counts 39 / 25 / 36 / 7 / 29 / 8. The `NO` column is never used as a count. Asserted by `pnpm test:rkb`.
- **AC-2**: The reader detects the layout per sheet rather than assuming one. A test asserts Facade resolves to layout B with a `PROGRES` column and Ruang Utility to layout C with a `ZONA` column, and that both have their day grid anchored one column right of layout A.
- **AC-3**: Each job row exposes 31 day entries, each with an R value, an A value and a `is_non_working_day` flag taken from the sheet's shading. A test asserts 31 entries on a row from every layout.
- **AC-4**: The Facade equipment date-bands and the rain-contingency list are parsed into structured values, not dropped as free text. A test asserts seven equipment bands with their date ranges and six contingency jobs.
- **AC-5**: Writing A values back produces a file that opens in Excel with the original sheet names, block structure, column widths, shading and formulas intact. A round-trip test reads the output and asserts structural equality with the input on everything except A cells.
- **AC-6**: The writer fills A cells for all three layouts at the correct column offset. A test writes a known A value into one row per layout and asserts it lands in the expected cell reference (for example Toilet row 12 day 3 → `I12`, Facade row 12 day 3 → `K12`).
- **AC-7**: `JUMLAH MCP`, `REALISASI MCP` and `PERSENTASI (%)` recompute from the written values. A test asserts the three rows below a block agree with the cells above them, and that `PERSENTASI` is left as `#DIV/0!` where `JUMLAH MCP` is zero rather than being replaced with 0.
- **AC-8**: A blocked job row writes an A value of 0 and records the block separately; the workbook never invents a marker Reno has not agreed to. A test asserts a blocked row's A cell is 0 and that the block and its citation are exposed on the parsed model, not in the file.
- **AC-9**: A workbook that does not match any known layout fails with a named error identifying the sheet and the missing header, rather than parsing into silent nonsense. A test feeds a malformed sheet and asserts the error names it.

## Verification
```
pnpm typecheck
pnpm test:rkb
```
