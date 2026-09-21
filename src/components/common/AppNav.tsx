'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The two screens Reno sees and the client does not are marked `renoOnly`.
 * The client link renders its own navigation from the subset — this component
 * is never mounted there, so a mistake here cannot leak an internal screen.
 */
export interface NavItem {
  readonly href: string
  readonly label: string
  readonly renoOnly?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Today' },
  { href: '/complaints', label: 'Complaints' },
  { href: '/work-orders', label: 'Work Orders' },
  { href: '/rkb', label: 'RKB Realisation' },
  { href: '/manpower', label: 'Manpower & Billing' },
  { href: '/report-quality', label: 'Report Quality', renoOnly: true },
  { href: '/scorecard', label: 'Pimpro Scorecard', renoOnly: true },
  { href: '/report', label: 'Monthly Report' },
  { href: '/personnel', label: 'Personnel', renoOnly: true },
]

export function AppNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Screens" className="flex gap-1 overflow-x-auto px-4 py-2">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={[
              // min-h-11 is 44px: the smallest target a thumb reliably hits (AC-12).
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
