import { test, expect, APIRequestContext } from "@playwright/test"
import { createPrisma, cleanupTestData } from "./helpers"

const PASSWORD = "RateLimit123!"
const WRONG_PASSWORD = "WrongPassword1!"

const EMAILS = {
  happy: "test-rate-limit@example.com",
  lockout: "test-rate-limit-b@example.com",
  shared: "test-rate-limit-c@example.com",
  window: "test-rate-limit-d@example.com",
}

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

async function createUser(email: string) {
  const prisma = createPrisma()
  const passwordHash = await require("bcryptjs").hash(PASSWORD, 10)
  await prisma.user.create({
    data: {
      email,
      name: "Rate Limit User",
      passwordHash,
      role: "CUSTOMER",
    },
  })
  await prisma.$disconnect()
}

test.beforeEach(async () => {
  await cleanupTestData()
})

test.afterEach(async () => {
  await cleanupTestData()
})

test.describe("Login rate limiting on browser path", () => {
  test("happy path: valid credentials log in through the browser callback", async ({ request }) => {
    await createUser(EMAILS.happy)

    const result = await browserSignIn(request, EMAILS.happy, PASSWORD)
    expect(result.ok).toBeTruthy()
    expect(result.error).toBeFalsy()
  })

  test("unhappy path: repeated failed browser logins block even valid credentials", async ({ request }) => {
    await createUser(EMAILS.lockout)

    for (let i = 0; i < 5; i++) {
      const result = await browserSignIn(request, EMAILS.lockout, WRONG_PASSWORD)
      expect(result.error, `attempt ${i + 1} should fail`).toBe("CredentialsSignin")
    }

    const blocked = await browserSignIn(request, EMAILS.lockout, PASSWORD)
    expect(blocked.error, "valid password must be blocked after lockout").toBe("CredentialsSignin")
  })

  test("browser-path failures trip the shared limiter that the API route returns 429 for", async ({ request }) => {
    await createUser(EMAILS.shared)

    for (let i = 0; i < 5; i++) {
      await browserSignIn(request, EMAILS.shared, WRONG_PASSWORD)
    }

    const apiRes = await request.post("/api/auth/login", {
      data: { email: EMAILS.shared, password: PASSWORD },
    })
    expect(apiRes.status()).toBe(429)
  })

  test("rate limiter still blocks after lockout is reset by successful logins", async ({ request }) => {
    await createUser(EMAILS.window)

    for (let cycle = 0; cycle < 2; cycle++) {
      for (let i = 0; i < 4; i++) {
        await browserSignIn(request, EMAILS.window, WRONG_PASSWORD)
      }
      const success = await browserSignIn(request, EMAILS.window, PASSWORD)
      expect(success.error, `cycle ${cycle + 1} login should succeed`).toBeFalsy()
    }

    for (let i = 0; i < 4; i++) {
      await browserSignIn(request, EMAILS.window, WRONG_PASSWORD)
    }

    const blocked = await browserSignIn(request, EMAILS.window, PASSWORD)
    expect(blocked.error, "rate limiter must block once threshold is crossed").toBe("CredentialsSignin")
  })
})
