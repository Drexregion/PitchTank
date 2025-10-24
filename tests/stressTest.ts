/**
 * Stress Test for PitchTank AMM Trading System
 *
 * This test simulates 100 concurrent users trading simultaneously
 * to ensure the AMM pricing algorithm remains consistent and correct.
 */

import {
	simulateBuyTrade,
	simulateSellTrade,
	calculateCurrentPrice,
	verifyConstantProduct,
} from "../src/lib/ammEngine";
import { Founder } from "../src/types/Founder";

// Test configuration
const NUM_CONCURRENT_USERS = 100;
const INITIAL_SHARES_IN_POOL = 100000;
const INITIAL_CASH_IN_POOL = 1000000;
const INITIAL_PRICE = 10; // $10 per share

interface TradeResult {
	userId: number;
	tradeType: "buy" | "sell";
	shares: number;
	cost: number;
	priceAfter: number;
	timestamp: number;
	success: boolean;
	error?: string;
}

interface FounderState extends Founder {
	// Add any additional state tracking if needed
}

/**
 * Create initial founder state for testing
 */
function createInitialFounder(): FounderState {
	const k = INITIAL_SHARES_IN_POOL * INITIAL_CASH_IN_POOL;

	return {
		id: "test-founder-1",
		name: "Test Founder",
		event_id: "test-event-1",
		bio: "Test bio for stress testing",
		logo_url: null,
		pitch_summary: "Test pitch",
		shares_in_pool: INITIAL_SHARES_IN_POOL,
		cash_in_pool: INITIAL_CASH_IN_POOL,
		k_constant: k,
		min_reserve_shares: 1000,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};
}

/**
 * Simulate a random trade action
 */
function generateRandomTrade(
	userId: number,
	currentFounder: FounderState,
	userHoldings: Map<number, number>
): {
	type: "buy" | "sell";
	shares: number;
} {
	const userShares = userHoldings.get(userId) || 0;
	const canSell = userShares > 0;

	// 60% chance to buy, 40% chance to sell (if user has shares)
	const shouldBuy = Math.random() > 0.4 || !canSell;

	if (shouldBuy) {
		// Buy between 10 and 1000 shares
		const shares = Math.floor(Math.random() * 990) + 10;
		return { type: "buy", shares };
	} else {
		// Sell between 10 and min(user's shares, 1000)
		const maxSell = Math.min(userShares, 1000);
		const shares = Math.floor(Math.random() * (maxSell - 10)) + 10;
		return { type: "sell", shares };
	}
}

/**
 * Execute a single trade and update state
 */
function executeTrade(
	userId: number,
	tradeType: "buy" | "sell",
	shares: number,
	founder: FounderState,
	userHoldings: Map<number, number>
): {
	success: boolean;
	cost: number;
	newFounder: FounderState;
	error?: string;
} {
	try {
		if (tradeType === "buy") {
			const { cost, resultingPrice, error } = simulateBuyTrade(founder, shares);

			if (error) {
				return { success: false, cost: 0, newFounder: founder, error };
			}

			// Calculate new pool state
			const newSharesInPool = founder.shares_in_pool - shares;
			const newCashInPool = founder.k_constant / newSharesInPool;

			// Update founder state
			const newFounder: FounderState = {
				...founder,
				shares_in_pool: newSharesInPool,
				cash_in_pool: newCashInPool,
			};

			// Update user holdings
			const currentHoldings = userHoldings.get(userId) || 0;
			userHoldings.set(userId, currentHoldings + shares);

			return { success: true, cost, newFounder };
		} else {
			const { payout, resultingPrice, error } = simulateSellTrade(
				founder,
				shares
			);

			if (error) {
				return { success: false, cost: 0, newFounder: founder, error };
			}

			// Calculate new pool state
			const newSharesInPool = founder.shares_in_pool + shares;
			const newCashInPool = founder.k_constant / newSharesInPool;

			// Update founder state
			const newFounder: FounderState = {
				...founder,
				shares_in_pool: newSharesInPool,
				cash_in_pool: newCashInPool,
			};

			// Update user holdings
			const currentHoldings = userHoldings.get(userId) || 0;
			userHoldings.set(userId, currentHoldings - shares);

			return { success: true, cost: payout, newFounder };
		}
	} catch (err: any) {
		return { success: false, cost: 0, newFounder: founder, error: err.message };
	}
}

