import { prisma } from "@/lib/db"
import { toDeliveryAddressDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ basketId: string }> }
) {
  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { basketId } = await params

  const basket = await prisma.basket.findUnique({
    where: { id: basketId, farmerId },
    select: { id: true },
  })

  if (!basket) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orders = await prisma.order.findMany({
    where: { basketId, status: { not: "CANCELLED" } },
    include: { basket: { select: { name: true } } },
    orderBy: [{ deliveryCity: "asc" }, { deliveryAddress: "asc" }],
  })

  return NextResponse.json(orders.map(toDeliveryAddressDTO))
}
