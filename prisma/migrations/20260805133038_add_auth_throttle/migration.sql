-- CreateTable
CREATE TABLE "AuthThrottle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStart" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AuthThrottle_key_idx" ON "AuthThrottle"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AuthThrottle_scope_key_key" ON "AuthThrottle"("scope", "key");
