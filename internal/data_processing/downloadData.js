import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
	process.env.VITE_SUPABASE_URL,
	process.env.VITE_SUPABASE_ANON_KEY
);

async function downloadTable() {
	const { data, error } = await supabase.from("trades").select("*");

	if (error) throw error;

	// Convert to CSV
	const csv = [
		Object.keys(data[0]).join(","), // headers
		...data.map((row) => Object.values(row).join(",")),
	].join("\n");

	fs.writeFileSync("trades.csv", csv);
}

downloadTable();
