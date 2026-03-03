/**
 * Supabase Simple Mode Integration Test
 *
 * Simulates the simple-mode flow where:
 * - BUY: User commits a dollar amount → client converts to max purchasable shares → API receives shares
 * - SELL: User specifies shares to sell → API receives shares
 *
 * Runs trades SEQUENTIALLY (so we can predict outcomes and verify correctness).
 * Verifies that each investor has the correct balance and shares at the end.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   npm run test:integration:simple
 */

import "dotenv/config";
import pkg from "@supabase/supabase-js";
const { createClient } = pkg;
type SupabaseClient = import("@supabase/supabase-js").SupabaseClient;
import { randomUUID, createHmac } from "crypto";
// Inline AMM logic to avoid ESM/ts-node resolution issues with "type": "module"
interface FounderLike {
	shares_in_pool: number;
	cash_in_pool: number;
	k_constant: number;
	min_reserve_shares?: number;
}

function simulateBuyTrade(
	founder: FounderLike,
	shares: number
): { cost: number; resultingPrice: number; error?: string } {
	const x = Number(founder.shares_in_pool);
	const y = Number(founder.cash_in_pool);
	const k = Number(founder.k_constant);
	const minReserve = Number(founder.min_reserve_shares || 1000);
	const newX = x - shares;
	if (newX <= minReserve) {
		return {
			cost: 0,
			resultingPrice: 0,
			error: `Cannot buy ${shares} shares: would deplete pool below minimum reserve of ${minReserve}`,
		};
	}
	const newY = k / newX;
	const cost = newY - y;
	const resultingPrice = Math.min(newY / newX, 100);
	return { cost, resultingPrice };
}

function simulateSellTrade(
	founder: FounderLike,
	shares: number
): { payout: number; resultingPrice: number; error?: string } {
	const x = Number(founder.shares_in_pool);
	const y = Number(founder.cash_in_pool);
	const k = Number(founder.k_constant);
	const newX = x + shares;
	const newY = k / newX;
	const payout = y - newY;
	const resultingPrice = Math.min(newY / newX, 100);
	return { payout, resultingPrice };
}

type TradeType = "buy" | "sell";

interface CreatedUser {
	email: string;
	password: string;
	accessToken: string;
	userId: string;
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
	process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY =
	process.env.SUPABASE_SERVICE_ROLE_KEY ||
	process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_JWT_SECRET =
	process.env.SUPABASE_JWT_SECRET || process.env.VITE_SUPABASE_JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error(
		"Missing env. Please set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
	);
	process.exit(1);
}

// Config
const NUM_USERS = Number(process.env.INTEGRATION_SIMPLE_USERS || 10);
const NUM_TRADES = Number(process.env.INTEGRATION_SIMPLE_TRADES || 30);
const BUY_PROBABILITY = Number(process.env.INTEGRATION_BUY_PROB || 0.6);
const INITIAL_SHARES_IN_POOL = Number(
	process.env.INITIAL_SHARES_IN_POOL || 100000,
);
const INITIAL_CASH_IN_POOL = Number(
	process.env.INITIAL_CASH_IN_POOL || 1000000,
);
const MIN_RESERVE_SHARES = Number(process.env.MIN_RESERVE_SHARES || 1000);
const INITIAL_BALANCE = 1_000_000;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false },
});

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64UrlEncode(input: Buffer | string): string {
	const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
	return buf
		.toString("base64")
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
}

function signJwtHS256(payload: Record<string, any>, secret: string): string {
	const header = { alg: "HS256", typ: "JWT" };
	const encodedHeader = base64UrlEncode(JSON.stringify(header));
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const data = `${encodedHeader}.${encodedPayload}`;
	const signature = base64UrlEncode(
		createHmac("sha256", secret).update(data).digest(),
	);
	return `${data}.${signature}`;
}

async function signInWithRetry(
	userClient: SupabaseClient,
	email: string,
	password: string,
	maxRetries = 6,
): Promise<string> {
	let attempt = 0;
	let lastErr: any;
	while (attempt <= maxRetries) {
		const { data: sessionData, error } =
			await userClient.auth.signInWithPassword({ email, password });
		if (!error && sessionData?.session?.access_token) {
			return sessionData.session.access_token;
		}
		lastErr = error;
		const message = (error?.message || "").toLowerCase();
		const isRateLimited = message.includes("rate limit");
		if (!isRateLimited && attempt >= 1) break;
		const backoffMs =
			Math.min(2000 * 2 ** attempt, 15000) + Math.floor(Math.random() * 200);
		await delay(backoffMs);
		attempt++;
	}
	throw new Error(
		`Sign-in failed${lastErr?.message ? `: ${lastErr.message}` : ""}`,
	);
}

