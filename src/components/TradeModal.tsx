import React, { useState, useEffect } from "react";
import { FounderWithPrice, Founder } from "../types/Founder";
import { supabase, supabaseUrl } from "../lib/supabaseClient";
import {
	simulateBuyTrade,
	simulateSellTrade,
	calculateCurrentPrice,
	calculateMarketCap,
} from "../lib/ammEngine";

interface TradeModalProps {
	isOpen: boolean;
	onClose: () => void;
	founder: FounderWithPrice;
	investorId: string;
	investorBalance: number;
	onTradeComplete?: () => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({
	isOpen,
	onClose,
	founder,
	investorId,
	investorBalance,
	onTradeComplete,
}) => {
	const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
	const [shares, setShares] = useState<number>(10);
	const [note, setNote] = useState<string>("");
	const [estimatedCost, setEstimatedCost] = useState<number>(0);
	const [resultingPrice, setResultingPrice] = useState<number>(0);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [investorShares, setInvestorShares] = useState<number>(0);
	// Track real-time founder updates
	const [currentFounder, setCurrentFounder] =
		useState<FounderWithPrice>(founder);
	const [isEventActiveServer, setIsEventActiveServer] = useState<
		boolean | null
	>(null);
	const [checkingStatus, setCheckingStatus] = useState<boolean>(false);

	// Reset state when founder changes
	useEffect(() => {
		setTradeType("buy");
		setShares(10);
		setNote("");
		setError(null);
		setSuccessMessage(null);
		setCurrentFounder(founder);
		fetchInvestorShares();
	}, [founder.id, investorId]);

	// Set up real-time subscription for founder price updates
	useEffect(() => {
		if (!isOpen) return;

		console.log(
			`📡 Subscribing to real-time updates for founder: ${founder.name}`
		);

		const subscription = supabase
			.channel(`founder_${founder.id}_updates`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "founders",
					filter: `id=eq.${founder.id}`,
				},
				(payload) => {
					const updatedFounder = payload.new as Founder;
					console.log(`💹 Price update for ${founder.name}:`, {
						old_price: currentFounder.current_price,
						new_price: calculateCurrentPrice(updatedFounder),
					});

					setCurrentFounder({
						...updatedFounder,
						current_price: calculateCurrentPrice(updatedFounder),
						market_cap: calculateMarketCap(updatedFounder, 100000),
					});
				}
			)
			.subscribe((status) => {
				console.log(`🔌 Subscription status for ${founder.name}:`, status);
			});

		// Clean up subscription when modal closes or founder changes
		return () => {
			console.log(`🔌 Unsubscribing from ${founder.name} updates`);
			supabase.removeChannel(subscription);
		};
	}, [founder.id, isOpen]);

	// Determine active status from latest event record
	const computeIsActive = (evt: any) => {
		return evt.status === "active";
	};

	// Verify with backend that the event is still active
	const verifyEventIsActiveLatest = async (): Promise<boolean> => {
		try {
			setCheckingStatus(true);
			const { data, error } = await supabase
				.from("events")
				.select("*")
				.eq("id", currentFounder.event_id)
				.single();
			if (error || !data) {
				setIsEventActiveServer(false);
				return false;
			}
			const active = computeIsActive(data);
			setIsEventActiveServer(active);
			return active;
		} finally {
			setCheckingStatus(false);
		}
	};

	// Check status when modal opens or founder changes
	useEffect(() => {
		if (!isOpen) return;
		verifyEventIsActiveLatest();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, currentFounder.event_id]);

	// Fetch how many shares the investor owns of this founder
	const fetchInvestorShares = async () => {
		try {
			const response = await fetch(
				`${supabaseUrl}/rest/v1/investor_holdings?investor_id=eq.${investorId}&founder_id=eq.${founder.id}`,
				{
					method: "GET",
					headers: {
						apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
						"Content-Type": "application/json",
					},
				}
			);

			const data = await response.json();

			if (data && data.length > 0) {
				setInvestorShares(Number(data[0].shares));
			} else {
				setInvestorShares(0);
			}
		} catch (err) {
			console.error("Error fetching investor shares:", err);
			setInvestorShares(0);
		}
	};

	// Calculate max shares for buy
	const calculateMaxBuyShares = () => {
		// Binary search to find maximum shares that can be bought with available balance
		let low = 0;
		let high = 10000; // reasonable upper limit
		let maxShares = 0;

		while (low <= high) {
			const mid = Math.floor((low + high) / 2);
			const { cost, error: simulationError } = simulateBuyTrade(
				currentFounder,
				mid
			);

			if (!simulationError && cost <= investorBalance) {
				maxShares = mid;
				low = mid + 1;
			} else {
				high = mid - 1;
			}
		}

		return maxShares;
	};

