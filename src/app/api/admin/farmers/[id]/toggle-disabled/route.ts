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

  if (!session?.user?.id || session.user?.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
    auditLog({ event: "FARMER_DISABLED", adminId: session.user.id, farmerId: id })
  } else {
    auditLog({ event: "FARMER_ENABLED", adminId: session.user.id, farmerId: id })
  }

  return NextResponse.json({
    id: farmer.id,
    disabled: newDisabled,
    helpersAffected: helpersResult.count,
  })
}
