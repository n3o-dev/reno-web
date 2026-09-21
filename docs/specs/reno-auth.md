# reno-auth

## Goal
Put a sign-in in front of the Reno surface. Right now `/manpower`, `/report-quality`,
`/personnel` and the anti-fraud queue are open to anyone who can reach the host — fine on a
laptop, not fine on a VPS. Each person signs in as themselves, because the override chain
already claims to record who corrected a figure.

Depends on [ingest-endpoint](./ingest-endpoint.md) for the database. Unblocks the
roster-confirmation gate in [monthly-report-pack](./monthly-report-pack.md), which is the
first thing in this system a person writes.

## Non-goals
- **Self-service signup.** Reno is a fixed team. Accounts are created by a command, not by a form.
- **Password reset by email.** No mail service exists. A forgotten password is reset by the same command that creates accounts.
- **Roles and permissions.** Everyone signed in sees the whole Reno surface. The only distinction the system makes is Reno versus client, and the client uses a token, not an account.
- **Touching the client link.** `/c/<token>` keeps working exactly as it does. It is a different door with a different key, and nothing here changes it.
- **Protecting the ingest endpoint with sessions.** The agent holds a bearer token. A machine caller does not log in.
- **Remembering the device, 2FA, or an SSO path.** Later, if the deployment ever leaves one site.

## Decisions

**Passwords are hashed with `scrypt` from `node:crypto`.** It is memory-hard, it is in the
standard library, and the alternative is a native dependency that has to compile on the VPS.

**Sessions live in Postgres, and the cookie carries only an opaque id.** A signed stateless
cookie cannot be revoked; a row can be deleted the moment someone leaves.

**Two checks, not one.** Middleware rejects a request with no session cookie before it reaches
a page — cheap, and no database round trip. The dashboard layout then looks the session up and
confirms it is live, which is what makes revocation immediate. Middleware alone would let a
deleted session keep working until it expired.

**No open mode.** There is no configuration in which the Reno surface serves without a session,
because the failure that produces is exactly the one this spec exists to fix: a deployment that
forgot an environment variable and is wide open. Tests sign in like anyone else.

## Acceptance criteria

- **AC-1**: Every Reno screen redirects to `/login` when signed out. `pnpm test:e2e -- auth` walks all nine screens with no cookie and asserts a redirect to `/login` carrying the original path.
- **AC-2**: Signing in with a correct email and password lands on the screen originally asked for, not the home page. A test requests `/manpower` signed out, signs in, and asserts it arrives at `/manpower`.
- **AC-3**: A wrong password and an unknown email are refused identically. A test asserts both produce the same message, the same status and no hint about which part was wrong.
- **AC-4**: Passwords are never stored or logged in the clear. A test creates an account and asserts the stored value is neither the password nor its plain hash, that verification succeeds against it, and that no log line contains the password.
- **AC-5**: The session cookie is `httpOnly`, `SameSite=Lax`, `Secure` outside development, and carries an opaque id rather than a name, an email or a role. Asserted on the `Set-Cookie` header.
- **AC-6**: Deleting a session signs that person out immediately, on the next request, without waiting for expiry. A test signs in, deletes the row, and asserts the next request redirects to `/login`.
- **AC-7**: A forged or expired session id is refused. Tests assert a random id and a session past its expiry both redirect to `/login`.
- **AC-8**: Signing out clears the cookie and deletes the session row. A test asserts the cookie is expired in the response and the row is gone.
- **AC-9**: Repeated failed attempts on one account are slowed. A test asserts the sixth consecutive failure within the window is refused with a stated wait, and that a correct password still works after the window.
- **AC-10**: The client link is untouched. `pnpm test:e2e -- client-link` passes unchanged, and a test asserts `/c/<token>` serves without any session cookie.
- **AC-11**: The ingest endpoint is untouched. `pnpm test:ingest` passes unchanged, and a test asserts `POST /api/records` with a valid bearer token and no session cookie still stores records.
- **AC-12**: Accounts are created and reset by command. `pnpm user:add <email>` creates an account and prints nothing secret to stdout that is not the generated password itself; running it twice on the same email updates the password rather than creating a duplicate.
- **AC-13**: Server code can name the person who made a request, ready for the first write path to record. A test signs in, resolves the session the way a route handler would, and asserts it yields that person rather than a constant. *(Amended: the original wording said "who an override records", but overrides are read from a file and nothing writes one yet. Attaching the author to an override lands with the write path in [monthly-report-pack](./monthly-report-pack.md); what auth owes is the identity, and that is what this checks.)*

## Verification
```
pnpm typecheck
pnpm lint
pnpm test
pnpm test:ingest
pnpm test:e2e
pnpm build
```
