/**
 * Real content from the two Living World Alam Sutera sources.
 *
 *  - people and work-report captions: the WhatsApp export, LWAS-RENO HK
 *  - complaint areas: the evidence appendix of the Reno AI case-study deck
 *  - line-up rosters: Amartha's and Acenk's own roster messages
 *
 * Used so the fixtures read like Reno's site rather than like placeholders.
 * The published totals still govern — see published-figures.ts — and where the
 * deck shows a complaint with no readable area label, the fixture carries a
 * null `area_id` rather than an invented name.
 */

/** Reno-side reporters, with the display names WhatsApp actually shows. */
export const REPORTERS = [
  '🥀Amartha🥀',
  'Acenk (Bontot)',
  'Sarwedi',
  'N',
  'Faisal Hanafi',
  'yeyenriani🌻🌻',
  'Ahmad zamroni',
  'Sahril',
] as const

/** Client-side people who raise complaints and work orders in the group. */
export const CLIENT_PICS = [
  '𝚁𝚊𝚌𝚑𝚖𝚊𝚍 𝙰𝚍𝚒',
  'Cristian B. Suryanto',
  'Sofyan',
  'Desak Made Meyasni',
  'Alexander Tarigan',
] as const

/** Captions Reno's team actually wrote on work-report photos. */
export const JOB_CAPTIONS = [
  'Moping flek depan tenan jpp Lt1 sisi barat',
  'Cleaning busa bangku LK',
  'Glass cleaning kaca toilet LDL. LT gf',
  'Moping plek area loby east LT gf',
  'Glass cleaning kaca Aquarium LT gf',
  'Sweping dormat gate1',
  'Take out Sampah trasbin gate 1',
  'GC urinal toilet LDL LT GF',
  'GC toilet The market LT GF',
  'Progres brushing toilet kantin pria',
  'Glass cleaning kaca riling LT UG sisi barat',
  'Dusting trasbin depan Mako LT GF',
  'Glass cleaning pintu loby east LT GF',
  'Pencucian lantai carpak P4',
  'Lanjut cleaning ambalan dan acesoris',
  'Sweeping sampah lepas area ojol',
  'Kondisi akhir parkir ojol',
  'Sweeping sampah lepas all area outdoor',
  'Dry vacum all Nomate Gate-gate',
  'Scrubber koridor west atrium',
  'Washing manual koridor area LT 2',
  'Mopping koridor area XXI',
  'Progres sweeping lift barang Timur LT 2',
  'Progres Daily pagi Koridor UG',
  'Progres mopping koridor area LT 1 timur',
  'Glass cleaning escalator area LT 2',
  'Progres spider web area P4',
  'Progres Ram kanstin P7',
  'Cleaning dak railing koridor LP',
  'Dushting Dak sisi kaca railing lt 2',
  'Cleaning landing eskalator koridor UG',
  'Clean up lift',
  'Pick up all sampah tenant UG',
  'Cleaning pipa besi koridor LP',
  'General cleaning wastafel TW lt 1 timur',
  'Sweeping tangga exit lt 2 - 1',
  'Glass cleaning aquarium LK',
  'Ceiling spiderweb P1 zone C',
  'Cleaning toilet basement motor pria wanita',
  'Sweeping Dushting tangga exit lt 1',
  'Wall Cleaning toilet wanita UG Barat',
  'Cleaning wastafel toilet pria UG Barat',
  'Glass cleaning canopy selasar timur',
  'Clean up gutter canopy',
] as const

/**
 * The seven areas the deck shows complained about on more than one day, with
 * the day indices they recur on. These carry canonical ids because the deck
 * labels the same area differently on different days — "Trashbin depan CMO"
 * and "Tempat sampah stainless di CMO" are one bin.
 */
export const REPEAT_AREAS: ReadonlyArray<{
  readonly id: string
  readonly label: string
  readonly days: readonly number[]
}> = [
  { id: 'toilet_lt2', label: 'Toilet LT2 dekat Rockstar', days: [1, 2, 3] },
  { id: 'tempat_sampah_cmo', label: 'Tempat sampah depan CMO', days: [0, 1, 3] },
  { id: 'tangga_carpark_p1_p10', label: 'Tangga carpark P1–P10', days: [0, 2] },
  { id: 'asbak_smoking_area', label: 'Asbak area smoking', days: [1, 3] },
  { id: 'carpark_p1_zona_a', label: 'Carpark P1 zona A', days: [0, 1] },
  { id: 'area_apong', label: 'Area APONG', days: [0, 1] },
  { id: 'depan_skin_plus', label: 'Lantai depan Skin+', days: [0, 3] },
]

/**
 * One-off complaint areas, transcribed per day from the deck's evidence
 * appendix. Shorter than the day's total where the deck shows an entry with no
 * readable label; the generator fills the remainder with a null `area_id`.
 */
