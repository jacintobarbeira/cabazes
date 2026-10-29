import { existsSync, rmSync, unlinkSync } from "fs"
import { resolve } from "path"

const TEST_DB = resolve(__dirname, "../prisma/test.db")
const EMAIL_SINK_FILE = resolve(__dirname, "..", ".tmp/test-emails.jsonl")

export default function globalTeardown() {
  if (existsSync(TEST_DB)) {
    unlinkSync(TEST_DB)
  }
  rmSync(EMAIL_SINK_FILE, { force: true })
}
