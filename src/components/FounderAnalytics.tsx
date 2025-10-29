import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { usePriceHistory } from "../hooks/usePriceHistory";
import { Founder } from "../types/Founder";
import { Trade } from "../types/Trade";

interface FounderAnalyticsProps {
	founder: Founder;
}

interface TradeWithNote extends Trade {
	timestamp: string;
	priceAtTime: number;
}

export const FounderAnalytics: React.FC<FounderAnalyticsProps> = ({
	founder,
}) => {
	const {
		points,
		isLoading: priceLoading,
		error: priceError,
	} = usePriceHistory({ founderId: founder.id, maxPoints: 1000 });
	const [trades, setTrades] = useState<TradeWithNote[]>([]);
	const [selectedTrade, setSelectedTrade] = useState<TradeWithNote | null>(
		null
	);
	const [hoveredTrade, setHoveredTrade] = useState<TradeWithNote | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetchAnalyticsData();
	}, [founder.id]);

	const fetchAnalyticsData = async () => {
		try {
			setIsLoading(true);
			setError(null);

			// Fetch trades (note column may not exist yet in some databases)
			const { data: tradeData, error: tradeError } = await supabase
				.from("trades")
				.select("*")
				.eq("founder_id", founder.id)
				.order("created_at", { ascending: true });

			if (tradeError) throw tradeError;

			// If the 'note' column exists, keep only trades with a non-empty note.
			const hasNoteColumn =
				(tradeData?.length ?? 0) > 0 &&
				tradeData.some((t: any) =>
					Object.prototype.hasOwnProperty.call(t, "note")
				);

			const tradesWithNotes = hasNoteColumn
				? (tradeData as any[]).filter(
						(t) => t.note != null && String(t.note).trim() !== ""
				  )
				: [];

			// Enrich trades with price at time
			const enrichedTrades: TradeWithNote[] = tradesWithNotes.map((trade) => {
				// Find the closest price history entry to this trade
				const tradeTime = new Date(trade.created_at).getTime();
				const closestPrice = points?.reduce((closest, current) => {
					const currentTime = new Date(current.recorded_at).getTime();
					const closestTime = new Date(closest.recorded_at).getTime();
					return Math.abs(currentTime - tradeTime) <
						Math.abs(closestTime - tradeTime)
						? current
						: closest;
				}, points[0]);

				return {
					...trade,
					timestamp: trade.created_at,
					priceAtTime: closestPrice?.price || trade.price_per_share,
				};
			});

			setTrades(enrichedTrades);
		} catch (err: any) {
			setError(err.message || "Failed to load analytics data");
		} finally {
			setIsLoading(false);
		}
	};

	// Calculate chart dimensions and scales
	const chartWidth = 800;
	const chartHeight = 400;
	const padding = { top: 20, right: 20, bottom: 60, left: 60 };
	const innerWidth = chartWidth - padding.left - padding.right;
	const innerHeight = chartHeight - padding.top - padding.bottom;

	// Get min/max values for scaling
	const prices = points.map((p) => p.price);
	const minPrice = Math.min(...prices, ...trades.map((t) => t.priceAtTime));
	const maxPrice = Math.max(...prices, ...trades.map((t) => t.priceAtTime));
	const priceRange = maxPrice - minPrice || 1;

	const timestamps = points.map((p) => new Date(p.recorded_at).getTime());
	const minTime = Math.min(
		...timestamps,
		...trades.map((t) => new Date(t.timestamp).getTime())
	);
	const maxTime = Math.max(
		...timestamps,
		...trades.map((t) => new Date(t.timestamp).getTime())
	);
	const timeRange = maxTime - minTime || 1;

	// Scaling functions
	const scaleX = (timestamp: string) => {
		const time = new Date(timestamp).getTime();
		return padding.left + ((time - minTime) / timeRange) * innerWidth;
	};

	const scaleY = (price: number) => {
		return (
			chartHeight -
			padding.bottom -
			((price - minPrice) / priceRange) * innerHeight
		);
	};

	// Generate SVG path for price line
	const generatePath = () => {
		if (points.length === 0) return "";

		return points
			.map((point, index) => {
				const x = scaleX(point.recorded_at);
				const y = scaleY(point.price);
				return `${index === 0 ? "M" : "L"} ${x} ${y}`;
			})
			.join(" ");
	};

	// Format currency
	const formatCurrency = (value: number) => {
		return value.toLocaleString("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	};

	// Format date
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	if (isLoading || priceLoading) {
		return (
			<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow p-8">
				<div className="flex items-center justify-center py-12">
					<div className="animate-spin rounded-full h-12 w-12 border-b-4 border-accent-cyan"></div>
					<span className="ml-4 text-white">Loading analytics...</span>
				</div>
			</div>
		);
	}

	if (error || priceError) {
		return (
			<div className="bg-dark-900/95 backdrop-blur-sm border border-red-500/30 rounded-2xl shadow-glow p-8">
				<div className="p-4 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg">
					{error || priceError}
				</div>
			</div>
		);
	}

	if (points.length === 0) {
		return (
			<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow p-8">
				<div className="text-center py-12">
					<div className="text-dark-400 text-lg">
						No price history available yet
					</div>
					<p className="text-dark-500 text-sm mt-2">
						Price data will appear after the first trades
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow p-6">
				<h2 className="text-2xl font-bold text-white mb-2">
					{founder.name} - Trading Analytics
				</h2>
				<p className="text-dark-300">Price history with investor trade notes</p>
			</div>

			{/* Chart */}
			<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow p-6">
				<div className="overflow-x-auto">
					<svg
						width={chartWidth}
						height={chartHeight}
						className="mx-auto"
						style={{ minWidth: chartWidth }}
					>
						{/* Grid lines */}
						<g>
							{[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
								const y = chartHeight - padding.bottom - ratio * innerHeight;
								return (
									<g key={ratio}>
										<line
											x1={padding.left}
											y1={y}
											x2={chartWidth - padding.right}
											y2={y}
											stroke="rgba(255, 255, 255, 0.1)"
											strokeWidth="1"
										/>
										<text
											x={padding.left - 10}
											y={y + 4}
											fill="rgba(255, 255, 255, 0.6)"
											fontSize="12"
											textAnchor="end"
										>
											${(minPrice + ratio * priceRange).toFixed(2)}
										</text>
									</g>
								);
							})}
						</g>

						{/* Price line */}
						<path
							d={generatePath()}
							fill="none"
							stroke="url(#priceGradient)"
							strokeWidth="3"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>

						{/* Gradient definition */}
						<defs>
							<linearGradient
								id="priceGradient"
								x1="0%"
								y1="0%"
								x2="100%"
								y2="0%"
							>
								<stop offset="0%" stopColor="#00d4ff" />
								<stop offset="100%" stopColor="#0052b3" />
							</linearGradient>
						</defs>

						{/* Trade note dots */}
						{trades.map((trade) => {
							const x = scaleX(trade.timestamp);
							const y = scaleY(trade.priceAtTime);
							const isSelected = selectedTrade?.id === trade.id;
							const isHovered = hoveredTrade?.id === trade.id;

							return (
								<g key={trade.id}>
									{/* Outer glow circle (for selected/hovered) */}
									{(isSelected || isHovered) && (
										<circle
											cx={x}
											cy={y}
											r="12"
											fill={
												trade.type === "buy"
													? "rgba(34, 197, 94, 0.2)"
													: "rgba(239, 68, 68, 0.2)"
											}
											className="animate-pulse"
										/>
									)}

									{/* Main dot */}
									<circle
										cx={x}
										cy={y}
										r={isSelected || isHovered ? "8" : "6"}
										fill={trade.type === "buy" ? "#22c55e" : "#ef4444"}
										stroke="white"
										strokeWidth="2"
										className="cursor-pointer transition-all"
										onClick={() => setSelectedTrade(trade)}
									/>

									{/* Trade type indicator */}
									<text
										x={x}
										y={y - 15}
										fill="white"
										fontSize="10"
										fontWeight="bold"
										textAnchor="middle"
										className="pointer-events-none"
									>
										{trade.type === "buy" ? "↑" : "↓"}
									</text>
								</g>
							);
						})}

						{/* X-axis labels */}
						<g>
							{[0, 0.5, 1].map((ratio) => {
								const time = minTime + ratio * timeRange;
								const x = padding.left + ratio * innerWidth;
								return (
									<text
										key={ratio}
										x={x}
										y={chartHeight - padding.bottom + 20}
										fill="rgba(255, 255, 255, 0.6)"
										fontSize="12"
										textAnchor="middle"
									>
										{new Date(time).toLocaleDateString("en-US", {
											month: "short",
											day: "numeric",
										})}
									</text>
								);
							})}
						</g>

						{/* Axis labels */}
						<text
							x={chartWidth / 2}
							y={chartHeight - 10}
							fill="rgba(255, 255, 255, 0.8)"
							fontSize="14"
							fontWeight="bold"
							textAnchor="middle"
						>
							Time
						</text>
						<text
							x={15}
							y={chartHeight / 2}
							fill="rgba(255, 255, 255, 0.8)"
							fontSize="14"
							fontWeight="bold"
							textAnchor="middle"
							transform={`rotate(-90, 15, ${chartHeight / 2})`}
						>
							Price (USD)
						</text>
					</svg>
				</div>

				{/* Legend */}
				<div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-dark-700">
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 bg-green-500 rounded-full"></div>
						<span className="text-sm text-dark-300">Buy Trade</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 bg-red-500 rounded-full"></div>
						<span className="text-sm text-dark-300">Sell Trade</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-8 h-0.5 bg-gradient-to-r from-accent-cyan to-primary-500"></div>
						<span className="text-sm text-dark-300">Price History</span>
					</div>
				</div>
			</div>

			{/* Selected/Hovered Trade Details */}
			{(selectedTrade || hoveredTrade) && (
				<div className="bg-dark-900/95 backdrop-blur-sm border border-accent-cyan/30 rounded-2xl shadow-glow p-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
					<div className="flex items-start justify-between mb-4">
						<div className="flex items-center gap-3">
							<div
								className={`w-12 h-12 rounded-full flex items-center justify-center ${
									(selectedTrade || hoveredTrade)!.type === "buy"
										? "bg-green-500/20 border border-green-500/50"
										: "bg-red-500/20 border border-red-500/50"
								}`}
							>
								<svg
									className="w-6 h-6 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									{(selectedTrade || hoveredTrade)!.type === "buy" ? (
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
										/>
									) : (
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
										/>
									)}
								</svg>
							</div>
							<div>
								<h3 className="text-xl font-bold text-white capitalize">
									{(selectedTrade || hoveredTrade)!.type} Trade
								</h3>
								<p className="text-sm text-dark-400">
									{formatDate((selectedTrade || hoveredTrade)!.timestamp)}
								</p>
							</div>
						</div>
						{selectedTrade && (
							<button
								onClick={() => setSelectedTrade(null)}
								className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
							>
								<svg
									className="w-5 h-5 text-dark-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						)}
					</div>

					<div className="grid grid-cols-2 gap-4 mb-4">
						<div className="bg-dark-800/50 rounded-lg p-4">
							<p className="text-xs text-dark-400 mb-1">Shares</p>
							<p className="text-lg font-bold text-white">
								{(selectedTrade || hoveredTrade)!.shares.toLocaleString()}
							</p>
						</div>
						<div className="bg-dark-800/50 rounded-lg p-4">
							<p className="text-xs text-dark-400 mb-1">Price per Share</p>
							<p className="text-lg font-bold text-accent-cyan">
								{formatCurrency(
									(selectedTrade || hoveredTrade)!.price_per_share
								)}
							</p>
						</div>
						<div className="bg-dark-800/50 rounded-lg p-4">
							<p className="text-xs text-dark-400 mb-1">Total Amount</p>
							<p className="text-lg font-bold text-white">
								{formatCurrency(
									Math.abs((selectedTrade || hoveredTrade)!.amount)
								)}
							</p>
						</div>
						<div className="bg-dark-800/50 rounded-lg p-4">
							<p className="text-xs text-dark-400 mb-1">Price at Time</p>
							<p className="text-lg font-bold text-white">
								{formatCurrency((selectedTrade || hoveredTrade)!.priceAtTime)}
							</p>
						</div>
					</div>

					{(selectedTrade || hoveredTrade)!.note && (
						<div className="bg-dark-800/50 rounded-lg p-4">
							<p className="text-xs text-dark-400 mb-2 font-medium">
								Investor's Note:
							</p>
							<p className="text-white leading-relaxed">
								"{(selectedTrade || hoveredTrade)!.note}"
							</p>
						</div>
					)}
				</div>
			)}

			{/* All Trades with Notes */}
			<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow p-6">
				<h3 className="text-xl font-bold text-white mb-4">
					All Trades with Notes ({trades.length})
				</h3>

				{trades.length === 0 ? (
					<div className="text-center py-8">
						<div className="text-dark-400">No trades with notes yet</div>
						<p className="text-dark-500 text-sm mt-2">
							Investor notes will appear here when they add them during trades
						</p>
					</div>
				) : (
					<div className="space-y-3 max-h-96 overflow-y-auto">
						{trades.map((trade) => (
							<div
								key={trade.id}
								onClick={() => setSelectedTrade(trade)}
								className={`p-4 rounded-lg border transition-all cursor-pointer ${
									selectedTrade?.id === trade.id
										? "bg-dark-700 border-accent-cyan/50"
										: "bg-dark-800/50 border-dark-700 hover:bg-dark-700 hover:border-dark-600"
								}`}
							>
								<div className="flex items-start gap-3">
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
											trade.type === "buy"
												? "bg-green-500/20 text-green-400"
												: "bg-red-500/20 text-red-400"
										}`}
									>
										{trade.type === "buy" ? "↑" : "↓"}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between mb-1">
											<span className="text-white font-semibold capitalize">
												{trade.type}
											</span>
											<span className="text-xs text-dark-400">
												{formatDate(trade.timestamp)}
											</span>
										</div>
										<p className="text-sm text-dark-300 mb-2">
											{trade.shares.toLocaleString()} shares @{" "}
											{formatCurrency(trade.price_per_share)}
										</p>
										<p className="text-sm text-dark-400 italic line-clamp-2">
											"{trade.note}"
										</p>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};
