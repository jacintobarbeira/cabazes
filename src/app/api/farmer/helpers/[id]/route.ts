import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireFarmer } from "@/lib/auth-helpers"
import { auditLog } from "@/lib/audit"
import { withCsrf } from "@/lib/csrf"

export const PATCH = withCsrf(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response> => {
    const guard = await requireFarmer()
    if (!guard.ok) return guard.error

    const { id } = await params

    const helper = await prisma.user.findFirst({
      where: { id, managedById: guard.user.id },
    })

    if (!helper) {
      return NextResponse.json({ error: "Helper not found" }, { status: 404 })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { disabled: !helper.disabled },
    })

    if (updated.disabled) {
      auditLog({ event: "HELPER_DISABLED", farmerId: guard.user.id, helperId: id })
    } else {
      auditLog({ event: "HELPER_ENABLED", farmerId: guard.user.id, helperId: id })
    }

    return NextResponse.json({ id: updated.id, disabled: updated.disabled })
  }
)
