import { prisma } from "@/lib/db"
import { toBasketDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"

export const POST = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const { id } = await params
    const body = await request.json()
    const { productId, isBase = true } = body

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 })
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, farmerId: guard.farmerId },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const basket = await prisma.basket.findFirst({
      where: { id, farmerId: guard.farmerId },
      include: { items: true },
    })

    if (!basket) {
      return NextResponse.json({ error: "Basket not found" }, { status: 404 })
    }

    const sameProductItem = basket.items.find((i) => i.productId === productId)
    if (sameProductItem) {
      return NextResponse.json(
        { error: "A product cannot be both a base item and a swap item" },
        { status: 400 }
      )
    }

    const item = await prisma.basketItem.create({
      data: {
        basketId: id,
        productId,
        isBase,
      },
      include: { product: true },
    })

    const updatedBasket = await prisma.basket.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    })

    return NextResponse.json(toBasketDTO(updatedBasket!), { status: 201 })
  }
)

export const DELETE = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get("itemId")

    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 })
    }

    const basket = await prisma.basket.findFirst({
      where: { id, farmerId: guard.farmerId },
    })

    if (!basket) {
      return NextResponse.json({ error: "Basket not found" }, { status: 404 })
    }

    try {
      await prisma.basketItem.delete({ where: { id: itemId, basketId: id } })
    } catch {
      return NextResponse.json({ error: "Basket item not found" }, { status: 404 })
    }

    const updatedBasket = await prisma.basket.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    })

    return NextResponse.json(toBasketDTO(updatedBasket!))
  }
)
