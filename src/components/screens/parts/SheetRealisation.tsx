import Link from 'next/link'
import type { Realisation } from '@/rules/realisation'

export interface SheetSummary {
  readonly name: string
  readonly slug: string
  readonly sections: number
  readonly rows: number
  readonly realisation: Realisation
}

interface SheetRealisationProps {
  readonly sheets: readonly SheetSummary[]
  /** `/rkb` for Reno, `/c/<token>/rkb` for the client link. */
  readonly basePath: string
}

const percent = (value: number | null): string =>
  value === null ? '—' : `${Math.round(value * 100)}%`

export function SheetRealisation({ sheets, basePath }: SheetRealisationProps) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Realisation by sheet</caption>
      <thead>
        <tr className="text-[13px] tracking-[0.04em] text-faint">
          <th scope="col" className="px-0 py-2 font-normal">Sheet</th>
          <th scope="col" className="px-3 py-2 text-right font-normal">Planned</th>
          <th scope="col" className="px-3 py-2 text-right font-normal">Done</th>
          <th scope="col" className="px-0 py-2 text-right font-normal">Realisation</th>
        </tr>
      </thead>
      <tbody>
        {sheets.map((sheet) => (
          <tr key={sheet.slug} className="border-t border-line text-[14px]">
            <th scope="row" className="px-0 py-2 font-normal">
              <Link href={`${basePath}/${sheet.slug}`} className="underline decoration-line hover:decoration-ink">
                {sheet.name.trim()}
              </Link>
              <span className="block text-[13px] text-faint">
                {sheet.rows} job rows in {sheet.sections}{' '}
                {sheet.sections === 1 ? 'section' : 'sections'}
              </span>
            </th>
            <td className="px-3 py-2 text-right tabular-nums">{sheet.realisation.planned}</td>
            <td className="px-3 py-2 text-right tabular-nums">{sheet.realisation.done}</td>
            <td
              data-figure={`rkb.realisation.${sheet.slug}`}
              data-figure-kind="completion"
              className="px-0 py-2 text-right tabular-nums"
            >
              {percent(sheet.realisation.net)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
