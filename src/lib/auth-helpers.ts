import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function getEffectiveFarmerId(): Promise<string | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  if (session.user.role === "FARMER") return session.user.id
  if (session.user.role === "FARMER_HELPER") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { managedById: true },
    })
    return user?.managedById ?? null
  }
  return null
}

export async function isFarmerOrHelper(): Promise<boolean> {
  const session = await auth()
  if (!session?.user?.id) return false
  return ["FARMER", "FARMER_HELPER"].includes(session.user.role)
}
