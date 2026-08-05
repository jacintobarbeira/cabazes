import { NextResponse } from "next/server"

function trustedOrigins(request: Request): string[] {
  const origins = new Set<string>()

  origins.add(new URL(request.url).origin)

  const forwardedProto = request.headers.get("x-forwarded-proto")
  const forwardedHost = request.headers.get("x-forwarded-host")
  if (forwardedProto && forwardedHost) {
    origins.add(`${forwardedProto}://${forwardedHost}`)
  }

  if (process.env.NEXTAUTH_URL) {
    origins.add(new URL(process.env.NEXTAUTH_URL).origin)
  }

  return [...origins]
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")

  if (origin) {
    return trustedOrigins(request).includes(origin)
  }

  if (referer) {
    return trustedOrigins(request).includes(new URL(referer).origin)
  }

  return true
}

export function csrfCheck(request: Request): NextResponse | null {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  }
  return null
}
