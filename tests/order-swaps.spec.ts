import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestCustomer } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function createBasketWithSwaps(prisma: any, opts: { allowedSwaps?: number; customerEmail?: string; suffix?: string } = {}) {
  const suffix = opts.suffix || Date.now().toString()
  const farmer = await createTestFarmer(prisma, `swaps-farmer-${suffix}`)
  const customerEmail = opts?.customerEmail || `swaps-customer-${suffix}@example.com`
  const customer = await createTestCustomer(prisma, { email: customerEmail })

  const carrot = await prisma.product.create({
    data: { name: `Test Swaps Carrot ${suffix}`, farmerId: farmer.id, active: true },
  })

  const potato = await prisma.product.create({
    data: { name: `Test Swaps Potato ${suffix}`, farmerId: farmer.id, active: true },
  })

  const apple = await prisma.product.create({
    data: { name: `Test Swaps Apple ${suffix}`, farmerId: farmer.id, active: true },
  })

  const banana = await prisma.product.create({
    data: { name: `Test Swaps Banana ${suffix}`, farmerId: farmer.id, active: true },
  })

  const orange = await prisma.product.create({
    data: { name: `Test Swaps Orange ${suffix}`, farmerId: farmer.id, active: true },
  })

  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const basket = await prisma.basket.create({
    data: {
      name: `Test Swaps Basket ${suffix}`,
      orderDeadline: nextWeek,
      price: 25.0,
      deliveryDay: tomorrow,
      allowedSwaps: opts.allowedSwaps ?? 3,
      farmerId: farmer.id,
      published: true,
    },
  })

  const baseCarrot = await prisma.basketItem.create({
    data: { basketId: basket.id, productId: carrot.id, isBase: true },
  })

  const basePotato = await prisma.basketItem.create({
    data: { basketId: basket.id, productId: potato.id, isBase: true },
  })

  const swapApple = await prisma.basketItem.create({
    data: { basketId: basket.id, productId: apple.id, isBase: false },
  })

  const swapBanana = await prisma.basketItem.create({
    data: { basketId: basket.id, productId: banana.id, isBase: false },
  })

  const swapOrange = await prisma.basketItem.create({
    data: { basketId: basket.id, productId: orange.id, isBase: false },
  })

  const tokenValue = "test-swaps-token-" + Date.now()
  await prisma.inviteToken.create({
    data: {
      customerId: customer.id,
      basketId: basket.id,
      token: tokenValue,
      expiresAt: nextWeek,
    },
  })

  return {
    basket,
    tokenValue,
    baseCarrot,
    basePotato,
    swapApple,
    swapBanana,
    swapOrange,
  }
}

async function placeOrder(request: any, tokenValue: string, basketId: string, swapChoices: any[]) {
  return request.post("/api/orders", {
    data: {
      basketId,
      token: tokenValue,
      deliveryAddress: "123 Test St",
      deliveryCity: "Testville",
      deliveryPostalCode: "00000",
      swapChoices,
    },
  })
}

