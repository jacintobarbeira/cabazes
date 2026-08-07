import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export type SessionUser = {
  id: string
  email?: string | null
  name?: string | null
  role?: string | null
  timezone?: string | null
  mustResetPassword?: boolean
}

export type GuardResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: NextResponse }

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return session.user as SessionUser
}

async function authorize(
  allowedRoles?: string[]
): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const user = await getSessionUser()
  if (!user) return { error: unauthorized() }
  if (allowedRoles && !allowedRoles.includes(user.role || "")) {
    return { error: unauthorized() }
  }
  return { user }
}

export async function getEffectiveFarmerId(): Promise<string | null> {
  const user = await getSessionUser()
  if (!user) return null

  if (user.role === "FARMER") return user.id
  if (user.role === "FARMER_HELPER") {
    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { managedById: true },
    })
    return record?.managedById ?? null
  }
  return null
}

export async function requireSession(): Promise<GuardResult<{ user: SessionUser }>> {
  const result = await authorize()
  if ("error" in result) return { ok: false, error: result.error }
  return { ok: true, user: result.user }
}

export async function requireFarmerOrHelper(): Promise<
  GuardResult<{ user: SessionUser; farmerId: string }>
> {
  const result = await authorize(["FARMER", "FARMER_HELPER"])
  if ("error" in result) return { ok: false, error: result.error }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) return { ok: false, error: unauthorized() }

  return { ok: true, user: result.user, farmerId }
}

export async function requireFarmer(): Promise<GuardResult<{ user: SessionUser }>> {
  const result = await authorize(["FARMER"])
  if ("error" in result) return { ok: false, error: result.error }
  return { ok: true, user: result.user }
}

export async function requireAdmin(): Promise<GuardResult<{ user: SessionUser }>> {
  const result = await authorize(["ADMINISTRATOR"])
  if ("error" in result) return { ok: false, error: result.error }
  return { ok: true, user: result.user }
}

export async function requireCustomer(): Promise<GuardResult<{ user: SessionUser }>> {
  const result = await authorize(["CUSTOMER"])
  if ("error" in result) return { ok: false, error: result.error }
  return { ok: true, user: result.user }
}
