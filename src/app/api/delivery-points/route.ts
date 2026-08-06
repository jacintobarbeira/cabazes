import { prisma } from "@/lib/db"
import { toDeliveryPointDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"
import { csrfCheck } from "@/lib/csrf"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const points = await prisma.deliveryPoint.findMany({
    where: { farmerId },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(points.map(toDeliveryPointDTO))
}

export async function POST(request: Request) {
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

  const body = await request.json()
  const { name, address, city, postalCode } = body

  if (!name || !address) {
    return NextResponse.json(
      { error: "name and address are required" },
      { status: 400 }
    )
  }

  const point = await prisma.deliveryPoint.create({
    data: {
      name,
      address,
      city: city || null,
      postalCode: postalCode || null,
      farmerId,
    },
  }).catch(() => null)

  if (!point) {
    return NextResponse.json(
      { error: "A delivery point with this name already exists" },
      { status: 400 }
    )
  }

  return NextResponse.json(toDeliveryPointDTO(point), { status: 201 })
}
