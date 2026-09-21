import type { PersonRecord } from '@/contract/schemas'

interface PersonTableProps {
  readonly people: readonly PersonRecord[]
}

const ROLE_LABEL: Record<string, string> = {
  operational_manager: 'Operational Manager',
  project_coordinator: 'Project Coordinator',
  pimpro: 'Pimpro',
  team_leader: 'Team leader',
  cleaner: 'Cleaner',
  admin: 'Admin',
  client_pic: 'Client PIC',
}

export function PersonTable({ people }: PersonTableProps) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">The personnel master</caption>
      <thead>
        <tr className="text-[13px] tracking-[0.04em] text-faint">
          <th scope="col" className="px-0 py-2 font-normal">Name</th>
          <th scope="col" className="px-3 py-2 font-normal">Role</th>
          <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell">Area</th>
          <th scope="col" className="px-0 py-2 font-normal">Also written</th>
        </tr>
      </thead>
      <tbody>
        {people.map((person) => (
          <tr key={person.record_id} className="border-t border-line text-[14px]">
            <th scope="row" className="px-0 py-2 font-normal">
              {person.canonical_name}
            </th>
            <td className="px-3 py-2 text-muted">{ROLE_LABEL[person.role] ?? person.role}</td>
            <td className="hidden px-3 py-2 text-muted sm:table-cell">
              {person.area_default ?? '—'}
            </td>
            <td data-value={`personnel.aliases.${person.person_id}`} className="px-0 py-2">
              {person.aliases.length === 0 ? (
                <span className="text-faint">—</span>
              ) : (
                person.aliases.join(', ')
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
