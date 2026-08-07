import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { matchesTemplate, parseSpreadsheet, PRODUCT_TEMPLATE_HEADERS } from "@/lib/excel"
import { createProductForFarmer } from "@/lib/product-creation"

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

    if (!matchesTemplate(parsed.columns, PRODUCT_TEMPLATE_HEADERS)) {
      return NextResponse.json(
        { error: "The file must use the provided product template." },
        { status: 400 }
      )
    }

    const results: Array<{ row: number; ok: boolean; name: string; error?: string }> = []
    let created = 0

    for (let i = 0; i < parsed.rows.length; i++) {
      const [name, category, description] = parsed.rows[i]
      const result = await createProductForFarmer(guard.farmerId, { name, category, description })

      if (result.ok) {
        created++
        results.push({ row: i + 2, ok: true, name: result.product.name })
      } else {
        results.push({ row: i + 2, ok: false, name: name || "", error: result.error })
      }
    }

    return NextResponse.json({ total: parsed.rows.length, created, results }, { status: 201 })
  }
)
