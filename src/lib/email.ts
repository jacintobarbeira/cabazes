import { appendFile, mkdir } from "node:fs/promises"
import path from "node:path"
import nodemailer from "nodemailer"
import { decryptSecret } from "@/lib/secret-box"

export type EmailTransport = "smtp" | "sink" | "disabled"

/** A farmer's SMTP settings, with secrets already decrypted. */
export type FarmerEmailSettings = {
  configId: string
  updatedAt: Date
  host: string
  port: number
  secure: boolean
  username?: string
  password?: string
  from: string
}

export class EmailNotConfiguredError extends Error {
  constructor(farmerId: string) {
    super(`Farmer ${farmerId} has not configured an email server.`)
    this.name = "EmailNotConfiguredError"
  }
}

type OutgoingMessage = {
  from: string
  to: string
  subject: string
  html: string
}

const TRANSPORTS: EmailTransport[] = ["smtp", "sink", "disabled"]

export const DEFAULT_SINK_FILE = ".tmp/emails.jsonl"

const FALLBACK_FROM = "noreply@cabazes.com"

export function getEmailTransport(): EmailTransport {
  const configured = process.env.EMAIL_TRANSPORT?.trim().toLowerCase()

  if (configured) {
    if (!TRANSPORTS.includes(configured as EmailTransport)) {
      throw new Error(
        `Invalid EMAIL_TRANSPORT "${configured}". Expected one of: ${TRANSPORTS.join(", ")}`
      )
    }
    return configured as EmailTransport
  }

  return "smtp"
}

export function getSinkFile(): string {
  return process.env.EMAIL_SINK_FILE?.trim() || DEFAULT_SINK_FILE
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Build a farmer's usable SMTP settings from their stored config row.
 * Returns null when the farmer has not configured an email server.
 * `senderEmail` (profile field) acts as a fallback for the From address.
 */
export function buildEmailSettings(
  farmer: {
    senderEmail: string | null
    emailServerConfig: {
      id: string
      updatedAt: Date
      host: string
      port: number
      secure: boolean
      usernameEnc: string | null
      passwordEnc: string | null
      fromAddress: string | null
      fromName: string | null
    } | null
  }
): FarmerEmailSettings | null {
  const config = farmer.emailServerConfig
  if (!config) return null

  const username = config.usernameEnc ? decryptSecret(config.usernameEnc) : undefined
  const password = config.passwordEnc ? decryptSecret(config.passwordEnc) : undefined

  const address = config.fromAddress || farmer.senderEmail || FALLBACK_FROM
  const name = config.fromName?.trim()
  const from = name ? `"${name.replace(/["\\]/g, "")}" <${address}>` : address

  return {
    configId: config.id,
    updatedAt: config.updatedAt,
    host: config.host,
    port: config.port,
    secure: config.secure,
    username,
    password,
    from,
  }
}

// One transport per farmer config, rebuilt when the config changes.
const transportCache = new Map<string, { updatedAt: Date; transport: nodemailer.Transporter }>()

function getTransportForSettings(settings: FarmerEmailSettings): nodemailer.Transporter {
  const cached = transportCache.get(settings.configId)
  if (cached && cached.updatedAt.getTime() === settings.updatedAt.getTime()) {
    return cached.transport
  }

  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.username || settings.password ? { user: settings.username, pass: settings.password } : undefined,
  })

  transportCache.set(settings.configId, { updatedAt: settings.updatedAt, transport })
  return transport
}

async function writeToSink(message: OutgoingMessage) {
  const file = getSinkFile()
  const dir = path.dirname(path.resolve(file))

  await mkdir(dir, { recursive: true })
  await appendFile(file, `${JSON.stringify(message)}\n`, "utf8")
}

async function deliver(message: OutgoingMessage, settings: FarmerEmailSettings | null) {
  const transport = getEmailTransport()

  // Dev/test transports do not need (and must not require) farmer config.
  if (transport === "disabled") return

  if (transport === "sink") {
    await writeToSink(message)
    return
  }

  if (!settings) {
    throw new EmailNotConfiguredError("unknown")
  }

  await getTransportForSettings(settings).sendMail(message)
}

function resolveFrom(options: { from?: string }, settings: FarmerEmailSettings | null): string {
  // settings.from already falls back to the farmer's profile senderEmail, so
  // the resolved per-farmer config wins; options.from is the legacy fallback
  // used when the farmer has no server config (e.g. sink/disabled transports).
  return settings?.from || options.from || FALLBACK_FROM
}

function sanitizeSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 200)
}

export async function sendOrderLink(options: {
  to: string
  customerName: string
  basketName: string
  link: string
  from?: string
  settings?: FarmerEmailSettings | null
}) {
  const safeCustomerName = escapeHtml(options.customerName)
  const safeBasketName = escapeHtml(options.basketName)
  const safeLink = escapeHtml(options.link)

  await deliver(
    {
      from: resolveFrom(options, options.settings ?? null),
      to: options.to,
      subject: `Your order link for ${sanitizeSubject(options.basketName)}`,
      html: `
        <p>Hello ${safeCustomerName},</p>
        <p>You have been invited to place an order for <strong>${safeBasketName}</strong>.</p>
        <p>Click the link below to view and place your order:</p>
        <p><a href="${safeLink}">${safeLink}</a></p>
      `,
    },
    options.settings ?? null
  )
}

export async function sendDeliveredNotification(options: {
  to: string
  customerName: string
  basketName: string
  from?: string
  settings?: FarmerEmailSettings | null
}) {
  const safeCustomerName = escapeHtml(options.customerName)
  const safeBasketName = escapeHtml(options.basketName)

  await deliver(
    {
      from: resolveFrom(options, options.settings ?? null),
      to: options.to,
      subject: `Your ${sanitizeSubject(options.basketName)} order has been delivered`,
      html: `
        <p>Hello ${safeCustomerName},</p>
        <p>Your order for <strong>${safeBasketName}</strong> has been marked as delivered.</p>
        <p>Thank you for your order!</p>
      `,
    },
    options.settings ?? null
  )
}

export async function sendTestEmail(options: { to: string; settings: FarmerEmailSettings | null }) {
  await deliver(
    {
      from: resolveFrom({}, options.settings),
      to: options.to,
      subject: "Cabazes email server test",
      html: `
        <p>This is a test email from Cabazes.</p>
        <p>If you received it, your email server settings are working.</p>
      `,
    },
    options.settings
  )
}
