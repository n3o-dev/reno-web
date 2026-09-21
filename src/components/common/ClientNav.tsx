'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface ClientNavProps {
  readonly token: string
}

/**
 * The client's own navigation, built from its own list rather than by
 * filtering the Reno one. A filter that failed open would put an internal
 * screen in front of a client; a separate list cannot.
 */
const ITEMS = [
  { path: '', label: 'Today' },
  { path: '/complaints', label: 'Complaints' },
  { path: '/work-orders', label: 'Work Orders' },
  { path: '/rkb', label: 'RKB' },
  { path: '/manpower', label: 'Manpower' },
  { path: '/report', label: 'Report' },
] as const

export function ClientNav({ token }: ClientNavProps) {
  const pathname = usePathname()
  const base = `/c/${token}`
  return (
    <nav aria-label="Screens" className="flex gap-1 overflow-x-auto px-4 py-2">
      {ITEMS.map((item) => {
        const href = `${base}${item.path}`
        const active = pathname === href
        return (
          <Link
            key={item.label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex min-h-11 shrink-0 items-center rounded-[var(--radius-control)] px-3 text-[14px] whitespace-nowrap',
              active ? 'bg-cream text-ink' : 'text-muted hover:bg-plane',
            ].join(' ')}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
