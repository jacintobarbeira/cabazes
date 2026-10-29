import { test, expect } from "@playwright/test"
import { encryptSecret, decryptSecret, isEnvelope } from "../src/lib/secret-box"
import { TEST_EMAIL_ENCRYPTION_KEY } from "../playwright.config"

const VALID_KEY = TEST_EMAIL_ENCRYPTION_KEY

test.describe("secret-box (AES-256-GCM encryption at rest)", () => {
  const originalKey = process.env.EMAIL_ENCRYPTION_KEY

  test.afterEach(() => {
    if (originalKey !== undefined) {
      process.env.EMAIL_ENCRYPTION_KEY = originalKey
    } else {
      delete process.env.EMAIL_ENCRYPTION_KEY
    }
  })

  test("round-trips a secret", () => {
    process.env.EMAIL_ENCRYPTION_KEY = VALID_KEY
    const secret = "app-password! # $% 你好"
    const envelope = encryptSecret(secret)
    expect(decryptSecret(envelope)).toBe(secret)
  })

  test("uses v1 envelope format: v1:<iv>:<tag>:<data>", () => {
    process.env.EMAIL_ENCRYPTION_KEY = VALID_KEY
    const envelope = encryptSecret("hunter2")
    const parts = envelope.split(":")
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe("v1")
    expect(isEnvelope(envelope)).toBe(true)
    expect(envelope).not.toContain("hunter2")
  })

  test("same plaintext encrypts to different ciphertext (random IV)", () => {
    process.env.EMAIL_ENCRYPTION_KEY = VALID_KEY
    const a = encryptSecret("same-secret")
    const b = encryptSecret("same-secret")
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe("same-secret")
    expect(decryptSecret(b)).toBe("same-secret")
  })

  test("tampered ciphertext fails to decrypt (GCM auth tag)", () => {
    process.env.EMAIL_ENCRYPTION_KEY = VALID_KEY
    const envelope = encryptSecret("important")
    const parts = envelope.split(":")
    const data = Buffer.from(parts[3], "base64")
    data[0] ^= 0xff
    parts[3] = data.toString("base64")
    expect(() => decryptSecret(parts.join(":"))).toThrow()
  })

  test("wrong key fails to decrypt", () => {
    process.env.EMAIL_ENCRYPTION_KEY = VALID_KEY
    const envelope = encryptSecret("important")
    process.env.EMAIL_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64")
    expect(() => decryptSecret(envelope)).toThrow()
  })

  test("missing key fails closed — nothing encrypts as plaintext", () => {
    delete process.env.EMAIL_ENCRYPTION_KEY
    expect(() => encryptSecret("important")).toThrow(/EMAIL_ENCRYPTION_KEY is not set/)
  })

  test("invalid key length is rejected", () => {
    process.env.EMAIL_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64")
    expect(() => encryptSecret("important")).toThrow(/32/)
  })

  test("rejects unknown envelope versions and garbage", () => {
    process.env.EMAIL_ENCRYPTION_KEY = VALID_KEY
    expect(() => decryptSecret("v2:AAA:BBB:CCC")).toThrow(/Unrecognised/)
    expect(() => decryptSecret("plaintext-password")).toThrow(/Unrecognised/)
    expect(isEnvelope("plaintext-password")).toBe(false)
    expect(isEnvelope(null)).toBe(false)
  })
})
