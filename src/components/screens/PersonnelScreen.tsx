import type { ScreenProps } from '@/components/screens/props'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/styled/Card'
import { getRecords } from '@/services/records'
import { PersonTable } from '@/components/screens/parts/PersonTable'

export async function PersonnelScreen({ siteId }: ScreenProps) {
  const records = await getRecords(siteId)
  const people = [...records.people].sort((a, b) =>
    a.canonical_name.localeCompare(b.canonical_name),
  )
  const withAliases = people.filter((p) => p.aliases.length > 0)

  return (
    <>
      <ScreenHeader
        title="Personnel"
        question="People, aliases, and contracted slots per area per shift"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="On the master"
          info="Everyone the agent has seen named in the group, resolved to one record each. A person appears here once however many ways their name is spelled."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <span data-figure="personnel.people">{people.length}</span>
          </p>
        </Card>
        <Card
          title="Aliases resolved"
          info="Two spellings a person has confirmed are the same human being — Damme and Dame, for instance. Until one is confirmed the roster counts them twice and the billing figure is wrong, which is why the monthly pack refuses to generate with any left undecided."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <span data-figure="personnel.aliases">{withAliases.length}</span>
          </p>
        </Card>
        <Card
          title="Contracted slots"
          info="Headcount per area per shift, from the service contract. Nothing has loaded it yet, so Manpower is running on figures derived from the roster and says so."
        >
          <p className="font-[family-name:var(--font-display)] text-[20px] leading-[1.2] text-muted">
            Not loaded
          </p>
        </Card>
      </div>
      <section className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-[17px]">Everyone</h2>
        <PersonTable people={people} />
      </section>
    </>
  )
}
