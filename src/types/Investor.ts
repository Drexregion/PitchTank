export interface Investor {
  id: string;
  event_id: string;
  profile_user_id: string | null;
  name: string;
  initial_balance: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

export interface InvestorHolding {
  id: string;
  investor_id: string;
  pitch_id: string;
  shares: number;
  cost_basis: number;
  created_at: string;
  updated_at: string;
}

export interface InvestorWithPortfolio extends Investor {
  holdings: InvestorHoldingWithValue[];
  portfolio_value: number;
  total_value: number;
  roi_percent: number;
}

export interface EventInvestorEntry {
  id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  holdings: { pitch_id: string; shares: number }[];
}

export interface InvestorHoldingWithValue extends InvestorHolding {
  pitch_name: string;
  current_price: number;
  current_value: number;
  profit_loss: number;
  roi_percent: number;
}
