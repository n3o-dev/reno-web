import { Card } from '@/components/styled/Card'
import { ChartTable } from '@/components/common/ChartTable'
import { Figure } from '@/components/common/Figure'
import type { CauseSplit as Split } from '@/rules/causes'
import type { FigureEvidence } from '@/services/evidence'

interface CauseSplitProps {
  readonly split: Split
  readonly evidence: Readonly<Record<string, FigureEvidence>>
}

const LABEL: Record<string, string> = {
  hk_standard: 'Housekeeping standard',
  tenant_project_event: 'Tenant project or event',
  engineering_equipment: 'Engineering or equipment',
  spill: 'Spill',
  external_other: 'External, other',
}

/*
 * Unordered categories, so the categorical palette in its fixed order,
 * never cycled. A sixth cause would fold into "Other" — there are five.
 * These hues leave the brand deliberately: the four brand colours measure
 * chroma 0.031–0.053 against a 0.1 floor, so none of them can lead a
 * categorical set (DESIGN.md).
 */
const HUE = [
  'var(--color-cat-1)',
  'var(--color-cat-2)',
  'var(--color-cat-3)',
  'var(--color-cat-4)',
  'var(--color-cat-5)',
]

export function CauseSplit({ split, evidence }: CauseSplitProps) {
  const total = Math.max(1, split.total)

  return (
    <Card
      title="What caused them"
      info="Within Reno's control means housekeeping standard: work that should have been done and was not. Everything else — a tenant fit-out, equipment, a spill, something external — is outside it, and each cause is itemised so the split cannot be hidden behind. Reno's own KPI figures use the gross count including every cause."
    >
      <div className="mb-3 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11.5px] tracking-[0.10em] text-faint uppercase">
            Within Reno&rsquo;s control
          </p>
          <Figure
            name="complaints.cause.within"
            evidence={evidence['within']?.items ?? []}
            total={evidence['within']?.total ?? 0}
            className="font-[family-name:var(--font-display)] text-[32px] leading-[1.05] tabular-nums"
          >
            {split.withinRenoControl}
          </Figure>
        </div>
        <div>
          <p className="text-[11.5px] tracking-[0.10em] text-faint uppercase">Outside it</p>
          <Figure
            name="complaints.cause.outside"
            evidence={evidence['outside']?.items ?? []}
            total={evidence['outside']?.total ?? 0}
            className="font-[family-name:var(--font-display)] text-[32px] leading-[1.05] tabular-nums"
          >
            {split.outsideRenoControl}
          </Figure>
        </div>
      </div>

      {/* 2px surface gap between adjacent segments, per the chart rules. */}
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[var(--radius-bar)]">
        {split.items.map((item, i) => (
          <div
            key={item.cause}
            style={{
              width: `${(item.count / total) * 100}%`,
              background: HUE[i] ?? 'var(--color-faint)',
            }}
          />
        ))}
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {split.items.map((item, i) => (
          <li key={item.cause} className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: HUE[i] ?? 'var(--color-faint)' }}
              />
              {LABEL[item.cause] ?? item.cause}
              {!item.withinRenoControl && <span className="text-faint">· outside</span>}
            </span>
            <Figure
              name={`complaints.cause.${item.cause}`}
              evidence={evidence[item.cause]?.items ?? []}
              total={evidence[item.cause]?.total ?? 0}
              className="tabular-nums"
            >
              {item.count}
            </Figure>
          </li>
        ))}
      </ul>

      <ChartTable
        caption="Complaints by cause"
        headers={['Cause', 'Within Reno’s control', 'Complaints']}
        rows={split.items.map((item) => [
          LABEL[item.cause] ?? item.cause,
          item.withinRenoControl ? 'yes' : 'no',
          String(item.count),
        ])}
      />
    </Card>
  )
}
