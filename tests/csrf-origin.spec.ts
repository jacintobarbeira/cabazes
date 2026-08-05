import { test, expect } from "@playwright/test"
import { isSameOrigin, csrfCheck } from "@/lib/csrf"

const ORIGINAL_NEXTAUTH_URL = process.env.NEXTAUTH_URL

test.afterEach(() => {
  if (ORIGINAL_NEXTAUTH_URL === undefined) {
    delete process.env.NEXTAUTH_URL
  } else {
    process.env.NEXTAUTH_URL = ORIGINAL_NEXTAUTH_URL
  }
})

test.describe("CSRF same-origin behind a reverse proxy", () => {
  test("accepts a request whose Origin matches the public NEXTAUTH_URL even when request.url is internal", () => {
    process.env.NEXTAUTH_URL = "https://cabazes.fly.dev"

    const request = new Request("https://localhost:3000/api/admin/farmers", {
      method: "POST",
      headers: { Origin: "https://cabazes.fly.dev" },
    })

    expect(isSameOrigin(request)).toBe(true)
    expect(csrfCheck(request)).toBeNull()
  })

  test("accepts a request whose Origin matches the forwarded proxy headers", () => {
    const request = new Request("http://localhost:3000/api/admin/farmers", {
      method: "POST",
      headers: {
        Origin: "https://cabazes.fly.dev",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "cabazes.fly.dev",
      },
    })

    expect(isSameOrigin(request)).toBe(true)
  })

  test("rejects a cross-origin request even when NEXTAUTH_URL is configured", () => {
    process.env.NEXTAUTH_URL = "https://cabazes.fly.dev"

    const request = new Request("https://localhost:3000/api/admin/farmers", {
      method: "POST",
      headers: { Origin: "https://evil.example.com" },
    })

    expect(isSameOrigin(request)).toBe(false)
    expect(csrfCheck(request)).not.toBeNull()
    expect(csrfCheck(request)!.status).toBe(403)
  })

  test("rejects a request with a mismatched Referer", () => {
    const request = new Request("http://localhost:3000/api/admin/farmers", {
      method: "POST",
      headers: { Referer: "https://evil.example.com/admin/farmers" },
    })

    expect(isSameOrigin(request)).toBe(false)
  })

  test("accepts a same-origin request in local development", () => {
    const request = new Request("http://localhost:3000/api/admin/farmers", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
    })

    expect(isSameOrigin(request)).toBe(true)
  })

  test("accepts a request with no Origin or Referer header", () => {
    const request = new Request("http://localhost:3000/api/admin/farmers", {
      method: "POST",
    })

    expect(isSameOrigin(request)).toBe(true)
  })
})
