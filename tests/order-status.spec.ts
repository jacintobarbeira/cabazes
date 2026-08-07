import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestCustomer, createTestAdmin, loginViaUI, TEST_PASSWORDS } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function loginAs(page: any, email: string, password: string) {
  await loginViaUI(page, email, password, /.*(dashboard|my-orders)/)
}

async function createOrderSetup(prisma: any, opts?: { basketName?: string; status?: string; customerEmail?: string }) {
  const farmer = await createTestFarmer(prisma)
  const customer = await createTestCustomer(prisma, opts?.customerEmail ? { email: opts.customerEmail } : undefined)

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const basket = await prisma.basket.create({
    data: {
      name: opts?.basketName || "Test Order Basket",
      orderDeadline: nextWeek,
      price: 30.0,
      deliveryDay: tomorrow,
      farmerId: farmer.id,
      published: true,
    },
  })

  const order = await prisma.order.create({
    data: {
      basketId: basket.id,
      customerId: customer.id,
      deliveryAddress: "123 Test St",
      deliveryCity: "Testville",
      deliveryPostalCode: "00000",
      status: opts?.status || "PENDING",
    },
  })

  return { farmer, customer, basket, order }
}

test.describe("Order Status Transitions", () => {
  test("farmer confirms PENDING order", async ({ page, request }) => {
    const prisma = createPrisma()
    const { farmer, basket } = await createOrderSetup(prisma, { basketName: "Test Confirm Basket" })

    const tokenValue = "test-confirm-token-" + Date.now()
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.inviteToken.create({
      data: {
        customerId: (await createTestCustomer(prisma, `order-status-confirm-${Date.now()}`)).id,
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
    const order = await orderRes.json()
    expect(order.status).toBe("PENDING")

    await loginAs(page, farmer.email, TEST_PASSWORDS.farmer)

    const confirmRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CONFIRMED" },
    })
    expect(confirmRes.ok()).toBeTruthy()
    expect(confirmRes.status()).toBe(200)
    const confirmedOrder = await confirmRes.json()
    expect(confirmedOrder.status).toBe("CONFIRMED")
  })

  test("farmer cannot confirm already CONFIRMED order", async ({ page, request }) => {
    const prisma = createPrisma()
    const { farmer, order } = await createOrderSetup(prisma, { basketName: "Test Already Confirmed Basket", status: "CONFIRMED" })
    await prisma.$disconnect()

    await loginAs(page, farmer.email, TEST_PASSWORDS.farmer)

    const confirmRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CONFIRMED" },
    })
    expect(confirmRes.ok()).toBeFalsy()
    expect(confirmRes.status()).toBe(400)
    const errorData = await confirmRes.json()
    expect(errorData.error).toContain("already")
  })

  test("farmer delivers CONFIRMED order", async ({ page, request }) => {
    const prisma = createPrisma()
    const { farmer, order } = await createOrderSetup(prisma, { basketName: "Test Deliver Basket", status: "CONFIRMED" })
    await prisma.$disconnect()

    await loginAs(page, farmer.email, TEST_PASSWORDS.farmer)

    const deliverRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "DELIVERED" },
    })
    expect(deliverRes.ok()).toBeTruthy()
    expect(deliverRes.status()).toBe(200)
    const deliveredOrder = await deliverRes.json()
    expect(deliveredOrder.status).toBe("DELIVERED")
  })

  test("farmer cannot deliver PENDING order", async ({ page, request }) => {
    const prisma = createPrisma()
    const { farmer, order } = await createOrderSetup(prisma, { basketName: "Test Deliver Pending Basket", status: "PENDING" })
    await prisma.$disconnect()

    await loginAs(page, farmer.email, TEST_PASSWORDS.farmer)

    const deliverRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "DELIVERED" },
    })
    expect(deliverRes.ok()).toBeFalsy()
    expect(deliverRes.status()).toBe(400)
  })

  test("farmer cannot deliver already DELIVERED order", async ({ page, request }) => {
    const prisma = createPrisma()
    const { farmer, order } = await createOrderSetup(prisma, { basketName: "Test Already Delivered Basket", status: "DELIVERED" })
    await prisma.$disconnect()

    await loginAs(page, farmer.email, TEST_PASSWORDS.farmer)

    const deliverRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "DELIVERED" },
    })
    expect(deliverRes.ok()).toBeFalsy()
    expect(deliverRes.status()).toBe(400)
  })

  test("customer cancels CONFIRMED order", async ({ page, request }) => {
    const prisma = createPrisma()
    const { customer, order } = await createOrderSetup(prisma, { basketName: "Test Cancel Basket", status: "CONFIRMED" })
    await prisma.$disconnect()

    await loginAs(page, customer.email, TEST_PASSWORDS.customer)

    const cancelRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELLED" },
    })
    expect(cancelRes.ok()).toBeTruthy()
    expect(cancelRes.status()).toBe(200)
    const cancelledOrder = await cancelRes.json()
    expect(cancelledOrder.status).toBe("CANCELLED")
  })

  test("customer cannot cancel PENDING order", async ({ page, request }) => {
    const prisma = createPrisma()
    const { customer, order } = await createOrderSetup(prisma, { basketName: "Test Cancel Pending Basket", status: "PENDING" })
    await prisma.$disconnect()

    await loginAs(page, customer.email, TEST_PASSWORDS.customer)

    const cancelRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELLED" },
    })
    expect(cancelRes.ok()).toBeFalsy()
    expect(cancelRes.status()).toBe(400)
  })

  test("customer cannot cancel DELIVERED order", async ({ page, request }) => {
    const prisma = createPrisma()
    const { customer, order } = await createOrderSetup(prisma, { basketName: "Test Cancel Delivered Basket", status: "DELIVERED" })
    await prisma.$disconnect()

    await loginAs(page, customer.email, TEST_PASSWORDS.customer)

    const cancelRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELLED" },
    })
    expect(cancelRes.ok()).toBeFalsy()
    expect(cancelRes.status()).toBe(400)
  })

  test("customer cannot cancel already CANCELLED order", async ({ page, request }) => {
    const prisma = createPrisma()
    const { customer, order } = await createOrderSetup(prisma, { basketName: "Test Already Cancelled Basket", status: "CANCELLED" })
    await prisma.$disconnect()

    await loginAs(page, customer.email, TEST_PASSWORDS.customer)

    const cancelRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELLED" },
    })
    expect(cancelRes.ok()).toBeFalsy()
    expect(cancelRes.status()).toBe(400)
  })

  test("farmer cannot cancel order", async ({ page, request }) => {
    const prisma = createPrisma()
    const { farmer, order } = await createOrderSetup(prisma, { basketName: "Test Farmer Cancel Basket", status: "CONFIRMED" })
    await prisma.$disconnect()

    await loginAs(page, farmer.email, TEST_PASSWORDS.farmer)

    const cancelRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELLED" },
    })
    expect(cancelRes.ok()).toBeFalsy()
    expect(cancelRes.status()).toBe(400)
  })

  test("farmer cannot confirm another farmer's order", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer1 = await createTestFarmer(prisma, { email: "test-farmer-1@example.com" })
    const farmer2 = await createTestFarmer(prisma, { email: "test-farmer-2@example.com" })
    const customer = await createTestCustomer(prisma)

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Cross Farmer Confirm Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer2.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "PENDING",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, farmer1.email, TEST_PASSWORDS.farmer)

    const confirmRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CONFIRMED" },
    })
    expect(confirmRes.ok()).toBeFalsy()
    expect(confirmRes.status()).toBe(401)
  })

  test("customer cannot cancel another customer's order", async ({ page, request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const customer1 = await createTestCustomer(prisma, { email: "test-order-customer-1@example.com" })
    const customer2 = await createTestCustomer(prisma, { email: "test-order-customer-2@example.com" })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Cross Customer Cancel Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer1.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "CONFIRMED",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, customer2.email, TEST_PASSWORDS.customer)

    const cancelRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELLED" },
    })
    expect(cancelRes.ok()).toBeFalsy()
    expect(cancelRes.status()).toBe(401)
  })
})
