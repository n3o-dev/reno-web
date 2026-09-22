interface ChartTableProps {
  readonly caption: string
  readonly headers: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

/**
 * The same numbers as the chart above it, as a table, behind a disclosure.
 *
 * Required of every chart (AC-11): colour is an encoding some people cannot
 * read and no screen reader can, and a table is the one view that always
 * works. Closed by default so it costs a sighted reader nothing.
 */
export function ChartTable({ caption, headers, rows }: ChartTableProps) {
  return (
    <details className="mt-3 border-t border-line pt-2">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-[13px] text-muted">
        Table view
      </summary>
      <table className="mt-2 w-full border-collapse text-left text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-faint">
            {headers.map((header) => (
              <th key={header} scope="col" className="px-2 py-1 font-normal first:pl-0">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('|')} className="border-t border-line">
              {row.map((cell, i) => (
                // The cell's own column header is the stable part of its identity.
                <td key={`${row.join('|')}-${headers[i] ?? i}`} className="px-2 py-1 tabular-nums first:pl-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
