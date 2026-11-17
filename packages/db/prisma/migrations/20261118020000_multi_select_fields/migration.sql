ALTER TYPE "FieldType" ADD VALUE 'MULTI_SELECT';
ALTER TABLE "fieldValue" ADD COLUMN "optionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "fieldValue_optionIds_idx" ON "fieldValue" USING GIN ("optionIds");
