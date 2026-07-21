-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "notes" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "mustResetPassword" BOOLEAN NOT NULL DEFAULT false,
    "managedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_managedById_fkey" FOREIGN KEY ("managedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("address", "city", "createdAt", "email", "id", "name", "notes", "passwordHash", "phone", "postalCode", "role", "timezone", "updatedAt") SELECT "address", "city", "createdAt", "email", "id", "name", "notes", "passwordHash", "phone", "postalCode", "role", "timezone", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
