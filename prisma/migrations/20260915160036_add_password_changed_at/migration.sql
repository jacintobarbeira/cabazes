-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("active", "category", "createdAt", "description", "farmerId", "id", "name", "updatedAt") SELECT "active", "category", "createdAt", "description", "farmerId", "id", "name", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_farmerId_idx" ON "Product"("farmerId");
CREATE UNIQUE INDEX "Product_name_farmerId_key" ON "Product"("name", "farmerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
