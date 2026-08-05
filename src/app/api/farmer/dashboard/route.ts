import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const timezone = session.user.timezone || "UTC"

  const baskets = await prisma.basket.findMany({
    where: { farmerId },
    include: { _count: { select: { orders: true } } },
    orderBy: { orderDeadline: "desc" },
    take: 5,
  })

  const totalOrders = await prisma.order.count({ where: { basket: { farmerId } } })
  const totalCustomers = await prisma.user.count({ where: { role: "CUSTOMER" } })
  const pendingOrders = await prisma.order.count({ where: { status: "PENDING", basket: { farmerId } } })

  return NextResponse.json({
    baskets: baskets.map((b) => ({
      id: b.id,
      name: b.name,
      orderDeadline: b.orderDeadline.toISOString(),
      published: b.published,
      orderCount: b._count.orders,
    })),
    totalOrders,
    totalCustomers,
    pendingOrders,
    timezone,
  })
}
