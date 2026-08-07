import ExcelJS from "exceljs"

export const CUSTOMER_TEMPLATE_HEADERS = [
  "Name",
  "Email",
  "Phone",
  "Address",
  "City",
  "Postal Code",
  "Notes",
]

export const PRODUCT_TEMPLATE_HEADERS = ["Name", "Category", "Description"]

export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export async function generateTemplate(columns: string[]): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Import")
  sheet.columns = columns.map((header) => ({ header, width: 24 }))
  sheet.getRow(1).font = { bold: true }
  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer as unknown as ArrayBuffer)
}

export type ParsedSheet = {
  columns: string[]
  rows: string[][]
}

export async function parseSpreadsheet(buffer: Uint8Array): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
  const sheet = workbook.worksheets[0]
  if (!sheet) return { columns: [], rows: [] }

  const data: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as Array<string | number | Date | null | undefined>).slice(1)
    data.push(values.map((value) => (value === null || value === undefined ? "" : String(value).trim())))
  })

  return { columns: data[0] ?? [], rows: data.slice(1) }
}

export function matchesTemplate(columns: string[], expected: string[]): boolean {
  if (columns.length < expected.length) return false
  for (let i = 0; i < expected.length; i++) {
    if (columns[i].toLowerCase() !== expected[i].toLowerCase()) return false
  }
  return true
}
