import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * Encryption-at-rest for farmer email credentials.
 *
 * Envelope format: v1:<iv-base64>:<authTag-base64>:<ciphertext-base64>
 *   - AES-256-GCM with a fresh 12-byte random IV per encryption, so the same
 *     secret never produces the same ciphertext twice.
 *   - The 16-byte GCM auth tag is stored in the envelope; any tampering or a
 *     wrong key makes decryption throw.
 *   - The "v1:" prefix lets a future key-rotation script tell which scheme (and
 *     which key) produced a stored value.
 *
 * The key comes from EMAIL_ENCRYPTION_KEY: 32 random bytes, base64-encoded
 * (generate with `openssl rand -base64 32`). It is a dedicated secret — do NOT
 * reuse NEXTAUTH_SECRET or any other application secret.
 *
 * Fails closed: with a missing or invalid key, nothing is ever stored or read
 * as plaintext.
 */

const ALGORITHM = "aes-256-gcm"
const KEY_BYTES = 32
const IV_BYTES = 12
const VERSION = "v1"

function getKey(): Buffer {
  const raw = process.env.EMAIL_ENCRYPTION_KEY?.trim()
  if (!raw) {
    throw new Error(
      "EMAIL_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and provide it as an environment secret."
    )
  }

  const key = Buffer.from(raw, "base64")
  if (key.length !== KEY_BYTES) {
    throw new Error("EMAIL_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (e.g. `openssl rand -base64 32`).")
  }
  return key
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":")
}

export function decryptSecret(envelope: string): string {
  const parts = envelope.split(":")
  if (parts.length !== 4 || parts[0] !== VERSION || !parts[1] || !parts[2] || !parts[3]) {
    throw new Error("Unrecognised encrypted value (expected a v1:<iv>:<tag>:<data> envelope).")
  }

  const [, ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const data = Buffer.from(dataB64, "base64")
  if (iv.length !== IV_BYTES || tag.length === 0 || data.length === 0) {
    throw new Error("Corrupted encrypted value.")
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
}

export function isEnvelope(value: string | null | undefined): boolean {
  return !!value && value.startsWith(`${VERSION}:`)
}
