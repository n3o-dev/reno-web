# The RKB plan is frozen for the month, and job rows stay positional

`rkb_match.job_row_id` is positional — `koridor_dalam:LANTAI 2:4` is sheet, section and the
`NO` column. Renaming an activity is safe. Inserting or deleting a job row shifts every later
number, so every match recorded before the edit would point at the wrong job afterwards.

Two alternatives were put on the table and declined: a permanent id assigned per job row with
an upload-review screen for the ambiguous cases, and a content-addressed id hashed from
sheet + section + subject + work. The first costs a screen; the second silently restarts an
activity's history whenever its wording changes.

The plan is therefore frozen for the month instead. A new RKB takes effect at a month
boundary, and job rows keep their positional ids.

## Consequences

A freeze nobody checks is not a freeze, so the workbook's job-row structure is fingerprinted
on upload and a mid-month upload whose structure differs is refused, naming the rows that
moved. Wording may change freely; only inserts, deletes and reorders are refused.

Reno cannot add an activity mid-month. That is a real cost, accepted knowingly: the work still
happens and is still reported, it just carries no RKB row until the next month's plan. The
escape hatch is the month boundary, not an override.

Cross-month history is positional, so a row that moves between months is a different row as
far as the data is concerned. Trend lines across a plan change are not trustworthy and must
not be drawn.
