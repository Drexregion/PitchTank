import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import url from "url";
import dotenv from "dotenv";
dotenv.config();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const INPUT_CSV_PATH = path.resolve(__dirname, "../../trades_feedback.csv");
const DEFAULT_TABLE = process.env.UPLOAD_TABLE || "trades_feedback"; // change via env if needed
const UPSERT_ON_CONFLICT = process.env.UPLOAD_ON_CONFLICT || "id";
const BATCH_SIZE = Number(process.env.UPLOAD_BATCH_SIZE || 500);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error(
		"Missing Supabase credentials. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set."
	);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseCsvFlexible(raw) {
	const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
	if (lines.length === 0) return { headers: [], rows: [] };
	const header = lines[0];
	const headers = header.split(",");
	const expectedColumns = headers.length;
	const rows = [];
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line.trim()) continue;
		const parts = line.split(",");
		if (parts.length < expectedColumns) continue;
		const base = parts.slice(0, expectedColumns - 1);
		const note = parts.slice(expectedColumns - 1).join(",");
		rows.push([...base, note]);
	}
	return { headers, rows };
}

function coerceRow(headers, row) {
	const obj = {};
	for (let i = 0; i < headers.length; i++) {
		obj[headers[i]] = row[i];
	}
	// Type coercions for known columns
	if (obj.shares !== undefined && obj.shares !== null && obj.shares !== "") {
		const n = Number(obj.shares);
		if (!Number.isNaN(n)) obj.shares = n;
	}
	if (obj.amount !== undefined && obj.amount !== null && obj.amount !== "") {
		const n = Number(obj.amount);
		if (!Number.isNaN(n)) obj.amount = n;
	}
	if (
		obj.price_per_share !== undefined &&
		obj.price_per_share !== null &&
		obj.price_per_share !== ""
	) {
		const n = Number(obj.price_per_share);
		if (!Number.isNaN(n)) obj.price_per_share = n;
	}
	// created_at left as string (ISO). Supabase/Postgres can coerce.
	return obj;
}

async function uploadCsvToSupabase(inputPath, tableName) {
	if (!fs.existsSync(inputPath)) {
		throw new Error(`Input CSV not found at ${inputPath}`);
	}
	const raw = fs.readFileSync(inputPath, "utf8");
	const { headers, rows } = parseCsvFlexible(raw);
	if (headers.length === 0 || rows.length === 0) {
		// eslint-disable-next-line no-console
		console.warn("No data to upload.");
		return;
	}

	const objects = rows.map((r) => coerceRow(headers, r));
	let uploaded = 0;
	for (let i = 0; i < objects.length; i += BATCH_SIZE) {
		const batch = objects.slice(i, i + BATCH_SIZE);
		const { error } = await supabase
			.from(tableName)
			.upsert(batch, { onConflict: UPSERT_ON_CONFLICT });
		if (error) {
			throw new Error(
				`Upload failed at batch starting index ${i}: ${error.message}`
			);
		}
		uploaded += batch.length;
		// eslint-disable-next-line no-console
		console.log(
			`Uploaded ${uploaded}/${objects.length} rows to '${tableName}'.`
		);
	}
	// eslint-disable-next-line no-console
	console.log(
		`Upload complete. Total rows: ${objects.length} -> table '${tableName}'.`
	);
}

// Entry point
const tableName = process.env.UPLOAD_TABLE || DEFAULT_TABLE;
uploadCsvToSupabase(INPUT_CSV_PATH, tableName).catch((e) => {
	// eslint-disable-next-line no-console
	console.error(e);
	process.exit(1);
});
