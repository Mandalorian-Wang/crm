import "@crm/env/load";
import { randomUUID } from "node:crypto";
import { db } from "@crm/db";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { ensureFields } from "./fields";

const username = process.env.CRM_ADMIN_USERNAME;
const password = process.env.CRM_ADMIN_PASSWORD;
if (
	!username ||
	!/^[a-z0-9._-]+$/.test(username) ||
	!password ||
	password.length < 12
)
	throw new Error(
		"Set an admin username and password of at least 12 characters.",
	);
const email = `${username}@polygala.ai`;
await db.$transaction(async (tx) => {
	const user = await tx.user.upsert({
		where: { email },
		create: {
			id: randomUUID(),
			email,
			name: "BoxLite Admin",
			emailVerified: true,
		},
		update: {},
	});
	const account = await tx.account.findFirst({
		where: { userId: user.id, providerId: "credential" },
	});
	if (!account)
		await tx.account.create({
			data: {
				id: randomUUID(),
				userId: user.id,
				accountId: user.id,
				providerId: "credential",
				password: await hashPassword(password),
			},
		});
	else if (
		!account.password ||
		!(await verifyPassword({ hash: account.password, password }))
	) {
		await tx.account.update({
			where: { id: account.id },
			data: { password: await hashPassword(password) },
		});
		await tx.session.deleteMany({ where: { userId: user.id } });
	}
	await tx.organization.upsert({
		where: { id: "workspace" },
		create: {
			id: "workspace",
			name: "BoxLite",
			slug: "boxlite",
			website: "boxlite.ai",
			createdAt: new Date(),
			metadata: JSON.stringify({ onboardedAt: new Date().toISOString() }),
		},
		update: {},
	});
	const membership = await tx.member.findFirst({
		where: { organizationId: "workspace", userId: user.id },
	});
	if (!membership)
		await tx.member.create({
			data: {
				id: randomUUID(),
				organizationId: "workspace",
				userId: user.id,
				role: "owner",
				createdAt: new Date(),
			},
		});
});
await ensureFields();
await db.$disconnect();
console.info("BoxLite workspace, admin account and import fields are ready.");
