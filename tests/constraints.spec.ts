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

test.describe("Basket Constraints", () => {
  test("should reject duplicate basket name and delivery date", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const deliveryDay = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    await prisma.basket.create({
      data: {
        name: "Duplicate Test Basket",
        description: "First basket",
        orderDeadline: nextWeek,
        price: 20.0,
        deliveryDay,
        farmerId: farmer.id,
        published: false,
      },
    })

    try {
      await prisma.basket.create({
        data: {
          name: "Duplicate Test Basket",
          description: "Second basket with same name and date",
          orderDeadline: nextWeek,
          price: 25.0,
          deliveryDay,
          farmerId: farmer.id,
          published: false,
        },
      })
      throw new Error("Should have thrown")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ""
      expect(message).toMatch(/Unique constraint failed/)
    }

    await prisma.$disconnect()
  })

  test("should handle basket with no items gracefully", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const deliveryDay = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Empty Basket",
        description: "Basket with no items",
        orderDeadline: nextWeek,
        price: 20.0,
        deliveryDay,
        farmerId: farmer.id,
        published: false,
      },
    })

    await prisma.$disconnect()

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)

    await page.goto(`/farmer/baskets/${basket.id}`)
    await expect(page.getByText("Test Empty Basket")).toBeVisible()
    await expect(page.getByText("No base items")).toBeVisible()
  })

  test("should show not found for non-existent basket", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    await prisma.$disconnect()

    await loginAsFarmer(page, farmer.email, TEST_PASSWORDS.farmer)

    await page.goto("/farmer/baskets/non-existent-id")
    await expect(page.getByText("Basket not found")).toBeVisible()
  })
})

