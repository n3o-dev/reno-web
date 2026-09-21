# Agentic Reno AI

Reno (PT Indo Cipta Daya, trading as Renno Indonesia) supplies cleaning labour to client
buildings. All field reporting happens in a WhatsApp group, one group per site. An agent
built by Intiva reads the group and produces records. This repository is the **dashboard**
that reads those records and produces the monthly report. The agent itself is not in scope.

Domain language is Indonesian; the interface is English. Terms below keep their Indonesian
name where the name is contractual (it appears in the SOP, the Excel workbook, or the
invoice) and are given an English name where the name is only descriptive.

## Language

### People

**Operational Manager**:
Head-office manager accountable for work quality, data integrity and payroll approval across all sites.
_Avoid_: OM in user-facing text.

**Project Coordinator**:
Head-office role responsible for several sites; visits sites, scores the Pimpro, owns BAPP.
_Avoid_: Project Manager, PC in user-facing text.

**Pimpro**:
Short for Pimpinan Proyek. The most senior Reno person based at one site; signs the RKB.
_Avoid_: Project Leader, Chief Supervisor, Chief Superintendent.

**Team Leader**:
Reno supervisor responsible for one area on one shift; reports to the Pimpro.
_Avoid_: Captain, TL.

**Cleaner**:
A labourer who performs cleaning work. The people counted in the line-up.
_Avoid_: Office boy, labor, MP (MP is a count, not a person).

**Client PIC**:
A named person on the client's side who raises complaints and work orders in the group.
_Avoid_: User, customer.

### Work

**Work Report**:
A message in the group where a Reno person reports work done, normally a photo with a caption.
_Avoid_: Laporan, report (ambiguous with Monthly Report).

**Complaint**:
A message where a Client PIC or a Reno superior flags something as dirty, broken or unacceptable.
_Avoid_: Keluhan, issue, ticket.

**Work Order**:
A dated job the client requests in the group, normally as a PDF. Includes Material Requests.
_Avoid_: WO, MR, request.

**Periodic Work**:
Scheduled deep-clean work that appears as a job row in the RKB.
_Avoid_: MCP work, GC (General Cleaning is one kind of periodic work, not all of it).

**Daily Routine Work**:
Everyday cleaning that is reported in the group but has no row in the RKB and is never scored.
_Avoid_: Daily coverage.

### Plan and realisation

**RKB**:
Rencana Kerja Bulanan. The monthly Excel workbook of periodic job rows, authored at the site by the Pimpro. Six sheets, 144 job rows, 31 day-columns each holding a paired R and A value.
_Avoid_: Monthly work plan, schedule.

**Section**:
A run of job rows in one RKB sheet, ending at its `PERSENTASI (%)` row. Not to be confused with **Blocked**.
_Avoid_: Block (it collides with Blocked).

**R**:
Rencana. The planned value in an RKB day-column. Read-only in the dashboard.
_Avoid_: Plan column.

**A**:
Aktual. The realised value in an RKB day-column, filled by the dashboard from matched Work Reports.
_Avoid_: Actual column, realisation column.

**Realisation**:
A completed over planned percentage computed from RKB R and A values. The only percentage in the system.
_Avoid_: Completion rate, coverage.

**Blocked**:
State of an RKB job row or a Complaint that could not proceed for a reason outside Reno's control, evidenced by a cited message.
_Avoid_: On hold, pending, paused.

### Attendance and money

**Slot**:
The billing unit: one area, one shift, one day. A slot is filled or unfilled regardless of who fills it.
_Avoid_: Position, headcount, seat.

**Line-up**:
The roster message posted to the group at the start of each shift, listing every name by area plus the Off Day, Sakit, Alfa and Izin counts. The only attendance record in the group.
_Avoid_: Absensi, briefing, roster message.

**Claimed attendance**:
Attendance derived from a Line-up and nothing else. Never labelled verified.
_Avoid_: Attendance, presence.

**Admin-confirmed attendance**:
Claimed attendance that a site admin has explicitly confirmed in the dashboard.
_Avoid_: Verified attendance.

