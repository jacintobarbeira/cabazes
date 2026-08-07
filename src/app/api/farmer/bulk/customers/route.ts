import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { CUSTOMER_TEMPLATE_HEADERS, matchesTemplate, parseSpreadsheet } from "@/lib/excel"
import { createCustomerForFarmer } from "@/lib/customer-creation"

export const POST = withCsrf(
  async (request: Request): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const buffer = Buffer.from(await request.arrayBuffer())

    let parsed
    try {
      parsed = await parseSpreadsheet(buffer)
    } catch {
      return NextResponse.json(
        { error: "Could not read the file. Please upload an Excel (.xlsx) file." },
        { status: 400 }
      )
    }

    if (!matchesTemplate(parsed.columns, CUSTOMER_TEMPLATE_HEADERS)) {
      return NextResponse.json(
        { error: "The file must use the provided customer template." },
        { status: 400 }
      )
    }

    const results: Array<{ row: number; ok: boolean; email: string; error?: string }> = []
    let created = 0

    for (let i = 0; i < parsed.rows.length; i++) {
      const [name, email, phone, address, city, postalCode, notes] = parsed.rows[i]
      const result = await createCustomerForFarmer(guard.farmerId, {
        name,
        email,
        phone,
        address,
        city,
        postalCode,
        notes,
      })

      if (result.ok) {
        created++
        results.push({ row: i + 2, ok: true, email: result.customer.email })
      } else {
        results.push({ row: i + 2, ok: false, email: email || "", error: result.error })
      }
    }

    return NextResponse.json({ total: parsed.rows.length, created, results }, { status: 201 })
  }
)
