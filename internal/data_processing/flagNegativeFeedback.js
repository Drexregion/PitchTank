/**
 * Flag Unuseful Feedback
 *
 * Fetches all trade feedback (notes) for an event and uses GPT to identify
 * feedback that does NOT constitute useful feedback—i.e., notes that are
 * generic, vague, empty, or otherwise unhelpful for founders.
 *
 * Useful feedback = specific, actionable, constructive (even if critical).
 * Unuseful = platitudes, one-word responses, off-topic, or too vague to act on.
 *
 * Usage:
 *   node internal/data_processing/flagNegativeFeedback.js --event <eventId>
 *   node internal/data_processing/flagNegativeFeedback.js --event-id <eventId>
 *   EVENT_ID=<eventId> node internal/data_processing/flagNegativeFeedback.js
 *
 * Output: JSON report to stdout and optionally to a file.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import OpenAI from "openai";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error(
		"Missing Supabase credentials. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.",
	);
}
if (!openaiApiKey) {
	throw new Error(
		"Missing OpenAI API key. Set OPENAI_API_KEY in your environment.",
	);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

async function fetchEventFeedback(eventId) {
	const foundersQuery = supabase.from("pitches").select("*");
	const foundersRes = await foundersQuery.eq("event_id", eventId);
	if (foundersRes.error) throw foundersRes.error;
	const founders = foundersRes.data || [];
	const founderIds = founders.map((f) => f.id);

	if (founderIds.length === 0) {
		return {
			founders: [],
			investors: [],
			tradesWithNotes: [],
			foundersById: new Map(),
		};
	}

	const [tradesRes, investorsRes] = await Promise.all([
		supabase
			.from("trades")
			.select(
				"id, founder_id, investor_id, note, amount, shares, price_per_share, created_at",
			)
			.in("pitch_id", founderIds)
			.order("created_at", { ascending: true }),
		supabase.from("investors").select("*"),
	]);

	if (tradesRes.error) throw tradesRes.error;
	if (investorsRes.error) throw investorsRes.error;

	const trades = tradesRes.data || [];
	const investors = investorsRes.data || [];

	const tradesWithNotes = trades.filter((t) => {
		if (t.note === null || t.note === undefined) return false;
		const txt = String(t.note).trim();
		if (!txt) return false;
		if (txt.toLowerCase() === "system") return false;
		return true;
	});

	const foundersById = new Map(founders.map((f) => [f.id, f]));
	const investorsById = new Map(investors.map((i) => [i.id, i]));

	return {
		founders,
		investors,
		tradesWithNotes,
		foundersById,
		investorsById,
	};
}

/**
 * Uses GPT to analyze feedback and flag items that are NOT useful.
 * Returns { flagged: [...], total_analyzed: number }
 */
async function flagUnusefulFeedback(
	tradesWithNotes,
	investorsById,
	foundersById,
) {
	if (!tradesWithNotes.length) {
		return { flagged: [], total_analyzed: 0 };
	}

	const context = tradesWithNotes.map((t) => ({
		trade_id: t.id,
		pitch_id: t.pitch_id,
		founder_name: foundersById.get(t.pitch_id)?.name || t.pitch_id,
		investor_name: investorsById.get(t.investor_id)?.name || t.investor_id,
		created_at: t.created_at,
		note: String(t.note).trim(),
	}));

	const systemPrompt = `You analyze investor feedback notes written during a pitch event. Your task is to identify feedback that does NOT constitute useful feedback for founders.

**Useful feedback** (do NOT flag): Specific, actionable, constructive. Gives founders something concrete to work with. Examples: "The market size seems optimistic—consider adding more data", "Strong team but the go-to-market could use more detail", "Pricing model unclear—would help to see unit economics".

**Unuseful feedback** (DO flag):
- Generic platitudes: "great pitch!", "nice!", "interesting", "good luck" without substance
- Too vague: "needs work", "could be better", "not convinced" with no specifics
- One-word or minimal: "ok", "maybe", "hmm", "idk"
- Off-topic or irrelevant to the pitch
- Purely emotional without actionable insight
- Empty or nonsensical

Return strict JSON only.`;

	const userPrompt = `Analyze these feedback notes from an event. Flag any that do NOT constitute useful feedback for founders.

Feedback to analyze (JSON array):
${JSON.stringify(context, null, 2)}

Return a JSON object with:
- flagged: array of objects for each flagged note, each with: trade_id, investor_name, founder_name, note, category ("generic" | "vague" | "minimal" | "off_topic" | "empty" | "other"), reason (brief explanation)
- total_analyzed: number of notes analyzed

If all feedback is useful, return flagged: [] and total_analyzed: <count>.`;

	const completion = await openai.chat.completions.create({
		model: "gpt-4o-mini",
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		response_format: { type: "json_object" },
		max_tokens: 5000,
		temperature: 0.2,
	});

	try {
		const json = JSON.parse(completion.choices[0].message.content || "{}");
		const flagged = Array.isArray(json.flagged) ? json.flagged : [];
		const total_analyzed =
			typeof json.total_analyzed === "number"
				? json.total_analyzed
				: tradesWithNotes.length;
		return { flagged, total_analyzed };
	} catch (_e) {
		// eslint-disable-next-line no-console
		console.error(
			"Failed to parse GPT response. Raw:",
			completion.choices[0]?.message?.content,
		);
		return { flagged: [], total_analyzed: tradesWithNotes.length };
	}
}

