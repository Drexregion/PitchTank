import React, { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ClipboardList, Info, Loader2, X } from "lucide-react";
import { PitchWithPrice } from "../types/Pitch";
import { supabase, supabaseUrl } from "../lib/supabaseClient";
import { simulateBuyTrade, simulateSellTrade } from "../lib/ammEngine";
import { useEventData } from "../contexts/EventDataContext";
import { GlassCard } from "./design-system/GlassCard";
import { Button } from "./design-system/Button";
import { IconButton } from "./design-system/IconButton";
import { Money } from "./design-system/Money";

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

type SubmitState = "idle" | "submitting" | "sent";

function formatShares(value: number): string {
	return value.toLocaleString("en-US");
}

function formatCompact(value: number): string {
	if (Math.abs(value) >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 2)}M`;
	}
	if (Math.abs(value) >= 10_000) {
		return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
	}
	return value.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function StatTile({
	label,
	children,
	tone,
}: {
	label: string;
	children: ReactNode;
	tone?: "cyan" | "orange";
}) {
	const valueClass =
		tone === "cyan"
			? "trade-dialog-stat-cyan"
			: tone === "orange"
				? "trade-dialog-stat-orange"
				: "trade-dialog-stat-value";
	return (
		<div className="trade-dialog-stat">
			<div className="trade-dialog-label">{label}</div>
			<div className={valueClass}>{children}</div>
		</div>
	);
}

function PreviewRow({
	label,
	value,
	tone,
}: {
	label: string;
	value: ReactNode;
	tone?: "buy" | "sell" | "positive";
}) {
	const valueColor =
		tone === "buy"
			? "text-pt-cyan"
			: tone === "sell"
				? "text-pt-orange"
				: tone === "positive"
					? "text-[#21FFA6]"
					: "text-white";
	return (
		<div className="trade-dialog-preview-row">
			<span>{label}</span>
			<span className={valueColor}>{value}</span>
		</div>
	);
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
		(pitches.find((f) => f.id === founder.id) as PitchWithPrice | undefined) ??
		founder;

	const [tradeType, setTradeType] = useState<"buy" | "sell">(initialTradeType);
	const [dollarInput, setDollarInput] = useState<string>("100");
	const dollarAmount = Math.max(0, parseFloat(dollarInput) || 0);
	const [note, setNote] = useState<string>("");
	const [noteTouched, setNoteTouched] = useState(false);
	const [submitAttempted, setSubmitAttempted] = useState(false);
	const [submitState, setSubmitState] = useState<SubmitState>("idle");
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [investorShares, setInvestorShares] = useState<number>(initialShares);
	const isSubmittingRef = useRef(false);
	const noteId = useId();
	const noteErrorId = useId();
	const amountId = useId();

	const isEventActiveServer = event?.status === "active" ? null : false;
	const isBuy = tradeType === "buy";

	useEffect(() => {
		setTradeType(initialTradeType);
		setDollarInput("100");
		setNote("");
		setNoteTouched(false);
		setSubmitAttempted(false);
		setSubmitState("idle");
		setError(null);
		setSuccessMessage(null);
	}, [founder.id, investorId, initialTradeType]);

	useEffect(() => {
		setInvestorShares(initialShares);
	}, [initialShares]);

	// Lock body scroll + close on Escape
	useEffect(() => {
		if (!isOpen) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && submitState !== "submitting") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", onKey);
		};
	}, [isOpen, onClose, submitState]);

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

	const buyResult = isBuy ? computeBuyResult(dollarAmount) : null;
	const sellResult = !isBuy ? computeSellResult(dollarAmount) : null;

	const handleMax = () => {
		if (isBuy) {
			setDollarInput(String(Math.floor(investorBalance)));
		} else {
			const allSharesValue = investorShares * currentFounder.current_price;
			setDollarInput(String(Math.floor(allSharesValue)));
		}
	};

	const handleTrade = async () => {
		if (isSubmittingRef.current) return;
		setSubmitAttempted(true);

		const trimmedNote = note.trim();
		if (!trimmedNote) {
			setError(`A short ${tradeType} note is required`);
			return;
		}

		if (isBuy) {
			if (dollarAmount <= 0) {
				setError("Please enter a valid amount");
				return;
			}
			if (dollarAmount > investorBalance) {
				setError("Insufficient balance");
				return;
			}
			if ((buyResult?.shares ?? 0) <= 0) {
				setError("Amount too small to purchase any shares");
				return;
			}
		} else {
			if (!sellResult || sellResult.shares <= 0) {
				setError("Please enter a valid amount to sell");
				return;
			}
		}

		if (event?.status !== "active") {
			setError("Trading has closed for this event");
			return;
		}

		isSubmittingRef.current = true;
		setSubmitState("submitting");
		setError(null);
		setSuccessMessage(null);

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const accessToken =
				session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

			const sharesToTrade = isBuy
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
			if (!response.ok)
				throw new Error(data.error || "Failed to execute trade");

			setSuccessMessage(
				isBuy
					? `Successfully purchased ${sharesToTrade.toLocaleString()} shares for $${(buyResult?.actualCost ?? 0).toFixed(2)}`
					: `Successfully sold ${sharesToTrade.toLocaleString()} shares for $${(sellResult?.proceeds ?? 0).toFixed(2)}`,
			);
			setSubmitState("sent");

			if (onTradeComplete) {
				window.setTimeout(onTradeComplete, 720);
			}
		} catch (err: any) {
			setError(err.message || "An error occurred while executing the trade");
			setSubmitState("idle");
		} finally {
			isSubmittingRef.current = false;
		}
	};

	if (!isOpen) return null;

	const noteInvalid =
		(noteTouched || submitAttempted) && note.trim().length === 0;
	const isPending = submitState !== "idle";
	const isLoading = submitState === "submitting";

	const showOrderPreview =
		dollarAmount > 0 &&
		((isBuy && (buyResult?.shares ?? 0) > 0) ||
			(!isBuy && (sellResult?.shares ?? 0) > 0));

	const title = `${isBuy ? "BUY" : "SELL"} ${currentFounder.name.toUpperCase()} SHARES`;
	const titleParts = title.split(" ");
	const titleHead = titleParts.slice(0, -1).join(" ");
	const titleTail = titleParts[titleParts.length - 1] ?? "";

	const amountLabel = isBuy ? "Amount to commit ($)" : "Amount to sell ($)";
	const maxLabel = isBuy ? "Buy Max" : "Sell Max";
	const noteLabel = isBuy
		? "Why this trade? (required)"
		: "Why this sell? (required)";
	const noteHelp = isBuy
		? "Add a short reason for your trade."
		: "Add a short reason for your sell order.";
	const notePlaceholder = isBuy
		? "e.g. Strong pitch, clear market need, great traction..."
		: "e.g. Taking profits, reducing exposure, market cooling off...";
	const submitLabel = isBuy ? "Confirm Purchase" : "Confirm Sale";

	const handleOverlayClick = () => {
		if (submitState !== "submitting") onClose();
	};

	const isConfirmDisabled = (() => {
		if (isPending || isEventActiveServer === false) return true;
		if (note.trim().length === 0) return true;
		if (isBuy) {
			return (
				dollarAmount <= 0 ||
				dollarAmount > investorBalance ||
				(buyResult?.shares ?? 0) <= 0
			);
		}
		return !sellResult || sellResult.shares <= 0;
	})();

	const dialog = (
		<>
			<div
				className="trade-dialog-overlay"
				onClick={handleOverlayClick}
				aria-hidden="true"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={title}
				onClick={(e) => e.stopPropagation()}
			>
				<GlassCard tone="frame" size="lg" className="trade-dialog-content">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleTrade();
						}}
						className="trade-dialog-form"
					>
						<div className="trade-dialog-header">
							<h2 className="trade-dialog-title">
								{titleHead && (
									<>
										<span className="trade-dialog-title-text">
											{titleHead}
										</span>{" "}
									</>
								)}
								<span className="trade-dialog-title-tail">
									{titleTail}
									<span
										className="trade-dialog-live"
										aria-label="Live market"
									>
										<span className="trade-dialog-live-text">Live</span>
										<span aria-hidden className="trade-dialog-live-dot" />
									</span>
								</span>
							</h2>
							<IconButton
								type="button"
								size="md"
								aria-label="Close trade dialog"
								icon={<X strokeWidth={1.5} />}
								onClick={onClose}
								disabled={submitState === "submitting"}
							/>
						</div>

						<div className="trade-dialog-stats">
							<StatTile label="Available balance" tone="cyan">
								${formatCompact(investorBalance)}
							</StatTile>
							<StatTile label="Shares owned">
								{formatShares(investorShares)}
							</StatTile>
							<StatTile
								label="Current price"
								tone={isBuy ? "cyan" : "orange"}
							>
								<Money value={currentFounder.current_price} decimals={2} />
							</StatTile>
						</div>

						<div
							className="trade-dialog-side-switch"
							role="group"
							aria-label="Trade side"
						>
							<Button
								type="button"
								variant={isBuy ? "buy" : "secondary"}
								size="lg"
								aria-pressed={isBuy}
								className="w-full"
								onClick={() => setTradeType("buy")}
								disabled={isPending}
							>
								▲ Buy
							</Button>
							<Button
								type="button"
								variant={!isBuy ? "sell" : "secondary"}
								size="lg"
								aria-pressed={!isBuy}
								className="w-full"
								onClick={() => investorShares > 0 && setTradeType("sell")}
								disabled={isPending || investorShares <= 0}
							>
								▼ Sell
							</Button>
						</div>

						<div className="trade-dialog-field">
							<label htmlFor={amountId} className="trade-dialog-label">
								{amountLabel}
							</label>
							<div className="trade-dialog-amount-row" style={{ marginTop: 12 }}>
								<div
									className={`trade-dialog-input-shell ${isBuy ? "is-buy" : "is-sell"}`}
								>
									<span aria-hidden="true">$</span>
									<input
										id={amountId}
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
										disabled={isPending}
									/>
								</div>
								<Button
									type="button"
									variant={isBuy ? "buy" : "sell"}
									size="lg"
									className="trade-dialog-max"
									onClick={handleMax}
									disabled={isPending}
								>
									{maxLabel}
								</Button>
							</div>
							{isBuy && dollarAmount > investorBalance && (
								<div className="trade-dialog-error" style={{ marginTop: 8 }}>
									Exceeds your available balance
								</div>
							)}
						</div>

						<div className="trade-dialog-preview">
							<div className="trade-dialog-preview-head">
								<span>Order Preview</span>
								<ClipboardList
									aria-hidden="true"
									size={18}
									strokeWidth={1.5}
								/>
							</div>
							<div
								style={
									!showOrderPreview
										? {
												filter: "blur(4px)",
												userSelect: "none",
												pointerEvents: "none",
											}
										: undefined
								}
							>
								{isBuy ? (
									<>
										{!simpleMode && (
											<PreviewRow
												label="Shares received"
												value={
													buyResult && buyResult.shares > 0
														? formatShares(buyResult.shares)
														: "—"
												}
											/>
										)}
										<PreviewRow
											label="Estimated cost"
											value={
												buyResult && buyResult.shares > 0 ? (
													<Money value={buyResult.actualCost} />
												) : (
													"$—"
												)
											}
											tone="buy"
										/>
										{buyResult && buyResult.remainder > 0.01 && (
											<PreviewRow
												label="Change returned"
												value={<Money value={buyResult.remainder} />}
												tone="positive"
											/>
										)}
										<PreviewRow
											label="Remaining balance"
											value={
												buyResult && buyResult.shares > 0 ? (
													<Money
														value={investorBalance - buyResult.actualCost}
													/>
												) : (
													"$—"
												)
											}
										/>
									</>
								) : (
									<>
										{!simpleMode && (
											<PreviewRow
												label="Shares sold"
												value={
													sellResult ? formatShares(sellResult.shares) : "—"
												}
											/>
										)}
										<PreviewRow
											label="Estimated proceeds"
											value={
												sellResult ? <Money value={sellResult.proceeds} /> : "$—"
											}
											tone="sell"
										/>
										{!simpleMode && (
											<PreviewRow
												label="Shares remaining"
												value={
													sellResult
														? formatShares(sellResult.sharesRemaining)
														: "—"
												}
											/>
										)}
									</>
								)}
							</div>
						</div>

						<div className="trade-dialog-field">
							<div className="trade-dialog-note-head">
								<label htmlFor={noteId} className="trade-dialog-label">
									{noteLabel}
								</label>
								<Info aria-hidden="true" size={16} strokeWidth={1.5} />
							</div>
							<p className="trade-dialog-help">{noteHelp}</p>
							<textarea
								id={noteId}
								value={note}
								maxLength={500}
								placeholder={notePlaceholder}
								aria-invalid={noteInvalid}
								aria-describedby={noteInvalid ? noteErrorId : undefined}
								onBlur={() => setNoteTouched(true)}
								onChange={(e) => setNote(e.target.value)}
								className="trade-dialog-textarea"
								disabled={isPending}
							/>
							<div className="trade-dialog-note-meta">
								<div
									id={noteErrorId}
									aria-live="polite"
									className="trade-dialog-error"
								>
									{noteInvalid
										? `A short ${isBuy ? "trade" : "sell"} note is required.`
										: null}
								</div>
								<span className="trade-dialog-note-count num">
									{note.length}/500
								</span>
							</div>
						</div>

						{isEventActiveServer === false && (
							<div className="trade-dialog-banner is-error">
								Trading has closed for this event
							</div>
						)}

						{error && (
							<div className="trade-dialog-banner is-error">{error}</div>
						)}

						{successMessage && (
							<div className="trade-dialog-banner is-success">
								{successMessage}
							</div>
						)}

						<div className="trade-dialog-actions">
							<Button
								type="button"
								variant="secondary"
								size="lg"
								className="w-full"
								onClick={onClose}
								disabled={submitState === "submitting"}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant={isBuy ? "buy" : "sell"}
								size="lg"
								className="w-full trade-dialog-submit"
								data-state={submitState}
								disabled={isConfirmDisabled}
							>
								{submitState === "sent" ? (
									<span className="trade-dialog-submit-label">Done</span>
								) : (
									<>
										<span className="trade-dialog-submit-label">
											{submitLabel}
										</span>
										<span className="trade-dialog-submit-icon" aria-hidden>
											{isLoading ? (
												<Loader2
													size={18}
													strokeWidth={2}
													className="trade-dialog-spin"
												/>
											) : (
												<ArrowRight size={18} strokeWidth={1.5} />
											)}
										</span>
									</>
								)}
							</Button>
						</div>
					</form>
				</GlassCard>
			</div>
		</>
	);

	return createPortal(dialog, document.body);
};
