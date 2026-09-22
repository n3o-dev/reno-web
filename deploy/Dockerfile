# syntax=docker/dockerfile:1

# Built on the server, because the server is x86_64 and the machine this was
# written on is not. The server also has 1 GB of RAM and a live application
# on it, so every stage is kept lean and the build is run under a memory cap
# — a build that overruns must kill itself, not the neighbour.

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    PNPM_HOME=/pnpm pnpm install --frozen-lockfile --prefer-offline

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
ENV NEXT_TELEMETRY_DISABLED=1
# Cap the compiler's heap below the container limit so Node throws a
# diagnosable OOM instead of the kernel killing it silently.
ENV NODE_OPTIONS=--max-old-space-size=768
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Never root. The app writes nothing outside /app.
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

# Read at runtime, not bundled: the RKB workbook the realisation screen
# mirrors, and the site's own configuration.
COPY --from=build --chown=nextjs:nodejs /app/fixtures ./fixtures
COPY --from=build --chown=nextjs:nodejs /app/src/db/migrations ./src/db/migrations

# The committed client link is a fixture. The deployed one is mounted here,
# so it never enters the image or the repository.
ENV CLIENT_TOKENS_FILE=/run/secrets/client-tokens.json

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
