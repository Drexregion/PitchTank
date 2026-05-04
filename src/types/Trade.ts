export interface Trade {
	id: string;
	event_id: string;
	investor_id: string;
	pitch_id: string;
	shares: number;
	amount: number;
	type: "buy" | "sell";
	price_per_share: number;
	note?: string;
	created_at: string;
}

export interface TradeWithDetails extends Trade {
	investor_name: string;
	pitch_name: string;
}
