import { test, expect } from "@playwright/test"
import type { APIRequestContext } from "@playwright/test"
import {
  createPrisma,
  cleanupTestData,
  createTestFarmer,
  createTestCustomer,
  createTestEmailServerConfig,
  clearCapturedEmails,
  readCapturedEmails,
  TEST_PASSWORDS,
} from "./helpers"
import { decryptSecret } from "../src/lib/secret-box"
import { TEST_EMAIL_ENCRYPTION_KEY } from "../playwright.config"

// This spec decrypts stored envelopes in the test process to verify what was
// written at rest — use the same test-only key the webServer was given.
process.env.EMAIL_ENCRYPTION_KEY = TEST_EMAIL_ENCRYPTION_KEY

test.beforeEach(async () => {
  await cleanupTestData()
  clearCapturedEmails()
})

test.afterEach(async () => {
  await cleanupTestData()
  clearCapturedEmails()
})

async function login(request: APIRequestContext, email: string, password: string) {
  const res = await request.post("/api/auth/login", { data: { email, password } })
  expect(res.ok()).toBeTruthy()
}

test.describe("Per-farmer email server settings", () => {
  test("fresh farmer shows an unconfigured email server", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, "test-email-server-farmer")
    await prisma.$disconnect()

    await login(request, farmer.email, TEST_PASSWORDS.farmer)

    const res = await request.get("/api/farmer/email-server")
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.configured).toBe(false)
    expect(data.hasPassword).toBe(false)
  })

  test("farmer saves SMTP config; credentials encrypt at rest; password never returns to the client", async ({
    request,
  }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, "test-email-server-farmer")
    await prisma.$disconnect()

    await login(request, farmer.email, TEST_PASSWORDS.farmer)

    const patchRes = await request.patch("/api/farmer/email-server", {
      data: {
        host: "smtp.farm.example",
        port: 465,
        secure: true,
        username: "farm-user",
        password: "sup3r-s3cret",
        fromAddress: "orders@farm.example",
        fromName: "My Farm",
      },
    })
    expect(patchRes.ok()).toBeTruthy()
    const raw = await patchRes.text()
    const data = JSON.parse(raw)

    expect(data.configured).toBe(true)
    expect(data.host).toBe("smtp.farm.example")
    expect(data.port).toBe(465)
    expect(data.secure).toBe(true)
    expect(data.username).toBe("farm-user")
    expect(data.hasPassword).toBe(true)
    expect(data.fromAddress).toBe("orders@farm.example")
    expect(data.fromName).toBe("My Farm")

    // The password is write-only over the API.
    expect("password" in data).toBe(false)
    expect(raw).not.toContain("sup3r-s3cret")

    // Stored encrypted (AES-256-GCM v1 envelope), never as plaintext.
    const prisma2 = createPrisma()
    const row = await prisma2.emailServerConfig.findUnique({ where: { farmerId: farmer.id } })
    await prisma2.$disconnect()
    expect(row).not.toBeNull()
    expect(row!.passwordEnc).toMatch(/^v1:/)
    expect(row!.usernameEnc).toMatch(/^v1:/)
    expect(row!.passwordEnc).not.toContain("sup3r-s3cret")
    expect(row!.usernameEnc).not.toContain("farm-user")
    expect(decryptSecret(row!.passwordEnc!)).toBe("sup3r-s3cret")
    expect(decryptSecret(row!.usernameEnc!)).toBe("farm-user")

    // Re-saving the same password produces a different ciphertext (random IV).
    const again = await request.patch("/api/farmer/email-server", {
      data: { password: "sup3r-s3cret" },
    })
    expect(again.ok()).toBeTruthy()
    const prisma3 = createPrisma()
    const row2 = await prisma3.emailServerConfig.findUnique({ where: { farmerId: farmer.id } })
    await prisma3.$disconnect()
    expect(row2!.passwordEnc).not.toBe(row!.passwordEnc)
    expect(decryptSecret(row2!.passwordEnc!)).toBe("sup3r-s3cret")
  })

  test("omitting the password keeps it; null clears it", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, "test-email-server-farmer")
    await prisma.$disconnect()

    await login(request, farmer.email, TEST_PASSWORDS.farmer)

    const first = await request.patch("/api/farmer/email-server", {
      data: { host: "smtp.farm.example", username: "u", password: "keep-me-1" },
    })
    expect(first.ok()).toBeTruthy()

    const readRow = async () => {
      const p = createPrisma()
      const row = await p.emailServerConfig.findUnique({ where: { farmerId: farmer.id } })
      await p.$disconnect()
      return row
    }
    const originalEnc = (await readRow())!.passwordEnc

    // PATCH without a password field keeps the stored secret.
    const keep = await request.patch("/api/farmer/email-server", {
      data: { host: "smtp2.farm.example" },
    })
    expect(keep.ok()).toBeTruthy()
    expect((await keep.json()).host).toBe("smtp2.farm.example")
    expect((await readRow())!.passwordEnc).toBe(originalEnc)

    // Explicit null clears it.
    const clear = await request.patch("/api/farmer/email-server", {
      data: { password: null, username: null },
    })
    expect(clear.ok()).toBeTruthy()
    const cleared = await clear.json()
    expect(cleared.hasPassword).toBe(false)
    expect(cleared.username).toBeNull()
    const row = await readRow()
    expect(row!.passwordEnc).toBeNull()
    expect(row!.usernameEnc).toBeNull()
  })

  test("rejects invalid SMTP settings", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, "test-email-server-farmer")
    await prisma.$disconnect()

    await login(request, farmer.email, TEST_PASSWORDS.farmer)

    const cases: Array<Record<string, unknown>> = [
      { host: "" },
      { host: "smtp server with spaces" },
      { host: "smtp.farm.example", port: 70000 },
      { host: "smtp.farm.example", port: 0 },
      { host: "smtp.farm.example", port: "abc" },
      { host: "smtp.farm.example", fromAddress: "not-an-email" },
      { host: "x".repeat(300) },
    ]

    for (const payload of cases) {
      const res = await request.patch("/api/farmer/email-server", { data: payload })
      expect(res.status(), `payload ${JSON.stringify(payload)}`).toBe(400)
    }
  })

  test("only the farmer (not customers, helpers, or other farmers) can manage the config", async ({
    request,
  }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, "test-email-server-farmer")
    const customer = await createTestCustomer(prisma, "test-email-server-customer")
    const bcrypt = await import("bcryptjs")
    const helper = await prisma.user.create({
      data: {
        email: "test-email-server-helper@example.com",
        name: "Test Email Helper",
        role: "FARMER_HELPER",
        managedById: farmer.id,
        passwordHash: await bcrypt.hash(TEST_PASSWORDS.farmer, 10),
      },
    })
    await createTestEmailServerConfig(prisma, farmer.id, { password: "seeded" })
    await prisma.$disconnect()

    await login(request, customer.email, TEST_PASSWORDS.customer)
    expect((await request.get("/api/farmer/email-server")).status()).toBe(401)
    expect((await request.patch("/api/farmer/email-server", { data: { host: "evil.example" } })).status()).toBe(401)

    // A helper acts on the farmer's account for baskets, but cannot view or
    // change the farmer's SMTP credentials.
    await login(request, helper.email, TEST_PASSWORDS.farmer)
    expect((await request.get("/api/farmer/email-server")).status()).toBe(401)
    expect((await request.patch("/api/farmer/email-server", { data: { host: "evil.example" } })).status()).toBe(401)
    expect((await request.delete("/api/farmer/email-server")).status()).toBe(401)

    // A different farmer sees nothing about the first farmer's config.
    const prismaB = createPrisma()
    const farmerB = await createTestFarmer(prismaB, "test-email-server-farmer-b")
    await prismaB.$disconnect()

    await login(request, farmerB.email, TEST_PASSWORDS.farmer)
    const bGet = await request.get("/api/farmer/email-server")
    expect(bGet.ok()).toBeTruthy()
    expect((await bGet.json()).configured).toBe(false)

    // And the first farmer's stored row is untouched by all of the above.
    const prismaCheck = createPrisma()
    const row = await prismaCheck.emailServerConfig.findUnique({ where: { farmerId: farmer.id } })
    await prismaCheck.$disconnect()
    expect(row!.host).toBe("localhost")
  })

  test("DELETE removes the configuration", async ({ request }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, "test-email-server-farmer")
    await prisma.$disconnect()

    await login(request, farmer.email, TEST_PASSWORDS.farmer)

    const create = await request.patch("/api/farmer/email-server", {
      data: { host: "smtp.farm.example", password: "gone-soon" },
    })
    expect(create.ok()).toBeTruthy()

    const del = await request.delete("/api/farmer/email-server")
    expect(del.ok()).toBeTruthy()
    expect((await del.json()).configured).toBe(false)

    const prisma2 = createPrisma()
    const row = await prisma2.emailServerConfig.findUnique({ where: { farmerId: farmer.id } })
    await prisma2.$disconnect()
    expect(row).toBeNull()
  })

  test("send test email delivers to the farmer (captured via sink) and honours the config's From", async ({
    request,
  }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, "test-email-server-farmer")
    await prisma.$disconnect()

    await login(request, farmer.email, TEST_PASSWORDS.farmer)

    // Not configured yet → 400
    const early = await request.post("/api/farmer/email-server/test")
    expect(early.status()).toBe(400)

    const patch = await request.patch("/api/farmer/email-server", {
      data: {
        host: "smtp.farm.example",
        username: "farm-user",
        password: "sup3r-s3cret",
        fromAddress: "orders@farm.example",
        fromName: "My Farm",
      },
    })
    expect(patch.ok()).toBeTruthy()

    const res = await request.post("/api/farmer/email-server/test")
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.sent).toBe(true)
    expect(data.to).toBe(farmer.email)

    const emails = readCapturedEmails()
    expect(emails).toHaveLength(1)
    expect(emails[0].to).toBe(farmer.email)
    expect(emails[0].from).toBe('"My Farm" <orders@farm.example>')
    expect(emails[0].subject).toBe("Cabazes email server test")
  })

  test("farmer settings page shows the email server card with values but no password", async ({
    page,
  }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, "test-email-server-farmer")
    await createTestEmailServerConfig(prisma, farmer.id, {
      host: "smtp.farm.example",
      port: 587,
      username: "farm-user",
      password: "sup3r-s3cret",
      fromAddress: "orders@farm.example",
    })
    await prisma.$disconnect()

    await page.goto("/login")
    await page.fill('input[name="email"]', farmer.email)
    await page.fill('input[type="password"]', TEST_PASSWORDS.farmer)
    await page.click('button[type="submit"]')
    await page.waitForURL(/.*dashboard/, { timeout: 10000 })

    await page.goto("/farmer/settings")
    await page.waitForLoadState("networkidle")

    await expect(page.locator("#smtp-host")).toHaveValue("smtp.farm.example")
    await expect(page.locator("#smtp-port")).toHaveValue("587")
    await expect(page.locator("#smtp-username")).toHaveValue("farm-user")
    await expect(page.locator("#smtp-from-address")).toHaveValue("orders@farm.example")
    // Password is never rendered.
    await expect(page.locator("#smtp-password")).toHaveValue("")
    await expect(page.locator("#smtp-password")).toHaveAttribute(
      "placeholder",
      /leave blank to keep it/i
    )
    await expect(page.getByText("Remove configuration")).toBeVisible()
  })

  test("helper settings page does not render the email server card", async ({ page }) => {
    const prisma = createPrisma()
    const farmer = await createTestFarmer(prisma, "test-email-server-farmer")
    const bcrypt = await import("bcryptjs")
    const helper = await prisma.user.create({
      data: {
        email: "test-email-server-helper@example.com",
        name: "Test Email Helper",
        role: "FARMER_HELPER",
        managedById: farmer.id,
        passwordHash: await bcrypt.hash(TEST_PASSWORDS.farmer, 10),
      },
    })
    await prisma.$disconnect()

    await page.goto("/login")
    await page.fill('input[name="email"]', helper.email)
    await page.fill('input[type="password"]', TEST_PASSWORDS.farmer)
    await page.click('button[type="submit"]')
    await page.waitForURL(/.*dashboard/, { timeout: 10000 })

    await page.goto("/farmer/settings")
    await page.waitForLoadState("networkidle")

    await expect(page.locator("#smtp-host")).toHaveCount(0)
  })
})