	// Handler for buy-max button
	const handleBuyMax = () => {
		const maxShares = calculateMaxBuyShares();
		setShares(maxShares);
	};

	// Handler for sell-max button
	const handleSellMax = () => {
		setShares(investorShares);
	};

	// Update cost estimate when shares or trade type changes
	useEffect(() => {
		if (shares <= 0) {
			setEstimatedCost(0);
			setResultingPrice(0);
			return;
		}

		if (tradeType === "buy") {
			const {
				cost,
				resultingPrice,
				error: simulationError,
			} = simulateBuyTrade(currentFounder, shares);
			if (simulationError) {
				setError(simulationError);
				setEstimatedCost(0);
				setResultingPrice(0);
			} else {
				setError(null);
				setEstimatedCost(cost);
				setResultingPrice(resultingPrice);
			}
		} else {
			const {
				payout,
				resultingPrice,
				error: simulationError,
			} = simulateSellTrade(currentFounder, shares);
			if (simulationError) {
				setError(simulationError);
				setEstimatedCost(0);
				setResultingPrice(0);
			} else {
				setError(null);
				setEstimatedCost(payout);
				setResultingPrice(resultingPrice);
			}
		}
	}, [shares, tradeType, currentFounder, investorBalance]);

	// Execute trade
	const handleTrade = async () => {
		if (shares <= 0) {
			setError("Please enter a valid number of shares");
			return;
		}

		// Require a note explaining the trade
		const trimmedNote = note.trim();
		if (!trimmedNote) {
			setError("Please add a brief note explaining your trade");
			return;
		}

		// Server-verify event status right before executing trade
		const canTradeNow = await verifyEventIsActiveLatest();
		if (!canTradeNow) {
			setError("Trading has closed for this event");
			return;
		}

		// For buy trades, check if investor has enough balance
		if (tradeType === "buy" && estimatedCost > investorBalance) {
			setError("Insufficient balance to complete this trade");
			return;
		}

		// For sell trades, check if investor has enough shares
		if (tradeType === "sell" && shares > investorShares) {
			setError("You don't own enough shares to sell");
			return;
		}

		setIsLoading(true);
		setError(null);
		setSuccessMessage(null);

		try {
			// Use the authenticated user's access token when available
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const accessToken =
				session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

			// Call executeTrade edge function
			const response = await fetch(`${supabaseUrl}/functions/v1/executeTrade`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({
					investor_id: investorId,
					founder_id: founder.id,
					shares,
					type: tradeType,
					event_id: founder.event_id,
					note: trimmedNote,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to execute trade");
			}

			// Update investor shares
			await fetchInvestorShares();

			// Show success message
			setSuccessMessage(
				tradeType === "buy"
					? `Successfully purchased ${shares} shares for $${estimatedCost.toFixed(
							2
					  )}`
					: `Successfully sold ${shares} shares for $${estimatedCost.toFixed(
							2
					  )}`
			);

			// Notify parent component
			if (onTradeComplete) {
				onTradeComplete();
			}
		} catch (err: any) {
			setError(err.message || "An error occurred while executing the trade");
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div className="card-dark p-4 md:p-6 max-w-md w-full shadow-glow-lg max-h-[90vh] overflow-y-auto">
				<h2 className="text-xl md:text-2xl font-bold mb-4 text-white">
					{tradeType === "buy" ? "Buy" : "Sell"} {currentFounder.name} Shares
				</h2>

				{/* Status banner */}
				{isEventActiveServer === false && (
					<div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg border border-red-500/50 text-sm">
						Trading has closed for this event
					</div>
				)}

				{/* Info Cards */}
				<div className="grid grid-cols-2 gap-3 mb-4">
					<div className="bg-dark-700 rounded-lg p-3 border border-dark-600 relative">
						<p className="text-xs text-dark-400 mb-1 flex items-center gap-1">
							Current Price
							<span
								className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"
								title="Live updates"
							></span>
						</p>
						<p className="text-lg md:text-xl font-bold text-accent-cyan">
							${currentFounder.current_price.toFixed(2)}
						</p>
					</div>
					<div className="bg-dark-700 rounded-lg p-3 border border-dark-600">
						<p className="text-xs text-dark-400 mb-1">Shares Owned</p>
						<p className="text-lg md:text-xl font-bold text-white">
							{investorShares.toLocaleString()}
						</p>
					</div>
				</div>

				{/* Buy/Sell Toggle */}
				<div className="mb-4">
					<div className="flex justify-between mb-2">
						<button
							className={`py-2 px-4 rounded-l-lg w-1/2 transition-all text-sm md:text-base ${
								tradeType === "buy"
									? "bg-green-600 text-white shadow-glow"
									: "bg-dark-700 text-dark-300"
							}`}
							onClick={() => setTradeType("buy")}
						>
							Buy
						</button>
						<button
							className={`py-2 px-4 rounded-r-lg w-1/2 transition-all text-sm md:text-base ${
								tradeType === "sell"
									? "bg-red-600 text-white shadow-glow"
									: "bg-dark-700 text-dark-300"
							}`}
							onClick={() => setTradeType("sell")}
							disabled={investorShares <= 0}
						>
							Sell
						</button>
					</div>

					{tradeType === "sell" && investorShares <= 0 && (
						<p className="text-red-400 text-sm mb-2">
							You don't own any shares to sell
						</p>
					)}
				</div>

				{/* Shares Input with Max Buttons */}
				<div className="mb-4">
					<label className="block text-white mb-2 text-sm md:text-base">
						Number of Shares
					</label>
					<div className="flex gap-2">
						<input
							type="number"
							min="1"
							max={tradeType === "sell" ? investorShares : undefined}
							value={shares}
							onChange={(e) => setShares(parseInt(e.target.value))}
							className="input-dark flex-1"
						/>
						{tradeType === "buy" ? (
							<button
								onClick={handleBuyMax}
								className="px-3 md:px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-all text-xs md:text-sm whitespace-nowrap"
							>
								Buy Max
							</button>
						) : (
							<button
								onClick={handleSellMax}
								disabled={investorShares <= 0}
								className="px-3 md:px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-all text-xs md:text-sm whitespace-nowrap disabled:bg-dark-700 disabled:text-dark-500"
							>
								Sell Max
							</button>
						)}
					</div>
				</div>

				{/* Note Input */}
				<div className="mb-4">
					<label className="block text-white mb-2 text-sm md:text-base">
						Note (Required)
					</label>
					<textarea
						value={note}
						onChange={(e) => setNote(e.target.value)}
						placeholder={`Why are you ${
							tradeType === "buy" ? "buying" : "selling"
						}? (e.g., "Strong pitch presentation", "Concerned about market fit")`}
						className="input-dark w-full min-h-[80px] resize-y"
						required
						maxLength={500}
					/>
					<p className="text-xs text-dark-400 mt-1">
						{note.length}/500 characters
					</p>
					{note.trim().length === 0 && (
						<p className="text-xs text-red-400 mt-1">
							A brief note is required
						</p>
					)}
				</div>

				{/* Trade Summary */}
				{shares > 0 && (
					<div className="mb-4 p-3 md:p-4 bg-dark-700 rounded-lg border border-dark-600">
						<div className="flex justify-between mb-2 text-sm md:text-base">
							<span className="text-dark-300">
								{tradeType === "buy" ? "Estimated Cost" : "Estimated Payout"}
							</span>
							<span className="font-bold text-accent-cyan">
								${estimatedCost.toFixed(2)}
							</span>
						</div>

						<div className="flex justify-between text-sm md:text-base">
							<span className="text-dark-300">Resulting Price</span>
							<span className="font-bold text-white">
								${resultingPrice.toFixed(2)}
							</span>
						</div>

						{tradeType === "buy" && estimatedCost > investorBalance && (
							<p className="text-red-400 text-xs md:text-sm mt-2">
								⚠️ Insufficient balance to complete this trade
							</p>
						)}
					</div>
				)}

				{/* Error Message */}
				{error && (
					<div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg border border-red-500/50 text-sm">
						{error}
					</div>
				)}

				{/* Success Message */}
				{successMessage && (
					<div className="mb-4 p-3 bg-green-500/20 text-green-400 rounded-lg border border-green-500/50 text-sm">
						✓ {successMessage}
					</div>
				)}

				{/* Action Buttons */}
				<div className="flex justify-end mt-6 gap-2">
					<button
						onClick={onClose}
						className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-all border border-dark-600 text-sm md:text-base"
					>
						Cancel
					</button>

					<button
						onClick={handleTrade}
						disabled={
							isLoading ||
							shares <= 0 ||
							(tradeType === "buy" && estimatedCost > investorBalance) ||
							(tradeType === "sell" && shares > investorShares) ||
							isEventActiveServer === false ||
							checkingStatus ||
							note.trim().length === 0
						}
						className={`px-4 py-2 rounded-lg font-medium transition-all text-sm md:text-base ${
							isLoading ||
							shares <= 0 ||
							(tradeType === "buy" && estimatedCost > investorBalance) ||
							(tradeType === "sell" && shares > investorShares) ||
							isEventActiveServer === false ||
							checkingStatus ||
							note.trim().length === 0
								? "bg-dark-600 text-dark-400 cursor-not-allowed"
								: tradeType === "buy"
								? "bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-glow"
								: "bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-glow"
						}`}
					>
						{isLoading || checkingStatus ? "Processing..." : "Confirm Trade"}
					</button>
				</div>
			</div>
		</div>
	);
};
