import { prisma } from "@/lib/db"
import { toBasketDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"
import { csrfCheck } from "@/lib/csrf"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

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
  const { items = [], allowedSwaps } = body

  const basket = await prisma.basket.findFirst({
    where: { id, farmerId },
  })

  if (!basket) {
    return NextResponse.json({ error: "Basket not found" }, { status: 404 })
  }

  if (basket.published) {
    return NextResponse.json(
      { error: "Published baskets cannot be edited" },
      { status: 400 }
    )
  }

  const baseProductIds = items.filter((i: { isBase: boolean }) => i.isBase).map((i: { productId: string }) => i.productId)
  const swapProductIds = items.filter((i: { isBase: boolean }) => !i.isBase).map((i: { productId: string }) => i.productId)

  const overlap = baseProductIds.filter((p: string) => swapProductIds.includes(p))
  if (overlap.length > 0) {
    return NextResponse.json(
      { error: "A product cannot be both a base item and a swap item" },
      { status: 400 }
    )
  }

  const productIds: string[] = [...new Set(items.map((i: { productId: string }) => i.productId) as string[])]

  if (productIds.length > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, farmerId },
    })

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "One or more products not found" }, { status: 400 })
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.basketItem.deleteMany({ where: { basketId: id } })

    for (const item of items) {
      await tx.basketItem.create({
        data: {
          basketId: id,
          productId: item.productId,
          isBase: item.isBase,
        },
      })
    }

    return tx.basket.update({
      where: { id },
      data: {
        allowedSwaps: allowedSwaps !== undefined ? parseInt(allowedSwaps) : basket.allowedSwaps,
      },
      include: {
        items: { include: { product: true } },
      },
    })
  })

  return NextResponse.json(toBasketDTO(updated))
}
