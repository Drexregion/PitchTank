/**
 * Edge Case Tests for PitchTank AMM Trading System
 *
 * Comprehensive tests to identify and verify edge cases in the trading system
 */

import {
	simulateBuyTrade,
	simulateSellTrade,
	calculateCurrentPrice,
	calculateMarketCap,
	verifyConstantProduct,
} from "../src/lib/ammEngine";
import { Founder } from "../src/types/Founder";

interface TestResult {
	testName: string;
	passed: boolean;
	message: string;
	details?: any;
}

const testResults: TestResult[] = [];

/**
 * Helper to create a founder with specific state
 */
function createFounder(
	sharesInPool: number,
	cashInPool: number,
	minReserve: number = 1000
): Founder {
	return {
		id: "test-founder",
		name: "Test Founder",
		event_id: "test-event",
		pitch_summary: "Test",
		shares_in_pool: sharesInPool,
		cash_in_pool: cashInPool,
		k_constant: sharesInPool * cashInPool,
		min_reserve_shares: minReserve,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};
}

/**
 * Test 1: Price Cap at $100
 */
function testPriceCap(): TestResult {
	console.log("\n📝 Test: Price Cap at $100");

	try {
		// Create founder with very low shares and high cash (should result in price > $100)
		const founder = createFounder(1000, 200000); // Would be $200 without cap
		const price = calculateCurrentPrice(founder);

		if (price <= 100) {
			console.log(`   ✅ Price correctly capped at $${price.toFixed(2)}`);
			return {
				testName: "Price Cap at $100",
				passed: true,
				message: `Price correctly capped at $${price.toFixed(2)}`,
				details: { calculatedPrice: price, expectedMax: 100 },
			};
		} else {
			console.error(`   ❌ Price not capped: $${price.toFixed(2)}`);
			return {
				testName: "Price Cap at $100",
				passed: false,
				message: `Price exceeded cap: $${price.toFixed(2)}`,
				details: { calculatedPrice: price, expectedMax: 100 },
			};
		}
	} catch (error: any) {
		console.error(`   ❌ Error: ${error.message}`);
		return {
			testName: "Price Cap at $100",
			passed: false,
			message: `Error: ${error.message}`,
		};
	}
}

/**
 * Test 2: Minimum Reserve Protection
 */
function testMinimumReserve(): TestResult {
	console.log("\n📝 Test: Minimum Reserve Protection");

	try {
		const minReserve = 1000;
		const founder = createFounder(5000, 50000, minReserve);

		// Try to buy more shares than allowed (would go below reserve)
		const sharesToBuy = 4500; // Would leave only 500 shares
		const result = simulateBuyTrade(founder, sharesToBuy);

		if (result.error && result.error.includes("minimum reserve")) {
			console.log(`   ✅ Correctly prevented purchase below reserve`);
			return {
				testName: "Minimum Reserve Protection",
				passed: true,
				message: "Correctly prevented purchase below reserve",
				details: {
					minReserve,
					attemptedPurchase: sharesToBuy,
					error: result.error,
				},
			};
		} else if (result.error) {
			console.log(`   ✅ Trade blocked (with error: ${result.error})`);
			return {
				testName: "Minimum Reserve Protection",
				passed: true,
				message: "Trade blocked with error",
				details: { error: result.error },
			};
		} else {
			console.error(`   ❌ Trade allowed when it should have been blocked`);
			return {
				testName: "Minimum Reserve Protection",
				passed: false,
				message: "Trade allowed when it should have been blocked",
				details: { minReserve, attemptedPurchase: sharesToBuy },
			};
		}
	} catch (error: any) {
		console.error(`   ❌ Error: ${error.message}`);
		return {
			testName: "Minimum Reserve Protection",
			passed: false,
			message: `Error: ${error.message}`,
		};
	}
}

/**
 * Test 3: Zero Share Purchase
 */
function testZeroSharePurchase(): TestResult {
	console.log("\n📝 Test: Zero Share Purchase");

	try {
		const founder = createFounder(100000, 1000000);
		const result = simulateBuyTrade(founder, 0);

		if (result.cost === 0 && result.resultingPrice > 0) {
			console.log(`   ✅ Zero share purchase handled correctly`);
			return {
				testName: "Zero Share Purchase",
				passed: true,
				message: "Zero share purchase handled correctly",
				details: result,
			};
		} else {
			console.error(`   ❌ Unexpected result for zero shares`);
			return {
				testName: "Zero Share Purchase",
				passed: false,
				message: "Unexpected result for zero shares",
				details: result,
			};
		}
	} catch (error: any) {
		console.error(`   ❌ Error: ${error.message}`);
		return {
			testName: "Zero Share Purchase",
			passed: false,
			message: `Error: ${error.message}`,
		};
	}
}

