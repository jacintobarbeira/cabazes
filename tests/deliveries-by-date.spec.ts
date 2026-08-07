import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestCustomer, loginAsFarmerPage, TEST_PASSWORDS } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("Deliveries by Date", () => {
  test("two baskets same date shows combined count", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket1 = await prisma.basket.create({
      data: {
        name: "Test Deliveries Date Basket A",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: deliveryDate,
        farmerId: farmer.id,
        published: true,
      },
    })

    const basket2 = await prisma.basket.create({
      data: {
        name: "Test Deliveries Date Basket B",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: deliveryDate,
        farmerId: farmer.id,
        published: true,
      },
    })

    const token1 = "test-deliveries-date-token-1-" + Date.now()
    const token2 = "test-deliveries-date-token-2-" + Date.now()

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
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await request.post("/api/orders", {
      data: {
        basketId: basket2.id,
        token: token2,
        deliveryAddress: "456 Test Ave",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmerPage(page, farmer.email, TEST_PASSWORDS.farmer)

    const datesRes = await page.request.get("/api/deliveries/by-date")
    expect(datesRes.ok()).toBeTruthy()
    const dates = await datesRes.json()

    const dateKey = deliveryDate.toISOString().split("T")[0]
    const matchingDate = dates.find((d: { date: string }) => d.date === dateKey)
    expect(matchingDate).toBeTruthy()
    expect(matchingDate.totalOrders).toBe(2)
  })

  test("two baskets different dates show separate cards", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const date1 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const date2 = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket1 = await prisma.basket.create({
      data: {
        name: "Test Deliveries Date Different A",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: date1,
        farmerId: farmer.id,
        published: true,
      },
    })

    const basket2 = await prisma.basket.create({
      data: {
        name: "Test Deliveries Date Different B",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: date2,
        farmerId: farmer.id,
        published: true,
      },
    })

    const token1 = "test-deliveries-different-token-1-" + Date.now()
    const token2 = "test-deliveries-different-token-2-" + Date.now()

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
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await request.post("/api/orders", {
      data: {
        basketId: basket2.id,
        token: token2,
        deliveryAddress: "456 Test Ave",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmerPage(page, farmer.email, TEST_PASSWORDS.farmer)

    const datesRes = await page.request.get("/api/deliveries/by-date")
    expect(datesRes.ok()).toBeTruthy()
    const dates = await datesRes.json()

    const dateKey1 = date1.toISOString().split("T")[0]
    const dateKey2 = date2.toISOString().split("T")[0]

    const matchingDate1 = dates.find((d: { date: string }) => d.date === dateKey1)
    const matchingDate2 = dates.find((d: { date: string }) => d.date === dateKey2)

    expect(matchingDate1).toBeTruthy()
    expect(matchingDate2).toBeTruthy()
    expect(matchingDate1.totalOrders).toBe(1)
    expect(matchingDate2.totalOrders).toBe(1)
  })

  test("clicking date shows orders from all baskets on that date", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket1 = await prisma.basket.create({
      data: {
        name: "Test Deliveries Date Multi Basket A",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: deliveryDate,
        farmerId: farmer.id,
        published: true,
      },
    })

    const basket2 = await prisma.basket.create({
      data: {
        name: "Test Deliveries Date Multi Basket B",
        orderDeadline: nextWeek,
        price: 25.0,
        deliveryDay: deliveryDate,
        farmerId: farmer.id,
        published: true,
      },
    })

    const token1 = "test-deliveries-multi-token-1-" + Date.now()
    const token2 = "test-deliveries-multi-token-2-" + Date.now()

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
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await request.post("/api/orders", {
      data: {
        basketId: basket2.id,
        token: token2,
        deliveryAddress: "456 Test Ave",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        swapChoices: [],
      },
    })

    await loginAsFarmerPage(page, farmer.email, TEST_PASSWORDS.farmer)

    const dateKey = deliveryDate.toISOString().split("T")[0]
    const ordersRes = await page.request.get(`/api/deliveries/by-date?date=${dateKey}`)
    expect(ordersRes.ok()).toBeTruthy()
    const orders = await ordersRes.json()

    expect(orders.length).toBe(2)

    const basketNames = orders.map((o: { basketName: string }) => o.basketName)
    expect(basketNames).toContain("Test Deliveries Date Multi Basket A")
    expect(basketNames).toContain("Test Deliveries Date Multi Basket B")
  })

  test("cancelled orders excluded from deliveries", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer = await createTestCustomer(prisma)

    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Deliveries Date Cancelled Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: deliveryDate,
        farmerId: farmer.id,
        published: true,
      },
    })

    await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "CANCELLED",
      },
    })

    await prisma.$disconnect()

    await loginAsFarmerPage(page, farmer.email, TEST_PASSWORDS.farmer)

    const dateKey = deliveryDate.toISOString().split("T")[0]
    const ordersRes = await page.request.get(`/api/deliveries/by-date?date=${dateKey}`)
    expect(ordersRes.ok()).toBeTruthy()
    const orders = await ordersRes.json()

    expect(orders.length).toBe(0)

    const datesRes = await page.request.get("/api/deliveries/by-date")
    expect(datesRes.ok()).toBeTruthy()
    const dates = await datesRes.json()
    const matchingDate = dates.find((d: { date: string }) => d.date === dateKey)
    expect(matchingDate).toBeFalsy()
  })

  test("farmer cannot see another farmer's delivery dates", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer1 = await createTestFarmer(prisma)
    const secondFarmer = await createTestFarmer(prisma, "second-farmer")
    const customer = await createTestCustomer(prisma)

    const deliveryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.basket.create({
      data: {
        name: "Test Deliveries Date Isolation Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: deliveryDate,
        farmerId: secondFarmer.id,
        published: true,
      },
    })

    await prisma.$disconnect()

    await loginAsFarmerPage(page, farmer1.email, TEST_PASSWORDS.farmer)

    const datesRes = await page.request.get("/api/deliveries/by-date")
    expect(datesRes.ok()).toBeTruthy()
    const dates = await datesRes.json()

    const dateKey = deliveryDate.toISOString().split("T")[0]
    const matchingDate = dates.find((d: { date: string }) => d.date === dateKey)
    expect(matchingDate).toBeFalsy()
  })
})