export const ONE_OFF_AREAS: readonly (readonly string[])[] = [
  [
    'Carpark P7 separator ramp spiral',
    'Carpark P2',
    'Toilet LT1 samping Xiaomi',
    'Belakang LED',
    'Lobby lift carpark P5–P1 kaca',
    'Counter Kopi Kenangan',
    'Carpark P1 zona AB',
    'Carpark P8',
    'Area Gas Tank',
    'Plafon lampu LT2 dekat trellis',
    'PKD atas',
    'Toilet disable LDL',
    'Toilet OO',
    'Lantai depan lift East Atrium',
  ],
  [
    'Gate 8 & area lift',
    'Carpark dinding mural & area',
    'Hand dryer toilet',
    'Planter box granit hitam',
    'Cladding kolom dekat Optik Seis',
    'Plint stainless & sudut kolom',
    'Sofa lounge koridor',
    'Jalur depan tenant area proyek',
    'Plafon sekitar box',
    'Lantai koridor bekas cucian',
    'Lantai dekat kolom & perangkap',
    'Air curtain stainless pintu masuk',
    'Fasad kaca & rangka East Lobby',
    'Lantai di bawah bangku balok',
    'Green wall samping tenant',
    'Cermin wastafel toilet',
    'Pagar/partisi besi putih',
    'Bangku kayu batang',
    'Pipa plumbing plafon carpark',
    'Sofa depan hoarding tenant proyek',
    'Parkir disabilitas carpark',
    'Area depan kantor CS',
    'Pintu proyek depan Point Coffee',
    'Halaman & kanopi pintu masuk',
    'Koridor depan CMO',
    'Tong sampah outdoor dekat hydrant',
    'Kanopi depan Lobby East / dropoff',
    'Area mushola LT2',
  ],
  ['Lantai keramik luar pintu East', 'Lantai kantin'],
  [
    'Eskalator dari Es Gentong',
    'Unit scenting di sebelah',
    'Lantai depan tenant dekat dropoff',
    'Koridor LT1 Timur, sudut plafon',
    'Depan gate 5',
    'Plafon/soffit tepi void atrium',
    'Selasar outdoor depan Bakmi GM',
    'Driver room timur',
    'Depan Karada',
    'Koridor zone B LT2, depan toilet',
    'Depan Minoshe LT2',
    'Entrance Uniqlo',
    'Driveway depan pintu kaca',
    'Lantai keramik luar pintu Eas',
    'Tempat sampah stainless CMO utara',
  ],
]

/** Cleaners by area, from the roster messages posted in the group. */
export const LINEUP_BY_AREA: Readonly<Record<string, readonly string[]>> = {
  external: ['Ade', 'Renno', 'Nando', 'Sandi', 'Okta', 'Marhadi'],
  gf: ['Ani', 'Deviana', 'Tiara', 'Junaesi', 'Febby', 'Muhamad hafiz', 'Warti', 'Septian'],
  ug: ['Mardiah', 'Damme', 'Farhan', 'Sahroni', 'Nurul'],
  lt2: ['Aryo', 'Naisah', 'Iska', 'Inez', 'Dikri', 'Hera'],
  lt1: ['Deviyanti', 'Heri', 'Rangga', 'Nenti', 'Mariam'],
  lk: ['Hermawati', 'Agus', 'Revaldi'],
  garbage: ['muhamad Abdullah'],
  gondola: ['afif', 'riyan', 'Sahrul'],
}

/**
 * Work orders the client actually sent into the group as PDFs.
 *
 * `closed` is when the closing photo went up. The group's own timeline gives
 * the day; the minute is chosen inside it, because a work order with no
 * closure time cannot be judged delivered on time or late, and "unknown" is
 * not a state the client's recap has ever shown.
 */
export const WORK_ORDERS = [
  {
    title: 'WO to HK — Take Out Kursi Area LDL & West Lobby (10 September 2026)',
    requestedBy: 'Desak Made Meyasni',
    dayIndex: 0,
    minute: 12 * 60 + 31,
    due: '2026-09-10',
    state: 'closed_with_photo',
    closed: { dayIndex: 0, minute: 16 * 60 + 10 },
  },
  {
    title: 'MR WO peminjaman Meja dan Qline — GO Bee Cheng Hiang',
    requestedBy: 'Desak Made Meyasni',
    dayIndex: 0,
    minute: 11 * 60 + 17,
    due: '2026-09-12',
    state: 'closed_with_photo',
    closed: { dayIndex: 2, minute: 9 * 60 + 40 },
  },
  {
    title: 'WO to HK — Pioneer DJ (12 – 13 September 2026)',
    requestedBy: '𝚁𝚊𝚌𝚑𝚖𝚊𝚍 𝙰𝚍𝚒',
    dayIndex: 0,
    minute: 21 * 60 + 41,
    due: '2026-09-13',
    state: 'raised',
  },
  /*
   * Blocked, and for the same real reason the RKB block cites: the gondola
   * never arrived. Without one the blocked branch of the work-order table
   * was unreachable, so its paused clock and its citation were never
   * rendered and never tested.
   */
  {
    title: 'WO to HK — Glass cleaning canopy selasar timur',
    requestedBy: 'Desak Made Meyasni',
    dayIndex: 1,
    minute: 9 * 60 + 5,
    due: '2026-09-13',
    state: 'blocked',
  },
] as const

/**
 * `Carpark P1 zona A` → `carpark_p1_zona_a`.
 *
 * NFKD, not NFD: WhatsApp display names in this group use stylised Unicode —
 * Rachmad Adi writes his in mathematical monospace, and yeyenriani and
 * Amartha carry emoji. Canonical decomposition leaves those untouched and
 * yields an empty id; compatibility decomposition folds them to ASCII. This is
 * the same identity problem the personnel master exists to solve, arriving one
 * layer earlier.
 */
export function slug(label: string): string {
  const out = label
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  if (out === '') throw new Error(`cannot derive an id from "${label}"`)
  return out
}