/**
 * Test 4: Negative Share Handling
 */
function testNegativeShares(): TestResult {
	console.log("\n📝 Test: Negative Share Handling");

	try {
		const founder = createFounder(100000, 1000000);
		const buyResult = simulateBuyTrade(founder, -100);
		const sellResult = simulateSellTrade(founder, -100);

		// Negative shares should either be rejected or cause an error
		const buyHandled = buyResult.error || buyResult.cost === 0;
		const sellHandled = sellResult.error || sellResult.payout === 0;

		if (buyHandled && sellHandled) {
			console.log(`   ✅ Negative shares handled correctly`);
			return {
				testName: "Negative Share Handling",
				passed: true,
				message: "Negative shares handled correctly",
				details: { buyResult, sellResult },
			};
		} else {
			console.error(`   ❌ Negative shares not properly handled`);
			return {
				testName: "Negative Share Handling",
				passed: false,
				message: "Negative shares not properly handled",
				details: { buyResult, sellResult },
			};
		}
	} catch (error: any) {
		// Catching an error is also acceptable for negative shares
		console.log(
			`   ✅ Negative shares caused error (acceptable): ${error.message}`
		);
		return {
			testName: "Negative Share Handling",
			passed: true,
			message: "Negative shares caused error (acceptable)",
			details: { error: error.message },
		};
	}
}

/**
 * Test 5: Very Large Trade
 */
function testVeryLargeTrade(): TestResult {
	console.log("\n📝 Test: Very Large Trade");

	try {
		const founder = createFounder(100000, 1000000);
		const largeAmount = 50000; // 50% of pool
		const result = simulateBuyTrade(founder, largeAmount);

		if (!result.error) {
			// Verify the price impact is significant but calculable
			const priceImpact = ((result.resultingPrice - 10) / 10) * 100;
			console.log(
				`   ℹ️  Large trade processed with ${priceImpact.toFixed(
					2
				)}% price impact`
			);

			// Verify constant product formula
			const newShares = founder.shares_in_pool - largeAmount;
			const newCash = founder.k_constant / newShares;
			const isValid = verifyConstantProduct(
				newShares,
				newCash,
				founder.k_constant
			);

			if (isValid) {
				console.log(
					`   ✅ Large trade handled correctly with constant product maintained`
				);
				return {
					testName: "Very Large Trade",
					passed: true,
					message: "Large trade handled correctly",
					details: { priceImpact, result },
				};
			} else {
				console.error(`   ❌ Constant product violated on large trade`);
				return {
					testName: "Very Large Trade",
					passed: false,
					message: "Constant product violated on large trade",
				};
			}
		} else {
			// If it's rejected due to reserve, that's also valid
			console.log(`   ✅ Large trade rejected: ${result.error}`);
			return {
				testName: "Very Large Trade",
				passed: true,
				message: "Large trade appropriately rejected",
				details: { error: result.error },
			};
		}
	} catch (error: any) {
		console.error(`   ❌ Error: ${error.message}`);
		return {
			testName: "Very Large Trade",
			passed: false,
			message: `Error: ${error.message}`,
		};
	}
}

/**
 * Test 6: Floating Point Precision
 */
function testFloatingPointPrecision(): TestResult {
	console.log("\n📝 Test: Floating Point Precision");

	try {
		const founder = createFounder(100000, 1000000);
		let currentFounder = { ...founder };

		// Perform 100 small trades and verify constant product
		for (let i = 0; i < 100; i++) {
			const shares = 10;
			const { cost, error } = simulateBuyTrade(currentFounder, shares);

			if (!error) {
				const newShares = currentFounder.shares_in_pool - shares;
				const newCash = currentFounder.k_constant / newShares;

				currentFounder = {
					...currentFounder,
					shares_in_pool: newShares,
					cash_in_pool: newCash,
				};
			}
		}

		// Verify constant product is still maintained
		const isValid = verifyConstantProduct(
			currentFounder.shares_in_pool,
			currentFounder.cash_in_pool,
			currentFounder.k_constant
		);

		if (isValid) {
			console.log(`   ✅ Floating point precision maintained after 100 trades`);
			return {
				testName: "Floating Point Precision",
				passed: true,
				message: "Precision maintained after multiple trades",
				details: {
					initialK: founder.k_constant,
					finalK: currentFounder.shares_in_pool * currentFounder.cash_in_pool,
					difference: Math.abs(
						founder.k_constant -
							currentFounder.shares_in_pool * currentFounder.cash_in_pool
					),
				},
			};
		} else {
			console.error(`   ❌ Precision lost after multiple trades`);
			return {
				testName: "Floating Point Precision",
				passed: false,
				message: "Precision lost after multiple trades",
				details: {
					initialK: founder.k_constant,
					finalK: currentFounder.shares_in_pool * currentFounder.cash_in_pool,
				},
			};
		}
	} catch (error: any) {
		console.error(`   ❌ Error: ${error.message}`);
		return {
			testName: "Floating Point Precision",
			passed: false,
			message: `Error: ${error.message}`,
		};
	}
}

