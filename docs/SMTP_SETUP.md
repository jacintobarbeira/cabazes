# SMTP Email Setup

The app already supports sending email via SMTP through `src/lib/email.ts` (nodemailer). Enabling it is pure configuration — no code changes required.

## Environment variables

| Variable       | Default                     | Description                                            |
| -------------- | --------------------------- | ------------------------------------------------------ |
| `SMTP_HOST`    | _(none)_                    | SMTP server host. Emails are silently skipped when unset. |
| `SMTP_PORT`    | `587`                       | SMTP port.                                             |
| `SMTP_SECURE`  | `false`                     | `true` for implicit TLS (usually port 465), `false` for STARTTLS (usually port 587). |
| `SMTP_USER`    | `""`                        | SMTP username.                                         |
| `SMTP_PASS`    | `""`                        | SMTP password or app password.                         |
| `SMTP_FROM`    | `noreply@cabazes.com`       | Default `From` address for all emails.                 |

## Behavior

- If `SMTP_HOST` is not set, `getTransport()` returns `null` and emails are silently skipped — nothing breaks until you configure it.
- A farmer can set their own `senderEmail` in Farmer Settings; it overrides `SMTP_FROM` for emails sent on their behalf.

## Emails sent

- **Order-link invitations** — triggered by the farmer via POST `/api/baskets/[id]/links/send-email` (the "Send email" action on a basket's links page).
- **Delivered notifications** — triggered when an order is marked delivered (`src/app/api/orders/[id]/route.ts:132`).

## Local development

Add to `.env` (gitignored):

```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=Cabazes <noreply@cabazes.com>
```

Notes:

- Port `587` with `SMTP_SECURE=false` (STARTTLS) is the common choice. Use `SMTP_SECURE=true` with port `465` only for implicit TLS.
- Gmail/Outlook require an app password, not your account password.

## Production (Fly)

Set the variables as Fly secrets so they aren't baked into the image:

```
fly secrets set SMTP_HOST=... SMTP_PORT=... SMTP_USER=... SMTP_PASS=... SMTP_FROM="Cabazes <noreply@cabazes.com>"
```

Then redeploy:

```
fly deploy
```

## Verification

1. Set the farmer's `senderEmail` in Farmer Settings if you want a custom `From`.
2. Create a basket → link a customer → click "Send email" → confirm the invitation arrives.
3. Deliver the order → confirm the "delivered" notification arrives.

## Gotchas

- Many providers (Gmail, SendGrid free tier) reject or rewrite `From` addresses that aren't a verified domain or user — if delivery fails, check the provider's "verified senders" panel.
- Delivered notifications fire when an order's status changes; emails are best-effort and failures are recorded per-recipient in the send-email response, they don't fail the request.
