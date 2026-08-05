import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user?.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const totalFarmers = await prisma.user.count({ where: { role: "FARMER" } })
  const totalHelpers = await prisma.user.count({ where: { role: "FARMER_HELPER" } })
  const totalCustomers = await prisma.user.count({ where: { role: "CUSTOMER" } })

  return NextResponse.json({ totalFarmers, totalHelpers, totalCustomers })
}
