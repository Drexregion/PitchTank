/**
 * Supabase Integration Stress Test
 * - Creates a test event and founder
 * - Spawns many users, signs them in, and calls the executeTrade edge function concurrently
 * - Verifies AMM invariants directly from the DB (constant product, non-negative values)
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY  (for setup/teardown and user creation)
 *
 * Run:
 *   npm run test:integration
 */

import "dotenv/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID, createHmac } from "crypto";
import { Founder } from "../../src/types/Founder";

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
		"Missing env. Please set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
	);
	process.exit(1);
}

// Config
const NUM_USERS = Number(process.env.INTEGRATION_USERS || 50);
const NUM_TRADES = Number(process.env.INTEGRATION_TRADES || 100);
const BUY_PROBABILITY = Number(process.env.INTEGRATION_BUY_PROB || 0.6);
const INITIAL_SHARES_IN_POOL = Number(
	process.env.INITIAL_SHARES_IN_POOL || 100000
);
const INITIAL_CASH_IN_POOL = Number(
	process.env.INITIAL_CASH_IN_POOL || 1000000
);
const MIN_RESERVE_SHARES = Number(process.env.MIN_RESERVE_SHARES || 1000);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false },
});

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Minimal JWT HS256 implementation to mint access tokens for tests without extra deps
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
		createHmac("sha256", secret).update(data).digest()
	);
	return `${data}.${signature}`;
}

async function signInWithRetry(
	userClient: SupabaseClient,
	email: string,
	password: string,
	maxRetries = 6
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
		if (!isRateLimited && attempt >= 1) break; // don't endlessly retry non-rate-limit errors
		const backoffMs =
			Math.min(2000 * 2 ** attempt, 15000) + Math.floor(Math.random() * 200);
		await delay(backoffMs);
		attempt++;
	}
	throw new Error(
		`Sign-in failed${lastErr?.message ? `: ${lastErr.message}` : ""}`
	);
}

async function getAccessTokenForUser(
	email: string,
	password: string,
	userId: string
): Promise<string> {
	// If a JWT secret is provided, mint tokens locally to avoid auth rate limits
	if (SUPABASE_JWT_SECRET) {
		const nowSec = Math.floor(Date.now() / 1000);
		const payload = {
			// Standard claims
			sub: userId,
			role: "authenticated",
			aud: "authenticated",
			iat: nowSec,
			exp: nowSec + 60 * 30, // 30 minutes
			// Helpful user context
			email,
		};
		return signJwtHS256(payload, SUPABASE_JWT_SECRET);
	}

	// Fallback to password sign-in with exponential backoff
	const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	return await signInWithRetry(userClient, email, password);
}

async function createTestEventAndFounder(
	adminClient: SupabaseClient
): Promise<{ eventId: string; founderId: string; founder: Founder }> {
	const eventId = randomUUID();
	const founderId = randomUUID();

	// Create event
	{
		const { error } = await adminClient.from("events").insert({
			id: eventId,
			name: `Integration Test Event ${eventId.slice(0, 8)}`,
			description: "Auto-created by integration stress test",
			start_time: new Date(Date.now() - 60_000).toISOString(),
			end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			status: "active",
		});
		if (error) throw new Error(`Failed to create event: ${error.message}`);
	}

	// Create founder
	{
		const k = INITIAL_SHARES_IN_POOL * INITIAL_CASH_IN_POOL;
		const { error } = await adminClient.from("founders").insert({
			id: founderId,
			event_id: eventId,
			name: `Test Founder ${founderId.slice(0, 6)}`,
			bio: "Integration stress test founder",
			logo_url: null,
			pitch_summary: "",
			shares_in_pool: INITIAL_SHARES_IN_POOL,
			cash_in_pool: INITIAL_CASH_IN_POOL,
			k_constant: k,
			min_reserve_shares: MIN_RESERVE_SHARES,
		});
		if (error) throw new Error(`Failed to create founder: ${error.message}`);
	}

	// Return latest founder row
	const { data: founderRow, error: fErr } = await adminClient
		.from("founders")
		.select("*")
		.eq("id", founderId)
		.single();
	if (fErr || !founderRow)
		throw new Error(`Failed to fetch founder: ${fErr?.message}`);

	return { eventId, founderId, founder: founderRow as Founder };
}

