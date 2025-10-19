import { Founder } from '../types/Founder';

/**
 * Calculates the current price of a founder's shares
 * @param founder The founder object with shares_in_pool and cash_in_pool
 * @returns Current price (capped at $100)
 */
export function calculateCurrentPrice(founder: Founder): number {
  const sharesInPool = Number(founder.shares_in_pool);
  const cashInPool = Number(founder.cash_in_pool);
  
  if (sharesInPool <= 0) return 100; // Cap at $100 if shares are depleted
  return Math.min(cashInPool / sharesInPool, 100); // Cap price at $100
}

/**
 * Calculates the market capitalization of a founder
 * @param founder The founder object
 * @param initialShares Initial shares in the pool (default 100,000)
 * @returns Market capitalization value
 */
export function calculateMarketCap(founder: Founder, initialShares: number = 100000): number {
  const currentPrice = calculateCurrentPrice(founder);
  const sharesIssued = initialShares - Number(founder.shares_in_pool);
  return currentPrice * sharesIssued;
}

/**
 * Simulates a buy trade to calculate the cost without executing it
 * @param founder Current founder state
 * @param shares Number of shares to buy
 * @returns Calculated cost and resulting price
 */
export function simulateBuyTrade(founder: Founder, shares: number): { 
  cost: number; 
  resultingPrice: number;
  error?: string;
} {
  try {
    const x = Number(founder.shares_in_pool);
    const y = Number(founder.cash_in_pool);
    const k = Number(founder.k_constant);
    const minReserve = Number(founder.min_reserve_shares || 1000);
    
    // Check if purchase would deplete below minimum reserve
    const newX = x - shares;
    if (newX <= minReserve) {
      return {
        cost: 0,
        resultingPrice: 0,
        error: `Cannot buy ${shares} shares: would deplete pool below minimum reserve of ${minReserve}`
      };
    }
    
    // Calculate new cash based on constant product formula
    const newY = k / newX;
    const cost = newY - y;
    
    // Cap price at $100
    const resultingPrice = Math.min(newY / newX, 100);
    
    return { cost, resultingPrice };
  } catch (error: any) {
    return {
      cost: 0,
      resultingPrice: 0,
      error: error.message || 'Error simulating buy trade'
    };
  }
}

/**
 * Simulates a sell trade to calculate the payout without executing it
 * @param founder Current founder state
 * @param shares Number of shares to sell
 * @returns Calculated payout and resulting price
 */
export function simulateSellTrade(founder: Founder, shares: number): { 
  payout: number; 
  resultingPrice: number;
  error?: string;
} {
  try {
    const x = Number(founder.shares_in_pool);
    const y = Number(founder.cash_in_pool);
    const k = Number(founder.k_constant);
    
    // Calculate new pool state after selling shares
    const newX = x + shares;
    const newY = k / newX;
    const payout = y - newY;
    
    // Cap price at $100
    const resultingPrice = Math.min(newY / newX, 100);
    
    return { payout, resultingPrice };
  } catch (error: any) {
    return {
      payout: 0,
      resultingPrice: 0,
      error: error.message || 'Error simulating sell trade'
    };
  }
}

/**
 * Verifies that the constant product formula is maintained
 * @param sharesInPool Number of shares in pool
 * @param cashInPool Amount of cash in pool
 * @param kConstant The expected product constant
 * @returns Boolean indicating if the formula is valid
 */
export function verifyConstantProduct(
  sharesInPool: number, 
  cashInPool: number, 
  kConstant: number
): boolean {
  // Allow for small floating point errors (0.01% tolerance)
  const calculatedK = sharesInPool * cashInPool;
  const tolerance = kConstant * 0.0001;
  
  return Math.abs(calculatedK - kConstant) <= tolerance;
}
