export interface Investor {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  initial_balance: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

export interface InvestorHolding {
  id: string;
  investor_id: string;
  founder_id: string;
  shares: number;
  cost_basis: number;
  created_at: string;
  updated_at: string;
}

export interface InvestorWithPortfolio extends Investor {
  holdings: InvestorHoldingWithValue[];
  portfolio_value: number; // Sum of all holdings value
  total_value: number;     // portfolio_value + current_balance
  roi_percent: number;     // (total_value / initial_balance - 1) * 100
}

export interface InvestorHoldingWithValue extends InvestorHolding {
  founder_name: string;
  current_price: number;
  current_value: number; // shares * current_price
  profit_loss: number;   // current_value - (shares * cost_basis)
  roi_percent: number;   // (current_price / cost_basis - 1) * 100
}
