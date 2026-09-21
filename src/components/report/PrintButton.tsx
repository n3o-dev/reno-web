'use client'

/**
 * Saves the report as a PDF, through the browser's own print dialogue.
 *
 * No server-side renderer: generating a PDF here would mean shipping
 * Chromium to the VPS for a button pressed once a month, and the browser
 * already does it in one step. Hidden when printing, for obvious reasons.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print min-h-11 shrink-0 rounded-[var(--radius-control)] bg-ink px-4 text-[14px] text-surface"
    >
      Save as PDF
    </button>
  )
}
