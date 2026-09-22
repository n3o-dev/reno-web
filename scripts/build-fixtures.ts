import { mkdirSync, writeFileSync } from 'node:fs'
import { CAUSES, RECORD_TYPES, type RecordType } from '../src/contract/schemas'
import {
  SITE,
  DAYS,
  MESSAGES,
  PHOTOS,
  REPORTS,
  COMPLAINTS,
  ANSWERED,
  CLOSED_WITH_PHOTO,
  BEFORE_AFTER,
  DEFECTS,
  LATE_OVER_3H,
  DUPLICATE_PAIRS,
  REPLY_MINUTES,
  CLOSURE_MINUTES,
} from './fixtures/published-figures'

/**
 * Builds the Living World Alam Sutera fixture set, 10–13 September 2026,
 * reproducing the published case-study figures exactly.
 *
 * Deterministic: a fixed seed, so a rebuild is a no-op in git and a diff
 * always means a real change. Run with `pnpm fixtures:build`.
 *
 * Every figure below is from the deck. They are the acceptance criteria in
 * docs/specs/agent-data-contract.md (AC-4, AC-5) — do not tune them to make a
 * test pass.
 */

import {
  REPORTERS,
  CLIENT_PICS,
  JOB_CAPTIONS,
  REPEAT_AREAS,
  ONE_OFF_AREAS,
  LINEUP_BY_AREA,
  WORK_ORDERS,
  slug,
} from './fixtures/real-content'

/** Mulberry32 — small, seeded, deterministic. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(20260910)

/** Every area named anywhere in the sources, for tagging work reports. */
const AREA_POOL: readonly string[] = [
  ...REPEAT_AREAS.map((a) => a.label),
  ...ONE_OFF_AREAS.flat(),
]
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T

/** WIB timestamp inside a working day. */
function at(dayIndex: number, minuteOfDay: number): string {
  const day = DAYS[dayIndex] as string
  const h = String(Math.floor(minuteOfDay / 60) % 24).padStart(2, '0')
  const m = String(minuteOfDay % 60).padStart(2, '0')
  return `${day}T${h}:${m}:00+07:00`
}

/**
 * The id of a message that actually exists on that day, nearest the given
 * minute.
 *
 * Messages are laid out evenly across the reporting window, so the index is
 * recoverable from the minute. This used to be `msg_<day>_<minute>`, which
 * looked right and resolved to nothing: message ids are indexed, not
 * timestamped, so every complaint, report and photo in the fixture set cited
 * a message that was not there. Nothing noticed until a figure tried to open
 * its own evidence.
 */
const DAY_START_MINUTE = 6 * 60
const DAY_SPAN_MINUTES = 17 * 60

function messageIdAt(dayIndex: number, minute: number): string {
  const total = MESSAGES[dayIndex] as number
  const fraction = (minute - DAY_START_MINUTE) / DAY_SPAN_MINUTES
  const index = Math.min(total - 1, Math.max(0, Math.round(fraction * total)))
  return `msg_${dayIndex}_${index}`
}

const envelope = (id: string, dayIndex: number, minute: number, sender: string) => ({
  record_id: id,
  site_id: SITE,
  source_message_id: messageIdAt(dayIndex, minute),
  sent_at: at(dayIndex, minute),
  sender_raw: sender,
  sender_person_id: null,
  confidence: 0.9,
})

const out: { [K in RecordType]: unknown[] } = {
  message: [],
  work_report: [],
  complaint: [],
  work_order: [],
  lineup: [],
  rkb_match: [],
  photo: [],
  person: [],
}

// ---- messages -------------------------------------------------------------
DAYS.forEach((_, d) => {
  for (let i = 0; i < (MESSAGES[d] as number); i++) {
    const minute = 6 * 60 + Math.floor((i / (MESSAGES[d] as number)) * 17 * 60)
    out.message.push({
      ...envelope(`msg_${d}_${i}`, d, minute, pick([...REPORTERS, ...CLIENT_PICS])),
      source_message_id: `msg_${d}_${i}`,
      text: JOB_CAPTIONS[i % JOB_CAPTIONS.length] as string,
      photo_ids: [],
      reply_to_message_id: null,
      edited: false,
    })
  }
})

