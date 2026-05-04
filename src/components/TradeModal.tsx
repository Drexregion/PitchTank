import React, { useState, useEffect, useRef } from "react";
import { PitchWithPrice } from "../types/Pitch";
import { supabase, supabaseUrl } from "../lib/supabaseClient";
import {
	simulateBuyTrade,
	simulateSellTrade,
} from "../lib/ammEngine";
import { useEventData } from "../contexts/EventDataContext";

interface TradeModalProps {
	isOpen: boolean;
	onClose: () => void;
	founder: PitchWithPrice;
	investorId: string;
	investorBalance: number;
	onTradeComplete?: () => void;
	simpleMode?: boolean;
	initialTradeType?: "buy" | "sell";
	initialShares?: number;
}

export const TradeModal: React.FC<TradeModalProps> = ({
	isOpen,
	onClose,
	founder,
	investorId,
	investorBalance,
	onTradeComplete,
	simpleMode = false,
	initialTradeType = "buy",
	initialShares = 0,
}) => {
	const { pitches, event } = useEventData();

	// Always use the live pitch from context so AMM price reflects other trades
	const currentFounder: PitchWithPrice =
		(pitches.find((f) => f.id === founder.id) as PitchWithPrice | undefined) ?? founder;

	const [tradeType, setTradeType] = useState<"buy" | "sell">(initialTradeType);
	const [dollarInput, setDollarInput] = useState<string>("100");
	const dollarAmount = Math.max(0, parseFloat(dollarInput) || 0);
	const [note, setNote] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [investorShares, setInvestorShares] = useState<number>(initialShares);
	const isSubmittingRef = useRef(false);

	const isEventActiveServer = event?.status === "active" ? null : false;

	useEffect(() => {
		setTradeType(initialTradeType);
		setDollarInput("100");
		setNote("");
		setError(null);
		setSuccessMessage(null);
	}, [founder.id, investorId, initialTradeType]);

	useEffect(() => {
		setInvestorShares(initialShares);
	}, [initialShares]);

	// Buy: binary search for max shares with cost ≤ amount
	const computeBuyResult = (
		amount: number,
	): { shares: number; actualCost: number; remainder: number } => {
		let low = 0,
			high = 50000,
			maxShares = 0,
			actualCost = 0;
		while (low <= high) {
			const mid = Math.floor((low + high) / 2);
			if (mid === 0) {
				low = mid + 1;
				continue;
			}
			const { cost, error: simError } = simulateBuyTrade(currentFounder, mid);
			if (!simError && cost <= amount) {
				maxShares = mid;
				actualCost = cost;
				low = mid + 1;
			} else {
				high = mid - 1;
			}
		}
		return { shares: maxShares, actualCost, remainder: amount - actualCost };
	};

	// Sell: compute shares from dollar target, then simulate AMM payout
	const computeSellResult = (
		amount: number,
	): {
		shares: number;
		proceeds: number;
		sharesRemaining: number;
		resultingPrice: number;
	} | null => {
		if (currentFounder.current_price <= 0) return null;
		const sharesToSell = Math.min(
			Math.floor(amount / currentFounder.current_price),
			investorShares,
		);
		if (sharesToSell <= 0) return null;
		const {
			payout,
			resultingPrice,
			error: simError,
		} = simulateSellTrade(currentFounder, sharesToSell);
		if (simError) return null;
		return {
			shares: sharesToSell,
			proceeds: payout,
			sharesRemaining: investorShares - sharesToSell,
			resultingPrice,
		};
	};

	const buyResult = tradeType === "buy" ? computeBuyResult(dollarAmount) : null;
	const sellResult =
		tradeType === "sell" ? computeSellResult(dollarAmount) : null;

	const handleBuyMax = () =>
		setDollarInput(String(Math.floor(investorBalance)));
	const handleSellMax = () => {
		const allSharesValue = investorShares * currentFounder.current_price;
		setDollarInput(String(Math.floor(allSharesValue)));
	};

	const handleTrade = async () => {
		if (isSubmittingRef.current) return;
		isSubmittingRef.current = true;

		const trimmedNote = note.trim();
		if (!trimmedNote) {
			setError("Please add a brief note explaining your trade");
			isSubmittingRef.current = false;
			return;
		}

		if (tradeType === "buy") {
			if (dollarAmount <= 0) {
				setError("Please enter a valid amount");
				isSubmittingRef.current = false;
				return;
			}
			if (dollarAmount > investorBalance) {
				setError("Insufficient balance");
				isSubmittingRef.current = false;
				return;
			}
			if ((buyResult?.shares ?? 0) <= 0) {
				setError("Amount too small to purchase any shares");
				isSubmittingRef.current = false;
				return;
			}
		} else {
			if (!sellResult || sellResult.shares <= 0) {
				setError("Please enter a valid amount to sell");
				isSubmittingRef.current = false;
				return;
			}
		}

		if (event?.status !== "active") {
			setError("Trading has closed for this event");
			isSubmittingRef.current = false;
			return;
		}

		setIsLoading(true);
		setError(null);
		setSuccessMessage(null);

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const accessToken =
				session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

			const sharesToTrade =
				tradeType === "buy"
					? (buyResult?.shares ?? 0)
					: (sellResult?.shares ?? 0);

			const response = await fetch(
				`${supabaseUrl}/functions/v1/executeTrade`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${accessToken}`,
					},
					body: JSON.stringify({
						investor_id: investorId,
						pitch_id: founder.id,
						shares: sharesToTrade,
						type: tradeType,
						event_id: founder.event_id,
						note: trimmedNote,
					}),
				},
			);

			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Failed to execute trade");

			setSuccessMessage(
				tradeType === "buy"
					? `Successfully purchased ${sharesToTrade.toLocaleString()} shares for $${(buyResult?.actualCost ?? 0).toFixed(2)}`
					: `Successfully sold ${sharesToTrade.toLocaleString()} shares for $${(sellResult?.proceeds ?? 0).toFixed(2)}`,
			);

			if (onTradeComplete) onTradeComplete();
		} catch (err: any) {
			setError(err.message || "An error occurred while executing the trade");
		} finally {
			setIsLoading(false);
			isSubmittingRef.current = false;
		}
	};

	if (!isOpen) return null;

	const isConfirmDisabled = (() => {
		if (
			isLoading ||
			isEventActiveServer === false ||
			!note.trim()
		)
			return true;
		if (tradeType === "buy")
			return (
				dollarAmount <= 0 ||
				dollarAmount > investorBalance ||
				(buyResult?.shares ?? 0) <= 0
			);
		return !sellResult || sellResult.shares <= 0;
	})();

	const showOrderPreview =
		dollarAmount > 0 &&
		((tradeType === "buy" && (buyResult?.shares ?? 0) > 0) ||
			(tradeType === "sell" && (sellResult?.shares ?? 0) > 0));

	return (
		<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
			<div
				className="w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl overflow-y-auto"
				style={{
					background: "linear-gradient(180deg, #13102e 0%, #0d0b22 100%)",
					border: "1px solid rgba(255,255,255,0.08)",
					maxHeight: "92vh",
				}}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3">
					<div className="flex-1 min-w-0">
						<p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-1">
							Market ticket
						</p>
						<h2 className="text-xl font-black text-white uppercase leading-tight">
							{tradeType === "buy" ? "Buy" : "Sell"} {currentFounder.name} Shares
						</h2>
					</div>
					<div className="flex items-center gap-2 flex-shrink-0 mt-1">
						<span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/30 flex items-center gap-1.5 flex-shrink-0">
							LIVE
							<span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
						</span>
						<button
							onClick={onClose}
							className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
							style={{
								background: "rgba(255,255,255,0.06)",
								border: "1px solid rgba(255,255,255,0.1)",
							}}
						>
							<svg
								className="w-3.5 h-3.5 text-white/50"
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
					</div>
				</div>

				{/* Info Cards */}
				<div className="px-6 pb-4 grid grid-cols-2 gap-3">
					<div
						className="rounded-2xl px-4 py-3"
						style={{
							background: "rgba(255,255,255,0.04)",
							border: "1px solid rgba(255,255,255,0.06)",
						}}
					>
						<p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
							Available Balance
						</p>
						<p className="text-cyan-400 font-black text-xl tabular-nums leading-none">
							$
							{investorBalance.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
						</p>
					</div>
					<div
						className="rounded-2xl px-4 py-3"
						style={{
							background: "rgba(255,255,255,0.04)",
							border: "1px solid rgba(255,255,255,0.06)",
						}}
					>
						<p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
							Shares Owned
						</p>
						<p className="text-white font-black text-xl tabular-nums leading-none">
							{investorShares.toLocaleString()}
						</p>
					</div>
				</div>

				{/* Buy/Sell Toggle */}
				<div className="px-6 pb-4">
					<div
						className="grid grid-cols-2 rounded-2xl overflow-hidden"
						style={{
							border: "1px solid rgba(255,255,255,0.08)",
							background: "rgba(255,255,255,0.03)",
						}}
					>
						<button
							onClick={() => setTradeType("buy")}
							className={`py-3.5 flex items-center justify-center gap-2 font-bold text-sm transition-all ${
								tradeType === "buy" ? "text-white" : "text-white/35 hover:text-white/60"
							}`}
							style={
								tradeType === "buy"
									? {
											background:
												"linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",
											boxShadow: "0 0 20px rgba(34,211,238,0.25)",
										}
									: {}
							}
						>
							<svg
								className="w-3 h-3"
								fill="currentColor"
								viewBox="0 0 24 24"
							>
								<path d="M12 4L4 16h16L12 4z" />
							</svg>
							BUY
						</button>
						<button
							onClick={() => investorShares > 0 && setTradeType("sell")}
							className={`py-3.5 flex items-center justify-center gap-2 font-bold text-sm transition-all ${
								tradeType === "sell"
									? "text-white"
									: investorShares <= 0
										? "text-white/20 cursor-not-allowed"
										: "text-white/35 hover:text-white/60"
							}`}
							style={
								tradeType === "sell"
									? {
											background:
												"linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
											boxShadow: "0 0 20px rgba(249,115,22,0.25)",
										}
									: {}
							}
						>
							<svg
								className="w-3 h-3"
								fill="currentColor"
								viewBox="0 0 24 24"
							>
								<path d="M12 20L4 8h16L12 20z" />
							</svg>
							SELL
						</button>
					</div>
				</div>

				{/* Dollar Amount Input */}
				<div className="px-6 pb-4">
					<p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3">
						Amount to {tradeType === "buy" ? "Buy" : "Sell"} ($)
					</p>
					<div className="flex gap-3">
						<div
							className="flex-1 flex items-center rounded-2xl overflow-hidden"
							style={{
								background: "rgba(255,255,255,0.05)",
								border: `1px solid ${tradeType === "buy" ? "rgba(34,211,238,0.3)" : "rgba(249,115,22,0.3)"}`,
							}}
						>
							<span className="pl-4 text-white/40 font-bold text-lg select-none">
								$
							</span>
							<input
								type="text"
								inputMode="numeric"
								value={dollarInput}
								onChange={(e) =>
									setDollarInput(
										e.target.value
											.replace(/[^0-9]/g, "")
											.replace(/^0+(?=\d)/, ""),
									)
								}
								className="flex-1 bg-transparent px-3 py-4 text-white font-bold text-lg outline-none"
								style={{ caretColor: tradeType === "buy" ? "#22d3ee" : "#f97316" }}
							/>
						</div>
						<button
							onClick={tradeType === "buy" ? handleBuyMax : handleSellMax}
							className="px-5 py-4 rounded-2xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 flex-shrink-0"
							style={
								tradeType === "buy"
									? {
											background:
												"linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",
											boxShadow: "0 0 15px rgba(34,211,238,0.2)",
										}
									: {
											background:
												"linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
											boxShadow: "0 0 15px rgba(249,115,22,0.2)",
										}
							}
						>
							{tradeType === "buy" ? "BUY MAX" : "SELL MAX"}
						</button>
					</div>
					{tradeType === "buy" && dollarAmount > investorBalance && (
						<p className="text-red-400 text-xs mt-2 flex items-center gap-1.5">
							<svg
								className="w-3.5 h-3.5 flex-shrink-0"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
							Exceeds your available balance
						</p>
					)}
				</div>

				{/* Order Preview */}
				<div className="px-6 pb-4">
					<div
						className="rounded-2xl p-4"
						style={{
							background: "rgba(255,255,255,0.04)",
							border: "1px solid rgba(255,255,255,0.06)",
						}}
					>
						<div className="flex items-center justify-between mb-3">
							<p className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest">
								Order Preview
							</p>
							<svg
								className="w-4 h-4 text-white/20"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
								/>
							</svg>
						</div>

						<div
							style={
								!showOrderPreview
									? { filter: "blur(4px)", userSelect: "none", pointerEvents: "none" }
									: {}
							}
						>
							{tradeType === "buy" ? (
								<div className="space-y-0 divide-y divide-white/5">
									{!simpleMode && (
										<div className="flex justify-between items-center text-sm py-2.5">
											<span className="text-white/50">Shares bought</span>
											<span className="text-white font-bold tabular-nums">
												{buyResult && buyResult.shares > 0 ? buyResult.shares.toLocaleString() : "—"}
											</span>
										</div>
									)}
									<div className="flex justify-between items-center text-sm py-2.5">
										<span className="text-white/50">Estimated cost</span>
										<span className="text-cyan-400 font-bold tabular-nums">
											{buyResult && buyResult.shares > 0 ? `$${buyResult.actualCost.toFixed(2)}` : "$—"}
										</span>
									</div>
									{buyResult && buyResult.remainder > 0.01 && (
										<div className="flex justify-between items-center text-sm py-2.5">
											<span className="text-white/50">Change returned</span>
											<span className="text-green-400 font-bold tabular-nums">
												${buyResult.remainder.toFixed(2)}
											</span>
										</div>
									)}
									<div className="flex justify-between items-center text-sm py-2.5">
										<span className="text-white/50">Remaining balance</span>
										<span className="text-white font-bold tabular-nums">
											{buyResult && buyResult.shares > 0
												? `$${(investorBalance - buyResult.actualCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
												: "$—"}
										</span>
									</div>
								</div>
							) : (
								<div className="space-y-0 divide-y divide-white/5">
									{!simpleMode && (
										<div className="flex justify-between items-center text-sm py-2.5">
											<span className="text-white/50">Shares sold</span>
											<span className="text-white font-bold tabular-nums">
												{sellResult ? sellResult.shares.toLocaleString() : "—"}
											</span>
										</div>
									)}
									<div className="flex justify-between items-center text-sm py-2.5">
										<span className="text-white/50">Estimated proceeds</span>
										<span
											className="font-bold tabular-nums"
											style={{ color: "#f97316" }}
										>
											{sellResult ? `$${sellResult.proceeds.toFixed(2)}` : "$—"}
										</span>
									</div>
									{!simpleMode && (
										<div className="flex justify-between items-center text-sm py-2.5">
											<span className="text-white/50">Shares remaining</span>
											<span className="text-white font-bold tabular-nums">
												{sellResult ? sellResult.sharesRemaining.toLocaleString() : "—"}
											</span>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Note Section */}
				<div className="px-6 pb-4">
					<div className="flex items-center gap-2 mb-1">
						<p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">
							Why this {tradeType}? (Required)
						</p>
						<svg
							className="w-3.5 h-3.5 text-white/25 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<p className="text-white/30 text-xs mb-3">
						Add a short reason for your {tradeType} order.
					</p>
					<textarea
						value={note}
						onChange={(e) => setNote(e.target.value)}
						placeholder={
							tradeType === "buy"
								? "e.g. Strong pitch, high growth potential..."
								: "e.g. Taking profits, reducing exposure, market cooling off..."
						}
						rows={3}
						maxLength={500}
						className="w-full rounded-2xl px-4 py-3.5 text-white text-sm resize-none outline-none transition-all placeholder:text-white/20"
						style={{
							background: "rgba(255,255,255,0.05)",
							border: "1px solid rgba(255,255,255,0.1)",
							caretColor: tradeType === "buy" ? "#22d3ee" : "#f97316",
						}}
					/>
					<div className="flex items-center justify-between mt-2">
						<div>
							{note.trim().length === 0 && (
								<div className="flex items-center gap-1.5">
									<svg
										className="w-3.5 h-3.5 text-orange-400 flex-shrink-0"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
									<p className="text-orange-400 text-xs font-medium">
										A short {tradeType} note is required.
									</p>
								</div>
							)}
						</div>
						<p className="text-white/25 text-[10px] tabular-nums flex-shrink-0">
							{note.length}/500
						</p>
					</div>
				</div>

				{/* Trading closed banner */}
				{isEventActiveServer === false && (
					<div
						className="mx-6 mb-4 p-3 rounded-2xl text-red-400 text-sm flex items-center gap-2"
						style={{
							background: "rgba(239,68,68,0.08)",
							border: "1px solid rgba(239,68,68,0.3)",
						}}
					>
						<svg
							className="w-4 h-4 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
							/>
						</svg>
						Trading has closed for this event
					</div>
				)}

				{/* Error */}
				{error && (
					<div
						className="mx-6 mb-4 p-3 rounded-2xl text-red-400 text-sm flex items-center gap-2"
						style={{
							background: "rgba(239,68,68,0.08)",
							border: "1px solid rgba(239,68,68,0.3)",
						}}
					>
						<svg
							className="w-4 h-4 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						{error}
					</div>
				)}

				{/* Success */}
				{successMessage && (
					<div
						className="mx-6 mb-4 p-3 rounded-2xl text-green-400 text-sm flex items-center gap-2"
						style={{
							background: "rgba(34,197,94,0.08)",
							border: "1px solid rgba(34,197,94,0.3)",
						}}
					>
						<svg
							className="w-4 h-4 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						{successMessage}
					</div>
				)}

				{/* Action Buttons */}
				<div className="px-6 pb-8 grid grid-cols-2 gap-3">
					<button
						onClick={onClose}
						className="py-4 rounded-2xl font-bold text-sm text-white/60 transition-all hover:text-white/80 active:scale-[0.98]"
						style={{
							background: "rgba(255,255,255,0.06)",
							border: "1px solid rgba(255,255,255,0.1)",
						}}
					>
						CANCEL
					</button>
					<button
						onClick={handleTrade}
						disabled={isConfirmDisabled}
						className="py-4 rounded-2xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
						style={
							!isConfirmDisabled
								? {
										background:
											tradeType === "buy"
												? "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)"
												: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
										boxShadow:
											tradeType === "buy"
												? "0 0 20px rgba(34,211,238,0.3)"
												: "0 0 20px rgba(249,115,22,0.3)",
									}
								: { background: "rgba(255,255,255,0.06)" }
						}
					>
						{isLoading ? (
							"Processing..."
						) : (
							<>
								CONFIRM {tradeType === "buy" ? "PURCHASE" : "SALE"}
								<svg
									className="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2.5}
										d="M13 7l5 5m0 0l-5 5m5-5H6"
									/>
								</svg>
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
};
