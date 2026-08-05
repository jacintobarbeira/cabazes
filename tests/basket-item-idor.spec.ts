import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

const FARMER_A = "test-idor-farmer-a@example.com"
const FARMER_B = "test-idor-farmer-b@example.com"
const PASSWORD = "Idor123!"

async function createFarmer(email: string) {
  const prisma = createPrisma()
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash(PASSWORD, 10)
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hash, disabled: false, role: "FARMER" },
    create: { email, name: email, passwordHash: hash, role: "FARMER", phone: "+1111111111" },
  })
  await prisma.$disconnect()
}

async function login(request: any, email: string) {
  const res = await request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  })
  expect(res.ok(), `login ${email}`).toBeTruthy()
}

async function createBasketAndItem(farmerEmail: string, suffix = "") {
  const prisma = createPrisma()
  const farmer = await prisma.user.findUnique({ where: { email: farmerEmail } })!
  const product = await prisma.product.upsert({
    where: { name_farmerId: { name: `Idor Product${suffix}`, farmerId: farmer!.id } },
    update: {},
    create: { name: `Idor Product${suffix}`, farmerId: farmer!.id },
  })
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const basket = await prisma.basket.upsert({
    where: { name_deliveryDay_farmerId: { name: `Idor Basket${suffix}`, deliveryDay: tomorrow, farmerId: farmer!.id } },
    update: {},
    create: {
      name: `Idor Basket${suffix}`,
      farmerId: farmer!.id,
      orderDeadline: tomorrow,
      price: 10,
      deliveryDay: tomorrow,
    },
  })
  const existingItem = await prisma.basketItem.findFirst({ where: { basketId: basket.id } })
  const item = existingItem ?? await prisma.basketItem.create({
    data: { basketId: basket.id, productId: product.id, isBase: true },
  })
  await prisma.$disconnect()
  return { basketId: basket.id, itemId: item.id }
}

test.beforeEach(async () => {
  await cleanupTestData()
  await createFarmer(FARMER_A)
  await createFarmer(FARMER_B)
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("Basket item IDOR", () => {
  test("farmer cannot delete another farmer's basket item using their own basket", async ({ request }) => {
    await login(request, FARMER_A)
    const { itemId: farmerAItemId } = await createBasketAndItem(FARMER_A, " A")

    await login(request, FARMER_B)
    const { basketId: farmerBBasketId } = await createBasketAndItem(FARMER_B, " B")

    const res = await request.delete(`/api/baskets/${farmerBBasketId}/items?itemId=${farmerAItemId}`)

    expect(res.status(), "farmer B must not delete farmer A's item via their own basket").toBe(404)

    const prisma = createPrisma()
    const stillExists = await prisma.basketItem.findUnique({ where: { id: farmerAItemId } })
    await prisma.$disconnect()
    expect(stillExists).toBeTruthy()
  })

  test("farmer can delete their own basket item", async ({ request }) => {
    await login(request, FARMER_A)
    const { basketId, itemId } = await createBasketAndItem(FARMER_A)

    const res = await request.delete(`/api/baskets/${basketId}/items?itemId=${itemId}`)

    expect(res.ok(), "farmer A must delete own item").toBeTruthy()

    const prisma = createPrisma()
    const gone = await prisma.basketItem.findUnique({ where: { id: itemId } })
    await prisma.$disconnect()
    expect(gone).toBeNull()
  })
})
