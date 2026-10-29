import { defineConfig, devices } from "@playwright/test"

export const TEST_EMAIL_SINK_FILE = ".tmp/test-emails.jsonl"

// Test-only key (base64 of 32 bytes). Never reuse in production.
export const TEST_EMAIL_ENCRYPTION_KEY = "Y2FiYXplcy10ZXN0LWVtYWlsLWtleWNhYmF6ZXMtdGU="

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/globalSetup.ts",
  globalTeardown: "./tests/globalTeardown.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:3000",
          localStorage: [{ name: "locale", value: "en" }],
        },
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: "file:./prisma/test.db",
      EMAIL_TRANSPORT: "sink",
      EMAIL_SINK_FILE: TEST_EMAIL_SINK_FILE,
      // Test-only key (32 random-byte equivalent). Never reuse in production.
      EMAIL_ENCRYPTION_KEY: TEST_EMAIL_ENCRYPTION_KEY,
    },
  },
})
