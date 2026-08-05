import { execSync } from "child_process"
import { existsSync, unlinkSync } from "fs"
import { resolve } from "path"

const TEST_DB = resolve(__dirname, "../prisma/test.db")

export default function globalSetup() {
  if (existsSync(TEST_DB)) {
    unlinkSync(TEST_DB)
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
  })
}
