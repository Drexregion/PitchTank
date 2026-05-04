/**
 * Admin script: Snapshot all tables affected by the schema cleanup migration.
 *
 * Writes one JSON file per table to internal/admin/output/backup_<timestamp>/
 *
 * Usage:
 *   node internal/admin/backupSchema.js
 *
 * Requires env vars:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
	process.env.SUPABASE_SERVICE_ROLE_KEY ||
	process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error(
		"Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
	);
	process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
	"applications",
	"users",
	"pitches",
	"investors",
	"investor_holdings",
	"trades",
	"price_history",
	"events",
	"applications",
	"chat_messages",
	"chat_upvotes",
];

async function fetchAll(table) {
	const PAGE = 1000;
	let rows = [];
	let from = 0;
	while (true) {
		const { data, error } = await admin
			.from(table)
			.select("*")
			.range(from, from + PAGE - 1);
		if (error) throw new Error(`${table}: ${error.message}`);
		if (!data || data.length === 0) break;
		rows = rows.concat(data);
		if (data.length < PAGE) break;
		from += PAGE;
	}
	return rows;
}

async function run() {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const outDir = path.join(
		"internal",
		"admin",
		"output",
		`backup_${timestamp}`,
	);
	fs.mkdirSync(outDir, { recursive: true });

	console.log(`\nBacking up to ${outDir}\n`);

	for (const table of TABLES) {
		process.stdout.write(`  ${table} ... `);
		try {
			const rows = await fetchAll(table);
			const file = path.join(outDir, `${table}.json`);
			fs.writeFileSync(file, JSON.stringify(rows, null, 2));
			console.log(`${rows.length} rows`);
		} catch (err) {
			console.log(`FAILED: ${err.message}`);
		}
	}

	console.log("\nBackup complete.\n");
}

run().catch((err) => {
	console.error("\nBackup failed:", err?.message || err);
	process.exit(1);
});