// ---- photos ---------------------------------------------------------------
// 3 duplicate pairs share a hash; 25 arrive over three hours after capture.
let photoN = 0
const lateBudget = { n: LATE_OVER_3H }
DAYS.forEach((_, d) => {
  for (let i = 0; i < (PHOTOS[d] as number); i++) {
    const minute = 6 * 60 + Math.floor((i / (PHOTOS[d] as number)) * 17 * 60)
    const isLate = lateBudget.n > 0 && d < 3 && i % 10 === 3
    if (isLate) lateBudget.n--
    const gapMinutes = isLate ? 200 : 3
    const captured = minute - gapMinutes
    out.photo.push({
      ...envelope(`ph_${photoN}`, d, minute, pick(REPORTERS)),
      captured_at: at(d, captured),
      received_at: at(d, minute),
      perceptual_hash: `p:${photoN.toString(16).padStart(12, '0')}`,
      storage_ref: `s3://reno/${SITE}/ph_${photoN}.jpg`,
    })
    photoN++
  }
})
if (lateBudget.n !== 0) throw new Error(`late-photo budget unspent: ${lateBudget.n}`)
for (let k = 0; k < DUPLICATE_PAIRS; k++) {
  const donor = out.photo[k * 40] as { perceptual_hash: string }
  const twin = out.photo[k * 40 + 17] as { perceptual_hash: string }
  twin.perceptual_hash = donor.perceptual_hash
}

// ---- work reports ---------------------------------------------------------
let reportN = 0
DAYS.forEach((_, d) => {
  const total = REPORTS[d] as number
  const defectsToday: string[][] = []
  for (const [name, counts] of Object.entries(DEFECTS)) {
    for (let i = 0; i < (counts[d] as number); i++) defectsToday.push([name])
  }
  const beforeAfterToday = BEFORE_AFTER[d] as number
  for (let i = 0; i < total; i++) {
    const minute = 6 * 60 + Math.floor((i / total) * 17 * 60)
    const defects = defectsToday[i] ?? []
    out.work_report.push({
      ...envelope(`wr_${reportN}`, d, minute, pick(REPORTERS)),
      area_id: defects.includes('no_area') ? null : slug(AREA_POOL[i % AREA_POOL.length] as string),
      job_text: defects.includes('no_caption')
        ? ''
        : (JOB_CAPTIONS[reportN % JOB_CAPTIONS.length] as string),
      photo_ids: [],
      is_before_after: i < beforeAfterToday,
      shift: ((i % 3) + 1) as 1 | 2 | 3,
      defects,
    })
    reportN++
  }
})

// ---- complaints -----------------------------------------------------------
// The seven repeat areas are placed on their real days first; the remainder
// get an area seen on no other day, so exactly seven areas recur.
/**
 * Real area ids per day: the seven recurring areas on the days the deck shows
 * them, then that day's transcribed one-offs. Where the deck shows a complaint
 * with no readable label, the fixture carries null rather than a made-up name.
 */
const complaintsByDay: (string | null)[][] = DAYS.map(() => [])
for (const area of REPEAT_AREAS) {
  for (const d of area.days) (complaintsByDay[d] as (string | null)[]).push(area.id)
}
DAYS.forEach((_, d) => {
  const list = complaintsByDay[d] as (string | null)[]
  for (const label of ONE_OFF_AREAS[d] ?? []) {
    if (list.length >= (COMPLAINTS[d] as number)) break
    list.push(slug(label))
  }
  while (list.length < (COMPLAINTS[d] as number)) list.push(null)
})

let complaintN = 0

/** Flatten every complaint first, so reply and closure durations can be
 *  allocated across the whole period rather than per day. */
interface Pending {
  readonly day: number
  readonly minute: number
  readonly area: string | null
  readonly index: number
  state: 'raised' | 'answered' | 'closed_with_photo'
}
const pending: Pending[] = []
DAYS.forEach((_, d) => {
  const list = complaintsByDay[d] as (string | null)[]
  const closed = CLOSED_WITH_PHOTO[d] as number
  const answered = ANSWERED[d] as number
  list.forEach((area, i) => {
    const minute = 7 * 60 + Math.floor((i / list.length) * 12 * 60)
    pending.push({
      day: d,
      minute,
      area,
      index: i,
      state: i < closed ? 'closed_with_photo' : i < answered ? 'answered' : 'raised',
    })
  })
})

// Longest closures go to the earliest complaints so none overflows its day.
const closedOnes = pending
  .filter((p) => p.state === 'closed_with_photo')
  .sort((a, b) => a.day * 1440 + a.minute - (b.day * 1440 + b.minute))
