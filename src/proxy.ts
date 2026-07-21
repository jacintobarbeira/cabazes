import { NextResponse, NextRequest } from "next/server"
import { decode } from "next-auth/jwt"

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const isDev = process.env.NODE_ENV === "development"

  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ")

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", cspHeader)

  function applyCSP(response: NextResponse) {
    response.headers.set("Content-Security-Policy", cspHeader)
    return response
  }

  const url = new URL(request.url)
  const pathname = url.pathname

  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1"

  if (!isLocalhost && url.protocol === "http:") {
    return applyCSP(
      NextResponse.redirect(
        new URL(`https://${url.host}${url.pathname}${url.search}`, request.url)
      )
    )
  }

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/api/auth")
  const isResetPasswordRoute = pathname.startsWith("/reset-password")
  const isFarmerRoute = pathname.startsWith("/farmer")
  const isAdminRoute = pathname.startsWith("/admin")
  const isCustomerRoute = pathname.startsWith("/my-orders") || pathname.startsWith("/profile")
  const isPublicOrderRoute = pathname.startsWith("/order/")
  const isPublicOrderApi = pathname === "/api/orders" && request.method === "POST"

  if (isAuthRoute) {
    return applyCSP(NextResponse.next({ request: { headers: requestHeaders } }))
  }

  const sessionToken = request.cookies.get("authjs.session-token")?.value ||
                       request.cookies.get("__Secure-authjs.session-token")?.value

  if (!sessionToken && !isPublicOrderRoute && !isPublicOrderApi && !isResetPasswordRoute) {
    return applyCSP(NextResponse.redirect(new URL("/login", request.url)))
  }

  if (sessionToken) {
    try {
      const payload = await decode({
        token: sessionToken,
        secret: process.env.NEXTAUTH_SECRET || "",
        salt: "authjs.session-token",
      })

      if (!payload && !isPublicOrderRoute && !isPublicOrderApi && !isResetPasswordRoute) {
        return applyCSP(NextResponse.redirect(new URL("/login", request.url)))
      }

      const role = payload?.role as string | undefined
      const mustResetPassword = payload?.mustResetPassword as boolean | undefined

      if (mustResetPassword && !isResetPasswordRoute) {
        return applyCSP(NextResponse.redirect(new URL("/reset-password", request.url)))
      }

      if (isResetPasswordRoute && !mustResetPassword) {
        if (role === "FARMER" || role === "FARMER_HELPER") {
          return applyCSP(NextResponse.redirect(new URL("/farmer/dashboard", request.url)))
        }
        return applyCSP(NextResponse.redirect(new URL("/my-orders", request.url)))
      }

      if (isFarmerRoute && !["FARMER", "FARMER_HELPER"].includes(role || "")) {
        if (role === "ADMINISTRATOR") {
          return applyCSP(NextResponse.redirect(new URL("/admin", request.url)))
        }
        return applyCSP(NextResponse.redirect(new URL("/my-orders", request.url)))
      }

      if (isAdminRoute && role !== "ADMINISTRATOR") {
        return applyCSP(NextResponse.redirect(new URL("/login", request.url)))
      }

      if (isCustomerRoute && role !== "CUSTOMER") {
        if (role === "ADMINISTRATOR") {
          return applyCSP(NextResponse.redirect(new URL("/admin", request.url)))
        }
        return applyCSP(NextResponse.redirect(new URL("/farmer/dashboard", request.url)))
      }
    } catch {
      if (!isPublicOrderRoute && !isPublicOrderApi && !isResetPasswordRoute) {
        return applyCSP(NextResponse.redirect(new URL("/login", request.url)))
      }
    }
  }

  return applyCSP(NextResponse.next({ request: { headers: requestHeaders } }))
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|public/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
