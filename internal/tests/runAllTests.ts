/**
 * Master Test Runner
 * Runs all tests for the PitchTank AMM system
 */

import { runStressTest } from "./stressTest";
import { runAllEdgeCaseTests } from "./edgeCaseTests";

async function runAllTests() {
	console.log("\n╔═══════════════════════════════════════════════╗");
	console.log("║  PitchTank AMM Complete Test Suite          ║");
	console.log("╚═══════════════════════════════════════════════╝");

	try {
		// Run edge case tests first
		console.log("\n\n📋 PHASE 1: Edge Case Tests");
		console.log("───────────────────────────────────────────────");
		await runAllEdgeCaseTests();

		// Run stress test
		console.log("\n\n📋 PHASE 2: Stress Test");
		console.log("───────────────────────────────────────────────");
		await runStressTest();

		console.log("\n\n╔═══════════════════════════════════════════════╗");
		console.log("║  🎉 All Tests Completed Successfully!       ║");
		console.log("╚═══════════════════════════════════════════════╝\n");
	} catch (error) {
		console.error("\n\n╔═══════════════════════════════════════════════╗");
		console.error("║  ❌ Test Suite Failed                       ║");
		console.error("╚═══════════════════════════════════════════════╝");
		console.error("\nError:", error);
		process.exit(1);
	}
}

// Run if executed directly
if (require.main === module) {
	runAllTests();
}

export { runAllTests };

