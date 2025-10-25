import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { calculateCurrentPrice, calculateMarketCap } from "../lib/ammEngine";

interface LeaderboardProps {
	eventId: string;
	className?: string;
}

type InvestorLeaderboardEntry = {
	id: string;
	name: string;
	initial_balance: number;
	total_value: number;
	roi_percent: number;
};

type FounderLeaderboardEntry = {
	id: string;
	name: string;
	price: number;
	market_cap: number;
	price_change_percent: number; // From initial $10 price
};

export const Leaderboard: React.FC<LeaderboardProps> = ({
	eventId,
	className = "",
}) => {
	const [activeTab, setActiveTab] = useState<"investors" | "founders">(
		"investors"
	);
	const [investorRankings, setInvestorRankings] = useState<
		InvestorLeaderboardEntry[]
	>([]);
	const [founderRankings, setFounderRankings] = useState<
		FounderLeaderboardEntry[]
	>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch leaderboard data
	useEffect(() => {
		const fetchLeaderboardData = async () => {
			setIsLoading(true);
			setError(null);

			try {
				// Fetch investors for this event
				const { data: investors, error: investorsError } = await supabase
					.from("investors")
					.select(
						`
            id,
            name,
            initial_balance,
            current_balance,
            investor_holdings (
              id,
              founder_id,
              shares
            )
          `
					)
					.eq("event_id", eventId);

				if (investorsError) {
					throw new Error(investorsError.message);
				}

				// Fetch founders for this event
				const { data: founders, error: foundersError } = await supabase
					.from("founders")
					.select("*")
					.eq("event_id", eventId);

				if (foundersError) {
					throw new Error(foundersError.message);
				}

				// Process founder rankings
				const initialPrice = 10; // $10 initial price
				const founderEntries: FounderLeaderboardEntry[] = founders.map(
					(founder) => {
						const currentPrice = calculateCurrentPrice(founder);
						const marketCap = calculateMarketCap(founder);
						const priceChangePercent = (currentPrice / initialPrice - 1) * 100;

						return {
							id: founder.id,
							name: founder.name,
							price: currentPrice,
							market_cap: marketCap,
							price_change_percent: priceChangePercent,
						};
					}
				);

				// Sort founders by market cap (highest first)
				const sortedFounders = founderEntries.sort(
					(a, b) => b.market_cap - a.market_cap
				);
				setFounderRankings(sortedFounders);

				// Create price lookup map for investor portfolio calculation
				const founderPriceMap = new Map<string, number>();
				founders.forEach((founder) => {
					founderPriceMap.set(founder.id, calculateCurrentPrice(founder));
				});

				// Process investor rankings
				const investorEntries: InvestorLeaderboardEntry[] = investors.map(
					(investor) => {
						// Calculate portfolio value
						let portfolioValue = 0;

						if (investor.investor_holdings) {
							investor.investor_holdings.forEach((holding) => {
								const founderPrice =
									founderPriceMap.get(holding.founder_id) || 0;
								portfolioValue += Number(holding.shares) * founderPrice;
							});
						}

						const totalValue =
							portfolioValue + Number(investor.current_balance);
						const roiPercent =
							(totalValue / Number(investor.initial_balance) - 1) * 100;

						return {
							id: investor.id,
							name: investor.name,
							initial_balance: Number(investor.initial_balance),
							total_value: totalValue,
							roi_percent: roiPercent,
						};
					}
				);

				// Sort investors by ROI (highest first)
				const sortedInvestors = investorEntries.sort(
					(a, b) => b.roi_percent - a.roi_percent
				);
				setInvestorRankings(sortedInvestors);

				setIsLoading(false);
			} catch (err: any) {
				setError(err.message || "Failed to fetch leaderboard data");
				setIsLoading(false);
			}
		};

		fetchLeaderboardData();

		// Set up realtime subscriptions for updates
		const foundersChannel = supabase
			.channel("founders_leaderboard")
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "founders",
					filter: `event_id=eq.${eventId}`,
				},
				() => {
					fetchLeaderboardData();
				}
			)
			.subscribe();

		const investorsChannel = supabase
			.channel("investors_leaderboard")
			.on(
				"postgres_changes",
				{
					event: "*", // Listen for all events
					schema: "public",
					table: "investor_holdings",
				},
				() => {
					fetchLeaderboardData();
				}
			)
			.subscribe();

		// Clean up subscriptions
		return () => {
			supabase.removeChannel(foundersChannel);
			supabase.removeChannel(investorsChannel);
		};
	}, [eventId]);

	// Format currency
	const formatCurrency = (value: number) => {
		return value.toLocaleString("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		});
	};

	return (
		<div className={`card-dark overflow-hidden ${className}`}>
			<div className="p-3 md:p-5">
				{/* Tabs */}
				<div className="flex border-b border-dark-600 mb-4">
					<button
						onClick={() => setActiveTab("investors")}
						className={`pb-2 px-3 md:px-4 text-sm md:text-base ${
							activeTab === "investors"
								? "border-b-2 border-primary-500 text-primary-400 font-medium"
								: "text-dark-400 hover:text-dark-200"
						}`}
					>
						Investors
					</button>
					<button
						onClick={() => setActiveTab("founders")}
						className={`pb-2 px-3 md:px-4 text-sm md:text-base ${
							activeTab === "founders"
								? "border-b-2 border-primary-500 text-primary-400 font-medium"
								: "text-dark-400 hover:text-dark-200"
						}`}
					>
						Founders
					</button>
				</div>

				{isLoading ? (
					<div className="text-center py-8 text-dark-300">
						Loading leaderboard...
					</div>
				) : error ? (
					<div className="text-center py-8 text-red-400">Error: {error}</div>
				) : (
					<div>
						{activeTab === "investors" ? (
							<div className="overflow-x-auto -mx-3 md:mx-0">
								{investorRankings.length === 0 ? (
									<div className="text-center py-8 text-dark-400">
										No investors yet
									</div>
								) : (
									<table className="min-w-full">
										<thead>
											<tr className="text-left text-xs md:text-sm text-dark-400">
												<th className="py-2 pl-3 md:pl-0 pr-2">Rank</th>
												<th className="py-2 px-2 md:px-4">Name</th>
												<th className="py-2 px-2 md:px-4 text-right">Value</th>
												<th className="py-2 pl-2 pr-3 md:pl-4 md:pr-0 text-right">
													ROI
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-dark-700">
											{investorRankings.map((investor, index) => (
												<tr
													key={investor.id}
													className="hover:bg-dark-700/50 transition-colors"
												>
													<td className="py-2 md:py-3 pl-3 md:pl-0 pr-2 font-bold text-primary-400 text-sm md:text-base">
														{index + 1}
													</td>
													<td className="py-2 md:py-3 px-2 md:px-4 text-white text-xs md:text-base truncate max-w-[100px] md:max-w-none">
														{investor.name}
													</td>
													<td className="py-2 md:py-3 px-2 md:px-4 text-right font-medium text-accent-cyan text-xs md:text-base whitespace-nowrap">
														{formatCurrency(investor.total_value)}
													</td>
													<td
														className={`py-2 md:py-3 pl-2 pr-3 md:pl-4 md:pr-0 text-right font-medium text-xs md:text-base whitespace-nowrap ${
															investor.roi_percent >= 0
																? "text-green-400"
																: "text-red-400"
														}`}
													>
														{investor.roi_percent >= 0 ? "+" : ""}
														{investor.roi_percent.toFixed(1)}%
													</td>
												</tr>
											))}
										</tbody>
									</table>
								)}
							</div>
						) : (
							<div className="overflow-x-auto -mx-3 md:mx-0">
								{founderRankings.length === 0 ? (
									<div className="text-center py-8 text-dark-400">
										No founders yet
									</div>
								) : (
									<table className="min-w-full">
										<thead>
											<tr className="text-left text-xs md:text-sm text-dark-400">
												<th className="py-2 pl-3 md:pl-0 pr-2">Rank</th>
												<th className="py-2 px-2 md:px-4">Name</th>
												<th className="py-2 px-2 md:px-4 text-right">Price</th>
												<th className="py-2 pl-2 pr-3 md:pl-4 md:pr-0 text-right">
													Change
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-dark-700">
											{founderRankings.map((founder, index) => (
												<tr
													key={founder.id}
													className="hover:bg-dark-700/50 transition-colors"
												>
													<td className="py-2 md:py-3 pl-3 md:pl-0 pr-2 font-bold text-primary-400 text-sm md:text-base">
														{index + 1}
													</td>
													<td className="py-2 md:py-3 px-2 md:px-4 text-white text-xs md:text-base truncate max-w-[100px] md:max-w-none">
														{founder.name}
													</td>
													<td className="py-2 md:py-3 px-2 md:px-4 text-right font-medium text-accent-cyan text-xs md:text-base whitespace-nowrap">
														${founder.price.toFixed(2)}
													</td>
													<td
														className={`py-2 md:py-3 pl-2 pr-3 md:pl-4 md:pr-0 text-right font-medium text-xs md:text-base whitespace-nowrap ${
															founder.price_change_percent >= 0
																? "text-green-400"
																: "text-red-400"
														}`}
													>
														{founder.price_change_percent >= 0 ? "+" : ""}
														{founder.price_change_percent.toFixed(1)}%
													</td>
												</tr>
											))}
										</tbody>
									</table>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};