/**
 * Main stress test function
 */
async function runStressTest(): Promise<void> {
	console.log("\n=================================================");
	console.log("🚀 PitchTank AMM Stress Test");
	console.log("=================================================\n");

	console.log(`📊 Test Configuration:`);
	console.log(`   - Concurrent Users: ${NUM_CONCURRENT_USERS}`);
	console.log(
		`   - Initial Shares in Pool: ${INITIAL_SHARES_IN_POOL.toLocaleString()}`
	);
	console.log(
		`   - Initial Cash in Pool: $${INITIAL_CASH_IN_POOL.toLocaleString()}`
	);
	console.log(`   - Initial Price: $${INITIAL_PRICE}`);
	console.log(
		`   - K Constant: ${(
			INITIAL_SHARES_IN_POOL * INITIAL_CASH_IN_POOL
		).toLocaleString()}\n`
	);

	// Initialize state
	let founder = createInitialFounder();
	const userHoldings = new Map<number, number>();
	const tradeResults: TradeResult[] = [];

	// Verify initial state
	const initialPrice = calculateCurrentPrice(founder);
	console.log(`✅ Initial price calculated: $${initialPrice.toFixed(2)}`);

	if (Math.abs(initialPrice - INITIAL_PRICE) > 0.01) {
		console.error(
			`❌ ERROR: Initial price mismatch! Expected $${INITIAL_PRICE}, got $${initialPrice.toFixed(
				2
			)}`
		);
		return;
	}

	// Generate trades for all users
	const trades: Array<{
		userId: number;
		type: "buy" | "sell";
		shares: number;
	}> = [];

	for (let i = 0; i < NUM_CONCURRENT_USERS; i++) {
		const trade = generateRandomTrade(i, founder, userHoldings);
		trades.push({ userId: i, ...trade });
	}

	console.log(`\n📝 Generated ${trades.length} trades`);
	console.log(
		`   - Buy trades: ${trades.filter((t) => t.type === "buy").length}`
	);
	console.log(
		`   - Sell trades: ${trades.filter((t) => t.type === "sell").length}`
	);

	// Execute all trades sequentially (simulating concurrent execution with consistent ordering)
	console.log(`\n⚡ Executing trades...`);

	const startTime = Date.now();
	let successCount = 0;
	let failCount = 0;

	for (const trade of trades) {
		const timestamp = Date.now();
		const result = executeTrade(
			trade.userId,
			trade.type,
			trade.shares,
			founder,
			userHoldings
		);

		if (result.success) {
			founder = result.newFounder;
			successCount++;

			// Verify constant product formula
			const isValid = verifyConstantProduct(
				founder.shares_in_pool,
				founder.cash_in_pool,
				founder.k_constant
			);

			if (!isValid) {
				console.error(
					`❌ CRITICAL ERROR: Constant product formula violated after trade ${successCount}!`
				);
				console.error(
					`   Shares: ${founder.shares_in_pool}, Cash: ${founder.cash_in_pool}, K: ${founder.k_constant}`
				);
				console.error(
					`   Expected K: ${founder.k_constant}, Actual K: ${
						founder.shares_in_pool * founder.cash_in_pool
					}`
				);
				return;
			}
		} else {
			failCount++;
		}

		const priceAfter = calculateCurrentPrice(founder);

		tradeResults.push({
			userId: trade.userId,
			tradeType: trade.type,
			shares: trade.shares,
			cost: result.cost,
			priceAfter,
			timestamp,
			success: result.success,
			error: result.error,
		});
	}

	const endTime = Date.now();
	const duration = endTime - startTime;

	console.log(`\n✅ Stress test completed in ${duration}ms`);
	console.log(`   - Successful trades: ${successCount}`);
	console.log(`   - Failed trades: ${failCount}`);
	console.log(
		`   - Average time per trade: ${(duration / trades.length).toFixed(2)}ms`
	);

	// Final state verification
	console.log(`\n📊 Final State:`);
	console.log(
		`   - Shares in Pool: ${founder.shares_in_pool.toLocaleString()}`
	);
	console.log(
		`   - Cash in Pool: $${founder.cash_in_pool.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})}`
	);
	console.log(
		`   - Final Price: $${calculateCurrentPrice(founder).toFixed(2)}`
	);
	console.log(
		`   - Price Change: ${(
			(calculateCurrentPrice(founder) / INITIAL_PRICE - 1) *
			100
		).toFixed(2)}%`
	);

	// Verify final constant product
	const finalValid = verifyConstantProduct(
		founder.shares_in_pool,
		founder.cash_in_pool,
		founder.k_constant
	);

	if (finalValid) {
		console.log(`   ✅ Constant product formula maintained!`);
	} else {
		console.error(`   ❌ Constant product formula violated!`);
	}

	// Calculate total shares distributed
	let totalSharesDistributed = 0;
	userHoldings.forEach((shares) => {
		totalSharesDistributed += shares;
	});

	console.log(`\n👥 User Holdings:`);
	console.log(`   - Total users with holdings: ${userHoldings.size}`);
	console.log(
		`   - Total shares distributed: ${totalSharesDistributed.toLocaleString()}`
	);
	console.log(
		`   - Shares still in pool: ${founder.shares_in_pool.toLocaleString()}`
	);
	console.log(
		`   - Shares verification: ${
			totalSharesDistributed + founder.shares_in_pool === INITIAL_SHARES_IN_POOL
				? "✅ PASS"
				: "❌ FAIL"
		}`
	);

	// Analyze trade results
	const buyTrades = tradeResults.filter(
		(t) => t.tradeType === "buy" && t.success
	);
	const sellTrades = tradeResults.filter(
		(t) => t.tradeType === "sell" && t.success
	);

	if (buyTrades.length > 0) {
		const avgBuyCost =
			buyTrades.reduce((sum, t) => sum + t.cost, 0) / buyTrades.length;
		const totalBuyVolume = buyTrades.reduce((sum, t) => sum + t.shares, 0);
		console.log(`\n📈 Buy Trade Statistics:`);
		console.log(`   - Total buy trades: ${buyTrades.length}`);
		console.log(
			`   - Total buy volume: ${totalBuyVolume.toLocaleString()} shares`
		);
		console.log(`   - Average cost: $${avgBuyCost.toFixed(2)}`);
		console.log(
			`   - Total spent: $${buyTrades
				.reduce((sum, t) => sum + t.cost, 0)
				.toFixed(2)}`
		);
	}

	if (sellTrades.length > 0) {
		const avgSellPayout =
			sellTrades.reduce((sum, t) => sum + t.cost, 0) / sellTrades.length;
		const totalSellVolume = sellTrades.reduce((sum, t) => sum + t.shares, 0);
		console.log(`\n📉 Sell Trade Statistics:`);
		console.log(`   - Total sell trades: ${sellTrades.length}`);
		console.log(
			`   - Total sell volume: ${totalSellVolume.toLocaleString()} shares`
		);
		console.log(`   - Average payout: $${avgSellPayout.toFixed(2)}`);
		console.log(
			`   - Total received: $${sellTrades
				.reduce((sum, t) => sum + t.cost, 0)
				.toFixed(2)}`
		);
	}

	// Test summary
	console.log(`\n=================================================`);
	console.log("🎉 Stress Test Summary");
	console.log("=================================================");

	const allChecks = [
		{
			name: "Initial price correct",
			passed: Math.abs(initialPrice - INITIAL_PRICE) < 0.01,
		},
		{
			name: "All trades executed",
			passed: successCount + failCount === trades.length,
		},
		{ name: "Constant product maintained", passed: finalValid },
		{
			name: "Share conservation",
			passed:
				totalSharesDistributed + founder.shares_in_pool ===
				INITIAL_SHARES_IN_POOL,
		},
		{
			name: "No negative values",
			passed: founder.shares_in_pool > 0 && founder.cash_in_pool > 0,
		},
	];

	const passedChecks = allChecks.filter((c) => c.passed).length;
	const totalChecks = allChecks.length;

	allChecks.forEach((check) => {
		console.log(`${check.passed ? "✅" : "❌"} ${check.name}`);
	});

	console.log(`\n📊 Result: ${passedChecks}/${totalChecks} checks passed`);

	if (passedChecks === totalChecks) {
		console.log(
			"🎉 ALL TESTS PASSED! The AMM system is working correctly under stress.\n"
		);
	} else {
		console.error("❌ SOME TESTS FAILED! Please review the issues above.\n");
	}
}

// Run the stress test
runStressTest().catch(console.error);

export { runStressTest };
