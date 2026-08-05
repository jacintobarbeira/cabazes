import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("Invite Link Deduplication", () => {
  test("cannot create duplicate invite link for same customer and basket", async ({ request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        farmerId: farmer!.id,
        name: "Test Dedup Basket",
        orderDeadline: nextWeek,
        deliveryDay: nextWeek,
        price: 25,
        published: true,
      },
    })

    const product = await prisma.product.create({
      data: {
        name: "Test Dedup Carrot",
        farmerId: farmer!.id,
        active: true,
      },
    })

    await prisma.basketItem.create({
      data: {
        basketId: basket.id,
        productId: product.id,
        isBase: true,
      },
    })

    await prisma.$disconnect()

    await request.post("/api/auth/login", {
      data: { email: "farmer@cabazes.com", password: "Farmer123!" },
    })

    const firstRes = await request.post(`/api/baskets/${basket.id}/links`, {
      data: { customerIds: [customer!.id] },
    })
    expect(firstRes.ok()).toBeTruthy()
    const firstTokens = await firstRes.json()
    expect(firstTokens.length).toBe(1)
    const firstTokenId = firstTokens[0].id

    const secondRes = await request.post(`/api/baskets/${basket.id}/links`, {
      data: { customerIds: [customer!.id] },
    })
    expect(secondRes.ok()).toBeTruthy()
    const secondTokens = await secondRes.json()
    expect(secondTokens.length).toBe(1)
    expect(secondTokens[0].id).toBe(firstTokenId)

    const p = createPrisma()
    const count = await p.inviteToken.count({
      where: { basketId: basket.id, customerId: customer!.id },
    })
    expect(count).toBe(1)
    await p.$disconnect()
  })

  test("cannot create duplicate invite link even if previous was used", async ({ request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        farmerId: farmer!.id,
        name: "Test Dedup Used Basket",
        orderDeadline: nextWeek,
        deliveryDay: nextWeek,
        price: 25,
        published: true,
      },
    })

    const product = await prisma.product.create({
      data: {
        name: "Test Dedup Used Onion",
        farmerId: farmer!.id,
        active: true,
      },
    })

    await prisma.basketItem.create({
      data: {
        basketId: basket.id,
        productId: product.id,
        isBase: true,
      },
    })

    const firstToken = await prisma.inviteToken.create({
      data: {
        customerId: customer!.id,
        basketId: basket.id,
        token: "test-dedup-used-token",
        expiresAt: nextWeek,
        usedAt: new Date(),
      },
    })

    await prisma.$disconnect()

    await request.post("/api/auth/login", {
      data: { email: "farmer@cabazes.com", password: "Farmer123!" },
    })

    const secondRes = await request.post(`/api/baskets/${basket.id}/links`, {
      data: { customerIds: [customer!.id] },
    })
    expect(secondRes.ok()).toBeTruthy()
    const secondTokens = await secondRes.json()
    expect(secondTokens.length).toBe(1)
    expect(secondTokens[0].id).toBe(firstToken.id)

    const p = createPrisma()
    const count = await p.inviteToken.count({
      where: { basketId: basket.id, customerId: customer!.id },
    })
    expect(count).toBe(1)
    await p.$disconnect()
  })
})