test.describe("Order Swaps", () => {
  test("order with swaps within allowed limit is accepted and persisted", async ({ request }) => {
    const prisma = createPrisma()
    const ctx = await createBasketWithSwaps(prisma)
    await prisma.$disconnect()

    const res = await placeOrder(request, ctx.tokenValue, ctx.basket.id, [
      { baseItemId: ctx.baseCarrot.id, swapItemId: ctx.swapApple.id },
      { baseItemId: ctx.basePotato.id, swapItemId: ctx.swapBanana.id },
    ])

    expect(res.ok()).toBeTruthy()
    expect(res.status()).toBe(201)
    const order = await res.json()

    expect(order.swapChoices.length).toBe(2)
    const car = ctx.baseCarrot
    const app = ctx.swapApple
    const pot = ctx.basePotato
    const ban = ctx.swapBanana
    const found = order.swapChoices.map((c: any) => `${c.baseItemId}->${c.swapItemId}`).sort()
    expect(found).toContain(`${car.id}->${app.id}`)
    expect(found).toContain(`${pot.id}->${ban.id}`)
  })

  test("order without swaps is accepted", async ({ request }) => {
    const prisma = createPrisma()
    const ctx = await createBasketWithSwaps(prisma)
    await prisma.$disconnect()

    const res = await placeOrder(request, ctx.tokenValue, ctx.basket.id, [])

    expect(res.ok()).toBeTruthy()
    expect(res.status()).toBe(201)
    const order = await res.json()
    expect(order.swapChoices.length).toBe(0)
  })

  test("order with more swaps than allowed is rejected", async ({ request }) => {
    const prisma = createPrisma()
    const ctx = await createBasketWithSwaps(prisma, { allowedSwaps: 2 })
    await prisma.$disconnect()

    const res = await placeOrder(request, ctx.tokenValue, ctx.basket.id, [
      { baseItemId: ctx.baseCarrot.id, swapItemId: ctx.swapApple.id },
      { baseItemId: ctx.basePotato.id, swapItemId: ctx.swapBanana.id },
      { baseItemId: ctx.basePotato.id, swapItemId: ctx.swapOrange.id },
    ])

    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe("You can choose at most 2 swaps")
  })

  test("order swapping out a swap item is rejected", async ({ request }) => {
    const prisma = createPrisma()
    const ctx = await createBasketWithSwaps(prisma)
    await prisma.$disconnect()

    const res = await placeOrder(request, ctx.tokenValue, ctx.basket.id, [
      { baseItemId: ctx.swapApple.id, swapItemId: ctx.swapBanana.id },
    ])

    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe("One or more chosen base items are not part of this basket")
  })

  test("order choosing a swap item that is a base item is rejected", async ({ request }) => {
    const prisma = createPrisma()
    const ctx = await createBasketWithSwaps(prisma)
    await prisma.$disconnect()

    const res = await placeOrder(request, ctx.tokenValue, ctx.basket.id, [
      { baseItemId: ctx.baseCarrot.id, swapItemId: ctx.basePotato.id },
    ])

    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe("One or more chosen swap items are not part of this basket")
  })

  test("order choosing the same base item twice is rejected", async ({ request }) => {
    const prisma = createPrisma()
    const ctx = await createBasketWithSwaps(prisma)
    await prisma.$disconnect()

    const res = await placeOrder(request, ctx.tokenValue, ctx.basket.id, [
      { baseItemId: ctx.baseCarrot.id, swapItemId: ctx.swapApple.id },
      { baseItemId: ctx.baseCarrot.id, swapItemId: ctx.swapBanana.id },
    ])

    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe("Each base item can only be swapped out once")
  })

  test("order choosing the same swap item twice is rejected", async ({ request }) => {
    const prisma = createPrisma()
    const ctx = await createBasketWithSwaps(prisma)
    await prisma.$disconnect()

    const res = await placeOrder(request, ctx.tokenValue, ctx.basket.id, [
      { baseItemId: ctx.baseCarrot.id, swapItemId: ctx.swapApple.id },
      { baseItemId: ctx.basePotato.id, swapItemId: ctx.swapApple.id },
    ])

    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe("Each swap item can only be chosen once")
  })

  test("order with a swap item from another basket is rejected", async ({ request }) => {
    const prisma = createPrisma()
    const ctx = await createBasketWithSwaps(prisma, { suffix: "main-" + Date.now() })
    const other = await createBasketWithSwaps(prisma, { suffix: "other-" + Date.now() })
    await prisma.$disconnect()

    const res = await placeOrder(request, ctx.tokenValue, ctx.basket.id, [
      { baseItemId: ctx.baseCarrot.id, swapItemId: other.swapApple.id },
    ])

    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe("One or more chosen swap items are not part of this basket")
  })
})
