import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestCustomer, TEST_PASSWORDS } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function loginAsFarmer(page: any, email: string, password: string) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[name="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
}

test.describe("Deliveries - Order Link", () => {
  test("delivery addresses API returns basketId", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Deliveries Link Basket " + Date.now(),
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: deliveryDate,
        farmerId: farmer.id,
        published: true,
      },
    })

    const tokenValue = "test-deliveries-link-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "123 Link St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)

    const dateKey = deliveryDate.toISOString().split("T")[0]
    const ordersRes = await page.request.get(`/api/deliveries/by-date?date=${dateKey}`)
    expect(ordersRes.ok()).toBeTruthy()
    const orders = await ordersRes.json()

    expect(orders.length).toBe(1)
    expect(orders[0].basketId).toBe(basket.id)
    expect(orders[0].basketName).toBeTruthy()
  })

  test("deliveries page renders basket link to basket detail", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Deliveries Link UI Basket",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: deliveryDate,
        farmerId: farmer.id,
        published: true,
      },
    })

    const tokenValue = "test-deliveries-link-ui-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "123 Link UI St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)
    await page.goto("/farmer/deliveries")

    const dateKey = deliveryDate.toISOString().split("T")[0]
    const dateRes = await page.request.get("/api/deliveries/by-date")
    const dates = await dateRes.json()
    const matching = dates.find((d: any) => d.date === dateKey)
    expect(matching).toBeTruthy()

    await page.locator(`text=${matching.totalOrders} deliveries`).first().click()

    const link = page.locator(`a[href="/farmer/baskets/${basket.id}"]`)
    await expect(link.first()).toBeVisible({ timeout: 5000 })
  })

  test("multiple orders show links to their respective baskets", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket1 = await prisma.basket.create({
      data: {
        name: "Test Deliveries Multi Link A",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: deliveryDate,
        farmerId: farmer.id,
        published: true,
      },
    })

    const basket2 = await prisma.basket.create({
      data: {
        name: "Test Deliveries Multi Link B",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: deliveryDate,
        farmerId: farmer.id,
        published: true,
      },
    })

    const token1 = "test-deliveries-multi-link-token-1-" + Date.now()
    const token2 = "test-deliveries-multi-link-token-2-" + Date.now()

    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket1.id,
        token: token1,
        expiresAt: nextWeek,
      },
    })

    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket2.id,
        token: token2,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await request.post("/api/orders", {
      data: {
        basketId: basket1.id,
        token: token1,
        deliveryAddress: "111 Multi St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await request.post("/api/orders", {
      data: {
        basketId: basket2.id,
        token: token2,
        deliveryAddress: "222 Multi Ave",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)

    const dateKey = deliveryDate.toISOString().split("T")[0]
    const ordersRes = await page.request.get(`/api/deliveries/by-date?date=${dateKey}`)
    expect(ordersRes.ok()).toBeTruthy()
    const orders = await ordersRes.json()

    expect(orders.length).toBe(2)
    const basketIds = orders.map((o: any) => o.basketId).sort()
    expect(basketIds).toContain(basket1.id)
    expect(basketIds).toContain(basket2.id)

    for (const order of orders) {
      expect(order.basketId).toBeTruthy()
      expect(typeof order.basketId).toBe("string")
    }
  })
})
