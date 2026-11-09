ALTER TABLE "company" ADD COLUMN "followUpStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED', ADD COLUMN "nextFollowUpAt" DATE;
CREATE INDEX "company_followUpStatus_nextFollowUpAt_idx" ON "company"("followUpStatus","nextFollowUpAt");
ALTER TABLE "userTablePreference" ADD COLUMN "columnOrder" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE TABLE "userViewDefault" ("userId" TEXT NOT NULL, "entity" "FieldEntity" NOT NULL, "viewId" TEXT NOT NULL, CONSTRAINT "userViewDefault_pkey" PRIMARY KEY ("userId","entity"));
ALTER TABLE "userViewDefault" ADD CONSTRAINT "userViewDefault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "organizationContactLog" ("id" TEXT NOT NULL PRIMARY KEY,"companyId" TEXT NOT NULL,"createdById" TEXT NOT NULL,"contactId" TEXT,"channel" TEXT NOT NULL,"body" TEXT NOT NULL,"occurredAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
ALTER TABLE "organizationContactLog" ADD CONSTRAINT "organizationContactLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organizationContactLog" ADD CONSTRAINT "organizationContactLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "organizationContactLog_companyId_occurredAt_idx" ON "organizationContactLog"("companyId","occurredAt");

CREATE TABLE "organizationDailyNote" ("id" TEXT NOT NULL PRIMARY KEY,"companyId" TEXT NOT NULL,"body" TEXT NOT NULL,"updatedById" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"version" INTEGER NOT NULL DEFAULT 1);
ALTER TABLE "organizationDailyNote" ADD CONSTRAINT "organizationDailyNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organizationDailyNote" ADD CONSTRAINT "organizationDailyNote_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "organizationDailyNote_companyId_createdAt_idx" ON "organizationDailyNote"("companyId","createdAt");
