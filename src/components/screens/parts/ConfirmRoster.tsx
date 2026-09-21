'use client'

import { useState } from 'react'
import { isAxiosError } from 'axios'
import { apiClient } from '@/lib/axios'

interface ConfirmRosterProps {
  readonly month: string
}

/**
 * The first thing in this system a person writes.
 *
 * Confirming says the attendance the invoice is built on has been looked at
 * by a human, so the button says what it means rather than "Save".
 */
export function ConfirmRoster({ month }: ConfirmRosterProps) {
  const [state, setState] = useState<'idle' | 'sending' | 'failed'>('idle')

  const confirm = async (): Promise<void> => {
    setState('sending')
    try {
      await apiClient.post('/report/confirm', { month })
      window.location.reload()
    } catch (error) {
      setState('failed')
      if (!isAxiosError(error)) throw error
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <button
        type="button"
        onClick={() => void confirm()}
        disabled={state === 'sending'}
        className="min-h-11 rounded-[var(--radius-control)] bg-ink px-4 text-[14px] text-surface disabled:opacity-60"
      >
        {state === 'sending' ? 'Confirming…' : 'I have checked the roster for this month'}
      </button>
      <p className="mt-2 text-[13px] text-muted">
        Your name is recorded against it. BAPP cannot generate against claimed attendance alone.
      </p>
      {state === 'failed' && (
        <p role="alert" className="mt-2 text-[13px] text-[var(--color-critical)]">
          Could not confirm. Try again.
        </p>
      )}
    </div>
  )
}
