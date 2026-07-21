import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("Admin Features", () => {
  test("admin creates farmer and farmer can login", async ({ page, request }) => {
    const adminRes = await request.post("/api/auth/login", {
      data: {
        email: "admin@cabazes.com",
        password: "Admin123!",
      },
    })
    expect(adminRes.ok()).toBeTruthy()

    const createRes = await request.post("/api/admin/farmers", {
      data: {
        name: "Test Admin Farmer",
        email: "test-admin-farmer@example.com",
        phone: "+1234567890",
      },
    })
    expect(createRes.ok()).toBeTruthy()
    expect(createRes.status()).toBe(201)
    const farmerData = await createRes.json()
    expect(farmerData.tempPassword).toBeTruthy()
    expect(farmerData.role).toBe("FARMER")

    const listRes = await request.get("/api/admin/farmers")
    expect(listRes.ok()).toBeTruthy()
    const farmers = await listRes.json()
    expect(farmers.length).toBeGreaterThanOrEqual(1)
    const createdFarmer = farmers.find((f: any) => f.email === "test-admin-farmer@example.com")
    expect(createdFarmer).toBeTruthy()
  })

  test("admin updates farmer name and phone", async ({ page, request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    await prisma.$disconnect()

    const adminRes = await request.post("/api/auth/login", {
      data: {
        email: "admin@cabazes.com",
        password: "Admin123!",
      },
    })
    expect(adminRes.ok()).toBeTruthy()

    const updateRes = await request.patch(`/api/admin/farmers/${farmer!.id}`, {
      data: {
        name: "Updated Farmer Name",
        phone: "+9999999999",
      },
    })
    expect(updateRes.ok()).toBeTruthy()
    const updated = await updateRes.json()
    expect(updated.name).toBe("Updated Farmer Name")
    expect(updated.phone).toBe("+9999999999")
  })

  test("admin disables farmer and all helpers", async ({ page, request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const helperPassword = "TempPass123!"
    const passwordHash = await require("bcryptjs").hash(helperPassword, 10)

    await prisma.user.create({
      data: {
        email: "test-admin-disable-helper@example.com",
        name: "Test Helper",
        passwordHash,
        role: "FARMER_HELPER",
        phone: "+1234567890",
        managedById: farmer!.id,
        mustResetPassword: false,
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

    const disableRes = await request.patch(`/api/admin/farmers/${farmer!.id}/toggle-disabled`)
    expect(disableRes.ok()).toBeTruthy()
    const result = await disableRes.json()
    expect(result.disabled).toBe(true)
    expect(result.helpersAffected).toBe(1)

    const farmerLoginRes = await request.post("/api/auth/login", {
      data: {
        email: "farmer@cabazes.com",
        password: "Farmer123!",
      },
    })
    expect(farmerLoginRes.ok()).toBeFalsy()

    const helperLoginRes = await request.post("/api/auth/login", {
      data: {
        email: "test-admin-disable-helper@example.com",
        password: helperPassword,
      },
    })
    expect(helperLoginRes.ok()).toBeFalsy()
  })

  test("admin enables farmer and all helpers can login again", async ({ page, request }) => {
    const prisma = createPrisma()

    const farmer = await prisma.user.findUnique({
      where: { email: "farmer@cabazes.com" },
    })

    const helperPassword = "TempPass123!"
    const passwordHash = await require("bcryptjs").hash(helperPassword, 10)

    await prisma.user.update({
      where: { id: farmer!.id },
      data: { disabled: true },
    })

    await prisma.user.create({
      data: {
        email: "test-admin-enable-helper@example.com",
        name: "Test Helper",
        passwordHash,
        role: "FARMER_HELPER",
        phone: "+1234567890",
        managedById: farmer!.id,
        mustResetPassword: false,
        disabled: true,
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

    const enableRes = await request.patch(`/api/admin/farmers/${farmer!.id}/toggle-disabled`)
    expect(enableRes.ok()).toBeTruthy()
    const result = await enableRes.json()
    expect(result.disabled).toBe(false)

    const farmerLoginRes = await request.post("/api/auth/login", {
      data: {
        email: "farmer@cabazes.com",
        password: "Farmer123!",
      },
    })
    expect(farmerLoginRes.ok()).toBeTruthy()

    const helperLoginRes = await request.post("/api/auth/login", {
      data: {
        email: "test-admin-enable-helper@example.com",
        password: helperPassword,
      },
    })
    expect(helperLoginRes.ok()).toBeTruthy()
  })

  test("non-admin cannot access admin routes", async ({ page, request }) => {
    const farmerRes = await request.post("/api/auth/login", {
      data: {
        email: "farmer@cabazes.com",
        password: "Farmer123!",
      },
    })
    expect(farmerRes.ok()).toBeTruthy()

    const listRes = await request.get("/api/admin/farmers")
    expect(listRes.ok()).toBeFalsy()
    expect(listRes.status()).toBe(401)

    const createRes = await request.post("/api/admin/farmers", {
      data: {
        name: "Unauthorized Farmer",
        email: "unauthorized@example.com",
      },
    })
    expect(createRes.ok()).toBeFalsy()
    expect(createRes.status()).toBe(401)
  })
})
