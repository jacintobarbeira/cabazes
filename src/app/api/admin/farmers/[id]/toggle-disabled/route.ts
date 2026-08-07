import { prisma } from "@/lib/db"
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

    const farmer = await prisma.user.findUnique({
      where: { id, role: "FARMER" },
    })

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 })
    }

    const newDisabled = !farmer.disabled

    await prisma.user.update({
      where: { id },
      data: { disabled: newDisabled },
    })

    const helpersResult = await prisma.user.updateMany({
      where: { managedById: id },
      data: { disabled: newDisabled },
    })

    if (newDisabled) {
      auditLog({ event: "FARMER_DISABLED", adminId: guard.user.id, farmerId: id })
    } else {
      auditLog({ event: "FARMER_ENABLED", adminId: guard.user.id, farmerId: id })
    }

    return NextResponse.json({
      id: farmer.id,
      disabled: newDisabled,
      helpersAffected: helpersResult.count,
    })
  }
)
