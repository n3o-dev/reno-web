'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { apiClient } from '@/lib/axios'
import { signInSchema, type SignInValues } from '../_schemas/sign-in'

interface SignInFormProps {
  /** Where the person was going before they were stopped. */
  readonly next: string
}

export function SignInForm({ next }: SignInFormProps) {
  const [refusal, setRefusal] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setRefusal(null)
    try {
      await apiClient.post('/auth/login', values)
      // A full navigation, not router.replace + refresh: every server
      // component has to re-render with the new cookie, and racing those two
      // client-side calls sometimes left the browser on the sign-in page.
      window.location.assign(next)
    } catch (error) {
      if (isAxiosError(error) && error.response !== undefined) {
        const body: unknown = error.response.data
        const message =
          typeof body === 'object' && body !== null && 'error' in body
            ? String((body as { error: unknown }).error)
            : 'Could not sign in'
        setRefusal(message)
        return
      }
      setRefusal('Could not reach the server')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-[13px] tracking-[0.04em] text-muted">Email</span>
        <input
          {...register('email')}
          type="email"
          autoComplete="username"
          aria-invalid={errors.email !== undefined}
          className="min-h-11 rounded-[var(--radius-control)] border border-line px-3 text-[16px]"
        />
        {errors.email !== undefined && (
          <span className="text-[13px] text-[var(--color-critical)]">{errors.email.message}</span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[13px] tracking-[0.04em] text-muted">Password</span>
        <input
          {...register('password')}
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password !== undefined}
          className="min-h-11 rounded-[var(--radius-control)] border border-line px-3 text-[16px]"
        />
        {errors.password !== undefined && (
          <span className="text-[13px] text-[var(--color-critical)]">
            {errors.password.message}
          </span>
        )}
      </label>

      {refusal !== null && (
        <p role="alert" className="text-[14px] text-[var(--color-critical)]">
          {refusal}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-11 rounded-[var(--radius-control)] bg-ink px-4 text-[14px] text-surface disabled:opacity-60"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
