import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireCustomer } from "@/lib/auth-helpers"
import { toAvailableBasketDTO } from "@/lib/mappers"

export async function GET() {
  const guard = await requireCustomer()
  if (!guard.ok) return guard.error

  const now = new Date()

  const [baskets, subscribedFarmerCount] = await Promise.all([
    prisma.basket.findMany({
      where: {
        published: true,
        orderDeadline: { gt: now },
        deliveryDay: { gt: now },
        farmer: {
          farmerCustomers: { some: { customerId: guard.user.id } },
        },
        orders: { none: { customerId: guard.user.id } },
      },
      include: {
        farmer: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { deliveryDay: "asc" },
    }),
    prisma.customerFarmer.count({
      where: { customerId: guard.user.id },
    }),
  ])

  return NextResponse.json({
    baskets: baskets.map(toAvailableBasketDTO),
    subscribedFarmerCount,
  })
}