async function main() {
	const args = process.argv.slice(2);
	let eventId = null;
	let outputPath = null;

	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--event" || a === "--event-id") {
			eventId = args[i + 1];
			i++;
		} else if (a?.startsWith("--event=")) {
			eventId = a.split("=")[1];
		} else if (a?.startsWith("--event-id=")) {
			eventId = a.split("=")[1];
		} else if (a === "--output" || a === "-o") {
			outputPath = args[i + 1];
			i++;
		} else if (a && !a.startsWith("--") && !eventId) {
			eventId = a;
		}
	}

	if (!eventId) {
		eventId = process.env.EVENT_ID;
	}

	if (!eventId) {
		throw new Error(
			"Event ID required. Use --event <id>, --event-id <id>, or set EVENT_ID env var.",
		);
	}

	// eslint-disable-next-line no-console
	console.error(`Fetching feedback for event: ${eventId}`);

	const { founders, tradesWithNotes, foundersById, investorsById } =
		await fetchEventFeedback(eventId);

	if (tradesWithNotes.length === 0) {
		const result = {
			event_id: eventId,
			flagged: [],
			total_analyzed: 0,
			message: "No feedback notes found for this event.",
		};
		const json = JSON.stringify(result, null, 2);
		// eslint-disable-next-line no-console
		console.log(json);
		if (outputPath) {
			fs.writeFileSync(outputPath, json, "utf8");
			// eslint-disable-next-line no-console
			console.error(`Report written to ${outputPath}`);
		}
		return;
	}

	// eslint-disable-next-line no-console
	console.error(
		`Analyzing ${tradesWithNotes.length} feedback notes across ${founders.length} founders...`,
	);

	const { flagged, total_analyzed } = await flagUnusefulFeedback(
		tradesWithNotes,
		investorsById,
		foundersById,
	);

	const result = {
		event_id: eventId,
		flagged,
		total_analyzed,
		flagged_count: flagged.length,
		summary:
			flagged.length > 0
				? `${flagged.length} feedback note(s) flagged as unuseful.`
				: "All feedback appears useful.",
	};

	const json = JSON.stringify(result, null, 2);
	// eslint-disable-next-line no-console
	console.log(json);

	if (outputPath) {
		fs.writeFileSync(outputPath, json, "utf8");
		// eslint-disable-next-line no-console
		console.error(`Report written to ${outputPath}`);
	}

	if (flagged.length > 0) {
		// eslint-disable-next-line no-console
		console.error(`\n⚠️  ${flagged.length} unuseful feedback item(s):`);
		for (const f of flagged) {
			// eslint-disable-next-line no-console
			console.error(
				`  - [${f.category || "other"}] ${f.founder_name}: "${f.note}" (${f.investor_name})`,
			);
		}
	}
}

main().catch((e) => {
	// eslint-disable-next-line no-console
	console.error(e);
	process.exit(1);
});
