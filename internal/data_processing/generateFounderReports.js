import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
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

function groupBy(arr, keyFn) {
	const m = new Map();
	for (const item of arr) {
		const k = keyFn(item);
		if (!m.has(k)) m.set(k, []);
		m.get(k).push(item);
	}
	return m;
}

function parseTs(ts) {
	return ts instanceof Date ? ts : new Date(ts);
}

function sanitizeFileName(name) {
	return String(name)
		.replace(/[\\/:*?"<>|]/g, "_")
		.replace(/\s+/g, " ")
		.trim();
}

async function ensureDir(dirPath) {
	await fs.promises.mkdir(dirPath, { recursive: true });
}

async function fetchAll(eventId) {
	// Founders (optional event filter)
	const foundersQuery = supabase.from("founders").select("*");
	const foundersRes = eventId
		? await foundersQuery.eq("event_id", eventId)
		: await foundersQuery;
	if (foundersRes.error) throw foundersRes.error;
	const founders = foundersRes.data || [];
	const founderIds = founders.map((f) => f.id);

	// Investors (unfiltered)
	const investorsRes = await supabase.from("investors").select("*");
	if (investorsRes.error) throw investorsRes.error;

	let trades = [];
	let priceHistory = [];

	if (eventId) {
		if (founderIds.length > 0) {
			const [tradesRes, pricesRes] = await Promise.all([
				supabase
					.from("trades")
					.select(
						"id, founder_id, investor_id, note, amount, shares, price_per_share, created_at",
					)
					.in("founder_id", founderIds)
					.order("created_at", { ascending: true }),
				supabase
					.from("price_history")
					.select("founder_id, price, shares_in_pool, recorded_at")
					.in("founder_id", founderIds)
					.order("recorded_at", { ascending: true }),
			]);
			if (tradesRes.error) throw tradesRes.error;
			if (pricesRes.error) throw pricesRes.error;
			trades = tradesRes.data || [];
			priceHistory = pricesRes.data || [];
		}
	} else {
		const [tradesRes, pricesRes] = await Promise.all([
			supabase
				.from("trades")
				.select(
					"id, founder_id, investor_id, note, amount, shares, price_per_share, created_at",
				)
				.order("created_at", { ascending: true }),
			supabase
				.from("price_history")
				.select("founder_id, price, shares_in_pool, recorded_at")
				.order("recorded_at", { ascending: true }),
		]);
		if (tradesRes.error) throw tradesRes.error;
		if (pricesRes.error) throw pricesRes.error;
		trades = tradesRes.data || [];
		priceHistory = pricesRes.data || [];
	}

	return {
		founders,
		investors: investorsRes.data || [],
		trades,
		priceHistory,
	};
}

async function fetchBufferFromUrl(url) {
	if (!url) return null;
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const ab = await res.arrayBuffer();
		let contentType = res.headers?.get?.("content-type") || "";
		if (!contentType) {
			const lower = String(url).toLowerCase();
			if (lower.endsWith(".png")) contentType = "image/png";
			else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
				contentType = "image/jpeg";
			else if (lower.endsWith(".gif")) contentType = "image/gif";
			else contentType = "application/octet-stream";
		}
		return { buffer: Buffer.from(ab), contentType: contentType.split(";")[0] };
	} catch (_e) {
		return null;
	}
}

const INITIAL_SHARES = 100000;

function downsampleSeries(labels, data, maxPoints = 300) {
	if (labels.length <= maxPoints) return { labels, data };
	const step = Math.ceil(labels.length / maxPoints);
	const dsLabels = [];
	const dsData = [];
	for (let i = 0; i < labels.length; i += step) {
		dsLabels.push(labels[i]);
		dsData.push(data[i]);
	}
	return { labels: dsLabels, data: dsData };
}

/**
 * Compute market cap from price history: marketCap = price * (initialShares - shares_in_pool)
 * Matches calculateMarketCap in src/lib/ammEngine.ts
 */
function computeMarketCapFromHistory(priceHistoryPoints) {
	return (priceHistoryPoints || [])
		.filter((p) => p.shares_in_pool != null && p.price != null)
		.map((p) => {
			const price = Number(p.price);
			const sharesInPool = Number(p.shares_in_pool);
			const sharesIssued = INITIAL_SHARES - sharesInPool;
			return { x: parseTs(p.recorded_at), y: price * sharesIssued };
		});
}

async function createMarketCapChartPng(labels, data) {
	if (!labels.length || !data.length) return null;
	const { labels: l2, data: d2 } = downsampleSeries(labels, data, 300);
	const chartConfig = {
		type: "line",
		data: {
			labels: l2,
			datasets: [
				{
					label: "Market Cap",
					data: d2,
					borderColor: "#2563eb",
					backgroundColor: "rgba(37,99,235,0.15)",
					borderWidth: 2,
					fill: false,
					pointRadius: 0,
					tension: 0.2,
				},
			],
		},
		options: {
			maintainAspectRatio: false,
			layout: { padding: { top: 36, bottom: 36, left: 8, right: 8 } },
			plugins: {
				legend: { display: true, labels: { boxWidth: 12, color: "#ffffff" } },
				tooltip: {
					enabled: true,
					titleColor: "#ffffff",
					bodyColor: "#ffffff",
					footerColor: "#ffffff",
					callbacks: {
						label: (ctx) =>
							`Market Cap: $${Number(ctx.raw).toLocaleString("en-US", {
								minimumFractionDigits: 0,
								maximumFractionDigits: 0,
							})}`,
					},
				},
			},
			scales: {
				x: {
					display: true,
					grid: { color: "rgba(148,163,184,0.2)" },
					ticks: {
						maxRotation: 0,
						autoSkip: true,
						maxTicksLimit: 4,
						autoSkipPadding: 10,
						color: "#ffffff",
					},
					title: { display: true, text: "Time", color: "#ffffff" },
				},
				y: {
					display: true,
					beginAtZero: false,
					grid: { color: "rgba(148,163,184,0.2)" },
					ticks: {
						color: "#ffffff",
						callback: (v) =>
							v >= 1e6 ? `$${v / 1e6}M` : v >= 1e3 ? `$${v / 1e3}K` : `$${v}`,
					},
					title: { display: true, text: "Market Cap", color: "#ffffff" },
				},
			},
		},
	};
	const url =
		"https://quickchart.io/chart?format=png&width=1200&height=500&version=4&backgroundColor=transparent&c=" +
		encodeURIComponent(JSON.stringify(chartConfig));
	const res = await fetch(url);
	if (!res.ok) return null;
	const ab = await res.arrayBuffer();
	return Buffer.from(ab);
}

function bufferToDataUrl(buf, mime) {
	if (!buf) return null;
	const b64 = Buffer.from(buf).toString("base64");
	return `data:${mime};base64,${b64}`;
}

function formatTimeHM(d) {
	const hours = d.getHours();
	const minutes = d.getMinutes();
	return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatNumber(n) {
	return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatCurrency(n) {
	return `$${Number(n).toLocaleString("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	})}`;
}

function buildRawNotesRows(tradesWithNotes, investorsById) {
	const rows = (tradesWithNotes || [])
		.slice()
		.sort((a, b) => parseTs(a.created_at) - parseTs(b.created_at))
		.map((t) => {
			const when = parseTs(t.created_at);
			const shares = Number(t.shares || 0);
			const amount = Number(t.amount || 0);
			const pricePerShare = Number(t.price_per_share || 0);
			// Determine trade type solely from amount: negative => Sell, otherwise => Buy
			let type = amount < 0 ? "Sell" : "Buy";
			let amountDisplay = "—";
			if (amount !== 0) {
				amountDisplay = formatCurrency(Math.abs(amount));
			} else if (shares !== 0 && pricePerShare > 0) {
				amountDisplay = `${formatNumber(Math.abs(shares))} @ ${formatCurrency(
					pricePerShare,
				)}`;
			} else if (shares !== 0) {
				amountDisplay = `${formatNumber(Math.abs(shares))} shares`;
			}
			const typeClass =
				type === "Buy" ? "type-buy" : type === "Sell" ? "type-sell" : "";
			return {
				time: formatTimeHM(when),
				type,
				typeClass,
				amount: amountDisplay,
				note: String(t.note || "—"),
			};
		});
	return rows;
}

async function summarizeAndSelectFeedback(
	founder,
	investorById,
	tradesWithNotes,
) {
	if (!tradesWithNotes.length) {
		return {
			summary:
				"No written feedback was recorded for this founder during the event.",
			selected_feedback: [],
		};
	}

	const context = tradesWithNotes.map((t) => ({
		trade_id: t.id,
		investor_name: investorById.get(t.investor_id)?.name || t.investor_id,
		created_at: t.created_at,
		note: String(t.note).trim(),
		amount: Number(t.amount || 0),
		shares: Number(t.shares || 0),
		price_per_share: Number(t.price_per_share || 0),
	}));

	const messages = [
		{
			role: "system",
			content:
				"You analyze investor trade notes to craft concise, constructive feedback for startup founders. Select only high-signal, specific, actionable items. Avoid generic platitudes. Return strict JSON only.",
		},
		{
			role: "user",
			content: `Founder: ${
				founder.name
			}\n\nTrade feedback context (JSON array):\n${JSON.stringify(
				context,
			)}\n\nTask: 1) Summarize the overall feedback in 4-6 sentences. 2) Select 3-7 of the most useful feedback notes. Prefer notes that are specific, constructive, and actionable.\n\nReturn JSON with keys: summary (string), selected_feedback (array of {trade_id, investor_name, note, reason}).`,
		},
	];

	const completion = await openai.chat.completions.create({
		model: "gpt-4o-mini",
		messages,
		response_format: { type: "json_object" },
		max_tokens: 800,
		temperature: 0.2,
	});

	try {
		const json = JSON.parse(completion.choices[0].message.content || "{}");
		const summary = typeof json.summary === "string" ? json.summary : "";
		const selected = Array.isArray(json.selected_feedback)
			? json.selected_feedback
			: [];
		return { summary, selected_feedback: selected };
	} catch (_e) {
		return {
			summary:
				"Feedback was collected, but automatic summarization failed. Please review the raw notes.",
			selected_feedback: [],
		};
	}
}

function buildFounderReportHtml({
	founder,
	logoDataUrl,
	chartDataUrl,
	feedbackSummary,
	selectedFeedback,
	rawNotesRows,
}) {
	const safeSummary = (feedbackSummary || "—").toString();
	const notesHtml =
		Array.isArray(selectedFeedback) && selectedFeedback.length
			? selectedFeedback
					.map((item) => {
						const reason = item.reason
							? `<div class="note-reason">Why included: ${String(
									item.reason,
								)}</div>`
							: "";
						return `<li class="note-item"><div class="note">${String(
							item.note,
						)}</div>${reason}</li>`;
					})
					.join("")
			: '<div class="muted">No notable written feedback was selected.</div>';

	return `<!DOCTYPE html>
	<html>
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${founder.name || "Founder"} – PitchTank Report</title>
		<style>
			@page { margin: 0; }
			:root {
				--bg: #0b1220; /* deep midnight */
				--bg-elev: #0f1a2b; /* elevated card */
				--muted: #91a4c0;
				--text: #e8eef8;
				--primary: #3b82f6; /* blue-500 */
				--primary-600: #2563eb;
				--accent: #22d3ee; /* cyan-400 */
				--ring: rgba(59, 130, 246, 0.35);
				--divider: rgba(148, 163, 184, 0.15);
			}
			* { box-sizing: border-box; }
			html, body { margin:0; padding:0; }
			body {
				background: linear-gradient(180deg, #0b1220 0%, #0b1426 40%, #0b1220 100%);
				color: var(--text);
				font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji";
				line-height: 1.5;
				padding: 0;
			}
			.container {
				max-width: 960px;
				margin: 0 auto;
				padding: 20px 24px;
				background: linear-gradient(180deg, rgba(59,130,246,0.05) 0%, rgba(34,211,238,0.03) 100%), var(--bg-elev);
				border: 1px solid var(--divider);
				border-radius: 16px;
				box-shadow: 0 10px 30px rgba(0,0,0,0.45);
			}
			.header {
				display: grid;
				grid-template-columns: auto 1fr;
				gap: 16px;
				align-items: center;
				padding-bottom: 16px;
				border-bottom: 1px solid var(--divider);
			}
			.logo {
				width: 88px;
				height: 88px;
				border-radius: 12px;
				border: 1px solid var(--divider);
				background: rgba(255,255,255,0.02);
				object-fit: contain;
			}
			.title {
				font-size: 28px;
				font-weight: 700;
				letter-spacing: 0.2px;
			}
			.subtitle { color: var(--muted); margin-top: 4px; }
			.grid {
				display: grid;
				grid-template-columns: 1fr;
				gap: 18px;
				margin-top: 18px;
			}
			.section {
				background: rgba(15, 26, 43, 0.7);
				border: 1px solid var(--divider);
				border-radius: 14px;
				padding: 16px;
			}
			.section h2 {
				margin: 0 0 8px 0;
				font-size: 16px;
				font-weight: 700;
				color: #dbeafe;
				text-transform: uppercase;
				letter-spacing: 0.08em;
			}
			.muted { color: var(--muted); }
			.card {
				border-radius: 12px;
				border: 1px solid var(--divider);
				background: radial-gradient(1200px 600px at 0% 0%, rgba(59,130,246,0.08) 0%, rgba(34,211,238,0.06) 40%, rgba(15,26,43,0.6) 100%);
				padding: 14px;
			}
			.chart {
				width: 100%;
				height: 260px;
				border-radius: 10px;
				border: 1px dashed var(--divider);
				background: rgba(59,130,246,0.07);
				object-fit: cover;
			}
			.chart.placeholder {
				display: grid;
				place-items: center;
				color: var(--muted);
				font-size: 13px;
			}
			.notes {
				list-style: none;
				padding: 0;
				margin: 0;
				display: grid;
				gap: 10px;
			}
			.note-item {
				padding: 10px 12px;
				border-radius: 10px;
				background: rgba(59,130,246,0.08);
				border: 1px solid var(--divider);
			}
			.note { color: #e2e8f0; }
			.note-reason { color: var(--muted); margin-top: 6px; font-size: 12px; }
			.note-meta { color: var(--accent); font-size: 12px; margin-left: 6px; }
			.table {
				width: 100%;
				border-collapse: collapse;
				border: 1px solid var(--divider);
				border-radius: 12px;
				overflow: hidden;
			}
			.table th, .table td {
				padding: 10px 12px;
				border-bottom: 1px solid var(--divider);
				font-size: 12px;
			}
			.table th { text-align: left; color: #bfdbfe; background: rgba(59,130,246,0.08); }
			.table tr:last-child td { border-bottom: 0; }
			.type-buy { color: #10b981; font-weight: 600; }
			.type-sell { color: #ef4444; font-weight: 600; }
			.footer {
				margin-top: 16px;
				padding-top: 12px;
				border-top: 1px solid var(--divider);
				color: var(--muted);
				font-size: 12px;
			}
		</style>
	</head>
	<body>
		<div class="container">
			<div class="header">
				${
					logoDataUrl
						? `<img class="logo" src="${logoDataUrl}" alt="logo" />`
						: `<div class="logo" style="display:grid;place-items:center;color:var(--muted);">No Logo</div>`
				}
				<div>
					<div class="title">${founder.name || "Founder"}</div>
					<div class="subtitle">PitchTank Founder Report</div>
				</div>
			</div>

			<div class="grid">
				<div class="section">
					<h2>Market Cap History</h2>
					<div class="card">
						${
							chartDataUrl
								? `<img class="chart" src="${chartDataUrl}" alt="Market cap chart" />`
								: `<div class="chart placeholder">No market cap data available</div>`
						}
					</div>
				</div>

				<div class="section">
					<h2>Feedback Highlights</h2>
					<div class="card" style="margin-bottom:10px;">${safeSummary}</div>
					${
						Array.isArray(selectedFeedback) && selectedFeedback.length
							? `<ul class=\"notes\">${notesHtml}</ul>`
							: notesHtml
					}
				</div>

				<div class="section">
					<h2>Trades with Feedback</h2>
					<div class="card" style="padding:0;">
						<table class="table">
							<thead>
								<tr>
									<th style="width:90px;">Time</th>
									<th style="width:80px;">Type</th>
									<th style="width:120px;">Amount</th>
									<th>Note</th>
								</tr>
							</thead>
							<tbody>
								${(rawNotesRows || [])
									.map(
										(r) => `
									<tr>
										<td>${r.time}</td>
										<td><span class="${r.typeClass}">${r.type}</span></td>
										<td>${r.amount}</td>
										<td>${r.note}</td>
									</tr>
								`,
									)
									.join("")}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<div class="footer">We'd love your feedback about the event! You'll receive the event videos and photos soon. If you share on social, please tag #pitchtank — it really helps spread the word.</div>
		</div>
	</body>
	</html>`;
}

async function renderPdfFromHtml(html, outputPath) {
	const browser = await puppeteer.launch({ headless: true });
	try {
		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: "networkidle0" });
		await page.pdf({
			path: outputPath,
			format: "Letter",
			printBackground: true,
			margin: { top: "0", right: "0", bottom: "0", left: "0" },
		});
	} finally {
		await browser.close();
	}
	return outputPath;
}

function getEventIdFromArgs() {
	const args = process.argv.slice(2);
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--event" || a === "--event-id") return args[i + 1];
		if (a && a.startsWith("--event=")) return a.split("=")[1];
		if (a && a.startsWith("--event-id=")) return a.split("=")[1];
		// accept first positional argument as event id
		if (a && !a.startsWith("--")) return a;
	}
	return process.env.EVENT_ID || null;
}

async function main() {
	const eventId = getEventIdFromArgs();
	if (!eventId) {
		throw new Error(
			"Event ID required. Use --event <id>, --event-id <id>, or set EVENT_ID env var.",
		);
	}
	const { founders, investors, trades, priceHistory } = await fetchAll(eventId);
	const investorsById = new Map(investors.map((i) => [i.id, i]));
	const tradesByFounder = groupBy(trades, (t) => t.founder_id);
	const pricesByFounder = groupBy(priceHistory, (p) => p.founder_id);

	const outputDir = path.join("internal", "reports");
	await ensureDir(outputDir);

	for (const founder of founders) {
		const founderTrades = tradesByFounder.get(founder.id) || [];
		const tradesWithNotes = founderTrades.filter((t) => {
			if (t.note === null || t.note === undefined) return false;
			const txt = String(t.note).trim();
			if (!txt) return false;
			if (txt.toLowerCase() === "system") return false;
			return true;
		});

		const feedback = await summarizeAndSelectFeedback(
			founder,
			investorsById,
			tradesWithNotes,
		);

		const founderPriceHistory = pricesByFounder.get(founder.id) || [];
		const marketCapPoints = computeMarketCapFromHistory(founderPriceHistory);
		marketCapPoints.sort((a, b) => a.x - b.x);
		const labels = marketCapPoints.map((p) => formatTimeHM(p.x));
		const data = marketCapPoints.map((p) => p.y);

		const [chartBuffer, logoRes] = await Promise.all([
			createMarketCapChartPng(labels, data),
			fetchBufferFromUrl(founder.logo_url),
		]);

		const chartDataUrl = chartBuffer
			? bufferToDataUrl(chartBuffer, "image/png")
			: null;
		const logoDataUrl = logoRes
			? bufferToDataUrl(logoRes.buffer, logoRes.contentType || "image/png")
			: null;

		const html = buildFounderReportHtml({
			founder,
			logoDataUrl,
			chartDataUrl,
			feedbackSummary: feedback.summary,
			selectedFeedback: feedback.selected_feedback,
			rawNotesRows: buildRawNotesRows(tradesWithNotes, investorsById),
		});

		const safeName = sanitizeFileName(founder.name || founder.id || "founder");
		const filePath = path.join(outputDir, `${safeName}.pdf`);
		const pdfPath = await renderPdfFromHtml(html, filePath);

		// eslint-disable-next-line no-console
		console.log(`Generated report: ${pdfPath}`);
	}

	// eslint-disable-next-line no-console
	console.log("All founder reports generated.");
}

main().catch((e) => {
	// eslint-disable-next-line no-console
	console.error(e);
	process.exit(1);
});
