import { prisma } from "@/lib/db"
import { toDeliveryPointDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"
import { csrfCheck } from "@/lib/csrf"

async function getScopedPoint(request: Request, id: string) {
  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const point = await prisma.deliveryPoint.findFirst({
    where: { id, farmerId },
  })

  return { point, farmerId }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const { id } = await params
  const scoped = await getScopedPoint(request, id)
  if (scoped.error) return scoped.error
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const { id } = await params
  const scoped = await getScopedPoint(request, id)
  if (scoped.error) return scoped.error
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
