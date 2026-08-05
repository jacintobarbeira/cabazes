import { test, expect, APIRequestContext } from "@playwright/test"
import { createPrisma, cleanupTestData, createTestCustomer, TEST_PASSWORDS } from "./helpers"

const WRONG_PASSWORD = "WrongPassword1!"

async function browserSignIn(request: APIRequestContext, email: string, password: string) {
  const csrfRes = await request.get("/api/auth/csrf")
  const { csrfToken } = await csrfRes.json()

  const res = await request.post("/api/auth/callback/credentials", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    data: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: "/farmer/dashboard",
    }).toString(),
  })

  const body = await res.json().catch(() => ({}))
  const url = body?.url ?? ""
  return { ok: res.ok(), error: new URL(url).searchParams.get("error"), status: res.status() }
}

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("Login rate limiting on browser path", () => {
  test("happy path: valid credentials log in through the browser callback", async ({ request }) => {
    const prisma = createPrisma()
    const customer = await createTestCustomer(prisma, "rate-limit-happy")
    await prisma.$disconnect()

    const result = await browserSignIn(request, customer.email, TEST_PASSWORDS.customer)
    expect(result.ok).toBeTruthy()
    expect(result.error).toBeFalsy()
  })

  test("unhappy path: repeated failed browser logins block even valid credentials", async ({ request }) => {
    const prisma = createPrisma()
    const customer = await createTestCustomer(prisma, "rate-limit-lockout")
    await prisma.$disconnect()

    for (let i = 0; i < 5; i++) {
      const result = await browserSignIn(request, customer.email, WRONG_PASSWORD)
      expect(result.error, `attempt ${i + 1} should fail`).toBe("CredentialsSignin")
    }

    const blocked = await browserSignIn(request, customer.email, TEST_PASSWORDS.customer)
    expect(blocked.error, "valid password must be blocked after lockout").toBe("CredentialsSignin")
  })

  test("browser-path failures trip the shared limiter that the API route returns 429 for", async ({ request }) => {
    const prisma = createPrisma()
    const customer = await createTestCustomer(prisma, "rate-limit-shared")
    await prisma.$disconnect()

    for (let i = 0; i < 5; i++) {
      await browserSignIn(request, customer.email, WRONG_PASSWORD)
    }

    const apiRes = await request.post("/api/auth/login", {
      data: { email: customer.email, password: TEST_PASSWORDS.customer },
    })
    expect(apiRes.status()).toBe(429)
  })

  test("rate limiter still blocks after lockout is reset by successful logins", async ({ request }) => {
    const prisma = createPrisma()
    const customer = await createTestCustomer(prisma, "rate-limit-window")
    await prisma.$disconnect()

    for (let cycle = 0; cycle < 2; cycle++) {
      for (let i = 0; i < 4; i++) {
        await browserSignIn(request, customer.email, WRONG_PASSWORD)
      }
      const success = await browserSignIn(request, customer.email, TEST_PASSWORDS.customer)
      expect(success.error, `cycle ${cycle + 1} login should succeed`).toBeFalsy()
    }

    for (let i = 0; i < 4; i++) {
      await browserSignIn(request, customer.email, WRONG_PASSWORD)
    }

    const blocked = await browserSignIn(request, customer.email, TEST_PASSWORDS.customer)
    expect(blocked.error, "rate limiter must block once threshold is crossed").toBe("CredentialsSignin")
  })
})
