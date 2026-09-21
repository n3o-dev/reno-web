import { mkdirSync, writeFileSync } from 'node:fs'
import { CAUSES, RECORD_TYPES, type RecordType } from '../src/contract/schemas'

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

const SITE = 'lwas'
const DAYS = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'] as const
const MESSAGES = [339, 414, 326, 299] as const
const PHOTOS = [264, 314, 251, 223] as const
const REPORTS = [166, 149, 170, 154] as const
const COMPLAINTS = [19, 35, 4, 17] as const
const ANSWERED = [17, 25, 4, 16] as const
const CLOSED_WITH_PHOTO = [9, 10, 3, 7] as const
/**
 * 61 reports carry before-and-after.
 *
 * The deck states 61 twice — in the KPI table and again in the evidence
 * appendix — but its own per-reporter table sums to 65. The headline wins:
 * it is stated twice and is the figure the QBR is built on. The per-day split
 * below keeps the shape of the per-reporter table and trims the difference.
 */
const BEFORE_AFTER = [10, 21, 22, 8] as const
const DEFECTS: Record<string, readonly number[]> = {
  no_area: [7, 12, 9, 8],
  done_without_complaint: [5, 3, 2, 2],
  no_caption: [5, 4, 0, 1],
  photo_reused: [3, 0, 0, 0],
}
const LATE_OVER_3H = 25
/**
 * Reply and closure durations, in minutes, chosen so the period medians land
 * on the published figures: reply median 3 (fastest under 1, slowest 25) and
 * closure median 41 (fastest 6, slowest 16h50m = 1010).
 */
const REPLY_MINUTES: readonly number[] = [0, ...Array<number>(30).fill(2), ...Array<number>(30).fill(4), 25]
const CLOSURE_MINUTES: readonly number[] = [6, ...Array<number>(13).fill(30), 41, ...Array<number>(13).fill(60), 1010]
const DUPLICATE_PAIRS = 3

/** Areas complained about on more than one day, with the days they recurred. */
const REPEAT_AREAS: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['toilet_lt2', [1, 2, 3]],
  ['tempat_sampah_cmo', [0, 1, 3]],
  ['tangga_carpark_p1_p10', [0, 2]],
  ['asbak_smoking_area', [1, 3]],
  ['carpark_p1_zona_a', [0, 1]],
  ['area_apong', [0, 1]],
  ['depan_skin_plus', [0, 3]],
]

const REPORTERS = ['Amartha', 'Faisal Hanafi', 'Aldo', 'Acenk (Bontot)', 'N', 'yeyenriani', 'Sarwedi']
const CLIENT_PICS = ['Cristian B. Suryanto', 'Rachmad Adi', 'Sofyan', 'Desak Made Meyasni']

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
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T

/** WIB timestamp inside a working day. */
function at(dayIndex: number, minuteOfDay: number): string {
  const day = DAYS[dayIndex] as string
  const h = String(Math.floor(minuteOfDay / 60) % 24).padStart(2, '0')
  const m = String(minuteOfDay % 60).padStart(2, '0')
  return `${day}T${h}:${m}:00+07:00`
}

const envelope = (id: string, dayIndex: number, minute: number, sender: string) => ({
  record_id: id,
  site_id: SITE,
  source_message_id: `msg_${dayIndex}_${minute}`,
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
      text: 'Progres area',
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
      area_id: defects.includes('no_area') ? null : `area_${i % 12}`,
      job_text: defects.includes('no_caption') ? '' : 'Mopping koridor',
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
const complaintsByDay: string[][] = DAYS.map(() => [])
for (const [area, days] of REPEAT_AREAS) {
  for (const d of days) (complaintsByDay[d] as string[]).push(area)
}
let uniqueArea = 0
DAYS.forEach((_, d) => {
  const list = complaintsByDay[d] as string[]
  while (list.length < (COMPLAINTS[d] as number)) list.push(`once_${uniqueArea++}`)
})

let complaintN = 0

/** Flatten every complaint first, so reply and closure durations can be
 *  allocated across the whole period rather than per day. */
interface Pending {
  readonly day: number
  readonly minute: number
  readonly area: string
  readonly index: number
  state: 'raised' | 'answered' | 'closed_with_photo'
}
const pending: Pending[] = []
DAYS.forEach((_, d) => {
  const list = complaintsByDay[d] as string[]
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
    history.push({ state: 'answered', at: at(p.day, p.minute + reply), source_message_id: `msg_r_${complaintN}` })
  }
  if (closure !== undefined) {
    history.push({ state: 'closed_with_photo', at: at(p.day, p.minute + closure), source_message_id: `msg_c_${complaintN}` })
  }
  out.complaint.push({
    ...envelope(`cmp_${complaintN}`, p.day, p.minute, pick(CLIENT_PICS)),
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
DAYS.forEach((_, d) => {
  for (const shift of [1, 2, 3] as const) {
    out.lineup.push({
      ...envelope(`lu_${d}_${shift}`, d, shift === 1 ? 7 * 60 : shift === 2 ? 15 * 60 : 23 * 60, 'Amartha'),
      shift,
      date: DAYS[d] as string,
      entries: REPORTERS.map((name, n) => ({
        area_id: `area_${n}`,
        name_raw: name,
        person_id: `p_${n}`,
      })),
      total_mp: 34,
      off_day: 0,
      sakit: 0,
      alfa: 0,
      izin: 0,
    })
  }
})

REPORTERS.forEach((name, n) => {
  out.person.push({
    ...envelope(`per_${n}`, 0, 7 * 60, name),
    person_id: `p_${n}`,
    canonical_name: name,
    aliases: [],
    role: n === 1 ? 'pimpro' : 'team_leader',
    area_default: `area_${n}`,
    active_from: '2026-01-01',
    active_to: null,
  })
})

const WORK_ORDERS = [
  ['Take Out Kursi Area LDL & West Lobby', 0, '2026-09-10', 'closed_with_photo'],
  ['Peminjaman Meja & Qline — Bee Cheng Hiang', 0, '2026-09-12', 'closed_with_photo'],
  ['WO to HK — Pioneer DJ', 0, '2026-09-13', 'raised'],
] as const
WORK_ORDERS.forEach(([title, d, due, state], n) => {
  out.work_order.push({
    ...envelope(`wo_${n}`, d, 11 * 60 + n * 40, 'Desak Made Meyasni'),
    title,
    document_id: `doc_${n}`,
    requested_by: 'p_desak',
    due_date: due,
    state,
    state_history: [],
    closing_photo_id: state === 'closed_with_photo' ? `ph_${n}` : null,
    blocked_reason_message_id: null,
  })
})

out.rkb_match.push({
  ...envelope('rm_0', 2, 7 * 60 + 37, 'Amartha'),
  job_row_id: 'toilet:TOILET LT 2:3',
  date: '2026-09-12',
  work_report_id: 'wr_0',
  matched_by: 'agent',
})

mkdirSync('fixtures/agent', { recursive: true })
for (const type of RECORD_TYPES) {
  writeFileSync(`fixtures/agent/${type}.json`, `${JSON.stringify(out[type], null, 1)}\n`)
  process.stdout.write(`${type}: ${out[type].length}\n`)
}
