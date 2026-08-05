import { prisma } from "@/lib/db"
import { toCustomerDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const customers = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      OR: [
        { orders: { some: { basket: { farmerId } } } },
        { inviteTokens: { some: { basket: { farmerId } } } },
        { customerFarmers: { some: { farmerId } } },
      ],
    },
    orderBy: { name: "asc" },
  })

  const includePII = session.user.role === "FARMER"

  return NextResponse.json(customers.map((c) => toCustomerDTO(c, { includePII })))
}
