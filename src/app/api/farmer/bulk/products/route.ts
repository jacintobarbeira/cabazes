import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { withCsrf } from "@/lib/csrf"
import { matchesTemplate, parseSpreadsheet, PRODUCT_TEMPLATE_HEADERS } from "@/lib/excel"
import { createProductForFarmer } from "@/lib/product-creation"

const MAX_BULK_BYTES = 10 * 1024 * 1024 // 10 MB
const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])

export const POST = withCsrf(
  async (request: Request): Promise<Response> => {
    const guard = await requireFarmerOrHelper()
    if (!guard.ok) return guard.error

    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > MAX_BULK_BYTES) {
      return NextResponse.json({ error: "File too large. Maximum size is 10 MB." }, { status: 413 })
    }

    const arrayBuffer = await request.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_BULK_BYTES) {
      return NextResponse.json({ error: "File too large. Maximum size is 10 MB." }, { status: 413 })
    }

    const buffer = Buffer.from(arrayBuffer)

    const contentType = request.headers.get("content-type") || ""
    if (contentType && !contentType.includes("sheet") && !contentType.includes("excel") && !contentType.includes("octet-stream") && !contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Invalid file type. Please upload an Excel (.xlsx) file." }, { status: 400 })
    }
    if (!buffer.subarray(0, 4).equals(XLSX_MAGIC)) {
      return NextResponse.json({ error: "Invalid file type. Please upload an Excel (.xlsx) file." }, { status: 400 })
    }

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
