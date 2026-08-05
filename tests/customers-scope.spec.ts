import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

const FARMER_SCOPE_EMAIL = "test-farmer-scope@example.com"
const HELPER_SCOPE_EMAIL = "test-helper-scope@example.com"
const CUSTOMER_SCOPE_EMAIL = "test-customer-scope@example.com"
const CUSTOMER_SCOPE_OTHER_EMAIL = "test-customer-scope-other@example.com"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function login(email: string, password: string, request: any) {
  const res = await request.post("/api/auth/login", { data: { email, password } })
  expect(res.ok()).toBeTruthy()
}

async function setup(prisma: any) {
  const passwordHash = await require("bcryptjs").hash("TempPass123!", 10)

  const farmer = await prisma.user.create({
    data: {
      email: FARMER_SCOPE_EMAIL,
      name: "Scope Farmer",
      passwordHash,
      role: "FARMER",
      mustResetPassword: false,
    },
  })

  await prisma.user.create({
    data: {
      email: HELPER_SCOPE_EMAIL,
      name: "Scope Helper",
      passwordHash,
      role: "FARMER_HELPER",
      managedById: farmer.id,
      mustResetPassword: false,
    },
  })

  const otherFarmer = await prisma.user.create({
    data: {
      email: "scope-other-farmer@example.com",
      name: "Other Farmer",
      passwordHash,
      role: "FARMER",
      mustResetPassword: false,
    },
  })

  const customer = await prisma.user.create({
    data: {
      email: CUSTOMER_SCOPE_EMAIL,
      name: "Scope Customer",
      passwordHash,
      role: "CUSTOMER",
      phone: "+1111111111",
      address: "10 Hidden St",
      city: "Springfield",
      postalCode: "12345",
      notes: "Sensitive delivery notes",
      mustResetPassword: false,
    },
  })

  const otherCustomer = await prisma.user.create({
    data: {
      email: CUSTOMER_SCOPE_OTHER_EMAIL,
      name: "Other Customer",
      passwordHash,
      role: "CUSTOMER",
      phone: "+2222222222",
      address: "20 Other St",
      city: "Shelbyville",
      postalCode: "67890",
      notes: "Other farmer notes",
      mustResetPassword: false,
    },
  })

  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const deliveryDay = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  const basket = await prisma.basket.create({
    data: {
      farmerId: farmer.id,
      name: "Scope Basket",
      orderDeadline: nextWeek,
      price: 20,
      deliveryDay,
      published: true,
    },
  })

  const otherBasket = await prisma.basket.create({
    data: {
      farmerId: otherFarmer.id,
      name: "Other Scope Basket",
      orderDeadline: nextWeek,
      price: 20,
      deliveryDay,
      published: true,
    },
  })

  const token = await prisma.inviteToken.create({
    data: {
      customerId: customer.id,
      basketId: basket.id,
      token: "test-customer-scope-token-" + Date.now(),
      expiresAt: nextWeek,
    },
  })

  await prisma.order.create({
    data: {
      customerId: customer.id,
      basketId: basket.id,
      inviteTokenId: token.id,
      status: "PENDING",
      deliveryAddress: "10 Hidden St",
      customerName: "Scope Customer",
      customerEmail: customer.email,
    },
  })

  await prisma.inviteToken.create({
    data: {
      customerId: otherCustomer.id,
      basketId: otherBasket.id,
      token: "test-customer-scope-other-token-" + Date.now(),
      expiresAt: nextWeek,
    },
  })

  return { farmer, otherFarmer }
}

test.describe("Customer scoping and PII", () => {
  test("farmer sees only customers linked to their own baskets", async ({ request }) => {
    const prisma = createPrisma()
    await setup(prisma)
    await prisma.$disconnect()

    await login(FARMER_SCOPE_EMAIL, "TempPass123!", request)

    const res = await request.get("/api/customers")
    expect(res.ok()).toBeTruthy()
    const customers = await res.json()

    const emails = customers.map((c: any) => c.email)
    expect(emails).toContain(CUSTOMER_SCOPE_EMAIL)
    expect(emails).not.toContain(CUSTOMER_SCOPE_OTHER_EMAIL)
  })

  test("farmer sees full PII for their customers", async ({ request }) => {
    const prisma = createPrisma()
    await setup(prisma)
    await prisma.$disconnect()

    await login(FARMER_SCOPE_EMAIL, "TempPass123!", request)

    const res = await request.get("/api/customers")
    const customers = await res.json()
    const customer = customers.find((c: any) => c.email === CUSTOMER_SCOPE_EMAIL)

    expect(customer.address).toBe("10 Hidden St")
    expect(customer.city).toBe("Springfield")
    expect(customer.postalCode).toBe("12345")
    expect(customer.notes).toBe("Sensitive delivery notes")
  })

  test("helper sees farmer customers but with PII hidden", async ({ request }) => {
    const prisma = createPrisma()
    await setup(prisma)
    await prisma.$disconnect()

    await login(HELPER_SCOPE_EMAIL, "TempPass123!", request)

    const res = await request.get("/api/customers")
    expect(res.ok()).toBeTruthy()
    const customers = await res.json()

    const emails = customers.map((c: any) => c.email)
    expect(emails).toContain(CUSTOMER_SCOPE_EMAIL)
    expect(emails).not.toContain(CUSTOMER_SCOPE_OTHER_EMAIL)

    const customer = customers.find((c: any) => c.email === CUSTOMER_SCOPE_EMAIL)
    expect(customer.address).toBeNull()
    expect(customer.city).toBeNull()
    expect(customer.postalCode).toBeNull()
    expect(customer.notes).toBeNull()
  })

  test("customer cannot access customers list", async ({ request }) => {
    const prisma = createPrisma()
    await setup(prisma)
    await prisma.$disconnect()

    await login(CUSTOMER_SCOPE_EMAIL, "TempPass123!", request)

    const res = await request.get("/api/customers")
    expect(res.ok()).toBeFalsy()
    expect(res.status()).toBe(401)
  })
})
