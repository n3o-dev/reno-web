# Reno dashboard

Turns the Living World Alam Sutera WhatsApp group into the four things Reno
(PT Indo Cipta Daya) has to produce anyway: the RKB realisation, the monthly client report,
the manpower figure that reaches the invoice, and the Rapor Pimpro.

**Every number clicks through to the message that produced it.** A figure the system cannot
evidence is not shown as zero — it is shown as unknown, and the monthly report refuses to
generate rather than producing a pack that is quietly wrong.

An agent reads the group and pushes records here. That agent is a separate system; this
repository is the dashboard only.

Live at **https://reno.devmgd.com**.

## Where to start

| You are | Read |
|---|---|
| A person using the dashboard | [docs/user-guide.md](docs/user-guide.md) |
| Building the agent that feeds it | [docs/agent-contract.md](docs/agent-contract.md) |
| Deploying or operating it | [docs/deployment.md](docs/deployment.md) |
| Learning the domain language | [CONTEXT.md](CONTEXT.md) |
| Wondering why something is the way it is | [docs/adr/](docs/adr/) |

## Developing

```bash
pnpm install
pnpm dev            # http://localhost:3000, reading fixtures/agent
```

With no `DATABASE_URL` the app reads the committed fixture set, so it runs with no services
at all. Set `DATABASE_URL` to a Postgres URL — or a `pglite://` path for Postgres-in-WASM —
and it reads that instead, with no screen changing.

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # oxlint (not ESLint: eslint-config-next pulls typescript-eslint,
                    # which throws on TypeScript 7)
pnpm test           # vitest
pnpm test:e2e       # playwright
pnpm schema:emit    # regenerate contract/*.schema.json and the agent document
pnpm contract:check <file>   # validate an agent payload against the real schemas
pnpm seed:demo --yes         # load the fixture month into DATABASE_URL
```

## Shape

```
src/contract/    the ten record types, as Zod schemas; everything else reads through them
src/rules/       pure functions: causes, coverage, quality, scoring. No I/O.
src/services/    the I/O edge: Postgres, sessions, tokens, the RKB workbook
src/report/      the monthly pack and the three gates that must pass before it generates
src/app/         Next.js App Router — (dashboard) for Reno, c/[token] for the client
fixtures/        a full month of records, so everything is testable without the agent
```

The rules layer never learns where records came from: `RecordSource` is satisfied by the
fixture reader and by Postgres, and a contract test runs the same assertions against both.
