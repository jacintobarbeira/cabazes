import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { auditLog } from "@/lib/audit"
import { csrfCheck } from "@/lib/csrf"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const session = await auth()

  if (!session?.user?.id || session.user?.role !== "FARMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const helper = await prisma.user.findFirst({
    where: { id, managedById: session.user.id },
  })

  if (!helper) {
    return NextResponse.json({ error: "Helper not found" }, { status: 404 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { disabled: !helper.disabled },
  })

  if (updated.disabled) {
    auditLog({ event: "HELPER_DISABLED", farmerId: session.user.id, helperId: id })
  } else {
    auditLog({ event: "HELPER_ENABLED", farmerId: session.user.id, helperId: id })
  }

  return NextResponse.json({ id: updated.id, disabled: updated.disabled })
}
