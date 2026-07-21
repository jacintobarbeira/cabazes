import { prisma } from "@/lib/db"
import { toProductDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    where: { farmerId },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(products.map(toProductDTO))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const farmerId = await getEffectiveFarmerId()
  if (!farmerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, description, category, unit, active } = body

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const product = await prisma.product.create({
    data: {
      name,
      description: description || null,
      category: category || null,
      unit: unit || "unit",
      active: active !== false,
      farmerId,
    },
  }).catch(() => null)

  if (!product) {
    return NextResponse.json({ error: "A product with this name already exists" }, { status: 400 })
  }

  return NextResponse.json(toProductDTO(product), { status: 201 })
}
