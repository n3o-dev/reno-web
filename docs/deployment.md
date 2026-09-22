# Deploying the Reno dashboard

One box, shared with another application. Everything here assumes that and is
deliberately conservative about it.

| | |
|---|---|
| Host | `103.63.24.52`, Ubuntu 20.04, 2 cores, 981 MB RAM + 2 GB swap |
| Address | https://reno.devmgd.com |
| TLS | The Caddy already on the box, shared with the secondbrain app |
| Checkout | `/opt/reno/repo` |
| Compose project | `reno` (separate from `secondbrain-deploy`) |
| Containers | `reno-app-1`, `reno-db-1` |
| Volume | `reno_reno-db` |
| DNS | `devmgd.com` is hosted at cloudhost.id. `reno` is an `A` record to `103.63.24.52`. |

## Why it is shaped this way

**Its own compose project.** Reno and secondbrain share exactly one thing — the Caddy
terminating TLS — and share it through an external network, `reno-proxy`, that Caddy is
attached to. Separate database, separate volumes, separate lifecycle. On a box with 1 GB of
RAM, a bad deploy of one taking the other down is not a theoretical concern.

**Built on the server.** The server is x86_64; the machine this was written on is not.
Every build runs under `--memory=900m` so a build that overruns kills itself rather than the
neighbour.

**Memory limits on both services.** 384 MB for the app, 256 MB for Postgres. Together with
secondbrain's two containers this fits, with swap as the margin.

## First deploy

```bash
git clone https://github.com/n3o-dev/reno-web.git /opt/reno/repo
cd /opt/reno/repo
docker network create reno-proxy          # once; Caddy joins this
```

Write `/opt/reno/repo/deploy/.env` — **not committed, exists only on the server**.
It sits beside the compose file, not at the repository root: Compose reads `.env`
from the compose file's own directory.

```
POSTGRES_PASSWORD=<openssl rand -hex 18>
INGEST_TOKENS=lwas:<openssl rand -hex 20>
```

Write `/opt/reno/repo/deploy/client-tokens.json` — the live client link, also never
committed. `deploy/client-tokens.example.json` is the shape. The file committed at
`fixtures/site/client-tokens.json` is a fixture and must never be the deployed link;
`CLIENT_TOKENS_FILE` in the image points at the mounted file instead.

```bash
docker build --memory=900m --memory-swap=2500m -f deploy/Dockerfile -t reno-web:latest .
docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml exec -T db true   # wait for healthy
```

Migrations and accounts run from the build stage, which still has the toolchain:

```bash
docker build --target build -t reno-tools:latest -f deploy/Dockerfile .   # cached, instant
docker run --rm --network reno_reno -e DATABASE_URL="postgres://reno:$PW@db:5432/reno" \
  reno-tools:latest pnpm db:migrate
docker run --rm --network reno_reno -e DATABASE_URL="postgres://reno:$PW@db:5432/reno" \
  reno-tools:latest pnpm user:add someone@renno.co.id "Their Name"
```

`user:add` prints the password once and runs migrations itself. Running it again on the same
address issues a new password; there is no reset-by-email because there is no mail service.

To put the concept deck's month into the database — a populated dashboard to walk someone
through before the agent emits anything:

```bash
docker run --rm --network reno_reno -e DATABASE_URL="postgres://reno:$PW@db:5432/reno" \
  reno-tools:latest pnpm seed:demo --yes
```

It upserts, so it is safe to repeat, and it seeds records only — no accounts, and no month
confirmation, because the roster gate is a person's signature and seeding one would forge it.
Records the agent later sends under the same `record_id` replace the seeded ones.

Finally attach Caddy and route the hostname:

```bash
docker network connect reno-proxy secondbrain-deploy-caddy-1   # no restart, no downtime
# add the reno.devmgd.com site block to /opt/secondbrain/secondbrain-deploy/Caddyfile
docker compose -f /opt/secondbrain/secondbrain-deploy/docker-compose.yml exec caddy \
  caddy validate --config /etc/caddy/Caddyfile
docker compose -f /opt/secondbrain/secondbrain-deploy/docker-compose.yml exec caddy \
  caddy reload --config /etc/caddy/Caddyfile
```

