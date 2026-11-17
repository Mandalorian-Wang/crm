INSERT INTO "fieldDefinition" (id, entity, key, label, type, "agentFilled", required, "showOnSheet", "showOnTable", "showOnFilter", position, "createdAt", "updatedAt") VALUES
('crm_growth_channel', 'COMPANY', 'growth_channel', 'Growth channel', 'SELECT', false, false, true, true, true, 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('crm_customer_region', 'COMPANY', 'customer_region', 'Customer region', 'SELECT', false, false, true, true, true, 101, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('crm_competitors', 'COMPANY', 'competitors', 'Competitors in use', 'MULTI_SELECT', false, false, true, true, true, 102, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (entity, key) DO NOTHING;
