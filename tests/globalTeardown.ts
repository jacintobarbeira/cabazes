import { existsSync, unlinkSync } from "fs"
import { resolve } from "path"

const TEST_DB = resolve(__dirname, "../prisma/test.db")

export default function globalTeardown() {
  if (existsSync(TEST_DB)) {
    unlinkSync(TEST_DB)
  }
}