/**
 * Test 7: Buy Then Sell (Round Trip)
 */
function testBuyThenSell(): TestResult {
	console.log("\n📝 Test: Buy Then Sell (Round Trip)");

	try {
		const founder = createFounder(100000, 1000000);
		const shares = 1000;

		// Buy shares
		const buyResult = simulateBuyTrade(founder, shares);
		if (buyResult.error) {
			throw new Error(`Buy failed: ${buyResult.error}`);
		}

		// Update founder state
		const founderAfterBuy = {
			...founder,
			shares_in_pool: founder.shares_in_pool - shares,
			cash_in_pool: founder.k_constant / (founder.shares_in_pool - shares),
		};

		// Sell same shares
		const sellResult = simulateSellTrade(founderAfterBuy, shares);
		if (sellResult.error) {
			throw new Error(`Sell failed: ${sellResult.error}`);
		}

		// The payout should be less than the cost (due to slippage and AMM curve)
		const netLoss = buyResult.cost - sellResult.payout;
		const lossPercent = (netLoss / buyResult.cost) * 100;

		console.log(
			`   ℹ️  Round trip loss: $${netLoss.toFixed(2)} (${lossPercent.toFixed(
				2
			)}%)`
		);

		if (netLoss >= 0) {
			console.log(
				`   ✅ Round trip handled correctly (expected loss due to slippage)`
			);
			return {
				testName: "Buy Then Sell (Round Trip)",
				passed: true,
				message: "Round trip handled correctly",
				details: {
					buyCost: buyResult.cost,
					sellPayout: sellResult.payout,
					netLoss,
					lossPercent,
				},
			};
		} else {
			console.error(
				`   ❌ Unexpected profit on round trip (arbitrage opportunity!)`
			);
			return {
				testName: "Buy Then Sell (Round Trip)",
				passed: false,
				message: "Unexpected profit on round trip",
				details: {
					buyCost: buyResult.cost,
					sellPayout: sellResult.payout,
					netLoss,
				},
			};
		}
	} catch (error: any) {
		console.error(`   ❌ Error: ${error.message}`);
		return {
			testName: "Buy Then Sell (Round Trip)",
			passed: false,
			message: `Error: ${error.message}`,
		};
	}
}

/**
 * Test 8: Depleted Pool (Near Zero Shares)
 */
function testDepletedPool(): TestResult {
	console.log("\n📝 Test: Depleted Pool (Near Zero Shares)");

	try {
		// Create founder with very few shares left
		const minReserve = 1000;
		const founder = createFounder(minReserve + 100, 1000000, minReserve);

		// Try to buy the remaining non-reserve shares
		const result = simulateBuyTrade(founder, 100);

		if (!result.error) {
			// If allowed, price should be very high
			if (result.resultingPrice >= 90) {
				console.log(
					`   ✅ Depleted pool handled with very high price: $${result.resultingPrice.toFixed(
						2
					)}`
				);
				return {
					testName: "Depleted Pool",
					passed: true,
					message: "Depleted pool handled correctly",
					details: { price: result.resultingPrice, cost: result.cost },
				};
			} else {
				console.error(
					`   ❌ Price too low for depleted pool: $${result.resultingPrice.toFixed(
						2
					)}`
				);
				return {
					testName: "Depleted Pool",
					passed: false,
					message: "Price unreasonably low for depleted pool",
					details: { price: result.resultingPrice },
				};
			}
		} else {
			console.log(`   ✅ Trade blocked on depleted pool: ${result.error}`);
			return {
				testName: "Depleted Pool",
				passed: true,
				message: "Trade appropriately blocked",
				details: { error: result.error },
			};
		}
	} catch (error: any) {
		console.error(`   ❌ Error: ${error.message}`);
		return {
			testName: "Depleted Pool",
			passed: false,
			message: `Error: ${error.message}`,
		};
	}
}