const closureFor = new Map<Pending, number>()
;[...CLOSURE_MINUTES]
  .sort((a, b) => b - a)
  .forEach((mins, n) => {
    const target = closedOnes[n]
    if (target !== undefined) closureFor.set(target, mins)
  })

const answeredOnes = pending.filter((p) => p.state !== 'raised')
const replyFor = new Map<Pending, number>()
// The single fastest reply pairs with the fastest closure, keeping each
// complaint internally consistent (a closure never precedes its reply).
const replyPool = [...REPLY_MINUTES].sort((a, b) => a - b)
answeredOnes
  .sort((a, b) => (closureFor.get(a) ?? 0) - (closureFor.get(b) ?? 0))
  .forEach((p, n) => replyFor.set(p, replyPool[n] as number))

for (const p of pending) {
  const reply = replyFor.get(p)
  const closure = closureFor.get(p)
  const history = []
  if (reply !== undefined) {
    history.push({
      state: 'answered',
      at: at(p.day, p.minute + reply),
      source_message_id: messageIdAt(p.day, p.minute + reply),
    })
  }
  if (closure !== undefined) {
    history.push({
      state: 'closed_with_photo',
      at: at(p.day, p.minute + closure),
      source_message_id: messageIdAt(p.day, p.minute + closure),
    })
  }
  /*
   * A complaint whose area the agent could not read is a complaint it is
   * less sure about. Confidence is the agent's own uncertainty, and a flat
   * 0.9 on every record would be a claim of uniform certainty that no reader
   * of a WhatsApp group could honestly make.
   */
  const confidence = p.area === null ? 0.45 : 0.9
  out.complaint.push({
    ...envelope(`cmp_${complaintN}`, p.day, p.minute, pick(CLIENT_PICS)),
    confidence,
    area_id: p.area,
    raised_by: 'p_client',
    raised_at: at(p.day, p.minute),
    cause: p.index % 9 === 4 ? (CAUSES[1 + (p.index % 4)] as string) : 'hk_standard',
    state: p.state,
    state_history: history,
    closing_photo_id: p.state === 'closed_with_photo' ? `ph_${p.index}` : null,
    blocked_reason_message_id: null,
  })
  complaintN++
}

// ---- supporting records ---------------------------------------------------
const rosterEntries = Object.entries(LINEUP_BY_AREA).flatMap(([areaId, names]) =>
  names.map((name) => ({ area_id: areaId, name_raw: name, person_id: slug(name) })),
)

/*
 * Shift 1 and shift 2 only. The group posts a roster for each of those; there
 * is no shift-3 message anywhere in the export, and copying the day roster
 * onto a night shift would invent 37 people's attendance.
 */
DAYS.forEach((_, d) => {
  for (const shift of [1, 2] as const) {
    out.lineup.push({
      ...envelope(`lu_${d}_${shift}`, d, shift === 1 ? 7 * 60 : 15 * 60, 'Amartha'),
      shift,
      date: DAYS[d] as string,
      entries: rosterEntries,
      /**
       * The group's shift-1 line-up states "Total mp : 34". This roster is the
       * union of every area named across the shift-1 and shift-2 messages, so
       * the count follows the names actually listed rather than quoting a
       * figure the entries would contradict.
       */
      total_mp: rosterEntries.length,
      off_day: 0,
      sakit: 0,
      alfa: 0,
      izin: 0,
    })
  }
})

REPORTERS.forEach((name, n) => {
  out.person.push({
    ...envelope(`per_tl_${n}`, 0, 7 * 60, name),
    person_id: slug(name),
    canonical_name: name,
    aliases: [],
    role: name === 'Faisal Hanafi' ? 'pimpro' : 'team_leader',
    area_default: null,
    active_from: '2026-01-01',
    active_to: null,
  })
})
Object.entries(LINEUP_BY_AREA).forEach(([areaId, names]) => {
  names.forEach((name, n) => {
    out.person.push({
      ...envelope(`per_${areaId}_${n}`, 0, 7 * 60, name),
      person_id: slug(name),
      canonical_name: name,
      // Damme is the alias case the personnel master exists to resolve.
      aliases: name === 'Damme' ? ['Dame'] : [],
      role: 'cleaner',
      area_default: areaId,
      active_from: '2026-01-01',
      active_to: null,
    })
  })
})

