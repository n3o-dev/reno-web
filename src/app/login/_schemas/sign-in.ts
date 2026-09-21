import { z } from 'zod'

/** One schema, used by the form and by the route handler. */
export const signInSchema = z.object({
  email: z.email('That does not look like an email address'),
  password: z.string().min(1, 'Enter your password'),
})

export type SignInValues = z.infer<typeof signInSchema>
