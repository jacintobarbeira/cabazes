import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireFarmer } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { buildEmailSettings, sendTestEmail } from "@/lib/email"

export const POST = withCsrf(async (): Promise<Response> => {
  const guard = await requireFarmer()
  if (!guard.ok) return guard.error

  const to = guard.user.email
  if (!to) {
    return NextResponse.json({ error: "Your account has no email address to test with." }, { status: 400 })
  }

  const farmer = await prisma.user.findUnique({
    where: { id: guard.user.id },
    select: { senderEmail: true, emailServerConfig: true },
  })

  const settings = farmer ? buildEmailSettings(farmer) : null
  if (!settings) {
    return NextResponse.json(
      { error: "Email server is not configured. Save your settings first." },
      { status: 400 }
    )
  }

  try {
    await sendTestEmail({ to, settings })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Test email failed: ${message}` }, { status: 502 })
  }

  return NextResponse.json({ sent: true, to })
})