Validate before reloading. A reload is atomic and does not drop connections; a restart would
take secondbrain down with it.

**Never edit a bind-mounted file with `sed -i`.** `sed -i` writes a new file and renames it
over the old one, which changes the inode. A Docker bind mount of a single *file* binds the
inode, so the container keeps seeing the old content: the host file and
`/etc/caddy/Caddyfile` silently diverge, `caddy reload` reports `config is unchanged`, and
the running proxy keeps a config nobody can see in the repository. Edit in place — `cp`
over it, or a `python write_text` — or restart the container to re-bind. To recover without
a restart: `docker cp` the correct file to a writable path inside the container and
`caddy reload --config <that path> --adapter caddyfile`, which applies it with no downtime.

**Never route to a bare service name from a Caddy that sits on more than one compose
network.** A compose service name is a DNS alias on every network the container joins, so
two projects that both call a service `web` make `web` ambiguous for that proxy — and the
neighbour's site block starts serving the wrong app on the neighbour's hostname, with no
error anywhere. Reno's service is called `app` so the collision cannot arise, and the site
block names the container, `reno-app-1`. When checking afterwards, compare the page, not the
status code: both apps answer a signed-out request with a redirect, so the status codes are
identical when it is broken.

## Updating

```bash
cd /opt/reno/repo && git pull
docker build --memory=900m --memory-swap=2500m -f deploy/Dockerfile -t reno-web:latest .
docker compose -f deploy/docker-compose.yml up -d app
docker run --rm --network reno_reno -e DATABASE_URL=... reno-tools:latest pnpm db:migrate
```

Migrations are forward-only and idempotent; running them twice is a no-op.

A rebuild re-runs `next build`, which takes roughly ten minutes on this box and saturates
both cores. Do it when nobody is depending on secondbrain being fast.

## Rotating a credential

| Credential | How |
|---|---|
| Client link | Set `revoked: true` on the old entry in `deploy/client-tokens.json`, add a new one, `docker compose up -d app`. The old link stops working immediately. |
| Agent token | Change `INGEST_TOKENS` in `.env`, `docker compose up -d app`, tell the agent team. |
| A person's password | `pnpm user:add <their email> "<their name>"` again. |
| Database password | Change it in Postgres and in `.env` together, then recreate both services. |

## Backup

The whole state is one volume, `reno_reno-db`. Everything else is rebuildable from the
repository.

```bash
docker run --rm -v reno_reno-db:/data -v /root/backups:/out alpine \
  tar czf /out/reno-db-$(date +%F).tar.gz -C /data .
```

Records are re-sendable by the agent, so the irreplaceable rows are the accounts, the month
confirmations and the slot corrections — small, but the ones with a person's name on them.

## DNS

`devmgd.com` is registered **and** DNS-hosted at idcloudhost.com — nameservers
`bromo.cloudhost.id` and `rinjani.cloudhost.id`. A new subdomain is one `A` record to
`103.63.24.52` in that panel, and nothing on the server can add it.

If a name has to be served before its record exists, put it on `sslip.io`:
`<label>.103.63.24.52.sslip.io` resolves to that IP for anyone, so Let's Encrypt validates
it and Caddy issues a normal certificate with no zone access at all. Remove the name again
once the real record is live. Caddy backs off after repeated NXDOMAIN failures and drops to
the staging endpoint, so after adding the record, reload rather than waiting it out.

## Health

```bash
docker compose -f deploy/docker-compose.yml ps        # both should read (healthy)
docker compose -f deploy/docker-compose.yml logs -n 50 web
curl -sS -o /dev/null -w '%{http_code}\n' https://reno.devmgd.com/login
```

The app's own healthcheck fetches `/login` every 30 s. A container that is `unhealthy` but
running is usually the database being unreachable; the app answers `503` rather than showing
a wrong figure.
