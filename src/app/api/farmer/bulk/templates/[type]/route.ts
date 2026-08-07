import { NextResponse } from "next/server"
import { requireFarmerOrHelper } from "@/lib/auth-helpers"
import { CUSTOMER_TEMPLATE_HEADERS, PRODUCT_TEMPLATE_HEADERS, generateTemplate, XLSX_MIME_TYPE } from "@/lib/excel"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> }
): Promise<Response> {
  const guard = await requireFarmerOrHelper()
  if (!guard.ok) return guard.error

  const { type } = await params
  const headers =
    type === "customers"
      ? CUSTOMER_TEMPLATE_HEADERS
      : type === "products"
        ? PRODUCT_TEMPLATE_HEADERS
        : null

  if (!headers) {
    return NextResponse.json({ error: "Unknown template type" }, { status: 400 })
  }

  const buffer = await generateTemplate(headers)

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": XLSX_MIME_TYPE,
      "Content-Disposition": `attachment; filename="${type}-template.xlsx"`,
    },
  })
}
