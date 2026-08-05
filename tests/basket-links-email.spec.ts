import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("Basket Link Email", () => {
  test("farmer can send email for generated links", async ({ request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        farmerId: farmer!.id,
        name: "Test Delete Basket",
        orderDeadline: nextWeek,
        price: 20,
        deliveryDay: tomorrow,
        published: true,
      },
    })

    const token = await prisma.inviteToken.create({
      data: {
        customerId: customer!.id,
        basketId: basket.id,
        token: "test-email-link-token",
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    const farmerRes = await request.post("/api/auth/login", {
      data: {
        email: "farmer@cabazes.com",
        password: "Farmer123!",
      },
    })
    expect(farmerRes.ok()).toBeTruthy()

    const sendRes = await request.post(`/api/baskets/${basket.id}/links/send-email`, {
      data: { tokenIds: [token.id] },
    })
    expect(sendRes.ok()).toBeTruthy()
    const result = await sendRes.json()
    expect(result.results).toBeDefined()
    expect(result.results.length).toBe(1)
    expect(result.results[0].tokenId).toBe(token.id)
    expect(result.results[0].email).toBe(customer!.email)
    expect(result.results[0].sent).toBe(true)
  })

  test("non-farmer cannot send emails for links", async ({ request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        farmerId: farmer!.id,
        name: "Test Delete Basket",
        orderDeadline: nextWeek,
        price: 20,
        deliveryDay: tomorrow,
      },
    })

    const token = await prisma.inviteToken.create({
      data: {
        customerId: customer!.id,
        basketId: basket.id,
        token: "test-email-unauth-token",
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    const customerRes = await request.post("/api/auth/login", {
      data: {
        email: "alice@example.com",
        password: "Customer123!",
      },
    })
    expect(customerRes.ok()).toBeTruthy()

    const sendRes = await request.post(`/api/baskets/${basket.id}/links/send-email`, {
      data: { tokenIds: [token.id] },
    })
    expect(sendRes.ok()).toBeFalsy()
    expect(sendRes.status()).toBe(401)
  })
})
