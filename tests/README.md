# PitchTank AMM Test Suite

This directory contains comprehensive tests for the PitchTank Automated Market Maker (AMM) trading system.

## Test Overview

### 🔥 Stress Test (`stressTest.ts`)

Simulates **100 concurrent users** trading simultaneously to ensure system stability and correctness under high load.

**What it tests:**

- Concurrent trade execution
- Price consistency under load
- Constant product formula maintenance (x × y = k)
- Share conservation
- Performance metrics
- No negative values or invalid states

**Key Metrics:**

- Total execution time
- Average time per trade
- Success/failure rates
- Price impact analysis
- Volume statistics

**Run with:**

```bash
npm run test:stress
```

### 🔬 Edge Case Tests (`edgeCaseTests.ts`)

Comprehensive tests covering 12 different edge cases to identify potential issues.

**Test Cases:**

1. **Price Cap at $100**

   - Ensures prices never exceed the $100 maximum
   - Tests with scenarios that would naturally exceed cap

2. **Minimum Reserve Protection**

   - Verifies trades can't deplete pool below minimum reserve
   - Tests boundary conditions

3. **Zero Share Purchase**

   - Handles zero-quantity trades gracefully
   - Ensures no division by zero errors

4. **Negative Share Handling**

   - Rejects or handles negative share amounts
   - Prevents exploitation

5. **Very Large Trade**

   - Tests trades with significant pool impact (50%+)
   - Verifies constant product maintained
   - Checks price impact calculations

6. **Floating Point Precision**

   - Performs 100 consecutive small trades
   - Ensures no accumulation of rounding errors
   - Verifies constant product remains accurate

7. **Buy Then Sell (Round Trip)**

   - Tests buying then immediately selling
   - Verifies expected loss due to slippage
   - Checks for arbitrage opportunities (should have none)

8. **Depleted Pool**

   - Tests behavior when pool is nearly empty
   - Ensures very high prices or trade rejection
   - Verifies minimum reserve enforcement

9. **Market Cap Calculation**

   - Validates market capitalization formula
   - Ensures: market_cap = current_price × shares_issued

10. **Selling More Than Owned**

    - Tests AMM's response to overselling
    - Notes that ownership validation should occur at API level

11. **Extreme K Constant Values**

    - Tests with very large and very small K values
    - Ensures calculations remain valid
    - Checks for NaN or Infinity values

12. **Consecutive Buys Price Increase**
    - Verifies price increases monotonically with buys
    - Tests 10 consecutive purchases
    - Ensures AMM curve behavior is correct

**Run with:**

```bash
npm run test:edge
```

### 🎯 Complete Test Suite (`runAllTests.ts`)

Runs all tests in sequence:

1. Edge Case Tests (Phase 1)
2. Stress Test (Phase 2)

**Run with:**

```bash
npm test
```

## Understanding the AMM Formula

The PitchTank AMM uses the **constant product formula**:

```
x × y = k
```

Where:

- `x` = shares in the pool
- `y` = cash in the pool
- `k` = constant product value (never changes)

### Price Calculation

```
price = cash_in_pool / shares_in_pool
```

### Buy Trade

When buying `n` shares:

```
new_shares = shares_in_pool - n
new_cash = k / new_shares
cost = new_cash - cash_in_pool
```

The buyer pays the difference in cash needed to maintain the constant product.

### Sell Trade

When selling `n` shares:

```
new_shares = shares_in_pool + n
new_cash = k / new_shares
payout = cash_in_pool - new_cash
```

The seller receives the difference in cash from the pool.

## Expected Behaviors

### ✅ Valid Behaviors

- **Price increases** when shares are bought (pool depletes)
- **Price decreases** when shares are sold (pool fills)
- **Slippage occurs** on all trades (larger trades = more slippage)
- **Round trips lose money** due to slippage (prevents arbitrage)
- **Constant product** is always maintained within floating-point tolerance
- **Prices are capped** at $100 maximum
- **Minimum reserves** prevent complete pool depletion

### ❌ Invalid Behaviors (Tests should catch these)

- Price going negative
- Constant product changing
- Shares disappearing or appearing
- Prices exceeding $100 cap
- Pool depleting below minimum reserve
- NaN or Infinity values
- Negative costs or payouts

## Running the Tests

### Prerequisites

```bash
npm install
```

This will install required dependencies including `ts-node`.

### Run All Tests

```bash
npm test
```

### Run Individual Test Suites

```bash
# Stress test only
npm run test:stress

# Edge cases only
npm run test:edge
```

## Interpreting Results

### Stress Test Output

```
✅ All trades executed successfully
✅ Constant product formula maintained
✅ Share conservation verified
✅ No negative values detected
```

**Key metrics to check:**

- All checks should pass ✅
- Execution time should be reasonable (< 1 second for 100 trades)
- Final price should reflect net buy/sell pressure
- Total shares should equal initial shares (conservation)

### Edge Case Test Output

```
✅ Price Cap at $100
✅ Minimum Reserve Protection
✅ Zero Share Purchase
...
📊 Result: 12/12 tests passed (100%)
```

**What to look for:**

- All 12 tests should pass
- No unexpected errors
- Edge cases handled gracefully
- No security vulnerabilities

## Common Issues and Solutions

### Issue: Constant Product Not Maintained

**Symptom:** Test fails with "Constant product formula violated"

**Cause:** Floating-point arithmetic errors accumulating

**Solution:** Increase tolerance in `verifyConstantProduct()` or use fixed-point arithmetic

### Issue: Tests Fail on Large Numbers

**Symptom:** Tests with extreme K values fail

**Cause:** JavaScript number precision limits

**Solution:** Consider using BigInt or decimal libraries for very large values

### Issue: Price Doesn't Increase Monotonically

**Symptom:** Consecutive buy test fails

**Cause:** Bug in AMM calculation

**Solution:** Review buy trade simulation logic in `ammEngine.ts`

## Test Coverage

Current test coverage includes:

- ✅ Basic AMM mechanics
- ✅ Price calculations
- ✅ Trade simulations (buy/sell)
- ✅ Constant product verification
- ✅ Edge cases and boundary conditions
- ✅ Concurrent user simulation
- ✅ Performance under load
- ✅ Floating-point precision
- ✅ Market cap calculations

## Future Test Ideas

- Integration tests with Supabase backend
- Race condition tests for truly concurrent trades
- Fuzzing tests with random inputs
- Long-running endurance tests
- API endpoint tests
- Frontend component tests
- End-to-end user flow tests

## Contributing

When adding new tests:

1. Add test function to appropriate file
2. Include detailed console logging
3. Return structured TestResult object
4. Add to test runner if new test suite
5. Document in this README

## Support

For questions or issues with tests, please open an issue on GitHub or contact the development team.

