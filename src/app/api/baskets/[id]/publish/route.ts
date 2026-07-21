import { prisma } from "@/lib/db"
import { toBasketDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const basket = await prisma.basket.findFirst({
    where: { id, farmerId },
  })

  if (!basket) {
    return NextResponse.json({ error: "Basket not found" }, { status: 404 })
  }

  const itemCount = await prisma.basketItem.count({
    where: { basketId: id },
  })

  if (itemCount === 0) {
    return NextResponse.json({ error: "Cannot publish a basket without items" }, { status: 400 })
  }

  const updated = await prisma.basket.update({
    where: { id },
    data: { published: true },
    include: {
      items: { include: { product: true } },
      swapGroups: { include: { items: { include: { product: true } } } },
    },
  })

  return NextResponse.json(toBasketDTO(updated))
}