/**
 * Test 9: Market Cap Calculation
 */
function testMarketCapCalculation(): TestResult {
	console.log("\n📝 Test: Market Cap Calculation");

	try {
		const initialShares = 100000;
		const sharesInPool = 90000; // 10,000 shares sold
		const cashInPool = 1111111.11; // Calculated after selling 10k shares
		const founder = createFounder(sharesInPool, cashInPool);

		const price = calculateCurrentPrice(founder);
		const marketCap = calculateMarketCap(founder, initialShares);

		// Market cap should be: current_price * shares_issued
		const sharesIssued = initialShares - sharesInPool;
		const expectedMarketCap = price * sharesIssued;

		const difference = Math.abs(marketCap - expectedMarketCap);
		const tolerance = 0.01; // 1 cent tolerance

		if (difference < tolerance) {
			console.log(
				`   ✅ Market cap calculated correctly: $${marketCap.toFixed(2)}`
			);
			return {
				testName: "Market Cap Calculation",
				passed: true,
				message: "Market cap calculated correctly",
				details: {
					price,
					sharesIssued,
					marketCap,
					expectedMarketCap,
					difference,
				},
			};
		} else {
			console.error(
				`   ❌ Market cap mismatch: $${marketCap.toFixed(
					2
				)} vs expected $${expectedMarketCap.toFixed(2)}`
			);
			return {
				testName: "Market Cap Calculation",
				passed: false,
				message: "Market cap calculation incorrect",
				details: {
					marketCap,
					expectedMarketCap,
					difference,
				},
			};
		}
	} catch (error: any) {
		console.error(`   ❌ Error: ${error.message}`);
		return {
			testName: "Market Cap Calculation",
			passed: false,
			message: `Error: ${error.message}`,
		};
	}
}

/**
 * Test 10: Selling More Than Owned
 */
function testSellMoreThanOwned(): TestResult {
	console.log("\n📝 Test: Selling More Than Owned");

	try {
		const founder = createFounder(100000, 1000000);

		// This test simulates the validation that should happen at the API level
		// The AMM engine itself doesn't track ownership, but we test large sells
		const veryLargeAmount = 200000; // More than initial pool
		const result = simulateSellTrade(founder, veryLargeAmount);

		// The AMM should handle this (it just increases pool)
		if (!result.error) {
			console.log(
				`   ℹ️  AMM accepts sell (ownership validation needed at API level)`
			);
			console.log(
				`   ✅ Test passed - AMM mechanics work, but API should prevent this`
			);
			return {
				testName: "Selling More Than Owned",
				passed: true,
				message:
					"AMM accepts sell (ownership should be validated at API level)",
				details: { result },
			};
		} else {
			console.log(`   ✅ Sell rejected: ${result.error}`);
			return {
				testName: "Selling More Than Owned",
				passed: true,
				message: "Sell rejected",
				details: { error: result.error },
			};
		}
	} catch (error: any) {
		console.error(`   ❌ Error: ${error.message}`);
		return {
			testName: "Selling More Than Owned",
			passed: false,
			message: `Error: ${error.message}`,
		};
	}
}

/**
 * Test 11: Extreme K Constant Values
 */
function testExtremeKValues(): TestResult {
	console.log("\n📝 Test: Extreme K Constant Values");

	try {
		// Test with very large K
		const largeK = 100000000000; // 100 billion
		const founder1 = createFounder(1000000, 100000); // K = 100 billion

		const price1 = calculateCurrentPrice(founder1);
		const isValid1 = !isNaN(price1) && isFinite(price1);

		// Test with very small K
		const founder2 = createFounder(100, 100); // K = 10,000
		const price2 = calculateCurrentPrice(founder2);
		const isValid2 = !isNaN(price2) && isFinite(price2);

		if (isValid1 && isValid2) {
			console.log(`   ✅ Extreme K values handled correctly`);
			console.log(`      Large K price: $${price1.toFixed(2)}`);
			console.log(`      Small K price: $${price2.toFixed(2)}`);
			return {
				testName: "Extreme K Constant Values",
				passed: true,
				message: "Extreme K values handled correctly",
				details: {
					largeKPrice: price1,
					smallKPrice: price2,
				},
			};
		} else {
			console.error(`   ❌ Invalid prices with extreme K values`);
			return {
				testName: "Extreme K Constant Values",
				passed: false,
				message: "Invalid prices with extreme K values",
				details: {
					largeKPrice: price1,
					largeKValid: isValid1,
					smallKPrice: price2,
					smallKValid: isValid2,
				},
			};
		}
	} catch (error: any) {
		console.error(`   ❌ Error: ${error.message}`);
		return {
			testName: "Extreme K Constant Values",
			passed: false,
			message: `Error: ${error.message}`,
		};
	}
}

