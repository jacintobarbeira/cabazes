import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/auth-helpers"
import { NextResponse } from "next/server"

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.error

  const totalFarmers = await prisma.user.count({ where: { role: "FARMER" } })
  const totalHelpers = await prisma.user.count({ where: { role: "FARMER_HELPER" } })
  const totalCustomers = await prisma.user.count({ where: { role: "CUSTOMER" } })

  return NextResponse.json({ totalFarmers, totalHelpers, totalCustomers })
}
