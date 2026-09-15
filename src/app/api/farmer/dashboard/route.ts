import { prisma } from "@/lib/db"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { toBasketSummaryDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"

export async function GET() {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const timezone = guard.user.timezone || "UTC"

  const baskets = await prisma.basket.findMany({
    where: { farmerId: guard.farmerId },
    include: { _count: { select: { orders: true } } },
    orderBy: { orderDeadline: "desc" },
    take: 5,
  })

  const totalOrders = await prisma.order.count({ where: { basket: { farmerId: guard.farmerId } } })
  const totalCustomers = await prisma.user.count({
    where: {
      role: "CUSTOMER",
      OR: [
        { customerFarmers: { some: { farmerId: guard.farmerId } } },
        { orders: { some: { basket: { farmerId: guard.farmerId } } } },
        { inviteTokens: { some: { basket: { farmerId: guard.farmerId } } } },
      ],
    },
  })
  const pendingOrders = await prisma.order.count({ where: { status: "PENDING", basket: { farmerId: guard.farmerId } } })

  return NextResponse.json({
    baskets: baskets.map(toBasketSummaryDTO),
    totalOrders,
    totalCustomers,
    pendingOrders,
    timezone,
  })
}
