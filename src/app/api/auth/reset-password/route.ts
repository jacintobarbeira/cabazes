import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { encode, decode } from "next-auth/jwt"
import { validatePassword } from "@/lib/password-policy"
import { auditLog } from "@/lib/audit"
import { requireSession } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { hashPassword } from "@/lib/passwords"

export const POST = withCsrf(
  async (request: Request): Promise<Response> => {
    const guard = await requireSession()
    if (!guard.ok) return guard.error

    const body = await request.json()
    const { newPassword } = body

    if (!newPassword) {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      )
    }

    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const passwordHash = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id: guard.user.id },
      data: {
        passwordHash,
        mustResetPassword: false,
      },
    })

    auditLog({ event: "PASSWORD_RESET", userId: guard.user.id, email: guard.user.email || "" })

    const response = NextResponse.json({ success: true })

    const cookieRequest = request as Request & { cookies?: { get: (name: string) => { value: string } | undefined } }
    const secureToken = cookieRequest.cookies?.get("__Secure-authjs.session-token")?.value
    const sessionToken = secureToken || cookieRequest.cookies?.get("authjs.session-token")?.value
    const salt = secureToken ? "__Secure-authjs.session-token" : "authjs.session-token"

    if (sessionToken && process.env.NEXTAUTH_SECRET) {
      try {
        const token = await decode({ token: sessionToken, secret: process.env.NEXTAUTH_SECRET, salt })
        if (token) {
          token.mustResetPassword = false
          const newToken = await encode({ token, secret: process.env.NEXTAUTH_SECRET, salt })
          response.cookies.set(salt, newToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: !!secureToken,
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
          })
        }
      } catch (error) {
        console.error("[reset-password] failed to re-sign session token", error)
      }
    }

    return response
  }
)
