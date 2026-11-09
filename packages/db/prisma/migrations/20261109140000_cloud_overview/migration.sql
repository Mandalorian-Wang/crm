CREATE TABLE "cloudDailyOverview" (
 "date" TEXT PRIMARY KEY,
 "evidence" JSONB NOT NULL,
 "syncedAt" TIMESTAMP(3) NOT NULL
);
