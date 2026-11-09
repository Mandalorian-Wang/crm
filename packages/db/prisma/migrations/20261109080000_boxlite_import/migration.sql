ALTER TYPE "DealStage" ADD VALUE 'NEW_SIGNUP' BEFORE 'DEMO_BOOKED';
CREATE TABLE "importedRecord" ("id" TEXT PRIMARY KEY, "source" TEXT NOT NULL, "externalId" TEXT NOT NULL, "kind" TEXT NOT NULL, "recordId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "importedRecord_source_externalId_kind_key" ON "importedRecord"("source", "externalId", "kind");
CREATE INDEX "importedRecord_recordId_idx" ON "importedRecord"("recordId");
CREATE TABLE "importRun" ("id" TEXT PRIMARY KEY, "source" TEXT NOT NULL, "scheduledDay" TEXT NOT NULL, "status" TEXT NOT NULL, "processed" INTEGER NOT NULL DEFAULT 0, "error" TEXT, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3));
CREATE INDEX "importRun_source_scheduledDay_status_idx" ON "importRun"("source", "scheduledDay", "status");
