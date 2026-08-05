import { NextResponse } from "next/server"

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")

  if (origin) {
    return origin === new URL(request.url).origin
  }

  if (referer) {
    return new URL(referer).origin === new URL(request.url).origin
  }

  return true
}

export function csrfCheck(request: Request): NextResponse | null {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  }
  return null
}
