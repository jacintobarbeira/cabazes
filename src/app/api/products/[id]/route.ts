import { prisma } from "@/lib/db"
import { toProductDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getEffectiveFarmerId } from "@/lib/auth-helpers"
import { csrfCheck } from "@/lib/csrf"

export async function PATCH(
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

  const product = await prisma.product.findUnique({
    where: { id },
  })

  if (!product || product.farmerId !== farmerId) {
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

export async function DELETE(
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

  const product = await prisma.product.findUnique({
    where: { id },
  })

  if (!product || product.farmerId !== farmerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.product.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