async function getAccessTokenForUser(
	email: string,
	password: string,
	userId: string,
): Promise<string> {
	if (SUPABASE_JWT_SECRET) {
		const nowSec = Math.floor(Date.now() / 1000);
		const payload = {
			sub: userId,
			role: "authenticated",
			aud: "authenticated",
			iat: nowSec,
			exp: nowSec + 60 * 30,
			email,
		};
		return signJwtHS256(payload, SUPABASE_JWT_SECRET);
	}
	const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	return await signInWithRetry(userClient, email, password);
}

async function createTestEventAndFounder(
	adminClient: SupabaseClient,
): Promise<{ eventId: string; founderId: string; founder: FounderLike }> {
	const eventId = randomUUID();
	const founderId = randomUUID();

	{
		const { error } = await adminClient.from("events").insert({
			id: eventId,
			name: `Simple Mode Test Event ${eventId.slice(0, 8)}`,
			description: "Auto-created by simple mode integration test",
			start_time: new Date(Date.now() - 60_000).toISOString(),
			end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			status: "active",
		});
		if (error) throw new Error(`Failed to create event: ${error.message}`);
	}

	{
		const k = INITIAL_SHARES_IN_POOL * INITIAL_CASH_IN_POOL;
		const { error } = await adminClient.from("founders").insert({
			id: founderId,
			event_id: eventId,
			name: `Test Founder ${founderId.slice(0, 6)}`,
			bio: "Simple mode integration test founder",
			logo_url: null,
			pitch_summary: "",
			shares_in_pool: INITIAL_SHARES_IN_POOL,
			cash_in_pool: INITIAL_CASH_IN_POOL,
			k_constant: k,
			min_reserve_shares: MIN_RESERVE_SHARES,
		});
		if (error) throw new Error(`Failed to create founder: ${error.message}`);
	}

	const { data: founderRow, error: fErr } = await adminClient
		.from("founders")
		.select("*")
		.eq("id", founderId)
		.single();
	if (fErr || !founderRow)
		throw new Error(`Failed to fetch founder: ${fErr?.message}`);

	return { eventId, founderId, founder: founderRow as FounderLike };
}

async function ensureInvestor(
	adminClient: SupabaseClient,
	eventId: string,
	userId: string,
	investorName: string,
	investorEmail: string,
): Promise<string> {
	const { data, error } = await adminClient
		.from("investors")
		.upsert(
			{
				id: randomUUID(),
				event_id: eventId,
				user_id: userId,
				name: investorName,
				email: investorEmail,
				initial_balance: INITIAL_BALANCE,
				current_balance: INITIAL_BALANCE,
			},
			{ onConflict: "event_id,user_id" },
		)
		.select("id")
		.single();
	if (error) throw new Error(`Failed to upsert investor: ${error.message}`);
	return data!.id as string;
}

async function cleanupTestArtifacts(
	adminClient: SupabaseClient,
	ctx: { eventId?: string; founderId?: string; users?: CreatedUser[] },
) {
	const { eventId, founderId, users } = ctx;
	try {
		if (eventId) {
			try {
				await adminClient.from("trades").delete().eq("event_id", eventId);
			} catch {}
			try {
				await adminClient.from("investors").delete().eq("event_id", eventId);
			} catch {}
		}
		if (founderId) {
			try {
				await adminClient
					.from("investor_holdings")
					.delete()
					.eq("founder_id", founderId);
			} catch {}
			try {
				await adminClient
					.from("price_history")
					.delete()
					.eq("founder_id", founderId);
			} catch {}
			try {
				await adminClient.from("founders").delete().eq("id", founderId);
			} catch {}
		}
		if (eventId) {
			try {
				await adminClient.from("events").delete().eq("id", eventId);
			} catch {}
		}
		if (users && users.length > 0) {
			const concurrency = 10;
			for (let i = 0; i < users.length; i += concurrency) {
				const batch = users.slice(i, i + concurrency);
				await Promise.allSettled(
					batch.map((u) => admin.auth.admin.deleteUser(u.userId)),
				);
			}
		}
	} catch {
		// swallow cleanup errors
	}
}

