interface CardProps {
  readonly title: string
  /** Rendered behind the info control: what this shows and how it is computed. */
  readonly info: string
  readonly children: React.ReactNode
}

/**
 * Every card carries an info control. The explanation lives behind a click,
 * never printed on the page — a dashboard that explains itself in body copy
 * has stopped being a dashboard.
 *
 * `<details>` rather than a popover: it needs no JavaScript, so the card works
 * in a Server Component and keeps working if hydration never arrives.
 */
export function Card({ title, info, children }: CardProps) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-1">
        <h2 className="font-[family-name:var(--font-display)] text-[17px] leading-[1.3]">
          {title}
        </h2>
        <details className="group relative shrink-0">
          <summary
            aria-label={`What this shows: ${title}`}
            // 44px hit area, small glyph (AC-12).
            className="grid size-11 cursor-pointer place-items-center rounded-full text-faint marker:content-none hover:bg-plane hover:text-muted"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
            </svg>
          </summary>
          <p className="absolute top-10 right-0 z-10 w-64 rounded-[var(--radius-control)] border border-line bg-surface p-3 text-[13px] leading-[1.5] text-muted shadow-sm">
            {info}
          </p>
        </details>
      </div>
      {children}
    </section>
  )
}
