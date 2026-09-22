/**
 * AC-5, AC-9 — the interface is in English, and attendance is never "verified".
 *
 * The rule is not "no Indonesian anywhere". Reno's contractual vocabulary is
 * Indonesian and stays that way: RKB, BAPP, JUMLAH, Sakit. What must not
 * happen is an interface string drifting back into Indonesian because the
 * source material is. Data values are exempt — this reads source, not records.
 *
 * A line carrying `i18n-allow:` with a reason is skipped. Use it for the few
 * places an Indonesian word is a value being handled rather than a word being
 * shown.
 */
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

/** Contractual terms. Indonesian, deliberately, and shown as-is. */
const ALLOWED = new Set(
  [
    'rkb', 'bapp', 'mcp', 'rapor', 'pimpro', 'jumlah', 'realisasi', 'persentasi',
    'off', 'day', 'sakit', 'alfa', 'izin', 'juli', 'renno', 'reno',
  ],
)

/**
 * Indonesian function words. Function words rather than nouns on purpose: an
 * interface string that has drifted will almost always carry one, and a
 * proper noun like "Alam Sutera" will not.
 */
const INDONESIAN = new Set([
  // Function words: a drifted sentence almost always carries one, and a
  // proper noun like "Alam Sutera" does not.
  'yang', 'dan', 'dengan', 'untuk', 'dari', 'pada', 'adalah', 'tidak', 'belum',
  'sudah', 'akan', 'bisa', 'dapat', 'harus', 'atau', 'juga', 'agar', 'karena',
  'setiap', 'semua', 'lebih', 'kurang', 'saat', 'kepada', 'oleh', 'dalam',
  'sedang', 'masih', 'telah', 'ini', 'itu', 'ada', 'tanpa', 'sampai',
  // Nouns this domain uses.
  'pekerjaan', 'kebersihan', 'laporan', 'keluhan', 'petugas', 'kehadiran',
  'catatan', 'tanggal', 'waktu', 'hari', 'bulan', 'minggu', 'tahun', 'nama',
  'lengkap', 'gedung', 'lantai', 'ruang', 'sampah', 'kotor', 'bersih', 'foto',
  'pesan', 'orang', 'absen',
  /*
   * Verbs and one-word button labels — the ones a list of function words
   * cannot reach. "Simpan", "Hapus", "Tutup" are a single word each with
   * nothing else to trip on, and a button is where an interface drifts
   * first.
   */
  'simpan', 'hapus', 'tutup', 'batal', 'batalkan', 'selesai', 'kirim', 'cari',
  'tambah', 'ubah', 'lihat', 'kembali', 'lanjut', 'lanjutkan', 'pilih',
  'masuk', 'keluar', 'unduh', 'unggah', 'cetak', 'buka', 'perubahan',
  'pengaturan', 'beranda', 'ringkasan', 'rincian',
])

const BANNED = [
  {
    pattern: /\bverified\b/i,
    message: 'attendance is `claimed` or `admin-confirmed`, never `verified` (AC-9)',
  },
]

/*
 * Interface strings live in the app and component trees, and also in
 * src/report and src/services — the generation gates, the pack model and
 * the workbook service all produce prose that reaches the client DOM, and
 * scanning only app and components left them unchecked. src/contract holds
 * example records and src/rules holds ids and area slugs: those are data,
 * and AC-5 exempts data values. The `verified` ban is not scoped this way: it is
 * about what attendance is called anywhere in the code.
 */
const uiFiles = globSync('src/{app,components,report,services}/**/*.{ts,tsx}')
const allFiles = globSync('src/**/*.{ts,tsx}')
const problems: string[] = []

for (const file of allFiles) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => {
    if (line.includes('i18n-allow:')) return
    const where = `${file}:${index + 1}`

    for (const banned of BANNED) {
      if (banned.pattern.test(line)) problems.push(`${where}  ${banned.message}\n    ${line.trim()}`)
    }

    if (!uiFiles.includes(file)) return

    const found = new Set(
      (line.toLowerCase().match(/[a-z]+/g) ?? []).filter(
        (word) => !ALLOWED.has(word) && INDONESIAN.has(word),
      ),
    )
    for (const word of found) {
      problems.push(`${where}  Indonesian in an interface string: "${word}"\n    ${line.trim()}`)
    }
  })
}

if (problems.length > 0) {
  console.error(`${problems.length} problem(s):\n`)
  for (const problem of problems) console.error(`  ${problem}\n`)
  process.exit(1)
}
console.log(`i18n OK — ${uiFiles.length} interface files, ${allFiles.length} scanned for banned terms`)
