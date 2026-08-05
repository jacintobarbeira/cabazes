import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestFarmer, createTestAdmin, TEST_PASSWORDS } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("Session revocation", () => {
  test("disabling a farmer immediately revokes an existing session", async ({ browser }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const admin = await createTestAdmin(prisma)
    await prisma.$disconnect()

    const farmerCtx = await browser.newContext({ baseURL: "http://localhost:3000" })
    const adminCtx = await browser.newContext({ baseURL: "http://localhost:3000" })

    const farmerLogin = await farmerCtx.request.post("/api/auth/login", {
      data: { email: farmer.email, password: TEST_PASSWORDS.farmer },
    })
    expect(farmerLogin.ok()).toBeTruthy()

    const meBefore = await farmerCtx.request.get("/api/farmer/me")
    expect(meBefore.status()).toBe(200)

    const adminLogin = await adminCtx.request.post("/api/auth/login", {
      data: { email: admin.email, password: TEST_PASSWORDS.admin },
    })
    expect(adminLogin.ok()).toBeTruthy()

    const disableRes = await adminCtx.request.patch(`/api/admin/farmers/${farmer.id}/toggle-disabled`)
    expect(disableRes.ok()).toBeTruthy()

    const meAfter = await farmerCtx.request.get("/api/farmer/me")
    expect(meAfter.status()).toBe(401)

    const ordersAfter = await farmerCtx.request.get("/api/orders")
    expect(ordersAfter.status()).toBe(401)

    const page = await farmerCtx.newPage()
    await page.goto("/farmer/dashboard")
    await expect(page).toHaveURL(/\/login/)

    await farmerCtx.close()
    await adminCtx.close()
  })

  test("deleting a farmer immediately revokes an existing session", async ({ browser }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    const admin = await createTestAdmin(prisma)
    await prisma.$disconnect()

    const farmerCtx = await browser.newContext({ baseURL: "http://localhost:3000" })
    const adminCtx = await browser.newContext({ baseURL: "http://localhost:3000" })

    const farmerLogin = await farmerCtx.request.post("/api/auth/login", {
      data: { email: farmer.email, password: TEST_PASSWORDS.farmer },
    })
    expect(farmerLogin.ok()).toBeTruthy()

    const meBefore = await farmerCtx.request.get("/api/farmer/me")
    expect(meBefore.status()).toBe(200)

    const adminLogin = await adminCtx.request.post("/api/auth/login", {
      data: { email: admin.email, password: TEST_PASSWORDS.admin },
    })
    expect(adminLogin.ok()).toBeTruthy()

    const deleteRes = await adminCtx.request.delete(`/api/admin/farmers/${farmer.id}`)
    expect(deleteRes.ok()).toBeTruthy()

    const meAfter = await farmerCtx.request.get("/api/farmer/me")
    expect(meAfter.status()).toBe(401)

    const page = await farmerCtx.newPage()
    await page.goto("/farmer/dashboard")
    await expect(page).toHaveURL(/\/login/)

    await farmerCtx.close()
    await adminCtx.close()
  })

  test("enabled farmer keeps an active session", async ({ browser }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma)
    await prisma.$disconnect()

    const farmerCtx = await browser.newContext({ baseURL: "http://localhost:3000" })

    const farmerLogin = await farmerCtx.request.post("/api/auth/login", {
      data: { email: farmer.email, password: TEST_PASSWORDS.farmer },
    })
    expect(farmerLogin.ok()).toBeTruthy()

    const me = await farmerCtx.request.get("/api/farmer/me")
    expect(me.status()).toBe(200)

    const page = await farmerCtx.newPage()
    await page.goto("/farmer/dashboard")
    await expect(page).toHaveURL(/\/farmer\/dashboard/)

    await farmerCtx.close()
  })
})