async function ensureInvestor(
	adminClient: SupabaseClient,
	eventId: string,
	userId: string,
	investorName: string,
	investorEmail: string
): Promise<string> {
	// Upsert investor per user per event (satisfy NOT NULL constraints like name)
	const initialBalance = 1_000_000;
	const { data, error } = await adminClient
		.from("investors")
		.upsert(
			{
				id: randomUUID(),
				event_id: eventId,
				user_id: userId,
				name: investorName,
				email: investorEmail,
				initial_balance: initialBalance,
				current_balance: initialBalance,
			},
			{ onConflict: "event_id,user_id" }
		)
		.select("id")
		.single();
	if (error) throw new Error(`Failed to upsert investor: ${error.message}`);
	return data!.id as string;
}

async function cleanupTestArtifacts(
	adminClient: SupabaseClient,
	ctx: { eventId?: string; founderId?: string; users?: CreatedUser[] }
) {
	const { eventId, founderId, users } = ctx;

	// Best-effort cleanup; ignore individual failures
	try {
		if (eventId) {
			// Delete dependent rows that might block event/founder deletion
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
			// Delete auth users (limit concurrency a bit)
			const concurrency = 10;
			for (let i = 0; i < users.length; i += concurrency) {
				const batch = users.slice(i, i + concurrency);
				await Promise.allSettled(
					batch.map((u) => admin.auth.admin.deleteUser(u.userId))
				);
			}
		}
	} catch {
		// swallow all cleanup errors
	}
}

