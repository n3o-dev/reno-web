import { readWorkbook } from '../../src/rkb/read'

async function main(): Promise<void> {
  const b = await readWorkbook('fixtures/rkb/RKB_JULI_2026.xlsx')
  for (const s of b.sheets) {
    console.log(
      JSON.stringify(s.name),
      'layout', s.layout.id,
      'blocks', s.blocks.length,
      'rows', s.blocks.flatMap((x) => x.rows).length,
    )
    console.log('   names:', s.blocks.map((x) => x.name).join(' | '))
  }
  const u = b.sheets.find((s) => s.name.includes('UTILITY'))
  console.log('\nUtility rows:', u?.blocks.flatMap((x) => x.rows).slice(0, 4).map((r) => `${r.no}:${r.location}/${r.job}`))
  const k = b.sheets.find((s) => s.name.includes('Koridor'))
  console.log('Koridor blocks:', k?.blocks.map((x) => `${x.name}(${x.rows.length})`).join(' | '))
}
void main()
