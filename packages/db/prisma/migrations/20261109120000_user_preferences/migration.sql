CREATE TABLE "userTablePreference" (
 "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
 "table" TEXT NOT NULL,
 "hiddenColumns" TEXT[] NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 PRIMARY KEY ("userId", "table")
);
CREATE TABLE "companyFavorite" (
 "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
 "companyId" TEXT NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId", "companyId")
);
CREATE INDEX "companyFavorite_companyId_idx" ON "companyFavorite"("companyId");
