/**
 * Admin script: Reset price history and remove all trades for an event.
 *
 * - Deletes all rows from price_history for founders in the event
 * - Deletes all rows from trades for the event
 *
 * Run:
 *   npm run admin:reset-event -- <event_id>
 *   # or
 *   EVENT_ID=<uuid> npm run admin:reset-event
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_* equivalents)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
	process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
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

async function resetEventTrading(eventId: string): Promise<void> {
	// Verify event exists
	const { data: event, error: eventError } = await admin
		.from("events")
		.select("id, name")
		.eq("id", eventId)
		.single();

	if (eventError || !event) {
		console.error(`Event not found: ${eventId}`);
		process.exit(1);
	}

	console.log(`\n🔄 Resetting trading data for event: ${event.name} (${eventId})\n`);

	// 1. Delete all trades for this event
	const { error: tradesError } = await admin
		.from("trades")
		.delete()
		.eq("event_id", eventId);

	if (tradesError) {
		console.error("Failed to delete trades:", tradesError.message);
		process.exit(1);
	}
	console.log("  ✓ Deleted all trades");

	// 2. Get founders for this event
	const { data: founders, error: foundersError } = await admin
		.from("pitches")
		.select("id")
		.eq("event_id", eventId);

	if (foundersError) {
		console.error("Failed to fetch founders:", foundersError.message);
		process.exit(1);
	}

	const founderIds = (founders || []).map((f: { id: string }) => f.id);

	if (founderIds.length === 0) {
		console.log("  ✓ No founders (no price history to delete)");
	} else {
		// 3. Delete all price_history for these founders
		const { error: priceError } = await admin
			.from("price_history")
			.delete()
			.in("pitch_id", founderIds);

		if (priceError) {
			console.error("Failed to delete price history:", priceError.message);
			process.exit(1);
		}
		console.log(`  ✓ Deleted price history for ${founderIds.length} founder(s)`);
	}

	console.log("\n✅ Reset complete.\n");
}

async function run(): Promise<void> {
	const eventId =
		process.argv[2] || process.env.EVENT_ID;

	if (!eventId) {
		console.error("Usage: npm run admin:reset-event -- <event_id>");
		console.error("   or: EVENT_ID=<uuid> npm run admin:reset-event");
		process.exit(1);
	}

	await resetEventTrading(eventId);
}

run().catch((err) => {
	console.error("\n❌ Reset failed:", err?.message || err);
	process.exit(1);
});
