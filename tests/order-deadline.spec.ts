import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestCustomer } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("Order Deadline", () => {
  test("should reject orders after basket deadline", async ({ request }) => {
    const prisma = createPrisma()

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const basket = await prisma.basket.create({
      data: {
        name: "Expired Basket",
        description: "This basket has a past deadline",
        orderDeadline: yesterday,
        price: 25.0,
        deliveryDay: tomorrow,
        farmerId: farmer.id,
        published: true,
      },
    })

    const tokenValue = "test-expired-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    const orderRes = await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        deliveryNotes: "Test order",
        swapChoices: [],
      },
    })

    expect(orderRes.ok()).toBeFalsy()
    expect(orderRes.status()).toBe(400)
    const errorData = await orderRes.json()
    expect(errorData.error).toBe("Order deadline has passed")
  })

  test("should accept orders before basket deadline", async ({ request }) => {
    const prisma = createPrisma()

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const basket = await prisma.basket.create({
      data: {
        name: "Active Basket",
        description: "This basket has a future deadline",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer.id,
        published: true,
      },
    })

    const tokenValue = "test-active-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    const orderRes = await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "456 Test Ave",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        deliveryNotes: "Test order",
        swapChoices: [],
      },
    })

    expect(orderRes.ok()).toBeTruthy()
    expect(orderRes.status()).toBe(201)
  })
})
