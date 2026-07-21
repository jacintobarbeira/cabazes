/*
  Warnings:

  - Made the column `customerId` on table `InviteToken` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InviteToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "basketId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InviteToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InviteToken_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "Basket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InviteToken" ("basketId", "createdAt", "customerId", "expiresAt", "id", "token", "usedAt") SELECT "basketId", "createdAt", "customerId", "expiresAt", "id", "token", "usedAt" FROM "InviteToken";
DROP TABLE "InviteToken";
ALTER TABLE "new_InviteToken" RENAME TO "InviteToken";
CREATE UNIQUE INDEX "InviteToken_token_key" ON "InviteToken"("token");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
