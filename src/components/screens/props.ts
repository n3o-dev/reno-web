/**
 * Every screen is rendered by two surfaces: Reno signed in, and a client
 * holding a tokenized link. The token is scoped to one site, so the client
 * surface passes that site down and the screen narrows its records to it.
 * Reno passes nothing and sees everything.
 */
export interface ScreenProps {
  readonly siteId?: string
}
