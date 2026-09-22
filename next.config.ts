import type { NextConfig } from 'next'

const config: NextConfig = {
  // A self-contained server bundle: the runtime image copies this and
  // nothing else, so the box that runs it never holds node_modules.
  output: 'standalone',
  // PGlite is WASM and must not be bundled.
  serverExternalPackages: ['@electric-sql/pglite'],
  // unauthorized() needs this: a revoked client link must answer 401, not 404.
  experimental: { authInterrupts: true },
  typedRoutes: true,
  // The dashboard reads fixtures from disk until the ingest endpoint exists.
  outputFileTracingIncludes: { '/**': ['./fixtures/**'] },
}

export default config
