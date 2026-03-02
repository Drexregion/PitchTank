/**
 * Cleanup script for Integration Test Artifacts
 * - Deletes events and founders created by the integration stress test
 * - Deletes related rows (trades, investors, holdings, price history) where possible
 * - Deletes auth users with emails like "int-test-user-*@example.com"
 *
 * Run:
 *   npm run test:cleanup
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
	process.env.SUPABASE_SERVICE_ROLE_KEY ||
	process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error(
		"Missing env. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
	);
	process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false },
});

async function deleteByEventIds(eventIds: string[]) {
	if (eventIds.length === 0) return;

	// Delete trades for these events
	try {
		await admin.from("trades").delete().in("event_id", eventIds);
	} catch {}

	// Delete investors for these events
	try {
		await admin.from("investors").delete().in("event_id", eventIds);
	} catch {}

	// Find founders for these events
	let founderIds: string[] = [];
	try {
		const { data } = await admin
			.from("founders")
			.select("id")
			.in("event_id", eventIds);
		founderIds = (data || []).map((r: any) => r.id as string);
	} catch {}

	if (founderIds.length > 0) {
		try {
			await admin
				.from("investor_holdings")
				.delete()
				.in("founder_id", founderIds);
		} catch {}
		try {
			await admin.from("price_history").delete().in("founder_id", founderIds);
		} catch {}
		try {
			await admin.from("founders").delete().in("id", founderIds);
		} catch {}
	}

	// Finally, delete the events themselves
	try {
		await admin.from("events").delete().in("id", eventIds);
	} catch {}
}

async function deleteTestUsers() {
	// Iterate admin users and delete those matching the test email prefix
	const perPage = 1000;
	let page = 1;
	let totalDeleted = 0;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
		if (error) break;
		const users = data?.users || [];
		if (users.length === 0) break;

		const testUsers = users.filter(
			(u: any) =>
				typeof u.email === "string" &&
				/^(int-test-user-).+@example\.com$/.test(u.email)
		);

		if (testUsers.length > 0) {
			const concurrency = 10;
			for (let i = 0; i < testUsers.length; i += concurrency) {
				const batch = testUsers.slice(i, i + concurrency);
				await Promise.allSettled(
					batch.map((u: any) => admin.auth.admin.deleteUser(u.id))
				);
			}
			totalDeleted += testUsers.length;
		}

		if (users.length < perPage) break;
		page += 1;
	}

	return totalDeleted;
}

async function run() {
	console.log("\n🧹 Cleaning up integration test artifacts...\n");

	// Find events created by the stress test
	const { data: eventsData } = await admin
		.from("events")
		.select("id, name")
		.ilike("name", "Integration Test Event %");

	const eventIds = (eventsData || []).map((e: any) => e.id as string);
	console.log(`Found ${eventIds.length} test event(s) to remove.`);

	await deleteByEventIds(eventIds);
	console.log("Deleted related rows and events.");

	const deletedUsers = await deleteTestUsers();
	console.log(`Deleted ${deletedUsers} test auth user(s).`);

	console.log("\n✅ Cleanup complete.\n");
}

run().catch((err) => {
	console.error("\n❌ Cleanup failed:", err?.message || err);
	process.exit(1);
});
