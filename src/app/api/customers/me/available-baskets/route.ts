import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import type { AvailableBasketDTO } from "@/types/api"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  const [baskets, subscribedFarmerCount] = await Promise.all([
    prisma.basket.findMany({
      where: {
        published: true,
        orderDeadline: { gt: now },
        deliveryDay: { gt: now },
        farmer: {
          farmerCustomers: { some: { customerId: session.user.id } },
        },
        orders: { none: { customerId: session.user.id } },
      },
      include: {
        farmer: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { deliveryDay: "asc" },
    }),
    prisma.customerFarmer.count({
      where: { customerId: session.user.id },
    }),
  ])

  const result: AvailableBasketDTO[] = baskets.map((basket) => ({
    id: basket.id,
    name: basket.name,
    description: basket.description,
    price: basket.price.toString(),
    deliveryDay: basket.deliveryDay.toISOString(),
    orderDeadline: basket.orderDeadline.toISOString(),
    farmerName: basket.farmer.name,
    itemCount: basket._count.items,
  }))

  return NextResponse.json({ baskets: result, subscribedFarmerCount })
}
