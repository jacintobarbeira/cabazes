import { prisma } from "@/lib/db"
import { toUserDTO } from "@/lib/mappers"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { auditLog } from "@/lib/audit"
import { withCsrf } from "@/lib/csrf"

export const PATCH = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.error

    const { id } = await params
    const body = await request.json()

    const farmer = await prisma.user.findUnique({
      where: { id, role: "FARMER" },
    })

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: body.name ?? farmer.name,
        phone: body.phone ?? farmer.phone,
      },
    })

    return NextResponse.json(toUserDTO(updated))
  }
)

export const DELETE = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.error

    const { id } = await params

    const farmer = await prisma.user.findUnique({
      where: { id, role: "FARMER" },
    })

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      const baskets = await tx.basket.findMany({
        where: { farmerId: id },
        select: { id: true },
      })
      const basketIds = baskets.map((b) => b.id)

      if (basketIds.length > 0) {
        await tx.order.deleteMany({
          where: { basketId: { in: basketIds } },
        })
      }

      await tx.basket.deleteMany({ where: { farmerId: id } })
      await tx.product.deleteMany({ where: { farmerId: id } })

      const helpers = await tx.user.findMany({
        where: { managedById: id },
        select: { id: true },
      })
      const helperIds = helpers.map((h) => h.id)

      if (helperIds.length > 0) {
        await tx.session.deleteMany({ where: { userId: { in: helperIds } } })
        await tx.account.deleteMany({ where: { userId: { in: helperIds } } })
        await tx.user.deleteMany({ where: { id: { in: helperIds } } })
      }

      await tx.session.deleteMany({ where: { userId: id } })
      await tx.account.deleteMany({ where: { userId: id } })

      await tx.user.delete({ where: { id } })
    })

    auditLog({ event: "FARMER_DELETED", adminId: guard.user.id, farmerId: id })

    return NextResponse.json({ success: true })
  }
)
