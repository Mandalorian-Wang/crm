import { expect, test } from "bun:test";
import { createHmac, randomUUID } from "node:crypto";
import { db } from "@crm/db";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../src/create-app";

test("CRM MCP authenticates a member and performs real CRUD with shared validation", async () => {
	const secret = process.env.BETTER_AUTH_SECRET;
	const origin = process.env.APP_URL;
	if (!secret || !origin)
		throw new Error("Test auth configuration is required");
	const app = await createApp();
	await app.listen(0, "127.0.0.1");
	const base = await app.getUrl();
	const id = `mcp-qa-${randomUUID()}`,
		token = randomUUID();
	const user = await db.user.create({
		data: { id, name: "MCP QA", email: `${id}@polygala.ai` },
	});
	await db.member.create({
		data: {
			id,
			userId: id,
			organizationId: "workspace",
			role: "member",
			createdAt: new Date(),
		},
	});
	await db.session.create({
		data: {
			id,
			token,
			userId: id,
			expiresAt: new Date(Date.now() + 600000),
			updatedAt: new Date(),
		},
	});
	const signed = encodeURIComponent(
		`${token}.${createHmac("sha256", secret).update(token).digest("base64")}`,
	);
	const headers = {
		"content-type": "application/json",
		origin: origin,
		cookie: `__Secure-crm.session_token=${signed}; crm.session_token=${signed}`,
	};
	const client = new Client({ name: "crm-verification", version: "1" });
	let companyId: string | undefined,
		contactId: string | undefined,
		typeId: string | undefined,
		keyId: string | undefined;
	async function rpc(name: string, input: object) {
		const r = await fetch(`${base}/api/trpc/${name}`, {
			method: "POST",
			headers,
			body: JSON.stringify(input),
		});
		const j = await r.json();
		if (j.error) throw new Error(j.error.message);
		return j.result.data;
	}
	async function call(operation: string, input: object = {}, write = false) {
		const description = await client.callTool({
			name: "crm_describe",
			arguments: { operation },
		});
		expect(description.isError).not.toBe(true);
		const r = await client.callTool({
			name: write ? "crm_write" : "crm_read",
			arguments: { operation, input },
		});
		if (r.isError) throw new Error(JSON.stringify(r.content));
		const content = r.content as { text: string }[];
		if (!content[0]) throw new Error("Missing MCP result");
		return JSON.parse(content[0].text);
	}
	try {
		const key = await rpc("apiKeys.create", { name: id, expiresInDays: 1 });
		keyId = key.id;
		const specResponse = await fetch(`${base}/openapi.json`);
		expect(specResponse.status).toBe(200);
		const restResponse = await fetch(`${base}/rest/companies/search`, {
			method: "POST",
			body: JSON.stringify({ pageSize: 1 }),
			headers: { "x-api-key": key.key, "content-type": "application/json" },
		});
		expect(restResponse.status).toBe(200);
		await client.connect(
			new StreamableHTTPClientTransport(new URL(`${base}/api/mcp/crm`), {
				requestInit: { headers: { "x-api-key": key.key } },
			}),
		);
		expect((await client.listTools()).tools).toHaveLength(4);
		const schema = await client.callTool({
			name: "crm_describe",
			arguments: { operation: "companies.create" },
		});
		expect(schema.isError).not.toBe(true);
		companyId = (await call("companies.create", { name: id }, true)).id;
		await expect(
			call(
				"companies.update",
				{ id: companyId, data: { nmae: "Ignored typo" } },
				true,
			),
		).rejects.toThrow("Unknown property");
		await expect(
			call("companies.list", { fields: { unknown_field: ["min:4"] } }),
		).rejects.toThrow("not filterable");

		await call(
			"companies.update",
			{ id: companyId, data: { name: `${id}-updated` } },
			true,
		);
		expect((await call("companies.byId", { id: companyId })).name).toBe(
			`${id}-updated`,
		);
		const types = await call(
			"dictionaries.saveOrganizationType",
			{ label: id.slice(0, 40), color: "blue", archived: false },
			true,
		);
		typeId = types.options.find(
			(x: { label: string }) => x.label === id.slice(0, 40),
		).id;
		await call(
			"companies.update",
			{ id: companyId, data: { fields: { organization_type: typeId } } },
			true,
		);
		contactId = (
			await call(
				"contacts.create",
				{
					firstName: "MCP",
					lastName: "QA",
					email: `${id}@example.test`,
					companyId,
				},
				true,
			)
		).id;
		await call(
			"contacts.update",
			{ id: contactId, data: { firstName: "Updated" } },
			true,
		);
		expect((await call("contacts.byId", { id: contactId })).firstName).toBe(
			"Updated",
		);
		const images = [
			{
				id: randomUUID(),
				name: "pixel.png",
				type: "image/png",
				base64:
					"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
			},
		];
		await call(
			"companies.addDailyNote",
			{ companyId, requestId: randomUUID(), body: "", images },
			true,
		);
		let notes = await call("companies.dailyNotes", { id: companyId });
		expect(notes[0].images).toEqual(images);
		await call(
			"companies.updateDailyNote",
			{
				companyId,
				id: notes[0].id,
				version: notes[0].version,
				body: "Image retained",
			},
			true,
		);
		notes = await call("companies.dailyNotes", { id: companyId });
		expect(notes[0].images).toEqual(images);
		await db.organizationDailyNote.update({
			where: { id: notes[0].id },
			data: { createdAt: new Date("2026-01-01") },
		});
		await expect(
			call(
				"companies.updateDailyNote",
				{
					companyId,
					id: notes[0].id,
					version: notes[0].version,
					body: "Frozen",
					images: [],
				},
				true,
			),
		).rejects.toThrow();
		expect(
			(
				await client.callTool({
					name: "crm_read",
					arguments: {
						operation: "companies.archive",
						input: { id: companyId },
					},
				})
			).isError,
		).toBe(true);
		await call("contacts.archive", { id: contactId }, true);
		await call("contacts.restore", { id: contactId }, true);
		await call("companies.archive", { id: companyId }, true);
		await call("companies.restore", { id: companyId }, true);
		const bad = await fetch(`${base}/api/mcp/crm`, {
			method: "POST",
			headers: { ...headers, "x-api-key": "invalid" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
		});
		expect(bad.status).toBe(401);
		await rpc("apiKeys.revoke", { id: keyId });
		keyId = undefined;
		await expect(client.listTools()).rejects.toThrow();
	} finally {
		await client.close();
		if (contactId) await db.contact.deleteMany({ where: { id: contactId } });
		if (companyId) await db.company.deleteMany({ where: { id: companyId } });
		if (typeId) await db.fieldOption.deleteMany({ where: { id: typeId } });
		if (keyId) await db.apikey.deleteMany({ where: { id: keyId } });
		await db.session.deleteMany({ where: { userId: user.id } });
		await db.member.deleteMany({ where: { userId: user.id } });
		await db.user.delete({ where: { id: user.id } });
		await app.close();
	}
}, 240000);
