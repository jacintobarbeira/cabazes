import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function loginAs(page: any, email: string, password: string) {
  await page.goto("/login")
  await page.fill('input[name="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*(dashboard|my-orders)/, { timeout: 10000 })
}

test.describe("Order Status Transitions", () => {
  test("farmer confirms PENDING order", async ({ page, request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Confirm Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const tokenValue = "test-confirm-token-" + Date.now()
    await prisma.inviteToken.create({
      data: {
        customerId: customer!.id,
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

    await loginAs(page, "farmer@cabazes.com", "Farmer123!")

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

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Already Confirmed Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer!.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "CONFIRMED",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, "farmer@cabazes.com", "Farmer123!")

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

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Deliver Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer!.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "CONFIRMED",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, "farmer@cabazes.com", "Farmer123!")

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

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Deliver Pending Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer!.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "PENDING",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, "farmer@cabazes.com", "Farmer123!")

    const deliverRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "DELIVERED" },
    })
    expect(deliverRes.ok()).toBeFalsy()
    expect(deliverRes.status()).toBe(400)
  })

  test("farmer cannot deliver already DELIVERED order", async ({ page, request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Already Delivered Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer!.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "DELIVERED",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, "farmer@cabazes.com", "Farmer123!")

    const deliverRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "DELIVERED" },
    })
    expect(deliverRes.ok()).toBeFalsy()
    expect(deliverRes.status()).toBe(400)
  })

  test("customer cancels CONFIRMED order", async ({ page, request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Cancel Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer!.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "CONFIRMED",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, "alice@example.com", "Customer123!")

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

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Cancel Pending Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer!.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "PENDING",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, "alice@example.com", "Customer123!")

    const cancelRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELLED" },
    })
    expect(cancelRes.ok()).toBeFalsy()
    expect(cancelRes.status()).toBe(400)
  })

  test("customer cannot cancel DELIVERED order", async ({ page, request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Cancel Delivered Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer!.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "DELIVERED",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, "alice@example.com", "Customer123!")

    const cancelRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELLED" },
    })
    expect(cancelRes.ok()).toBeFalsy()
    expect(cancelRes.status()).toBe(400)
  })

  test("customer cannot cancel already CANCELLED order", async ({ page, request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Already Cancelled Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer!.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "CANCELLED",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, "alice@example.com", "Customer123!")

    const cancelRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELLED" },
    })
    expect(cancelRes.ok()).toBeFalsy()
    expect(cancelRes.status()).toBe(400)
  })

  test("farmer cannot cancel order", async ({ page, request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Farmer Cancel Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer!.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "CONFIRMED",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, "farmer@cabazes.com", "Farmer123!")

    const cancelRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELLED" },
    })
    expect(cancelRes.ok()).toBeFalsy()
    expect(cancelRes.status()).toBe(400)
  })

  test("farmer cannot confirm another farmer's order", async ({ page, request }) => {
    const prisma = createPrisma()

    const farmer1 = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    let secondFarmer = await prisma.user.findUnique({
      where: { email: "test-farmer-2@example.com" },
    })

    if (!secondFarmer) {
      secondFarmer = await prisma.user.create({
        data: {
          email: "test-farmer-2@example.com",
          name: "Second Farmer",
          passwordHash: "hashed",
          role: "FARMER",
          phone: "+0000000000",
        },
      })
    }

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Cross Farmer Confirm Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: secondFarmer!.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer!.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "PENDING",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, "farmer@cabazes.com", "Farmer123!")

    const confirmRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CONFIRMED" },
    })
    expect(confirmRes.ok()).toBeFalsy()
    expect(confirmRes.status()).toBe(401)
  })

  test("customer cannot cancel another customer's order", async ({ page, request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const customer1 = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    let customer2 = await prisma.user.findUnique({
      where: { email: "test-customer-2@example.com" },
    })

    if (!customer2) {
      customer2 = await prisma.user.create({
        data: {
          email: "test-customer-2@example.com",
          name: "Second Customer",
          passwordHash: await require("bcryptjs").hash("Customer123!", 10),
          role: "CUSTOMER",
          phone: "+1111111111",
        },
      })
    }

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        name: "Test Cross Customer Cancel Basket",
        orderDeadline: nextWeek,
        price: 30.0,
        deliveryDay: tomorrow,
        farmerId: farmer!.id,
        published: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        basketId: basket.id,
        customerId: customer1!.id,
        deliveryAddress: "123 Test St",
        deliveryCity: "Testville",
        deliveryPostalCode: "00000",
        status: "CONFIRMED",
      },
    })

    await prisma.$disconnect()

    await loginAs(page, "test-customer-2@example.com", "Customer123!")

    const cancelRes = await page.request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELLED" },
    })
    expect(cancelRes.ok()).toBeFalsy()
    expect(cancelRes.status()).toBe(401)
  })
})
