# Email Server Setup (per farmer)

Customer emails (order-link invitations and delivered notifications) are sent
via SMTP through `src/lib/email.ts` (nodemailer). **Each farmer configures
their own email server** in Farmer Settings → Email Server. There are no
global `SMTP_*` environment variables.

## Transports

| `EMAIL_TRANSPORT` | Behaviour                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `smtp`            | Deliver through the **farmers' own** SMTP servers (the default; used in production).       |
| `sink`            | Never send: append every message as a JSON line to `EMAIL_SINK_FILE`. Used by the test suite. |
| `disabled`        | Drop every message.                                                                       |

If `EMAIL_TRANSPORT` is unset the transport is `smtp`. Anything other than the
three values above makes the app throw at send time instead of silently
dropping mail. `sink` and `disabled` do **not** require any farmer config, so
tests keep working without email servers set up.

## Environment variables

| Variable               | Default             | Description                                              |
| ---------------------- | ------------------- | -------------------------------------------------------- |
| `EMAIL_TRANSPORT`      | `smtp`              | `smtp`, `sink` or `disabled`.                             |
| `EMAIL_SINK_FILE`      | `.tmp/emails.jsonl` | Output file used by the `sink` transport.                 |
| `EMAIL_ENCRYPTION_KEY` | _(none — required)_ | 32-byte base64 key that encrypts farmer SMTP credentials at rest. |

## The encryption key

Farmer SMTP usernames and passwords are encrypted before they touch the
database (AES-256-GCM, random IV per write, `v1:<iv>:<tag>:<ciphertext>`
envelope — see `src/lib/secret-box.ts`). The key is a single deployment
secret:

```
openssl rand -base64 32
```

- Set `EMAIL_ENCRYPTION_KEY` **before** deploying; without it, saving an email
  server config fails with a clear error (nothing is ever stored as plaintext).
- It is a dedicated secret — do **not** reuse `NEXTAUTH_SECRET`.
- Rotate with care: stored credentials become unreadable under a different key.
  The `v1:` envelope prefix exists so a re-encryption script can be written
  later.

## Farmer configuration

In Farmer Settings → **Email Server** (visible to farmers only; helpers can
send mail through the farmer's server but cannot view or change credentials):

1. **SMTP host** and **port** — port `587` with TLS unchecked (STARTTLS) is the
   common choice; check "implicit TLS" for port `465`.
2. **Username** and **password** — Gmail/Outlook require an app password. The
   password is write-only: it is never sent back to the browser after saving
   (the UI shows "Saved — leave blank to keep it").
3. Optional **From address** and **sender name**. Precedence: Email Server
   from-address → profile *Sender Email* field → `noreply@cabazes.com`.
4. **Send test email** delivers a test message to the farmer's own account
   through the saved server.
5. **Remove configuration** deletes the stored server.

Until a farmer configures a server:

- Sending order-link emails returns `400 "Email server is not configured..."`.
- Delivered notifications are skipped (logged, order updates still succeed).

## API

- `GET /api/farmer/email-server` — safe settings (host/port/secure/username,
  `hasPassword`; **never** the password).
- `PATCH /api/farmer/email-server` — partial update; omitted `password` keeps
  the stored secret, `password: null`/`""` clears it.
- `DELETE /api/farmer/email-server` — remove the configuration.
- `POST /api/farmer/email-server/test` — send a test email to the farmer.

All endpoints are farmer-only and CSRF-checked (`withCsrf`).

## Emails sent

- **Order-link invitations** — farmer action on POST `/api/baskets/[id]/links/send-email`.
- **Delivered notifications** — when an order is marked delivered (`src/app/api/orders/[id]/route.ts`).

## Test environment

The Playwright `webServer` sets `EMAIL_TRANSPORT=sink`,
`EMAIL_SINK_FILE=.tmp/test-emails.jsonl` and a fixed test-only
`EMAIL_ENCRYPTION_KEY` (`playwright.config.ts`), so no mail ever leaves the
machine and tests can assert on captured messages:

```ts
import { readCapturedEmails, clearCapturedEmails } from "./helpers"

clearCapturedEmails()
// ... trigger an email ...
expect(readCapturedEmails()[0].subject).toContain("Your order link for")
```

`tests/globalSetup.ts` and `tests/globalTeardown.ts` delete the sink file, and
specs that assert on email should call `clearCapturedEmails()` in
`beforeEach`/`afterEach`. See `.env.test.example`.

To exercise the real SMTP path locally, run a mail catcher and point each
farmer's Email Server settings at it with `EMAIL_TRANSPORT=smtp`:

```
docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
# then configure farmers (host: localhost, port: 1025, TLS off, any credentials)
EMAIL_TRANSPORT=smtp EMAIL_ENCRYPTION_KEY=$(openssl rand -base64 32) npm run dev
```

## Production (Fly)

`fly.toml` only sets `EMAIL_TRANSPORT = 'smtp'`. Deploy once with the
encryption key as a secret:

```
flyctl secrets set EMAIL_ENCRYPTION_KEY="$(openssl rand -base64 32)" -a cabazes
flyctl deploy
```

Keep `EMAIL_TRANSPORT=smtp` in production — `sink` and `disabled` silently
discard customer emails. See `.env.production.example` for the per-farmer
provider checklist.

## Gotchas

- Each farmer is responsible for their own provider limits/deliverability.
- Many providers (Gmail, SendGrid free tier) reject or rewrite `From` addresses
  that aren't a verified domain or user — the farmer's verified sender must
  match their Email Server / Sender Email settings.
- Brevo's free tier only sends to verified recipients.
- Delivered notifications fire on status changes; email failures are logged and
  never fail the request. Order-link sends report failures per recipient in the
  send-email response.

## Migration note (clean cut)

The old global `SMTP_*` environment variables were removed. Existing
deployments must delete them (they're ignored now) and each farmer must
configure their own server before customer emails flow again. No credentials
were carried over by design — one shared SMTP key across all farms defeated
the per-farmer model.
