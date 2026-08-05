import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./lib/db"
import { checkLockout, recordFailedAttempt, resetLockout } from "@/lib/lockout"
import { isRateLimited, recordRateLimitAttempt } from "@/lib/rate-limiter"
import { auditLog } from "@/lib/audit"

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
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

        const rateCheck = isRateLimited(`login:${email}`)
        if (!rateCheck.allowed) {
          auditLog({ event: "LOGIN_RATE_LIMITED", email, retryAfter: rateCheck.retryAfter || 0 })
          return null
        }

        const { locked, retryAfter } = checkLockout(email)
        if (locked) {
          auditLog({ event: "LOGIN_LOCKED", email, retryAfter: retryAfter || 0 })
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.passwordHash) {
          recordFailedAttempt(email)
          recordRateLimitAttempt(`login:${email}`)
          auditLog({ event: "LOGIN_FAILED", email, reason: "user_not_found" })
          return null
        }

        if (user.disabled) {
          recordFailedAttempt(email)
          recordRateLimitAttempt(`login:${email}`)
          auditLog({ event: "LOGIN_FAILED", email, reason: "account_disabled" })
          return null
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash)
        if (!isMatch) {
          recordFailedAttempt(email)
          recordRateLimitAttempt(`login:${email}`)
          auditLog({ event: "LOGIN_FAILED", email, reason: "invalid_password" })
          return null
        }

        resetLockout(email)
        auditLog({ event: "LOGIN_SUCCESS", email, userId: user.id })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          timezone: user.timezone,
          mustResetPassword: user.mustResetPassword,
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
      }
      if (trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, mustResetPassword: true },
        })
        if (dbUser) {
          token.name = dbUser.name
          token.mustResetPassword = dbUser.mustResetPassword
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        let active = false
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { disabled: true },
          })
          active = !!dbUser && !dbUser.disabled
        } catch {
          active = false
        }

        if (!active) {
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