async function createAndLoginUsers(count: number): Promise<CreatedUser[]> {
	const users: CreatedUser[] = [];
	for (let i = 0; i < count; i++) {
		const email = `simple-test-${Date.now()}-${i}@example.com`;
		const password = `P@ssw0rd-${randomUUID().slice(0, 8)}`;

		const { data: created, error: cErr } = await admin.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
		});
		if (cErr || !created.user)
			throw new Error(`Create user failed: ${cErr?.message}`);

		const accessToken = await getAccessTokenForUser(
			email,
			password,
			created.user.id,
		);

		users.push({
			email,
			password,
			accessToken,
			userId: created.user.id,
		});
	}
	return users;
}

/**
 * Simple-mode buy: compute max shares purchasable with a dollar commitment.
 * Mirrors TradeModal.computeSharesFromCommit.
 */
function computeSharesFromCommit(
	founder: FounderLike,
	amount: number,
): { shares: number; actualCost: number; remainder: number } {
	let low = 0,
		high = 50000,
		maxShares = 0,
		actualCost = 0;
	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		if (mid === 0) {
			low = mid + 1;
			continue;
		}
		const { cost, error: simError } = simulateBuyTrade(founder, mid);
		if (!simError && cost <= amount) {
			maxShares = mid;
			actualCost = cost;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	return { shares: maxShares, actualCost, remainder: amount - actualCost };
}

async function run() {
	console.log("\n=================================================");
	console.log("📊 Supabase Simple Mode Integration Test");
	console.log("=================================================\n");

	console.log(
		`Config: users=${NUM_USERS}, trades=${NUM_TRADES} (sequential, simple-mode: buy=commit $, sell=shares)`,
	);

	let createdEventId: string | undefined;
	let createdFounderId: string | undefined;
	let createdUsers: CreatedUser[] = [];

	try {
		const { eventId, founderId, founder } =
			await createTestEventAndFounder(admin);
		createdEventId = eventId;
		createdFounderId = founderId;
		console.log(`Created event=${eventId}, founder=${founderId}`);

		console.log("Creating and logging in users...");
		createdUsers = await createAndLoginUsers(NUM_USERS);
		console.log(`Users ready: ${createdUsers.length}`);

		console.log("Ensuring investor rows...");
		const investorIds: Record<string, string> = {};
		for (const u of createdUsers) {
			const displayName = u.email.split("@")[0] || "User";
			investorIds[u.userId] = await ensureInvestor(
				admin,
				eventId,
				u.userId,
				displayName,
				u.email,
			);
		}

		// Track expected state per investor (keyed by investor_id)
		const expectedBalance: Record<string, number> = {};
		const expectedShares: Record<string, number> = {};
		for (const invId of Object.values(investorIds)) {
			expectedBalance[invId] = INITIAL_BALANCE;
			expectedShares[invId] = 0;
		}

		// Local founder state for computing next trade
		let localFounder: FounderLike = { ...founder };

		// Execute trades sequentially: build and execute in same loop so we know current state
		let executedCount = 0;
		let attempts = 0;
		const maxAttempts = NUM_TRADES * 3; // avoid infinite loop if many sells with no shares

		console.log(
			`Executing up to ${NUM_TRADES} trades sequentially (simple-mode)...`,
		);
		const startedAt = Date.now();

		while (executedCount < NUM_TRADES && attempts < maxAttempts) {
			attempts++;
			const user =
				createdUsers[Math.floor(Math.random() * createdUsers.length)];
			const investorId = investorIds[user.userId];
			const type: TradeType = Math.random() < BUY_PROBABILITY ? "buy" : "sell";

			let sharesToTrade: number;
			let tradeType: TradeType;
			let actualCost = 0;
			let payout = 0;

			if (type === "buy") {
				// Simple mode: dollar commitment (e.g. $50–$500)
				const commitAmount = Math.floor(Math.random() * 450) + 50;
				const bal = expectedBalance[investorId] ?? 0;
				if (commitAmount <= 0 || commitAmount > bal) continue;

				const result = computeSharesFromCommit(localFounder, commitAmount);
				if (result.shares <= 0) continue;

				sharesToTrade = result.shares;
				actualCost = result.actualCost;
				tradeType = "buy";
			} else {
				// Sell: shares (only if user has shares)
				const currentShares = expectedShares[investorId] || 0;
				if (currentShares <= 0) continue;

				sharesToTrade = Math.min(
					Math.floor(Math.random() * currentShares) + 1,
					currentShares,
				);
				tradeType = "sell";
				const sellResult = simulateSellTrade(localFounder, sharesToTrade);
				if (sellResult.error) continue;
				payout = sellResult.payout;
			}

			const res = await fetch(`${SUPABASE_URL}/functions/v1/executeTrade`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${user.accessToken}`,
				},
				body: JSON.stringify({
					investor_id: investorId,
					founder_id: founderId,
					shares: sharesToTrade,
					type: tradeType,
					event_id: eventId,
					note: `Simple mode test trade ${executedCount + 1}`,
				}),
			});

			const json: any = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(
					`Trade ${executedCount + 1} failed: ${res.status} ${JSON.stringify(json)}`,
				);
			}

			// Update expected state only after successful execution
			if (tradeType === "buy") {
				expectedBalance[investorId] -= actualCost;
				expectedShares[investorId] =
					(expectedShares[investorId] ?? 0) + sharesToTrade;
				const newX = Number(localFounder.shares_in_pool) - sharesToTrade;
				const k = Number(localFounder.k_constant);
				localFounder = {
					...localFounder,
					shares_in_pool: newX,
					cash_in_pool: k / newX,
				};
			} else {
				expectedBalance[investorId] =
					(expectedBalance[investorId] ?? 0) + payout;
				expectedShares[investorId] =
					(expectedShares[investorId] ?? 0) - sharesToTrade;
				const newX = Number(localFounder.shares_in_pool) + sharesToTrade;
				const k = Number(localFounder.k_constant);
				localFounder = {
					...localFounder,
					shares_in_pool: newX,
					cash_in_pool: k / newX,
				};
			}

			executedCount++;
			await delay(5); // small delay between sequential trades
		}

		console.log(`Executed ${executedCount} trades (${attempts} attempts)`);

		const durationMs = Date.now() - startedAt;
		console.log(`Completed in ${durationMs}ms`);

		// Fetch actual state from DB
		const { data: investors, error: invErr } = await admin
			.from("investors")
			.select("id, current_balance")
			.eq("event_id", eventId);

		if (invErr) throw new Error(`Failed to fetch investors: ${invErr.message}`);

		const { data: holdings, error: hErr } = await admin
			.from("investor_holdings")
			.select("investor_id, shares")
			.eq("founder_id", founderId);

		if (hErr) throw new Error(`Failed to fetch holdings: ${hErr.message}`);

		const actualBalance: Record<string, number> = {};
		const actualShares: Record<string, number> = {};
		for (const inv of investors || []) {
			actualBalance[inv.id] = Number(inv.current_balance);
		}
		for (const h of holdings || []) {
			actualShares[h.investor_id] = Number(h.shares);
		}

		// Verify each investor
		let allOk = true;
		const investorIdList = Object.keys(expectedBalance);
		for (const invId of investorIdList) {
			const expBal = expectedBalance[invId];
			const expSh = expectedShares[invId] ?? 0;
			const actBal = actualBalance[invId] ?? 0;
			const actSh = actualShares[invId] ?? 0;

			const balOk = Math.abs(expBal - actBal) < 0.02; // allow 2 cent rounding
			const shOk = expSh === actSh;

			if (!balOk || !shOk) {
				allOk = false;
				console.error(
					`  ❌ Investor ${invId.slice(0, 8)}: expected balance=$${expBal.toFixed(2)} shares=${expSh}, got balance=$${actBal.toFixed(2)} shares=${actSh}`,
				);
			}
		}

		if (allOk) {
			console.log(
				`\n✅ All ${investorIdList.length} investors have correct balance and shares.`,
			);
		} else {
			throw new Error(
				"Simple mode verification failed: one or more investors have incorrect balance or shares.",
			);
		}

		// Also verify AMM invariant on final founder state
		const { data: finalFounder, error: fErr } = await admin
			.from("founders")
			.select("*")
			.eq("id", founderId)
			.single();
		if (fErr || !finalFounder)
			throw new Error(`Failed to fetch final founder: ${fErr?.message}`);

		const x = Number(finalFounder.shares_in_pool);
		const y = Number(finalFounder.cash_in_pool);
		const k = Number(finalFounder.k_constant);
		const tolerance = 0.01 * k;
		const kOk = Math.abs(x * y - k) <= tolerance;
		const nonNegative = x > 0 && y > 0;

		console.log(`  AMM constant product: ${kOk ? "✅" : "❌"}`);
		console.log(`  Non-negative pools: ${nonNegative ? "✅" : "❌"}`);

		if (!kOk || !nonNegative) {
			throw new Error("AMM invariant failed.");
		}

		console.log("\n🎉 Simple mode integration test passed.");
	} finally {
		await cleanupTestArtifacts(admin, {
			eventId: createdEventId,
			founderId: createdFounderId,
			users: createdUsers,
		});
	}
}

run().catch((err) => {
	console.error(
		"\n❌ Simple mode integration test failed:",
		err?.message || err,
	);
	process.exit(1);
});