/*
 * Make each cited message read like the thing that cites it.
 *
 * Messages all carry work-report captions, so a complaint's evidence panel
 * would open onto "Washing manual koridor area LT 2" over a client PIC's
 * name — evidence that contradicts the figure it is supposed to support.
 * The citation now carries the complaint's own sender and a line naming the
 * area, which is what the group's complaint messages look like.
 */
{
  const byId = new Map(
    out.message.map((m) => [(m as { source_message_id: string }).source_message_id, m as { sender_raw: string; text: string }]),
  )
  for (const record of out.complaint) {
    const complaint = record as {
      source_message_id: string
      sender_raw: string
      area_id: string | null
    }
    const message = byId.get(complaint.source_message_id)
    if (message === undefined) continue
    message.sender_raw = complaint.sender_raw
    message.text =
      complaint.area_id === null
        ? 'Pak mohon dicek, ada komplain dari customer soal kebersihan.'
        : `Pak mohon dicek, ${complaint.area_id.replaceAll('_', ' ')} masih kotor.`
  }
}

/*
 * One complaint is blocked.
 *
 * The real case from this period: work that could not proceed because the
 * equipment never arrived — the car gondola, which is also the block the RKB
 * writer tests cite. A blocked item keeps
 * its 24-hour clock paused and must cite the message that justifies it —
 * without a blocked record in the fixture set, none of that is ever
 * exercised. Chosen from the already-answered complaints so the published
 * answered count does not move.
 */
{
  const target = out.complaint.find(
    (c): c is Record<string, unknown> & { state: string; cause: string } =>
      typeof c === 'object' &&
      c !== null &&
      (c as { state?: string }).state === 'answered' &&
      (c as { cause?: string }).cause === 'engineering_equipment',
  )
  if (target === undefined) throw new Error('no answered equipment complaint to block')
  const history = target['state_history'] as { state: string; at: string; source_message_id: string }[]
  const last = history[history.length - 1]
  if (last === undefined) throw new Error('blocked complaint must already have a history')
  const citation = last.source_message_id
  history.push({ state: 'blocked', at: last.at, source_message_id: citation })
  target.state = 'blocked'
  target['blocked_reason_message_id'] = citation

  // The cited message has to read like the reason, or the citation proves
  // nothing to whoever opens it. One of the day's messages becomes the one
  // that reported the equipment problem.
  const message = out.message.find(
    (m) => (m as { source_message_id?: string }).source_message_id === citation,
  ) as { text: string } | undefined
  if (message === undefined) throw new Error(`blocked citation ${citation} has no message`)
  message.text =
    'Pak, untuk area gas tank belum bisa dikerjakan. Car gondola belum datang, masih ditahan vendor.'
}

WORK_ORDERS.forEach((wo, n) => {
  out.work_order.push({
    ...envelope(`wo_${n}`, wo.dayIndex, wo.minute, wo.requestedBy),
    title: wo.title,
    document_id: `doc_${n}`,
    requested_by: slug(wo.requestedBy),
    due_date: wo.due,
    state: wo.state,
    state_history: [
      { state: 'raised' as const, at: at(wo.dayIndex, wo.minute), source_message_id: messageIdAt(wo.dayIndex, wo.minute) },
      ...('closed' in wo && wo.closed !== undefined
        ? [
            {
              state: 'closed_with_photo' as const,
              at: at(wo.closed.dayIndex, wo.closed.minute),
              source_message_id: messageIdAt(wo.closed.dayIndex, wo.closed.minute),
            },
          ]
        : []),
    ],
    closing_photo_id: wo.state === 'closed_with_photo' ? `ph_${n}` : null,
    blocked_reason_message_id: null,
  })
})

/*
 * Dated to a day the workbook actually plans this job row: TOILET LT 2 row
 * 3 runs on the 1st, 8th, 15th, 22nd and 29th. It used to carry a September
 * date against a July workbook, so the match resolved against nothing and
 * every RKB figure cited the workbook alone — the wiring was correct and
 * provably dead.
 */
out.rkb_match.push({
  ...envelope('rm_0', 2, 7 * 60 + 37, 'Amartha'),
  job_row_id: 'toilet:TOILET LT 2:3',
  date: '2026-07-08',
  work_report_id: 'wr_0',
  matched_by: 'agent',
})

mkdirSync('fixtures/agent', { recursive: true })
for (const type of RECORD_TYPES) {
  writeFileSync(`fixtures/agent/${type}.json`, `${JSON.stringify(out[type], null, 1)}\n`)
  process.stdout.write(`${type}: ${out[type].length}\n`)
}