test.describe("Order Constraints", () => {
  test("should reject customer placing second order for same basket", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Single Order Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer.id,
        published: true,
      },
    })

    const tokenValue = "test-single-order-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: basket.id,
        token: tokenValue,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    const firstRes = await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        deliveryNotes: "First order",
        swapChoices: [],
      },
    })
    expect(firstRes.ok()).toBeTruthy()
    expect(firstRes.status()).toBe(201)

    const secondRes = await request.post("/api/orders", {
      data: {
        basketId: basket.id,
        token: tokenValue,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        deliveryNotes: "Second order attempt",
        swapChoices: [],
      },
    })

    expect(secondRes.ok()).toBeFalsy()
    expect(secondRes.status()).toBe(400)
    const errorData = await secondRes.json()
    expect(["Token has already been used", "You have already placed an order for this basket"]).toContain(errorData.error)
  })

  test("should prevent deleting basket that has orders", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Restrict Delete Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer.id,
        published: true,
      },
    })

    const tokenValue = "test-restrict-delete-token-" + Date.now()
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
        swapChoices: [],
      },
    })
    expect(orderRes.status()).toBe(201)

    const prisma2 = createPrisma()

    try {
      await prisma2.basket.delete({
        where: { id: basket.id },
      })
      throw new Error("Should have thrown")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ""
      expect(message).toMatch(/Foreign key constraint violated/)
    }

    await prisma2.$disconnect()
  })

  test("should prevent deleting customer that has orders", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Restrict Delete Basket 2",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer.id,
        published: true,
      },
    })

    const tokenValue = "test-restrict-customer-token-" + Date.now()
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
        swapChoices: [],
      },
    })
    expect(orderRes.status()).toBe(201)

    const prisma2 = createPrisma()

    try {
      await prisma2.user.delete({
        where: { id: customer.id },
      })
      throw new Error("Should have thrown")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ""
      expect(message).toMatch(/Foreign key constraint violated/)
    }

    await prisma2.$disconnect()
  })

  test("should only return orders for the logged-in farmer", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer1 = await createTestFarmer(prisma)
    const farmer2 = await createTestFarmer(prisma, `constraints-farmer-2-${Date.now()}`)
    const customer = await createTestCustomer(prisma)

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const farmer1Basket = await prisma.basket.create({
      data: {
        name: "Test Farmer 1 Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer1.id,
        published: true,
      },
    })

    const farmer2Basket = await prisma.basket.create({
      data: {
        name: "Test Farmer 2 Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer2.id,
        published: true,
      },
    })

    const token1 = "test-farmer1-order-token-" + Date.now()
    const token2 = "test-farmer2-order-token-" + Date.now()

    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: farmer1Basket.id,
        token: token1,
        expiresAt: nextWeek,
      },
    })

    await prisma.inviteToken.create({
      data: {
        customerId: customer.id,
        basketId: farmer2Basket.id,
        token: token2,
        expiresAt: nextWeek,
      },
    })

    await prisma.$disconnect()

    await request.post("/api/orders", {
      data: {
        basketId: farmer1Basket.id,
        token: token1,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await request.post("/api/orders", {
      data: {
        basketId: farmer2Basket.id,
        token: token2,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmer(page, farmer1.email, TEST_PASSWORDS.farmer)

    const ordersRes = await page.request.get("/api/orders")
    expect(ordersRes.ok()).toBeTruthy()
    const orders = await ordersRes.json()

    for (const order of orders) {
      expect(order.basketName).not.toBe("Test Farmer 2 Basket")
    }

    const farmer1Orders = orders.filter((o: { basketName: string }) => o.basketName === "Test Farmer 1 Basket")
    expect(farmer1Orders.length).toBe(1)
  })

  test("should only show farmer own baskets and order counts on dashboard", async ({ page }) => {
    const prisma = createPrisma()
    const farmer1 = await createTestFarmer(prisma)
    const farmer2 = await createTestFarmer(prisma, `constraints-dash-f2-${Date.now()}`)

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.basket.create({
      data: {
        name: "Test Dashboard Farmer 1 Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer1.id,
        published: true,
      },
    })

    await prisma.basket.create({
      data: {
        name: "Test Dashboard Farmer 2 Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer2.id,
        published: true,
      },
    })

    await prisma.$disconnect()

    await loginAsFarmer(page, farmer1.email, TEST_PASSWORDS.farmer)

    await expect(page.getByText("Test Dashboard Farmer 1 Basket")).toBeVisible()
    await expect(page.getByText("Test Dashboard Farmer 2 Basket")).not.toBeVisible()
  })
})

test.describe("Farmer Data Isolation", () => {
  test("should not see other farmer's data via API", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer1 = await createTestFarmer(prisma)
    const farmer2 = await createTestFarmer(prisma, `constraints-iso-f2-${Date.now()}`)

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.basket.create({
      data: {
        name: "Test Isolation Farmer 1 Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer1.id,
        published: true,
      },
    })

    await prisma.basket.create({
      data: {
        name: "Test Isolation Farmer 2 Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer2.id,
        published: true,
      },
    })

    await prisma.product.create({
      data: {
        name: "Test Isolation Farmer 1 Product",
        farmerId: farmer1.id,
        active: true,
      },
    })

    await prisma.product.create({
      data: {
        name: "Test Isolation Farmer 2 Product",
        farmerId: farmer2.id,
        active: true,
      },
    })

    await prisma.$disconnect()

    await loginAsFarmer(page, farmer1.email, TEST_PASSWORDS.farmer)

    const basketsRes = await page.request.get("/api/baskets")
    expect(basketsRes.ok()).toBeTruthy()
    const baskets = await basketsRes.json()
    for (const b of baskets) {
      expect(b.name).not.toBe("Test Isolation Farmer 2 Basket")
    }

    const productsRes = await page.request.get("/api/products")
    expect(productsRes.ok()).toBeTruthy()
    const products = await productsRes.json()
    for (const p of products) {
      expect(p.name).not.toBe("Test Isolation Farmer 2 Product")
    }

    const ordersRes = await page.request.get("/api/orders")
    expect(ordersRes.ok()).toBeTruthy()
    const orders = await ordersRes.json()
    for (const o of orders) {
      expect(o.basketName).not.toBe("Test Isolation Farmer 2 Basket")
    }

    await expect(page.getByText("Test Isolation Farmer 1 Basket")).toBeVisible()
    await expect(page.getByText("Test Isolation Farmer 2 Basket")).not.toBeVisible()
  })
})

test.describe("Registration Constraints", () => {
  test("should reject registration with duplicate email", async ({ request }) => {
    const prisma = createPrisma()
    const customer = await createTestCustomer(prisma, `constraints-dup-${Date.now()}`)
    await prisma.$disconnect()

    const res = await request.post("/api/auth/register", {
      data: {
        name: "Duplicate User",
        email: customer.email,
        phone: "+9999999999",
        address: "999 Test Rd",
        city: "Testville",
        postalCode: "00000",
        password: "Password123!",
      },
    })

    expect(res.ok()).toBeFalsy()
    expect(res.status()).toBe(400)
    const errorData = await res.json()
    expect(errorData.error).toBe("User already exists")
  })

  test("should allow registration with unique email", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, `constraints-reg-${Date.now()}`)
    await prisma.$disconnect()

    const res = await request.post("/api/auth/register", {
      data: {
        name: "New Unique User",
        email: "newuser-" + Date.now() + "@example.com",
        phone: "+8888888888",
        address: "888 Unique St",
        city: "Uniquetown",
        postalCode: "11111",
        password: "Password123!",
        farmerIds: [farmer.id],
      },
    })

    expect(res.ok()).toBeTruthy()
    expect(res.status()).toBe(201)
  })
})
