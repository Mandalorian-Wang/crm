ALTER TABLE "fieldOption" ADD COLUMN "color" TEXT NOT NULL DEFAULT 'gray';
INSERT INTO "fieldDefinition" ("id", "entity", "key", "label", "type", "agentFilled", "required", "showOnSheet", "showOnTable", "showOnFilter", "position", "createdAt", "updatedAt")
VALUES ('boxlite-organization-type', 'COMPANY', 'organization_type', 'Organization type', 'SELECT', false, false, false, true, true, 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("entity", "key") DO NOTHING;
