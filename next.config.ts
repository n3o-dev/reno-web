import type { NextConfig } from 'next'

const config: NextConfig = {
  // unauthorized() needs this: a revoked client link must answer 401, not 404.
  experimental: { authInterrupts: true },
  typedRoutes: true,
  // The dashboard reads fixtures from disk until the ingest endpoint exists.
  outputFileTracingIncludes: { '/**': ['./fixtures/**'] },
}

export default config
