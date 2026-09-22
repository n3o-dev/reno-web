# Using the Reno dashboard

**Site:** Living World Alam Sutera (LWAS)
**Address:** https://reno.devmgd.com

The dashboard does not replace the WhatsApp group. The group stays exactly as it is. An
agent reads it, turns messages into records, and this dashboard turns those records into the
four things Reno has to produce anyway: the RKB realisation, the monthly client report, the
manpower figure that reaches the invoice, and the Rapor Pimpro.

---

## 1. The one rule worth knowing

**Every number clicks.** Tap or click any figure and it opens the WhatsApp messages it was
built from — sender, time, text, photos. Nothing on any screen is a number someone typed in.
If a figure looks wrong, click it and you will see why it says what it says, and whether the
fault is in the data or in the work.

A figure the system cannot evidence is not shown as zero. It is shown as unknown.

---

## 2. Who sees what

| | Reno staff | The client (Living World) |
|---|---|---|
| How they get in | Email and password at https://reno.devmgd.com | A link, no login |
| Today | ✓ | ✓ |
| Complaints | ✓ | ✓ |
| Work Orders | ✓ | ✓ |
| RKB Realisation | ✓ | ✓ |
| Manpower & Billing | ✓ | ✓ |
| Monthly Report | ✓ | ✓ |
| Report Quality | ✓ | — |
| Pimpro Scorecard | ✓ | — |
| Personnel | ✓ | — |

The client link is read-only. It cannot confirm a month, cannot correct a slot, cannot
download the workbook, and cannot reach the three internal screens. Those three are not
hidden by a filter — the client's navigation is a separate list, so a mistake in one cannot
expose the other.

Treat the client link like a password: whoever has it can read the whole site. It is
revocable — ask for a new one and the old one stops working immediately.

---

## 3. The screens

### Today — *what is happening on site right now*
The morning screen. Line-up for the current shift, complaints still inside their 24-hour
clock, work reported so far, and anything blocked. Open this first.

### Complaints — *the 24-hour clock*
Every complaint raised in the group, its state, and how long is left. States are `open`,
`answered`, `closed_with_photo`, `closed_without_photo`, and `blocked`.

Two things to understand:

- **Blocked pauses the clock.** A complaint Reno cannot act on — no water, tenant refused
  access, equipment held by a vendor — stops counting against Reno. A block is only accepted
  with the message that justifies it attached, and the client can see that message. This is
  deliberate: the one state that improves Reno's numbers is the one that must be evidenced.
- **Cause is split.** Each complaint is attributed either to Reno's own standard of work or
  to something outside Reno's control. The client sees both columns. The point of the split
  is to make an honest conversation possible, not to win an argument.

Repeat areas are called out separately. An area that generates complaints month after month
is a resourcing problem, not a cleaner problem.

### Work Orders — *the client's written requests*
WO and MR documents, usually arriving as PDFs, each running to a due date the client set —
never the 24-hour complaint clock. Shows delivered on time, still open, and blocked.

### RKB Realisation — *plan against actual*
The monthly work plan, sheet by sheet, as a grid of job rows against days. A cell is done
when a work report was matched to it. A cell is blocked when something stopped it, with the
reason attached. Realisation is the only percentage in the system, and it is the figure that
feeds Pimpro score A.1 at 30% weight — so it is the one worth checking before month end.

Each sheet opens to its own grid. Click a cell to see the report behind it.

### Manpower & Billing — *what is invoiceable*
Slot-days filled against slot-days contracted, absences by kind (off day, sick, alfa, izin),
and the amount payable.

Billing is per slot-day: an area × a shift × a day. The contract rate is Rp 5,000,000 per
person per month, pro-rated at 1/30 per day. An unfilled slot-day is a deduction.

**Corrections.** When the line-up in the group is wrong — someone worked but was not listed,
or was listed and did not — a Reno user can correct that specific slot on that specific day.
A correction requires a written reason, records who made it and when, and is visible to the
client. Corrections move coverage, deduction and payable together; there is no way to change
the payable figure alone.

### Monthly Report — *the pack, assembled*
Shows what the client report will contain, which parts are automatic, which are waiting on a
person, and which gates still have to pass.

**Three gates, all of which must pass before anything generates:**

1. **Roster confirmed.** Claimed attendance from a line-up is not attendance. A named person
   confirms the month before the manpower figure is allowed into a report. The screen records
   who confirmed it.
2. **Aliases resolved.** Any spelling in a line-up that does not resolve to a person on the
   master is named, and the report waits.
3. **Blocks cited.** Any blocked record without the message that justifies it is named, and
   the report waits.

Generation refuses rather than producing a pack that is quietly wrong. The refusal names what
is missing.

Two buttons, Reno only: **Open the client report** (a print view — use the browser's Print
to PDF; there is no server-side PDF) and **Download the RKB workbook** (the filled Excel
file, which preserves anything already entered by hand).

### Report Quality — *where Reno's own reporting is failing* (internal)
Not about the cleaning; about the reporting. Reports arriving more than three hours late,
duplicate photos, photos reused across days, reports with no before-and-after pair, and areas
nobody reported at all. This is the screen to read before the client reads the others.

### Pimpro Scorecard — *the SOP form, part auto-filled* (internal)
The Rapor Pimpro with the parts the data can fill already filled, and the parts that need a
human judgement left blank and marked. It does not invent a score for anything unevidenced.

### Personnel — *the master* (internal)
People, confirmed aliases, and contracted slots. The agent proposes an alias; a person
confirms it before it counts anywhere.

---

## 4. Things it deliberately does not do

- **No server-side PDF.** The client report is a print view. Print to PDF from the browser.
- **No daily coverage view.** It was cut: the figure is only meaningful monthly.
- **No second site.** LWAS only. Every read is scoped to one site by construction.
- **No score it cannot evidence.** A blank on the scorecard is a blank, not a guess.

---

## 5. When something looks wrong

1. **Click the figure.** The evidence is the first answer.
2. **If the evidence is right and the number is wrong** — that is a dashboard bug. Report it.
3. **If the evidence is wrong** — the agent misread a message. Report it to the agent team
   with the `record_id` shown in the evidence panel; they re-send the corrected record and
   the dashboard updates. They can also withdraw a record that should never have existed.
4. **If the message itself was wrong** — that is an operations problem, and a correction with
   a written reason on the Manpower screen is the honest way to fix it.
