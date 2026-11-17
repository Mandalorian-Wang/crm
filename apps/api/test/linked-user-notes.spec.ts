import { expect, test } from "bun:test";
import type { Db, Prisma } from "@crm/db";
import { isSourceManagedField } from "@crm/db/fields-shape";
import { timelineInput } from "../src/activities/activities.contracts";
import { ActivitiesService } from "../src/activities/activities.service";
import type { ActivityStampService } from "../src/crm/activity-stamp.service";

test("linked user notes follow current membership without an old organization constraint", async () => {
	const queries: Prisma.ActivityFindManyArgs[] = [];
	const db = {
		contact: {
			findMany: async () => [{ id: "linked-user", companyId: "org" }],
		},
		importedRecord: { findMany: async () => [] },
		activity: {
			findMany: async (input: Prisma.ActivityFindManyArgs) => {
				queries.push(input);
				return [];
			},
		},
	} as unknown as Db;
	const service = new ActivitiesService(db, {} as ActivityStampService);
	await service.timeline(
		timelineInput.parse({
			companyId: "org",
			linkedContactNotesOnly: true,
			filter: "all",
			limit: 2,
		}),
	);
	expect(queries[0]).toMatchObject({
		where: {
			contactId: { in: ["linked-user"] },
			type: { in: ["NOTE", "CALL", "EMAIL", "MEETING"] },
		},
		take: 3,
		orderBy: [{ occurredAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
	});
	expect(queries[0]?.where?.companyId).toBeUndefined();
	await expect(
		service.timeline(timelineInput.parse({ linkedContactNotesOnly: true })),
	).rejects.toThrow("organization ID only");
});

test("registration source is editable while external IDs and billing remain protected", () => {
	expect(isSourceManagedField("registration_source")).toBe(false);
	for (const key of [
		"cloud_user_id",
		"cloud_registered_at",
		"cloud_settled_usage_usd",
		"github_user_id",
		"linear_customer_id",
	])
		expect(isSourceManagedField(key)).toBe(true);
});
