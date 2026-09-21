import type { NextConfig } from 'next'

const config: NextConfig = {
  typedRoutes: true,
  // The dashboard reads fixtures from disk until the ingest endpoint exists.
  outputFileTracingIncludes: { '/**': ['./fixtures/**'] },
}

export default config
