import { test, expect } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

const CUSTOMER_EMAIL = "test-newfeat-customer@example.com"
const FARMER_A_EMAIL = "test-newfeat-farmera@example.com"
const FARMER_B_EMAIL = "test-newfeat-farmerb@example.com"
const PASSWORD = "Newfeat123!"

async function createFarmer(email: string) {
  const prisma = createPrisma()
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash(PASSWORD, 10)
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hash, disabled: false, role: "FARMER" },
    create: { email, name: email, passwordHash: hash, role: "FARMER", phone: "+1111111111" },
  })
  await prisma.$disconnect()
}

async function login(request: any, email: string) {
  const res = await request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  })
  expect(res.ok(), `login ${email}`).toBeTruthy()
}

test.beforeEach(async () => {
  await cleanupTestData()
  await createFarmer(FARMER_A_EMAIL)
  await createFarmer(FARMER_B_EMAIL)
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("New features", () => {
  test.describe("GET /api/farmers", () => {
    test("returns all active farmers", async ({ request }) => {
      const res = await request.get("/api/farmers")
      expect(res.ok()).toBeTruthy()
      const data = await res.json()
      expect(Array.isArray(data)).toBeTruthy()
      const emails = data.map((f: any) => f.email)
      expect(emails).toContain(FARMER_A_EMAIL)
      expect(emails).toContain(FARMER_B_EMAIL)
    })

    test("excludes disabled farmers", async ({ request }) => {
      const prisma = createPrisma()
      await prisma.user.update({ where: { email: FARMER_A_EMAIL }, data: { disabled: true } })
      await prisma.$disconnect()

      const res = await request.get("/api/farmers")
      const data = await res.json()
      const emails = data.map((f: any) => f.email)
      expect(emails).not.toContain(FARMER_A_EMAIL)
      expect(emails).toContain(FARMER_B_EMAIL)
    })
  })

  test.describe("Registration with farmer selection", () => {
    test("registers customer with selected farmers", async ({ request }) => {
      const farmers = await request.get("/api/farmers").then((r) => r.json())
      const farmerIds = farmers.map((f: any) => f.id)

      const res = await request.post("/api/auth/register", {
        data: {
          name: "Test Customer",
          email: CUSTOMER_EMAIL,
          phone: "+1234567890",
          address: "123 Main St",
          city: "Springfield",
          postalCode: "12345",
          password: PASSWORD,
          farmerIds,
        },
      })

      expect(res.ok()).toBeTruthy()
      const data = await res.json()
      expect(data.user.email).toBe(CUSTOMER_EMAIL)

      const prisma = createPrisma()
      const links = await prisma.customerFarmer.findMany({ where: { customerId: data.user.id } })
      expect(links.length).toBeGreaterThanOrEqual(2)
      const linkedFarmerIds = links.map((l: any) => l.farmerId)
      for (const fid of farmerIds) {
        expect(linkedFarmerIds).toContain(fid)
      }
      await prisma.$disconnect()
    })

    test("rejects registration with no farmers", async ({ request }) => {
      const res = await request.post("/api/auth/register", {
        data: {
          name: "Test Customer",
          email: CUSTOMER_EMAIL,
          phone: "+1234567890",
          address: "123 Main St",
          password: PASSWORD,
          farmerIds: [],
        },
      })

      expect(res.status()).toBe(400)
      const data = await res.json()
      expect(data.error).toContain("farmer")
    })

    test("rejects registration with invalid farmer ID", async ({ request }) => {
      const res = await request.post("/api/auth/register", {
        data: {
          name: "Test Customer",
          email: CUSTOMER_EMAIL,
          phone: "+1234567890",
          address: "123 Main St",
          password: PASSWORD,
          farmerIds: ["invalid-id"],
        },
      })

      expect(res.status()).toBe(400)
    })
  })

  test.describe("Customer farmer management", () => {
    test("lists subscribed farmers", async ({ request }) => {
      await login(request, FARMER_A_EMAIL)
      const farmers = await request.get("/api/farmers").then((r) => r.json())
      const farmerA = farmers.find((f: any) => f.email === FARMER_A_EMAIL)

      await request.post("/api/auth/register", {
        data: {
          name: "Test Customer",
          email: CUSTOMER_EMAIL,
          phone: "+1234567890",
          address: "123 Main St",
          password: PASSWORD,
          farmerIds: [farmerA.id],
        },
      })

      await login(request, CUSTOMER_EMAIL)
      const res = await request.get("/api/customers/me/farmers")
      expect(res.ok()).toBeTruthy()
      const data = await res.json()
      expect(data.length).toBe(1)
      expect(data[0].email).toBe(FARMER_A_EMAIL)
    })

    test("adds a farmer", async ({ request }) => {
      await login(request, FARMER_A_EMAIL)
      const farmers = await request.get("/api/farmers").then((r) => r.json())
      const farmerA = farmers.find((f: any) => f.email === FARMER_A_EMAIL)
      const farmerB = farmers.find((f: any) => f.email === FARMER_B_EMAIL)

      await request.post("/api/auth/register", {
        data: {
          name: "Test Customer",
          email: CUSTOMER_EMAIL,
          phone: "+1234567890",
          address: "123 Main St",
          password: PASSWORD,
          farmerIds: [farmerA.id],
        },
      })

      await login(request, CUSTOMER_EMAIL)
      const res = await request.post("/api/customers/me/farmers", {
        data: { farmerId: farmerB.id },
      })
      expect(res.ok()).toBeTruthy()

      const listRes = await request.get("/api/customers/me/farmers")
      const data = await listRes.json()
      expect(data.length).toBe(2)
    })

    test("blocks removal of last farmer", async ({ request }) => {
      await login(request, FARMER_A_EMAIL)
      const farmers = await request.get("/api/farmers").then((r) => r.json())
      const farmerA = farmers.find((f: any) => f.email === FARMER_A_EMAIL)

      await request.post("/api/auth/register", {
        data: {
          name: "Test Customer",
          email: CUSTOMER_EMAIL,
          phone: "+1234567890",
          address: "123 Main St",
          password: PASSWORD,
          farmerIds: [farmerA.id],
        },
      })

      await login(request, CUSTOMER_EMAIL)
      const res = await request.delete(`/api/customers/me/farmers?farmerId=${farmerA.id}`)
      expect(res.status()).toBe(400)
    })

    test("removes a farmer when multiple exist", async ({ request }) => {
      await login(request, FARMER_A_EMAIL)
      const farmers = await request.get("/api/farmers").then((r) => r.json())
      const farmerA = farmers.find((f: any) => f.email === FARMER_A_EMAIL)
      const farmerB = farmers.find((f: any) => f.email === FARMER_B_EMAIL)

      await request.post("/api/auth/register", {
        data: {
          name: "Test Customer",
          email: CUSTOMER_EMAIL,
          phone: "+1234567890",
          address: "123 Main St",
          password: PASSWORD,
          farmerIds: [farmerA.id, farmerB.id],
        },
      })

      await login(request, CUSTOMER_EMAIL)
      const res = await request.delete(`/api/customers/me/farmers?farmerId=${farmerA.id}`)
      expect(res.ok()).toBeTruthy()

      const listRes = await request.get("/api/customers/me/farmers")
      const data = await listRes.json()
      expect(data.length).toBe(1)
      expect(data[0].email).toBe(FARMER_B_EMAIL)
    })
  })

  test.describe("Customers scope includes registered customers", () => {
    test("farmer sees customers registered to them without orders", async ({ request }) => {
      await login(request, FARMER_A_EMAIL)
      const farmers = await request.get("/api/farmers").then((r) => r.json())
      const farmerA = farmers.find((f: any) => f.email === FARMER_A_EMAIL)

      await request.post("/api/auth/register", {
        data: {
          name: "Test Customer",
          email: CUSTOMER_EMAIL,
          phone: "+1234567890",
          address: "123 Main St",
          password: PASSWORD,
          farmerIds: [farmerA.id],
        },
      })

      const res = await request.get("/api/customers")
      expect(res.ok()).toBeTruthy()
      const data = await res.json()
      const emails = data.map((c: any) => c.email)
      expect(emails).toContain(CUSTOMER_EMAIL)
    })

    test("farmer does NOT see customers registered to other farmers", async ({ request }) => {
      await login(request, FARMER_B_EMAIL)
      const farmers = await request.get("/api/farmers").then((r) => r.json())
      const farmerB = farmers.find((f: any) => f.email === FARMER_B_EMAIL)

      await request.post("/api/auth/register", {
        data: {
          name: "Test Customer",
          email: CUSTOMER_EMAIL,
          phone: "+1234567890",
          address: "123 Main St",
          password: PASSWORD,
          farmerIds: [farmerB.id],
        },
      })

      await login(request, FARMER_A_EMAIL)
      const res = await request.get("/api/customers")
      expect(res.ok()).toBeTruthy()
      const data = await res.json()
      const emails = data.map((c: any) => c.email)
      expect(emails).not.toContain(CUSTOMER_EMAIL)
    })
  })

  test.describe("Password change", () => {
    test("changes password with correct current password", async ({ request }) => {
      await login(request, FARMER_A_EMAIL)

      const res = await request.post("/api/auth/change-password", {
        data: { currentPassword: PASSWORD, newPassword: "Newpass123!" },
      })
      expect(res.ok()).toBeTruthy()

      const loginRes = await request.post("/api/auth/login", {
        data: { email: FARMER_A_EMAIL, password: "Newpass123!" },
      })
      expect(loginRes.ok()).toBeTruthy()
    })

    test("rejects wrong current password", async ({ request }) => {
      await login(request, FARMER_A_EMAIL)

      const res = await request.post("/api/auth/change-password", {
        data: { currentPassword: "WrongPass1!", newPassword: "Newpass123!" },
      })
      expect(res.status()).toBe(403)
    })

    test("rejects weak new password", async ({ request }) => {
      await login(request, FARMER_A_EMAIL)

      const res = await request.post("/api/auth/change-password", {
        data: { currentPassword: PASSWORD, newPassword: "weak" },
      })
      expect(res.status()).toBe(400)
    })
  })
})
