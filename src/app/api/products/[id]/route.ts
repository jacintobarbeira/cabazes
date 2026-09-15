import { prisma } from "@/lib/db"
import { toProductDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"

export const PATCH = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const { id } = await params
    const body = await request.json()

    const product = await prisma.product.findUnique({
      where: { id },
    })

    if (!product || product.farmerId !== guard.farmerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: body.name ?? product.name,
        description: body.description,
        category: body.category,
        active: body.active ?? product.active,
      },
    }).catch(() => null)

    if (!updated) {
      return NextResponse.json({ error: "A product with this name already exists" }, { status: 400 })
    }

    return NextResponse.json(toProductDTO(updated))
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

    const product = await prisma.product.findUnique({
      where: { id },
    })

    if (!product || product.farmerId !== guard.farmerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const usedInPublishedBasket = await prisma.basketItem.findFirst({
      where: {
        productId: id,
        basket: { published: true },
      },
      select: { id: true },
    })

    if (usedInPublishedBasket) {
      return NextResponse.json(
        { error: "Cannot delete product: it is used in a published basket" },
        { status: 400 }
      )
    }

    await prisma.product.delete({ where: { id } })

    return NextResponse.json({ success: true })
  }
)
