import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireFarmer } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { decryptSecret, encryptSecret } from "@/lib/secret-box"
import { EMAIL_REGEX } from "@/lib/customer-creation"
import type { EmailServerSettingsDTO } from "@/types/api"

const HOST_REGEX = /^[A-Za-z0-9.\-_]+$/

function validationError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

function toSafeDTO(config: {
  host: string
  port: number
  secure: boolean
  usernameEnc: string | null
  passwordEnc: string | null
  fromAddress: string | null
  fromName: string | null
}): EmailServerSettingsDTO {
  return {
    configured: true,
    host: config.host,
    port: config.port,
    secure: config.secure,
    username: config.usernameEnc ? decryptSecret(config.usernameEnc) : null,
    hasPassword: !!config.passwordEnc,
    fromAddress: config.fromAddress,
    fromName: config.fromName,
  }
}

const NOT_CONFIGURED: EmailServerSettingsDTO = {
  configured: false,
  host: "",
  port: 587,
  secure: false,
  username: null,
  hasPassword: false,
  fromAddress: null,
  fromName: null,
}

export async function GET() {
  const guard = await requireFarmer()
  if (!guard.ok) return guard.error

  const config = await prisma.emailServerConfig.findUnique({
    where: { farmerId: guard.user.id },
  })

  if (!config) {
    return NextResponse.json(NOT_CONFIGURED)
  }

  try {
    return NextResponse.json(toSafeDTO(config))
  } catch {
    return NextResponse.json(
      { error: "Stored credentials could not be decrypted. The server encryption key may have changed." },
      { status: 500 }
    )
  }
}

export const PATCH = withCsrf(async (request: Request): Promise<Response> => {
  const guard = await requireFarmer()
  if (!guard.ok) return guard.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return validationError("Invalid request body")
  }

  const existing = await prisma.emailServerConfig.findUnique({
    where: { farmerId: guard.user.id },
  })

  // PATCH semantics: undefined keeps the stored value, null/"" clears it,
  // a string sets a new one. host is required on first save; port/secure
  // default to 587/false.
  const host = body.host === undefined ? existing?.host : body.host
  const port = body.port === undefined ? existing?.port ?? 587 : body.port
  const secure = body.secure === undefined ? existing?.secure : body.secure
  const username = body.username === undefined ? null : body.username === null ? "" : String(body.username)
  const password = body.password === undefined ? null : body.password === null ? "" : String(body.password)
  const keepUsername = body.username === undefined
  const keepPassword = body.password === undefined
  const fromAddress = body.fromAddress === undefined ? existing?.fromAddress : body.fromAddress === null ? null : String(body.fromAddress)
  const fromName = body.fromName === undefined ? existing?.fromName : body.fromName === null ? null : String(body.fromName)

  if (typeof host !== "string" || host.trim() === "") {
    return validationError("SMTP host is required")
  }
  const trimmedHost = host.trim()
  if (trimmedHost.length > 255 || !HOST_REGEX.test(trimmedHost)) {
    return validationError("SMTP host is invalid")
  }

  const portNumber = Number(port)
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    return validationError("Port must be a number between 1 and 65535")
  }

  if (secure !== undefined && typeof secure !== "boolean") {
    return validationError("secure must be a boolean")
  }

  if (!keepUsername && username !== null && username.length > 255) {
    return validationError("Username is too long")
  }
  if (!keepPassword && password !== null && password.length > 1024) {
    return validationError("Password is too long")
  }

  if (fromAddress !== undefined && fromAddress !== null) {
    if (fromAddress.length > 255 || !EMAIL_REGEX.test(fromAddress)) {
      return validationError("Sender email address is invalid")
    }
  }
  if (fromName !== undefined && fromName !== null) {
    if (fromName.length > 100) {
      return validationError("Sender name is too long")
    }
  }

  let usernameEnc: string | null = keepUsername ? existing?.usernameEnc ?? null : null
  let passwordEnc: string | null = keepPassword ? existing?.passwordEnc ?? null : null
  try {
    if (!keepUsername && typeof username === "string" && username !== "") {
      usernameEnc = encryptSecret(username)
    }
    if (!keepPassword && typeof password === "string" && password !== "") {
      passwordEnc = encryptSecret(password)
    }
  } catch {
    return NextResponse.json(
      { error: "Server encryption key is missing or invalid. Contact the administrator." },
      { status: 500 }
    )
  }

  const config = await prisma.emailServerConfig.upsert({
    where: { farmerId: guard.user.id },
    create: {
      farmerId: guard.user.id,
      host: trimmedHost,
      port: portNumber,
      secure: secure ?? false,
      usernameEnc,
      passwordEnc,
      fromAddress: fromAddress ?? null,
      fromName: fromName ?? null,
    },
    update: {
      host: trimmedHost,
      port: portNumber,
      secure: secure ?? false,
      usernameEnc,
      passwordEnc,
      fromAddress: fromAddress ?? null,
      fromName: fromName ?? null,
    },
  })

  return NextResponse.json(toSafeDTO(config))
})

export const DELETE = withCsrf(async (): Promise<Response> => {
  const guard = await requireFarmer()
  if (!guard.ok) return guard.error

  await prisma.emailServerConfig.deleteMany({ where: { farmerId: guard.user.id } })

  return NextResponse.json(NOT_CONFIGURED)
})
