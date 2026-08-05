import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestCustomer, TEST_PASSWORDS } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function loginAsCustomer(page: any, email: string, password: string) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[name="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/.*my-orders|.*dashboard/, { timeout: 10000 })
}

async function loginAsFarmer(page: any, email: string, password: string) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[name="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/.*dashboard/, { timeout: 10000 })
}

test.describe("Order Detail - Base Items", () => {
  test("customer orders API returns baseItems for each order", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const carrot = await prisma.product.create({
      data: { name: "Test Order Detail Carrot", farmerId: farmer.id, active: true },
    })
    const potato = await prisma.product.create({
      data: { name: "Test Order Detail Potato", farmerId: farmer.id, active: true },
    })
    const apple = await prisma.product.create({
      data: { name: "Test Order Detail Apple", farmerId: farmer.id, active: true },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Order Detail Basket " + Date.now(),
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: tomorrow,
        allowedSwaps: 2,
        farmerId: farmer.id,
        published: true,
      },
    })

    await prisma.basketItem.create({
      data: { basketId: basket.id, productId: carrot.id, isBase: true },
    })
    await prisma.basketItem.create({
      data: { basketId: basket.id, productId: potato.id, isBase: true },
    })
    await prisma.basketItem.create({
      data: { basketId: basket.id, productId: apple.id, isBase: false },
    })

    const tokenValue = "test-order-detail-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await page.request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsCustomer(page, customer.email, TEST_PASSWORDS.customer)

    const meRes = await page.request.get("/api/customers/me/orders")
    expect(meRes.ok()).toBeTruthy()
    const orders = await meRes.json()

    const myOrder = orders.find((o: any) => o.basketId === basket.id)
    expect(myOrder).toBeTruthy()
    expect(myOrder.baseItems.length).toBe(2)
    const names = myOrder.baseItems.map((i: any) => i.productName).sort()
    expect(names).toEqual(["Test Order Detail Carrot", "Test Order Detail Potato"])
  })

  test("farmer orders API returns baseItems for each order", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const lettuce = await prisma.product.create({
      data: { name: "Test Order Detail Lettuce", farmerId: farmer.id, active: true },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Order Detail Farmer Basket " + Date.now(),
        orderDeadline: nextWeek,
        price: 20.0,
        deliveryDay: tomorrow,
        allowedSwaps: 0,
        farmerId: farmer.id,
        published: true,
      },
    })

    await prisma.basketItem.create({
      data: { basketId: basket.id, productId: lettuce.id, isBase: true },
    })

    const tokenValue = "test-order-detail-farmer-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await page.request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "456 Oak Ave",
        deliveryCity: "Springfield",
        deliveryPostalCode: "12345",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)

    const ordersRes = await page.request.get("/api/orders")
    expect(ordersRes.ok()).toBeTruthy()
    const orders = await ordersRes.json()

    const myOrder = orders.find((o: any) => o.basketId === basket.id)
    expect(myOrder).toBeTruthy()
    expect(myOrder.baseItems.length).toBe(1)
    expect(myOrder.baseItems[0].productName).toBe("Test Order Detail Lettuce")
  })

  test("order with swaps shows baseItems and swapChoices separately", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const carrot = await prisma.product.create({
      data: { name: "Test Order Detail Mixed Carrot", farmerId: farmer.id, active: true },
    })
    const apple = await prisma.product.create({
      data: { name: "Test Order Detail Mixed Apple", farmerId: farmer.id, active: true },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Order Detail Mixed Basket " + Date.now(),
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: tomorrow,
        allowedSwaps: 1,
        farmerId: farmer.id,
        published: true,
      },
    })

    const baseCarrot = await prisma.basketItem.create({
      data: { basketId: basket.id, productId: carrot.id, isBase: true },
    })
    const swapApple = await prisma.basketItem.create({
      data: { basketId: basket.id, productId: apple.id, isBase: false },
    })

    const tokenValue = "test-order-detail-mixed-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await page.request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "789 Pine Rd",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [{ baseItemId: baseCarrot.id, swapItemId: swapApple.id }],
      },
    })

    await loginAsCustomer(page, customer.email, TEST_PASSWORDS.customer)

    const meRes = await page.request.get("/api/customers/me/orders")
    expect(meRes.ok()).toBeTruthy()
    const orders = await meRes.json()
    const myOrder = orders.find((o: any) => o.basketId === basket.id)

    expect(myOrder.baseItems.length).toBe(1)
    expect(myOrder.baseItems[0].productName).toBe("Test Order Detail Mixed Carrot")
    expect(myOrder.swapChoices.length).toBe(1)
    expect(myOrder.swapChoices[0].baseItemName).toBe("Test Order Detail Mixed Carrot")
    expect(myOrder.swapChoices[0].swapItemName).toBe("Test Order Detail Mixed Apple")
  })

  test("order without base items returns empty baseItems", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Order Detail Empty Basket " + Date.now(),
        orderDeadline: nextWeek,
        price: 10.0,
        deliveryDay: tomorrow,
        allowedSwaps: 0,
        farmerId: farmer.id,
        published: true,
      },
    })

    const tokenValue = "test-order-detail-empty-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await page.request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "100 Empty St",
        deliveryCity: "Nowhere",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsCustomer(page, customer.email, TEST_PASSWORDS.customer)

    const meRes = await page.request.get("/api/customers/me/orders")
    expect(meRes.ok()).toBeTruthy()
    const orders = await meRes.json()
    const myOrder = orders.find((o: any) => o.basketId === basket.id)

    expect(myOrder.baseItems.length).toBe(0)
    expect(myOrder.swapChoices.length).toBe(0)
  })
})
