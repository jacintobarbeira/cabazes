import { prisma } from "@/lib/db"
import { toUserDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(customers.map(toUserDTO))
}
