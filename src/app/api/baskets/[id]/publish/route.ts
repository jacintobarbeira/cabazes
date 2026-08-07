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

    const basket = await prisma.basket.findFirst({
      where: { id, farmerId: guard.farmerId },
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
      },
    })

    return NextResponse.json(toBasketDTO(updated))
  }
)
