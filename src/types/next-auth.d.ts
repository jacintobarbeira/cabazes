import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      timezone: string
      mustResetPassword: boolean
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    timezone: string
    mustResetPassword: boolean
    passwordChangedAt?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
    timezone?: string
    mustResetPassword?: boolean
    passwordChangedAt?: number
  }
}
