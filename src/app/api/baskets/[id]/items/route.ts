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
  const body = await request.json()
  const { productId, quantity = 1, isBase = true, swapGroupId } = body

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, farmerId },
  })

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const basket = await prisma.basket.findFirst({
    where: { id, farmerId },
  })

  if (!basket) {
    return NextResponse.json({ error: "Basket not found" }, { status: 404 })
  }

  const item = await prisma.basketItem.create({
    data: {
      basketId: id,
      productId,
      quantity,
      isBase,
      swapGroupId: swapGroupId || null,
    },
    include: { product: true },
  })

  const updatedBasket = await prisma.basket.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      swapGroups: { include: { items: { include: { product: true } } } },
    },
  })

  return NextResponse.json(toBasketDTO(updatedBasket!), { status: 201 })
}

export async function DELETE(
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
  const { searchParams } = new URL(request.url)
  const itemId = searchParams.get("itemId")

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 })
  }

  const basket = await prisma.basket.findFirst({
    where: { id, farmerId },
  })

  if (!basket) {
    return NextResponse.json({ error: "Basket not found" }, { status: 404 })
  }

  await prisma.basketItem.delete({ where: { id: itemId } })

  const updatedBasket = await prisma.basket.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      swapGroups: { include: { items: { include: { product: true } } } },
    },
  })

  return NextResponse.json(toBasketDTO(updatedBasket!))
}
