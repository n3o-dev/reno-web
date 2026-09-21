import type { Section } from '@/rkb/read'

interface DayGridProps {
  readonly section: Section
}

/**
 * The workbook's own grid: one row per job, one column pair per day, R planned
 * against A done. JUMLAH, REALISASI and PERSENTASI are recomputed here rather
 * than read out of the file, so a stale total in the spreadsheet shows up as a
 * disagreement instead of being repeated.
 */
export function DayGrid({ section }: DayGridProps) {
  const days = section.rows[0]?.days ?? []
  const planned = section.rows.flatMap((r) => r.days).filter((d) => (d.planned ?? 0) > 0)
  const done = planned.filter((d) => (d.actual ?? 0) > 0)
  const share = planned.length === 0 ? 0 : Math.round((done.length / planned.length) * 100)

  return (
    <section className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-[family-name:var(--font-display)] text-[17px]">{section.name}</h2>
        <p className="text-[13px] text-muted">
          JUMLAH <span className="tabular-nums">{planned.length}</span> · REALISASI{' '}
          <span className="tabular-nums">{done.length}</span> · PERSENTASI{' '}
          <span data-figure-kind="completion" className="tabular-nums">
            {share}%
          </span>
        </p>
      </div>
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="text-faint">
            <th scope="col" className="sticky left-0 bg-surface px-0 py-2 font-normal">
              Job row
            </th>
            {days.map((day) => (
              <th
                key={day.day}
                scope="col"
                className={`px-1 py-2 text-center font-normal tabular-nums ${
                  day.isNonWorkingDay ? 'text-[var(--color-critical)]' : ''
                }`}
              >
                {day.day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row) => (
            <tr key={row.rowNumber} className="border-t border-line">
              <th
                scope="row"
                className="sticky left-0 max-w-[16rem] bg-surface px-0 py-1.5 font-normal"
              >
                <span className="text-faint tabular-nums">{row.no}. </span>
                {row.subject}
                {row.work !== '' && <span className="text-muted"> — {row.work}</span>}
              </th>
              {row.days.map((day) => {
                const isPlanned = (day.planned ?? 0) > 0
                const isDone = (day.actual ?? 0) > 0
                return (
                  <td key={day.day} className="px-1 py-1.5 text-center">
                    <span
                      aria-label={
                        isPlanned ? (isDone ? 'done' : 'planned, not done') : 'not planned'
                      }
                      className="inline-block size-2.5 rounded-[2px]"
                      style={{
                        background: isDone
                          ? 'var(--color-ordinal-3)'
                          : isPlanned
                            ? 'var(--color-ordinal-1)'
                            : 'var(--color-plane)',
                      }}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 flex gap-4 text-[13px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[2px] bg-[var(--color-ordinal-3)]" /> Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[2px] bg-[var(--color-ordinal-1)]" />
          Planned, not done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[2px] bg-plane" /> Not planned
        </span>
      </p>
    </section>
  )
}
