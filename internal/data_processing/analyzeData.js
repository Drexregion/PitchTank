/**
 * PitchTank Analytics – Core metrics, timing, holdings, awards.
 *
 * Usage:
 *   node internal/data_processing/analyzeData.js [--event <eventId>]
 *   node internal/data_processing/analyzeData.js [--event-id <eventId>]
 *   EVENT_ID=<eventId> node internal/data_processing/analyzeData.js
 *
 * If event_id is provided, only data for that event is analyzed.
 * If omitted, all data across events is analyzed.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error(
		"Missing Supabase credentials. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set."
	);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function mapById(rows) {
	const map = new Map();
	for (const r of rows) map.set(r.id, r);
	return map;
}

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

function toPct(n) {
	if (n === null || n === undefined || Number.isNaN(n)) return "-";
	return `${(n * 100).toFixed(2)}%`;
}

function fmt(n, digits = 2) {
	if (n === null || n === undefined || Number.isNaN(n)) return "-";
	return Number(n).toLocaleString(undefined, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	});
}

function durationToString(ms) {
	if (ms <= 0) return "0s";
	const sec = Math.floor(ms / 1000);
	const days = Math.floor(sec / 86400);
	const hrs = Math.floor((sec % 86400) / 3600);
	const mins = Math.floor((sec % 3600) / 60);
	const s = sec % 60;
	const parts = [];
	if (days) parts.push(`${days}d`);
	if (hrs) parts.push(`${hrs}h`);
	if (mins) parts.push(`${mins}m`);
	if (s && parts.length === 0) parts.push(`${s}s`);
	return parts.join(" ") || "0s";
}

function findNearestPriceAtOrAfter(prices, ts) {
	for (let i = 0; i < prices.length; i++) {
		if (parseTs(prices[i].recorded_at) >= ts) return prices[i].price;
	}
	return null;
}

function findMinAfter(prices, ts) {
	let min = Infinity;
	let found = false;
	for (let i = 0; i < prices.length; i++) {
		const t = parseTs(prices[i].recorded_at);
		if (t > ts) {
			found = true;
			if (prices[i].price < min) min = prices[i].price;
		}
	}
	return found ? min : null;
}

function findMaxAfter(prices, ts) {
	let max = -Infinity;
	let found = false;
	for (let i = 0; i < prices.length; i++) {
		const t = parseTs(prices[i].recorded_at);
		if (t > ts) {
			found = true;
			if (prices[i].price > max) max = prices[i].price;
		}
	}
	return found ? max : null;
}

function findMinBetween(prices, start, end) {
	let min = Infinity;
	let found = false;
	for (let i = 0; i < prices.length; i++) {
		const t = parseTs(prices[i].recorded_at);
		if (t >= start && t <= end) {
			found = true;
			if (prices[i].price < min) min = prices[i].price;
		}
	}
	return found ? min : null;
}

function getEventIdFromArgs() {
	const args = process.argv.slice(2);
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--event" || a === "--event-id") return args[i + 1];
		if (a && a.startsWith("--event=")) return a.split("=")[1];
		if (a && a.startsWith("--event-id=")) return a.split("=")[1];
		if (a && !a.startsWith("--")) return a;
	}
	return process.env.EVENT_ID || null;
}

async function fetchAll(eventId) {
	const tradesQuery = supabase
		.from("trades")
		.select("*")
		.order("created_at", { ascending: true });
	const investorsQuery = supabase.from("investors").select("*");
	const foundersQuery = supabase.from("pitches").select("*");
	const pricesQuery = supabase
		.from("price_history")
		.select("*")
		.order("recorded_at", { ascending: true });
	const holdingsQuery = supabase.from("investor_holdings").select("*");

	const [tradesRes, investorsRes, foundersRes, pricesRes, holdingsRes] =
		await Promise.all([
			eventId ? tradesQuery.eq("event_id", eventId) : tradesQuery,
			eventId ? investorsQuery.eq("event_id", eventId) : investorsQuery,
			eventId ? foundersQuery.eq("event_id", eventId) : foundersQuery,
			eventId ? pricesQuery.eq("event_id", eventId) : pricesQuery,
			holdingsQuery,
		]);

	if (tradesRes.error) throw tradesRes.error;
	if (investorsRes.error) throw investorsRes.error;
	if (foundersRes.error) throw foundersRes.error;
	if (pricesRes.error) throw pricesRes.error;
	if (holdingsRes.error) throw holdingsRes.error;

	let holdings = holdingsRes.data || [];
	if (eventId) {
		const investorIds = new Set((investorsRes.data || []).map((i) => i.id));
		const founderIds = new Set((foundersRes.data || []).map((f) => f.id));
		holdings = holdings.filter(
			(h) => investorIds.has(h.investor_id) && founderIds.has(h.pitch_id)
		);
	}

	return {
		trades: tradesRes.data || [],
		investors: investorsRes.data || [],
		founders: foundersRes.data || [],
		priceHistory: pricesRes.data || [],
		holdings,
	};
}

function computeCoreMetrics(trades, investorsById, foundersById) {
	let totalVolume = 0;
	let totalShares = 0;
	let largestTrade = null; // by amount

	const tradesByFounder = new Map();
	const tradesByInvestor = new Map();

	for (const t of trades) {
		const amt = Math.abs(Number(t.amount || 0));
		const sh = Math.abs(Number(t.shares || 0));
		totalVolume += amt;
		totalShares += sh;

		if (!largestTrade || amt > Math.abs(largestTrade.amount || 0))
			largestTrade = t;

		const fKey = t.pitch_id;
		tradesByFounder.set(fKey, (tradesByFounder.get(fKey) || 0) + 1);
		const iKey = t.investor_id;
		tradesByInvestor.set(iKey, (tradesByInvestor.get(iKey) || 0) + 1);
	}

	const avgTradeSize = trades.length ? totalVolume / trades.length : 0;

	const liquidityRanking = Array.from(tradesByFounder.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([founderId, count]) => ({
			founderId,
			founderName: foundersById.get(founderId)?.name || founderId,
			trades: count,
		}));

	let mostActive = null;
	for (const [investorId, count] of tradesByInvestor.entries()) {
		if (!mostActive || count > mostActive.count) {
			mostActive = {
				investorId,
				investorName: investorsById.get(investorId)?.name || investorId,
				count,
			};
		}
	}

	return {
		totalVolume,
		totalShares,
		avgTradeSize,
		liquidityRanking,
		mostActiveTrader: mostActive,
		largestTrade,
	};
}

function computePnLAndHoldings(trades) {
	// Average-cost basis realization per investor+founder
	const key = (t) => `${t.investor_id}::${t.pitch_id}`;
	const state = new Map();
	const perInvestor = new Map();

	for (const t of trades) {
		const k = key(t);
		if (!state.has(k))
			state.set(k, {
				position: 0,
				avgCost: 0,
				realized: 0,
				wins: 0,
				sells: 0,
				firstPositiveTs: null,
				holds: [],
			});
		const s = state.get(k);
		const isBuy = String(t.type).toLowerCase() === "buy";
		const tradeTs = parseTs(t.created_at);
		const price = Number(t.price_per_share || 0);
		const sh = Number(t.shares || 0);

		if (isBuy) {
			const newPosition = s.position + sh;
			s.avgCost =
				s.position === 0
					? price
					: (s.avgCost * s.position + price * sh) / newPosition;
			s.position = newPosition;
			if (s.position > 0 && !s.firstPositiveTs) s.firstPositiveTs = tradeTs;
		} else {
			const sellQty = Math.min(sh, s.position);
			const realized = (price - s.avgCost) * sellQty;
			s.realized += realized;
			s.sells += 1;
			if (realized > 0) s.wins += 1;
			s.position -= sellQty;
			if (s.position <= 0) {
				if (s.firstPositiveTs)
					s.holds.push({ start: s.firstPositiveTs, end: tradeTs });
				s.firstPositiveTs = null;
				s.avgCost = 0;
			}
		}
	}

	// Close any open holds till now
	const now = new Date();
	for (const s of state.values()) {
		if (s.position > 0 && s.firstPositiveTs) {
			s.holds.push({ start: s.firstPositiveTs, end: now });
			s.firstPositiveTs = null;
		}
	}

	// Aggregate per investor
	for (const [k, s] of state.entries()) {
		const investorId = k.split("::")[0];
		if (!perInvestor.has(investorId))
			perInvestor.set(investorId, { realized: 0, wins: 0, sells: 0 });
		const agg = perInvestor.get(investorId);
		agg.realized += s.realized;
		agg.wins += s.wins;
		agg.sells += s.sells;
	}

	return { perPair: state, perInvestor };
}

function computeTimingMetrics(trades, pricesByFounder) {
	let bestTimedBuy = null; // {trade, pct}
	let bestTimedSell = null; // {trade, pctDrop}

	for (const t of trades) {
		const founderPrices = pricesByFounder.get(t.pitch_id) || [];
		const ts = parseTs(t.created_at);
		const price = Number(t.price_per_share || 0);
		if (String(t.type).toLowerCase() === "buy") {
			const maxAfter = findMaxAfter(founderPrices, ts);
			if (maxAfter !== null && price > 0) {
				const pct = (maxAfter - price) / price;
				if (!bestTimedBuy || pct > bestTimedBuy.pct)
					bestTimedBuy = { trade: t, pct };
			}
		} else {
			const minAfter = findMinAfter(founderPrices, ts);
			if (minAfter !== null && price > 0) {
				const pctDrop = (price - minAfter) / price; // drop after sell
				if (!bestTimedSell || pctDrop > bestTimedSell.pct)
					bestTimedSell = { trade: t, pct: pctDrop };
			}
		}
	}

	// Moonshot: founder with highest price gain % overall
	let moonshot = null; // {founderId, pct}
	for (const [founderId, list] of pricesByFounder.entries()) {
		let minSeen = Infinity;
		let maxGain = 0;
		for (const p of list) {
			if (p.price < minSeen) minSeen = p.price;
			const g = minSeen > 0 ? (p.price - minSeen) / minSeen : 0;
			if (g > maxGain) maxGain = g;
		}
		if (!moonshot || maxGain > moonshot.pct)
			moonshot = { founderId, pct: maxGain };
	}

	return { bestTimedBuy, bestTimedSell, moonshot };
}

function computeHoldingMetrics(
	pairsState,
	pricesByFounder,
	investorsById,
	foundersById,
	holdings
) {
	// Diamond hands: longest continuous hold for any investor/founder
	let diamond = null; // {investorId, founderId, durationMs}
	for (const [k, s] of pairsState.entries()) {
		for (const h of s.holds) {
			const dur = h.end - h.start;
			if (!diamond || dur > diamond.durationMs) {
				diamond = {
					investorId: k.split("::")[0],
					founderId: k.split("::")[1],
					durationMs: dur,
				};
			}
		}
	}

	// Diversified investor: most distinct founders with positive holdings
	const positiveByInvestor = new Map();
	if (holdings && holdings.length) {
		for (const row of holdings) {
			if (Number(row.shares || 0) > 0) {
				if (!positiveByInvestor.has(row.investor_id))
					positiveByInvestor.set(row.investor_id, new Set());
				positiveByInvestor.get(row.investor_id).add(row.pitch_id);
			}
		}
	} else {
		// Fallback: derive from pairsState positions
		for (const [k, s] of pairsState.entries()) {
			const investorId = k.split("::")[0];
			const founderId = k.split("::")[1];
			if (s.position > 0) {
				if (!positiveByInvestor.has(investorId))
					positiveByInvestor.set(investorId, new Set());
				positiveByInvestor.get(investorId).add(founderId);
			}
		}
	}
	let diversified = null;
	for (const [investorId, set] of positiveByInvestor.entries()) {
		if (!diversified || set.size > diversified.count) {
			diversified = { investorId, count: set.size };
		}
	}

	// YOLO: largest single trade amount as % of initial balance
	let yolo = null; // {investorId, tradeId, pct}
	const investorInitial = new Map();
	for (const [id, inv] of investorsById.entries())
		investorInitial.set(
			id,
			Number(inv.initial_balance || inv.current_balance || 0)
		);

	// We'll compute YOLO outside, but keep placeholder to be set by caller

	// Bag holder: during a hold window, worst drop relative to start price until end
	let bagHolder = null; // {investorId, founderId, dropPct}
	for (const [k, s] of pairsState.entries()) {
		const founderId = k.split("::")[1];
		const prices = pricesByFounder.get(founderId) || [];
		for (const h of s.holds) {
			const startPrice = findNearestPriceAtOrAfter(prices, h.start);
			const minBetween = findMinBetween(prices, h.start, h.end);
			if (startPrice && minBetween && startPrice > 0) {
				const drop = (startPrice - minBetween) / startPrice;
				if (!bagHolder || drop > bagHolder.dropPct) {
					bagHolder = {
						investorId: k.split("::")[0],
						founderId,
						dropPct: drop,
					};
				}
			}
		}
	}

	return { diamond, diversified, yolo, bagHolder };
}

function computeFounderNotes(trades) {
	const notesByFounder = new Map();
	for (const t of trades) {
		const raw = t.note;
		if (raw === null || raw === undefined) continue;
		const note = String(raw).trim();
		if (!note) continue;
		if (note.toLowerCase() === "system") continue;
		const list = notesByFounder.get(t.pitch_id) || [];
		list.push({ ts: parseTs(t.created_at), note });
		notesByFounder.set(t.pitch_id, list);
	}
	for (const [fid, list] of notesByFounder.entries()) {
		list.sort((a, b) => a.ts - b.ts);
		notesByFounder.set(fid, list);
	}
	return notesByFounder;
}

async function main() {
	const eventId = getEventIdFromArgs();
	const { trades, investors, founders, priceHistory, holdings } =
		await fetchAll(eventId);

	if (eventId) {
		// eslint-disable-next-line no-console
		console.log(`\nAnalyzing event: ${eventId}\n`);
	}
	const investorsById = mapById(investors);
	const foundersById = mapById(founders);
	const pricesByFounder = groupBy(priceHistory, (p) => p.pitch_id);

	const core = computeCoreMetrics(trades, investorsById, foundersById);
	const { perPair, perInvestor } = computePnLAndHoldings(trades);
	const timing = computeTimingMetrics(trades, pricesByFounder);
	const holds = computeHoldingMetrics(
		perPair,
		pricesByFounder,
		investorsById,
		foundersById,
		holdings
	);
	const notesByFounder = computeFounderNotes(trades);

	// Compute YOLO now that we can access investors initial balances
	let yolo = null;
	for (const t of trades) {
		const init = Number(investorsById.get(t.investor_id)?.initial_balance || 0);
		if (init > 0) {
			const pct = Math.abs(Number(t.amount || 0)) / init;
			if (!yolo || pct > yolo.pct)
				yolo = { investorId: t.investor_id, tradeId: t.id, pct };
		}
	}
	if (yolo) holds.yolo = yolo;

	// Awards
	let shark = null; // biggest total profit (realized)
	for (const [investorId, agg] of perInvestor.entries()) {
		if (!shark || agg.realized > shark.realized)
			shark = { investorId, realized: agg.realized };
	}

	let smartMoney = null; // highest win rate with min sells
	const MIN_SELLS = 3;
	for (const [investorId, agg] of perInvestor.entries()) {
		if (agg.sells >= MIN_SELLS) {
			const winRate = agg.sells > 0 ? agg.wins / agg.sells : 0;
			if (!smartMoney || winRate > smartMoney.winRate)
				smartMoney = { investorId, winRate, sells: agg.sells };
		}
	}

	let sniper = null; // few trades, big gains
	const tradesByInvestor = groupBy(trades, (t) => t.investor_id);
	for (const [investorId, list] of tradesByInvestor.entries()) {
		if (list.length <= 5) {
			const realized = perInvestor.get(investorId)?.realized || 0;
			if (!sniper || realized > sniper.realized)
				sniper = { investorId, realized, trades: list.length };
		}
	}

	let liquidityProvider = null; // most trades executed
	for (const [investorId, list] of tradesByInvestor.entries()) {
		if (!liquidityProvider || list.length > liquidityProvider.trades)
			liquidityProvider = { investorId, trades: list.length };
	}

	// Printing
	// eslint-disable-next-line no-console
	console.log("\n===== PitchTank Analytics =====\n");
	// eslint-disable-next-line no-console
	console.log("-- Core Metrics --");
	// eslint-disable-next-line no-console
	console.log(`Total trading volume: $${fmt(core.totalVolume)}`);
	// eslint-disable-next-line no-console
	console.log(`Total shares traded: ${fmt(core.totalShares, 0)}`);
	// eslint-disable-next-line no-console
	console.log(`Average trade size: $${fmt(core.avgTradeSize)}`);
	if (core.liquidityRanking.length) {
		const topFounder = core.liquidityRanking[0];
		// eslint-disable-next-line no-console
		console.log(
			`Liquidity ranking (top): ${topFounder.founderName} with ${topFounder.trades} trades`
		);
	}
	if (core.mostActiveTrader) {
		// eslint-disable-next-line no-console
		console.log(
			`Most active trader: ${core.mostActiveTrader.investorName} with ${core.mostActiveTrader.count} trades`
		);
	}
	if (core.largestTrade) {
		// eslint-disable-next-line no-console
		console.log(
			`Largest single trade: $${fmt(core.largestTrade.amount)} (${
				core.largestTrade.type
			}) by ${
				investorsById.get(core.largestTrade.investor_id)?.name ||
				core.largestTrade.investor_id
			} on ${new Date(core.largestTrade.created_at).toISOString()}`
		);
	}

	// eslint-disable-next-line no-console
	console.log("\n-- Timing Metrics --");
	if (timing.bestTimedBuy) {
		const t = timing.bestTimedBuy.trade;
		// eslint-disable-next-line no-console
		console.log(
			`Best-timed buy: ${
				investorsById.get(t.investor_id)?.name || t.investor_id
			} in ${foundersById.get(t.pitch_id)?.name || t.pitch_id} at $${fmt(
				t.price_per_share
			)} -> ${toPct(timing.bestTimedBuy.pct)}`
		);
	}
	if (timing.bestTimedSell) {
		const t = timing.bestTimedSell.trade;
		// eslint-disable-next-line no-console
		console.log(
			`Best-timed sell: ${
				investorsById.get(t.investor_id)?.name || t.investor_id
			} in ${
				foundersById.get(t.pitch_id)?.name || t.pitch_id
			} avoided drop ${toPct(timing.bestTimedSell.pct)}`
		);
	}
	if (timing.moonshot) {
		// eslint-disable-next-line no-console
		console.log(
			`Moonshot: ${
				foundersById.get(timing.moonshot.founderId)?.name ||
				timing.moonshot.founderId
			} max gain ${toPct(timing.moonshot.pct)}`
		);
	}

	// eslint-disable-next-line no-console
	console.log("\n-- Holding Metrics --");
	if (holds.diamond) {
		// eslint-disable-next-line no-console
		console.log(
			`Diamond hands: ${
				investorsById.get(holds.diamond.investorId)?.name ||
				holds.diamond.investorId
			} held ${
				foundersById.get(holds.diamond.founderId)?.name ||
				holds.diamond.founderId
			} for ${durationToString(holds.diamond.durationMs)}`
		);
	}
	if (holds.diversified) {
		// eslint-disable-next-line no-console
		console.log(
			`Diversified investor: ${
				investorsById.get(holds.diversified.investorId)?.name ||
				holds.diversified.investorId
			} with holdings in ${holds.diversified.count} founders`
		);
	}
	if (holds.yolo) {
		// eslint-disable-next-line no-console
		console.log(
			`YOLO trader: ${
				investorsById.get(holds.yolo.investorId)?.name || holds.yolo.investorId
			} committed ${toPct(holds.yolo.pct)} in one trade`
		);
	}
	if (holds.bagHolder) {
		// eslint-disable-next-line no-console
		console.log(
			`Bag Holder: ${
				investorsById.get(holds.bagHolder.investorId)?.name ||
				holds.bagHolder.investorId
			} in ${
				foundersById.get(holds.bagHolder.founderId)?.name ||
				holds.bagHolder.founderId
			} saw drop ${toPct(holds.bagHolder.dropPct)}`
		);
	}

	// eslint-disable-next-line no-console
	console.log("\n-- Awards --");
	if (shark) {
		// eslint-disable-next-line no-console
		console.log(
			`🦈 Shark Award – biggest total profit: ${
				investorsById.get(shark.investorId)?.name || shark.investorId
			} $${fmt(shark.realized)}`
		);
	}
	if (holds.diamond) {
		// eslint-disable-next-line no-console
		console.log(
			`💎 Diamond Hands – longest hold: ${
				investorsById.get(holds.diamond.investorId)?.name ||
				holds.diamond.investorId
			} (${durationToString(holds.diamond.durationMs)})`
		);
	}
	if (timing.moonshot) {
		// eslint-disable-next-line no-console
		console.log(
			`🚀 Moonshot – highest price gain %: ${
				foundersById.get(timing.moonshot.founderId)?.name ||
				timing.moonshot.founderId
			} (${toPct(timing.moonshot.pct)})`
		);
	}
	if (timing.bestTimedSell) {
		const t = timing.bestTimedSell.trade;
		// eslint-disable-next-line no-console
		console.log(
			`📉 Paper Hands – biggest loss after selling early: ${
				investorsById.get(t.investor_id)?.name || t.investor_id
			} (${toPct(timing.bestTimedSell.pct)})`
		);
	}
	if (smartMoney) {
		// eslint-disable-next-line no-console
		console.log(
			`🧠 Smart Money – most consistent profits: ${
				investorsById.get(smartMoney.investorId)?.name || smartMoney.investorId
			} (win rate ${toPct(smartMoney.winRate)} over ${smartMoney.sells} sells)`
		);
	}
	if (sniper) {
		// eslint-disable-next-line no-console
		console.log(
			`🎯 Sniper – smallest trades count, biggest gains: ${
				investorsById.get(sniper.investorId)?.name || sniper.investorId
			} ($${fmt(sniper.realized)} over ${sniper.trades} trades)`
		);
	}
	if (liquidityProvider) {
		// eslint-disable-next-line no-console
		console.log(
			`🧃 Liquidity Provider – most trades executed: ${
				investorsById.get(liquidityProvider.investorId)?.name ||
				liquidityProvider.investorId
			} (${liquidityProvider.trades} trades)`
		);
	}
	if (holds.bagHolder) {
		// eslint-disable-next-line no-console
		console.log(
			`🫣 Bag Holder – held stock that tanked the most: ${
				investorsById.get(holds.bagHolder.investorId)?.name ||
				holds.bagHolder.investorId
			} (${
				foundersById.get(holds.bagHolder.founderId)?.name ||
				holds.bagHolder.founderId
			}, drop ${toPct(holds.bagHolder.dropPct)})`
		);
	}

	// eslint-disable-next-line no-console
	console.log("\n-- Founder Notes --");
	for (const [founderId, list] of notesByFounder.entries()) {
		// eslint-disable-next-line no-console
		console.log(`\n${foundersById.get(founderId)?.name || founderId}:`);
		for (const item of list) {
			// eslint-disable-next-line no-console
			console.log(`  ${item.ts.toISOString()}: ${item.note}`);
		}
	}

	// eslint-disable-next-line no-console
	console.log("\nDone.\n");
}

main().catch((e) => {
	// eslint-disable-next-line no-console
	console.error(e);
	process.exit(1);
});