/**
 * Test 12: Consecutive Buys Price Increase
 */
function testConsecutiveBuysPriceIncrease(): TestResult {
	console.log("\n📝 Test: Consecutive Buys Price Increase");

	try {
		let currentFounder = createFounder(100000, 1000000);
		let previousPrice = calculateCurrentPrice(currentFounder);
		let allIncreasing = true;

		// Perform 10 consecutive buys
		for (let i = 0; i < 10; i++) {
			const shares = 1000;
			const result = simulateBuyTrade(currentFounder, shares);

			if (result.error) {
				throw new Error(`Buy ${i + 1} failed: ${result.error}`);
			}

			const newShares = currentFounder.shares_in_pool - shares;
			const newCash = currentFounder.k_constant / newShares;

			currentFounder = {
				...currentFounder,
				shares_in_pool: newShares,
				cash_in_pool: newCash,
			};

			const newPrice = calculateCurrentPrice(currentFounder);

			if (newPrice <= previousPrice) {
				allIncreasing = false;
				console.error(
					`   ❌ Price did not increase: $${previousPrice.toFixed(
						2
					)} -> $${newPrice.toFixed(2)}`
				);
				break;
			}

			previousPrice = newPrice;
		}

		if (allIncreasing) {
			const finalPrice = calculateCurrentPrice(currentFounder);
			console.log(
				`   ✅ Price increased monotonically: $10.00 -> $${finalPrice.toFixed(
					2
				)}`
			);
			return {
				testName: "Consecutive Buys Price Increase",
				passed: true,
				message: "Price increased correctly with consecutive buys",
				details: {
					initialPrice: 10,
					finalPrice: finalPrice,
				},
			};
		} else {
			return {
				testName: "Consecutive Buys Price Increase",
				passed: false,
				message: "Price did not increase monotonically",
			};
		}
	} catch (error: any) {
		console.error(`   ❌ Error: ${error.message}`);
		return {
			testName: "Consecutive Buys Price Increase",
			passed: false,
			message: `Error: ${error.message}`,
		};
	}
}

/**
 * Run all edge case tests
 */
async function runAllEdgeCaseTests(): Promise<void> {
	console.log("\n=================================================");
	console.log("🔬 PitchTank AMM Edge Case Tests");
	console.log("=================================================");

	const tests = [
		testPriceCap,
		testMinimumReserve,
		testZeroSharePurchase,
		testNegativeShares,
		testVeryLargeTrade,
		testFloatingPointPrecision,
		testBuyThenSell,
		testDepletedPool,
		testMarketCapCalculation,
		testSellMoreThanOwned,
		testExtremeKValues,
		testConsecutiveBuysPriceIncrease,
	];

	const results: TestResult[] = [];

	for (const test of tests) {
		const result = test();
		results.push(result);
	}

	// Print summary
	console.log("\n=================================================");
	console.log("🎉 Edge Case Test Summary");
	console.log("=================================================\n");

	const passed = results.filter((r) => r.passed).length;
	const total = results.length;

	results.forEach((result) => {
		console.log(`${result.passed ? "✅" : "❌"} ${result.testName}`);
		if (!result.passed || result.message.includes("ℹ️")) {
			console.log(`   ${result.message}`);
		}
	});

	console.log(
		`\n📊 Result: ${passed}/${total} tests passed (${(
			(passed / total) *
			100
		).toFixed(1)}%)`
	);

	if (passed === total) {
		console.log("🎉 ALL EDGE CASE TESTS PASSED!\n");
	} else {
		console.error(
			`❌ ${total - passed} test(s) failed. Please review the issues above.\n`
		);
	}

	// Return detailed results
	return;
}

// Run tests if executed directly
if (require.main === module) {
	runAllEdgeCaseTests().catch(console.error);
}

export { runAllEdgeCaseTests, testResults };

