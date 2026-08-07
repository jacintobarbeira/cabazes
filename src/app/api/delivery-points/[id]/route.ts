import { prisma } from "@/lib/db"
import { toDeliveryPointDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"

async function getScopedPoint(id: string) {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return { guard, point: null as Awaited<ReturnType<typeof prisma.deliveryPoint.findFirst>> }

  const point = await prisma.deliveryPoint.findFirst({
    where: { id, farmerId: guard.farmerId },
  })

  return { guard, point }
}

export const PATCH = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const { id } = await params
    const scoped = await getScopedPoint(id)
    if (!scoped.guard.ok) return scoped.guard.error
    if (!scoped.point) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await request.json()
    const name = body.name ?? scoped.point.name
    const address = body.address ?? scoped.point.address

    if (!name || !address) {
      return NextResponse.json(
        { error: "name and address are required" },
        { status: 400 }
      )
    }

    const updated = await prisma.deliveryPoint.update({
      where: { id },
      data: {
        name,
        address,
        city: body.city !== undefined ? body.city : scoped.point.city,
        postalCode: body.postalCode !== undefined ? body.postalCode : scoped.point.postalCode,
      },
    }).catch(() => null)

    if (!updated) {
      return NextResponse.json(
        { error: "A delivery point with this name already exists" },
        { status: 400 }
      )
    }

    return NextResponse.json(toDeliveryPointDTO(updated))
  }
)

export const DELETE = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const { id } = await params
    const scoped = await getScopedPoint(id)
    if (!scoped.guard.ok) return scoped.guard.error
    if (!scoped.point) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const inUse = await prisma.basketDeliveryPoint.count({
      where: { deliveryPointId: id },
    })

    if (inUse > 0) {
      return NextResponse.json(
        { error: "This delivery point is used by one or more baskets and cannot be deleted" },
        { status: 400 }
      )
    }

    await prisma.deliveryPoint.delete({ where: { id } })

    return NextResponse.json({ success: true })
  }
)
