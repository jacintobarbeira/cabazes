import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./lib/db"
import { checkLockout, recordFailedAttempt, resetLockout } from "@/lib/lockout"
import { isRateLimited, recordRateLimitAttempt } from "@/lib/rate-limiter"
import { auditLog } from "@/lib/audit"
import { verifyPassword } from "@/lib/passwords"

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is not set")
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 },
  jwt: { maxAge: 60 * 60 * 24 },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

        const rateCheck = await isRateLimited(`login:${email}`)
        if (!rateCheck.allowed) {
          auditLog({ event: "LOGIN_RATE_LIMITED", email, retryAfter: rateCheck.retryAfter || 0 })
          return null
        }

        const { locked, retryAfter } = await checkLockout(email)
        if (locked) {
          auditLog({ event: "LOGIN_LOCKED", email, retryAfter: retryAfter || 0 })
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.passwordHash) {
          await recordFailedAttempt(email)
          await recordRateLimitAttempt(`login:${email}`)
          auditLog({ event: "LOGIN_FAILED", email, reason: "user_not_found" })
          return null
        }

        if (user.disabled) {
          await recordFailedAttempt(email)
          await recordRateLimitAttempt(`login:${email}`)
          auditLog({ event: "LOGIN_FAILED", email, reason: "account_disabled" })
          return null
        }

        const isMatch = await verifyPassword(password, user.passwordHash)
        if (!isMatch) {
          await recordFailedAttempt(email)
          await recordRateLimitAttempt(`login:${email}`)
          auditLog({ event: "LOGIN_FAILED", email, reason: "invalid_password" })
          return null
        }

        await resetLockout(email)
        auditLog({ event: "LOGIN_SUCCESS", email, userId: user.id })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          timezone: user.timezone,
          mustResetPassword: user.mustResetPassword,
          passwordChangedAt: (user as unknown as { passwordChangedAt?: Date }).passwordChangedAt?.getTime() ?? 0,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.timezone = user.timezone
        token.mustResetPassword = user.mustResetPassword
        token.passwordChangedAt = (user as unknown as { passwordChangedAt?: number }).passwordChangedAt ?? 0
      }
      if (trigger === "update") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dbUser = (await (prisma.user.findUnique as any)({
          where: { id: token.id as string },
          select: { name: true, mustResetPassword: true, passwordChangedAt: true },
        })) as { name: string | null; mustResetPassword: boolean; passwordChangedAt: Date | null } | null
        if (dbUser) {
          token.name = dbUser.name
          token.mustResetPassword = dbUser.mustResetPassword
          const pwdChanged = dbUser.passwordChangedAt
          token.passwordChangedAt = pwdChanged ? pwdChanged.getTime() : 0
          // If password was changed after token was issued, force re-auth by invalidating token
          const iat = (token.iat as number | undefined) ?? 0
          if (pwdChanged && iat * 1000 < pwdChanged.getTime()) {
            // Invalidate by clearing role – session callback will treat as inactive
            token.passwordChangedAt = pwdChanged.getTime()
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        let active = false
        let passwordValid = true
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dbUser = (await (prisma.user.findUnique as any)({
            where: { id: token.id as string },
            select: { disabled: true, passwordChangedAt: true },
          })) as { disabled: boolean; passwordChangedAt: Date | null } | null
          active = !!dbUser && !dbUser.disabled
          const pwdChanged = dbUser?.passwordChangedAt
          if (pwdChanged && token.passwordChangedAt !== undefined) {
            const iat = (token.iat as number | undefined) ?? 0
            if (iat * 1000 < pwdChanged.getTime()) {
              passwordValid = false
            }
          } else if (pwdChanged) {
            const iat = (token.iat as number | undefined) ?? 0
            if (iat * 1000 < pwdChanged.getTime()) passwordValid = false
          }
        } catch {
          active = false
        }

        if (!active || !passwordValid) {
          session.user.id = ""
          session.user.role = ""
          session.user.timezone = ""
          session.user.mustResetPassword = false
          return session
        }

        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.timezone = token.timezone as string
        session.user.mustResetPassword = token.mustResetPassword as boolean
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
