import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

const TEST_FARMER_EMAIL = "test-delete-farmer@example.com"
const TEST_HELPER_EMAIL = "test-delete-helper@example.com"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

async function createTestFarmer(prisma: any) {
  const passwordHash = await require("bcryptjs").hash("TempPass123!", 10)
  return prisma.user.create({
    data: {
      email: TEST_FARMER_EMAIL,
      name: "Test Delete Farmer",
      passwordHash,
      role: "FARMER",
      phone: "+1234567890",
      mustResetPassword: false,
    },
  })
}

test.describe("Admin Delete Farmer", () => {
  test("admin deletes farmer and all associated data", async ({ request }) => {
    const prisma = createPrisma()

    const admin = await prisma.user.findUnique({
      where: { email: "admin@cabazes.com" },
    })

    const customer = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
    })

    const testFarmer = await createTestFarmer(prisma)

    const helperPasswordHash = await require("bcryptjs").hash("TempPass123!", 10)

    await prisma.user.create({
      data: {
        email: TEST_HELPER_EMAIL,
        name: "Delete Test Helper",
        passwordHash: helperPasswordHash,
        role: "FARMER_HELPER",
        managedById: testFarmer.id,
        mustResetPassword: false,
      },
    })

    const product = await prisma.product.create({
      data: {
        farmerId: testFarmer.id,
        name: "Test Delete Product",
        category: "vegetables",
      },
    })

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const basket = await prisma.basket.create({
      data: {
        farmerId: testFarmer.id,
        name: "Test Delete Basket",
        orderDeadline: nextWeek,
        price: 20,
        deliveryDay: tomorrow,
        published: true,
      },
    })

    await prisma.basketItem.create({
      data: {
        basketId: basket.id,
        productId: product.id,
        isBase: true,
      },
    })

    const token = await prisma.inviteToken.create({
      data: {
        customerId: customer!.id,
        basketId: basket.id,
        token: "test-delete-token",
        expiresAt: nextWeek,
      },
    })

    await prisma.order.create({
      data: {
        customerId: customer!.id,
        basketId: basket.id,
        inviteTokenId: token.id,
        status: "PENDING",
        deliveryAddress: "123 Test St",
        customerName: "Test Customer",
        customerEmail: customer!.email,
      },
    })

    await prisma.$disconnect()

    const adminRes = await request.post("/api/auth/login", {
      data: {
        email: "admin@cabazes.com",
        password: "Admin123!",
      },
    })
    expect(adminRes.ok()).toBeTruthy()

    const deleteRes = await request.delete(`/api/admin/farmers/${testFarmer.id}`)
    expect(deleteRes.ok()).toBeTruthy()
    expect(deleteRes.status()).toBe(200)

    const verifyPrisma = createPrisma()
    const deletedFarmer = await verifyPrisma.user.findUnique({
      where: { id: testFarmer.id },
    })
    expect(deletedFarmer).toBeNull()

    const remainingBaskets = await verifyPrisma.basket.count({
      where: { farmerId: testFarmer.id },
    })
    expect(remainingBaskets).toBe(0)

    const remainingProducts = await verifyPrisma.product.count({
      where: { farmerId: testFarmer.id },
    })
    expect(remainingProducts).toBe(0)

    const helper = await verifyPrisma.user.findUnique({
      where: { email: TEST_HELPER_EMAIL },
    })
    expect(helper).toBeNull()

    const farmerLoginRes = await request.post("/api/auth/login", {
      data: {
        email: TEST_FARMER_EMAIL,
        password: "TempPass123!",
      },
    })
    expect(farmerLoginRes.ok()).toBeFalsy()

    await verifyPrisma.$disconnect()
  })

  test("non-admin cannot delete a farmer", async ({ request }) => {
    const farmerRes = await request.post("/api/auth/login", {
      data: {
        email: "farmer@cabazes.com",
        password: "Farmer123!",
      },
    })
    expect(farmerRes.ok()).toBeTruthy()

    const deleteRes = await request.delete("/api/admin/farmers/some-id")
    expect(deleteRes.ok()).toBeFalsy()
    expect(deleteRes.status()).toBe(401)
  })

  test("delete non-existent farmer returns 404", async ({ request }) => {
    const adminRes = await request.post("/api/auth/login", {
      data: {
        email: "admin@cabazes.com",
        password: "Admin123!",
      },
    })
    expect(adminRes.ok()).toBeTruthy()

    const deleteRes = await request.delete("/api/admin/farmers/non-existent-id")
    expect(deleteRes.ok()).toBeFalsy()
    expect(deleteRes.status()).toBe(404)
  })
})