async function createAndLoginUsers(count: number): Promise<CreatedUser[]> {
	const users: CreatedUser[] = [];
	for (let i = 0; i < count; i++) {
		const email = `int-test-user-${Date.now()}-${i}@example.com`;
		const password = `P@ssw0rd-${randomUUID().slice(0, 8)}`;

		// Create user (email confirmed)
		const { data: created, error: cErr } = await admin.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
		});
		if (cErr || !created.user)
			throw new Error(`Create user failed: ${cErr?.message}`);

		// Get access token (JWT if secret provided, otherwise sign-in with backoff)
		const accessToken = await getAccessTokenForUser(
			email,
			password,
			created.user.id
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

function calculatePriceFromPools(shares: number, cash: number): number {
	if (shares <= 0) return Number.POSITIVE_INFINITY;
	return Math.min(cash / shares, 100);
}

async function run() {
	console.log("\n=================================================");
	console.log("🌐 Supabase Integration Stress Test");
	console.log("=================================================\n");

	console.log(`Config: users=${NUM_USERS}, trades=${NUM_TRADES}`);

	// Track created resources for cleanup
	let createdEventId: string | undefined;
	let createdFounderId: string | undefined;
	let createdUsers: CreatedUser[] = [];

	try {
		// Setup test event/founder
		const { eventId, founderId } = await createTestEventAndFounder(admin);
		createdEventId = eventId;
		createdFounderId = founderId;
		console.log(`Created event=${eventId}, founder=${founderId}`);

		// Create users and get tokens
		console.log("Creating and logging in users...");
		createdUsers = await createAndLoginUsers(NUM_USERS);
		console.log(`Users ready: ${createdUsers.length}`);

		// Ensure each has an investor row
		console.log("Ensuring investor rows...");
		const investorIds: Record<string, string> = {};
		for (const u of createdUsers) {
			const displayName = u.email.split("@")[0] || "Integration User";
			investorIds[u.userId] = await ensureInvestor(
				admin,
				eventId,
				u.userId,
				displayName,
				u.email
			);
		}

		// Prepare trades
		interface TradeJob {
			user: CreatedUser;
			type: TradeType;
			shares: number;
		}

		const trades: TradeJob[] = [];
		for (let i = 0; i < NUM_TRADES; i++) {
			const user = createdUsers[i % createdUsers.length];
			const type: TradeType = Math.random() < BUY_PROBABILITY ? "buy" : "sell";
			const shares =
				type === "buy"
					? Math.floor(Math.random() * 990) + 10
					: Math.floor(Math.random() * 490) + 10;
			trades.push({ user, type, shares });
		}

		console.log(`Dispatching ${trades.length} trades to Edge Function...`);
		const startedAt = Date.now();

		type TradeResult =
			| { ok: true; data: any }
			| {
					ok: false;
					status: number;
					error: any;
					type: TradeType;
					shares: number;
			  };

		const results = await Promise.allSettled(
			trades.map(async (t): Promise<TradeResult> => {
				// small jitter to increase contention
				await delay(Math.floor(Math.random() * 10));
				const investorId = investorIds[t.user.userId];
				const res = await fetch(`${SUPABASE_URL}/functions/v1/executeTrade`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${t.user.accessToken}`,
					},
					body: JSON.stringify({
						investor_id: investorId,
						founder_id: createdFounderId,
						shares: t.shares,
						type: t.type,
						event_id: createdEventId,
					}),
				});
				const json: any = await res.json().catch(() => ({}));
				if (!res.ok) {
					return {
						ok: false,
						status: res.status,
						error: json.error || json.message,
						type: t.type,
						shares: t.shares,
					};
				}
				return { ok: true, data: json };
			})
		);

		const durationMs = Date.now() - startedAt;
		const fulfilled = results.filter(
			(r) => r.status === "fulfilled"
		) as PromiseFulfilledResult<TradeResult>[];
		const successes = fulfilled.filter((r) => r.value.ok).length;
		const failed = fulfilled
			.filter((r) => !r.value.ok)
			.map((r) => r.value as Exclude<TradeResult, { ok: true }>);
		const failures = results.length - successes;
		console.log(
			`\nCompleted in ${durationMs}ms  (avg ${(
				durationMs / results.length
			).toFixed(2)}ms/trade)`
		);
		console.log(`Success: ${successes}, Failures: ${failures}`);

		if (failed.length > 0) {
			// Aggregate reasons
			const bucket = new Map<string, number>();
			for (const f of failed) {
				const key = `${f.status}:${String(f.error || "unknown")}`;
				bucket.set(key, (bucket.get(key) || 0) + 1);
			}
			console.log("\nFailure breakdown:");
			for (const [k, count] of bucket.entries()) {
				console.log(`  ${count} × ${k}`);
			}

			// Show a few examples
			console.log("\nSample failures:");
			failed.slice(0, 5).forEach((f, i) => {
				console.log(
					`  #${i + 1} status=${f.status} type=${f.type} shares=${
						f.shares
					} error=${String(f.error || "unknown")}`
				);
			});
		}

		// Fetch final founder state
		const { data: founder, error: fErr } = await admin
			.from("founders")
			.select("*")
			.eq("id", createdFounderId!)
			.single();
		if (fErr || !founder)
			throw new Error(`Failed to fetch final founder: ${fErr?.message}`);

		const x = Number(founder.shares_in_pool);
		const y = Number(founder.cash_in_pool);
		const k = Number(founder.k_constant);
		const price = calculatePriceFromPools(x, y);

		console.log("\nFinal Founder State:");
		console.log(`  shares_in_pool: ${x.toLocaleString()}`);
		console.log(
			`  cash_in_pool:   $${y.toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			})}`
		);
		console.log(`  price:          $${price.toFixed(2)}`);

		// Invariant checks
		const tolerance = 0.01 * k; // 1% tolerance for any numeric drift
		const actualK = x * y;
		const kOk = Math.abs(actualK - k) <= tolerance;
		const nonNegative = x > 0 && y > 0;

		console.log("\nChecks:");
		console.log(
			`${kOk ? "✅" : "❌"} Constant product maintained within tolerance`
		);
		console.log(`${nonNegative ? "✅" : "❌"} No negative pool values`);

		if (!kOk || !nonNegative) {
			throw new Error(
				"AMM invariant(s) failed under concurrent load. Possible race condition in executeTrade."
			);
		}

		console.log("\n🎉 Integration stress test passed.");
	} finally {
		await cleanupTestArtifacts(admin, {
			eventId: createdEventId,
			founderId: createdFounderId,
			users: createdUsers,
		});
	}
}

run().catch((err) => {
	console.error("\n❌ Integration stress test failed:", err?.message || err);
	process.exit(1);
});