**BAPP**:
Berita Acara Penyelesaian Pekerjaan. The signed monthly completion document that releases the invoice.
_Avoid_: Invoice, billing doc.

### Evidence and quality

**Evidence**:
The source message, sender, timestamp and photo behind any figure shown in the dashboard.
_Avoid_: Proof, backing data.

**Closed with photo**:
A Complaint whose resolution is evidenced by a photo taken after the Complaint was raised.
_Avoid_: Resolved, done, closed.

**Before-after**:
A Work Report carrying both a before and an after photo of the same job.
_Avoid_: B/A, progress photos.

**Override**:
A correction by a Reno user to something the agent produced, carrying a written reason, append-only and visible to the client.
_Avoid_: Edit, fix, adjustment.

**Rapor Pimpro**:
The SOP's weighted performance form for a Pimpro. Sections A 30%, B 20%, C 25%, D 25%.
_Avoid_: Scorecard in contractual contexts, KPI form.

## Relationships

- A **Site** has exactly one WhatsApp group and exactly one **RKB** per month
- A **Site** has one **Pimpro**, several **Team Leaders**, and many **Cleaners**
- A **Project Coordinator** covers several **Sites**; an **Operational Manager** covers all of them
- A **Slot** is filled by zero or more **Cleaners**; billing counts the **Slot**, never the **Cleaner**
- A **Line-up** produces **Claimed attendance** for the **Slots** of one shift
- An **RKB** contains **Job Rows**; each Job Row has 31 paired **R** and **A** values
- A **Work Report** may satisfy a Job Row's **A** value, or close a **Complaint**, or neither
- A **Complaint** and a **Work Order** each resolve to **Closed with photo**; a Complaint runs a 24-hour clock, a Work Order runs to its client-set due date
- Either may enter **Blocked**, which requires a cited message and pauses its clock
- **Realisation**, **Closed with photo** rate and report quality feed **Rapor Pimpro** A.1, A.3 and D.3
- An **Override** attaches to any agent output and is never destructive

## Example dialogue

> **Dev:** "Ani was off sick on the 12th and nobody covered Lantai 1. Does the client still pay for her?"
> **Domain expert:** "No. But say it properly — the client does not pay for Ani, the client pays for the **Slot**. Lantai 1 shift 1 on the 12th was unfilled, so that one slot-day comes off. If Deviana had walked over and covered it, the slot is filled and the client pays in full, even though Ani was the contracted name."
>
> **Dev:** "And the toilet that stayed dirty for three days — does that come off the bill too?"
> **Domain expert:** "It does not. Billing is manpower. A filthy toilet costs the **Pimpro** his **Rapor Pimpro** score and eventually costs us the contract, but it never touches the invoice."
>
> **Dev:** "The façade work on the 11th did not happen because the gondola was not on site. Is that realisation of zero?"
> **Domain expert:** "That row is **Blocked**, not zero, and it only counts as blocked if you can point at Ahmad's message saying the scaffolding had not arrived. Show the client both numbers. Score Faisal on the one that leaves blocked work out."

## Flagged ambiguities

- **"Project Manager" and "Project Leader"** were used for two roles the SOP names differently. Resolved: the multi-site head-office role is **Project Coordinator**; the site-based role is **Pimpro**. **Team Leader** is a distinct fourth level below the Pimpro, easy to miss because the group is full of them.
- **"MCP"** appears in the RKB workbook as `JUMLAH MCP`, meaning the count of periodic jobs planned that day, while SOP/OPS/004 uses *Master Cleaning Plan* for a project-setup document. Resolved: in this repository MCP always means the workbook's count. The setup document is not used.
- **"Report"** meant both a single field message and the monthly client document. Resolved: **Work Report** and **Monthly Report** are different things.
- **"Verified"** was used of attendance parsed from a Line-up. Resolved: that is **Claimed attendance**. Nothing in the group can verify physical presence, so the word *verified* is not used anywhere in the product.
- **"RKB" was believed to be authored by the Operational Manager and the client.** The July workbook is signed *Di Buat Oleh: PAISAL, Chief Superintendent*. Resolved: the **Pimpro** authors the RKB at the site, in Excel. The dashboard reads it and never writes the R column.
