import { test, expect, type APIRequestContext } from "@playwright/test"
import ExcelJS from "exceljs"
import {
  createPrisma,
  cleanupTestData,
  createTestFarmer,
  createTestCustomer,
  loginAsFarmerPage,
  TEST_PASSWORDS,
} from "./helpers"

const FARMER = "test-bulk-farmer"
const FARMER_EMAIL = `${FARMER}@example.com`
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

const CUSTOMER_HEADERS = ["Name", "Email", "Phone", "Address", "City", "Postal Code", "Notes"]
const PRODUCT_HEADERS = ["Name", "Category", "Description"]

const C1_EMAIL = "newuser-bulk-c1@example.com"
const C2_EMAIL = "newuser-bulk-c2@example.com"
const C3_EMAIL = "newuser-bulk-c3@example.com"

type BulkResult = { row: number; ok: boolean; email?: string; name?: string; error?: string }
type BulkResponse = { total: number; created: number; results: BulkResult[] }

async function parseBulkResponse(res: { json: () => Promise<unknown> }): Promise<BulkResponse> {
  return res.json() as Promise<BulkResponse>
}

async function buildXlsx(rows: Array<Array<string | number>>): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Import")
  rows.forEach((row) => sheet.addRow(row))
  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer as unknown as ArrayBuffer)
}

