import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./lib/db"
import { checkLockout, recordFailedAttempt, resetLockout } from "@/lib/lockout"
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
          auditLog({ event: "LOGIN_FAILED", email, reason: "user_not_found" })
          return null
        }

        if (user.disabled) {
          recordFailedAttempt(email)
          auditLog({ event: "LOGIN_FAILED", email, reason: "account_disabled" })
          return null
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash)
        if (!isMatch) {
          recordFailedAttempt(email)
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
      if (trigger === "update" && session?.name) {
        token.name = session.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
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