async function postBulk(request: APIRequestContext, path: string, buffer: Uint8Array) {
  return request.post(path, {
    data: Buffer.from(buffer),
    headers: { "Content-Type": XLSX_MIME },
  })
}

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("Bulk load", () => {
  test("farmer bulk loads customers from template", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    await prisma.$disconnect()

    await loginAsFarmerPage(page, FARMER_EMAIL, TEST_PASSWORDS.farmer)

    const buffer = await buildXlsx([
      CUSTOMER_HEADERS,
      ["Bulk Customer One", C1_EMAIL, "+351910000001", "Rua 1", "Lisboa", "1000-001", ""],
      ["Bulk Customer Two", C2_EMAIL, "+351910000002", "", "", "", ""],
    ])

    const res = await postBulk(page.request, "/api/farmer/bulk/customers", buffer)
    expect(res.status()).toBe(201)
    const data = await parseBulkResponse(res)
    expect(data.total).toBe(2)
    expect(data.created).toBe(2)
    expect(data.results).toHaveLength(2)
    expect(data.results.every((r) => r.ok)).toBe(true)

    const prisma2 = createPrisma()
    const created = await prisma2.user.findMany({
      where: { email: { in: [C1_EMAIL, C2_EMAIL] } },
      include: { customerFarmers: true },
    })
    expect(created).toHaveLength(2)
    for (const customer of created) {
      expect(customer.role).toBe("CUSTOMER")
      expect(customer.verified).toBe(false)
      expect(customer.passwordHash).toBeNull()
      expect(customer.customerFarmers).toHaveLength(1)
      expect(customer.customerFarmers[0].farmerId).toBe(farmer.id)
    }
    await prisma2.$disconnect()
  })

  test("bulk customers reports per-row failures", async ({ page }) => {
    const prisma = createPrisma()
    await createTestFarmer(prisma, FARMER)
    await prisma.$disconnect()

    await loginAsFarmerPage(page, FARMER_EMAIL, TEST_PASSWORDS.farmer)

    const buffer = await buildXlsx([
      CUSTOMER_HEADERS,
      ["Good One", C3_EMAIL, "", "", "", "", ""],
      ["Bad Email", "not-an-email", "", "", "", "", ""],
      ["Duplicate", C3_EMAIL, "", "", "", "", ""],
    ])

    const res = await postBulk(page.request, "/api/farmer/bulk/customers", buffer)
    expect(res.status()).toBe(201)
    const data = await parseBulkResponse(res)
    expect(data.total).toBe(3)
    expect(data.created).toBe(1)
    const failed = data.results.filter((r) => !r.ok)
    expect(failed).toHaveLength(2)
    expect(failed.map((r) => r.error)).toContain("Invalid email format")
    expect(failed.map((r) => r.error)).toContain("User already exists")
  })

  test("farmer bulk loads products from template", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, FARMER)
    await prisma.$disconnect()

    await loginAsFarmerPage(page, FARMER_EMAIL, TEST_PASSWORDS.farmer)

    const buffer = await buildXlsx([
      PRODUCT_HEADERS,
      ["Test Bulk Carrot", "Vegetables", "Fresh from the field"],
      ["Test Bulk Apple", "", ""],
    ])

    const res = await postBulk(page.request, "/api/farmer/bulk/products", buffer)
    expect(res.status()).toBe(201)
    const data = await parseBulkResponse(res)
    expect(data.total).toBe(2)
    expect(data.created).toBe(2)

    const prisma2 = createPrisma()
    const products = await prisma2.product.findMany({
      where: { name: { startsWith: "Test Bulk " } },
    })
    expect(products).toHaveLength(2)
    for (const product of products) {
      expect(product.farmerId).toBe(farmer.id)
      expect(product.active).toBe(true)
    }
    const carrot = products.find((p) => p.name === "Test Bulk Carrot")
    expect(carrot!.category).toBe("Vegetables")
    expect(carrot!.description).toBe("Fresh from the field")
    await prisma2.$disconnect()
  })

  test("bulk products reports duplicate name failures", async ({ page }) => {
    const prisma = createPrisma()
    await createTestFarmer(prisma, FARMER)
    await prisma.$disconnect()

    await loginAsFarmerPage(page, FARMER_EMAIL, TEST_PASSWORDS.farmer)

    const buffer = await buildXlsx([
      PRODUCT_HEADERS,
      ["Test Bulk Dupe Product", "", ""],
      ["Test Bulk Dupe Product", "", ""],
    ])

    const res = await postBulk(page.request, "/api/farmer/bulk/products", buffer)
    expect(res.status()).toBe(201)
    const data = await parseBulkResponse(res)
    expect(data.created).toBe(1)
    const failed = data.results.filter((r) => !r.ok)
    expect(failed).toHaveLength(1)
    expect(failed[0].error).toBe("A product with this name already exists")
  })

  test("rejects file with wrong template headers", async ({ page }) => {
    const prisma = createPrisma()
    await createTestFarmer(prisma, FARMER)
    await prisma.$disconnect()

    await loginAsFarmerPage(page, FARMER_EMAIL, TEST_PASSWORDS.farmer)

    const buffer = await buildXlsx([
      ["Wrong", "Columns", "Here"],
      ["a", "b", "c"],
    ])

    const res = await postBulk(page.request, "/api/farmer/bulk/customers", buffer)
    expect(res.status()).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("template")
  })

  test("rejects non-excel file", async ({ page }) => {
    const prisma = createPrisma()
    await createTestFarmer(prisma, FARMER)
    await prisma.$disconnect()

    await loginAsFarmerPage(page, FARMER_EMAIL, TEST_PASSWORDS.farmer)

    const res = await page.request.post("/api/farmer/bulk/customers", {
      data: "this is not an xlsx file",
      headers: { "Content-Type": "text/plain" },
    })
    expect(res.status()).toBe(400)
  })

  test("customer role cannot bulk load", async ({ page }) => {
    const prisma = createPrisma()
    await createTestFarmer(prisma, FARMER)
    await createTestCustomer(prisma, "test-bulk-customer")
    await prisma.$disconnect()

    await page.goto("/login")
    await page.waitForLoadState("networkidle")
    await page.fill('input[name="email"]', "test-bulk-customer@example.com")
    await page.fill('input[type="password"]', TEST_PASSWORDS.customer)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*(dashboard|my-orders)/, { timeout: 10000 })

    const buffer = await buildXlsx([CUSTOMER_HEADERS, ["Nope", "newuser-bulk-x@example.com", "", "", "", "", ""]])
    const res = await postBulk(page.request, "/api/farmer/bulk/customers", buffer)
    expect(res.status()).toBe(401)
  })

  test("farmer can download customer and product templates", async ({ page }) => {
    const prisma = createPrisma()
    await createTestFarmer(prisma, FARMER)
    await prisma.$disconnect()

    await loginAsFarmerPage(page, FARMER_EMAIL, TEST_PASSWORDS.farmer)

    const customer = await page.request.get("/api/farmer/bulk/templates/customers")
    expect(customer.status()).toBe(200)
    expect(customer.headers()["content-type"]).toContain("spreadsheetml")
    expect(customer.headers()["content-disposition"]).toContain("customers-template.xlsx")

    const product = await page.request.get("/api/farmer/bulk/templates/products")
    expect(product.status()).toBe(200)
    expect(product.headers()["content-type"]).toContain("spreadsheetml")

    const customers = await readHeaders(await customer.body())
    expect(customers).toEqual(CUSTOMER_HEADERS)
    const products = await readHeaders(await product.body())
    expect(products).toEqual(PRODUCT_HEADERS)
  })

  test("downloaded customer template imports zero rows", async ({ page }) => {
    const prisma = createPrisma()
    await createTestFarmer(prisma, FARMER)
    await prisma.$disconnect()

    await loginAsFarmerPage(page, FARMER_EMAIL, TEST_PASSWORDS.farmer)

    const res = await page.request.get("/api/farmer/bulk/templates/customers")
    const buffer = await res.body()
    const upload = await postBulk(page.request, "/api/farmer/bulk/customers", buffer)
    expect(upload.status()).toBe(201)
    const data = await upload.json()
    expect(data.total).toBe(0)
    expect(data.created).toBe(0)
  })
})

async function readHeaders(buffer: Uint8Array): Promise<string[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
  const sheet = workbook.worksheets[0]
  return (sheet.getRow(1).values as Array<string | undefined>).slice(1).map(String)
}
