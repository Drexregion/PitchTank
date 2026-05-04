import React, { useState, useEffect, useRef } from "react";
import { Info, CircleHelp } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { TradeModal } from "../components/TradeModal";
import { LeaderboardPanel } from "../components/LeaderboardPanel";
import { QRShareModal } from "../components/QRShareModal";
import { ScannerModal } from "../components/ScannerModal";
import { FounderPriceChart } from "../components/FounderPriceChart";
import { FounderMarketCapChart } from "../components/FounderMarketCapChart";
import { SparklineWithButton } from "../components/SparklineChart";
import { PortfolioChart } from "../components/PortfolioChart";
import { ChatPanel } from "../components/ChatPanel";
import { SchedulePanel } from "../components/SchedulePanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { useAuth } from "../contexts/AuthContext";
import { usePortfolioHistory } from "../hooks/usePortfolioHistory";
import { Event, Judge, Sponsor } from "../types/Event";
import { PitchWithPriceAndUser } from "../types/Pitch";
import { EventDataProvider, useEventData } from "../contexts/EventDataContext";

// Reusable top-sheet with slide-in animation and drag-to-close
function useTopSheet(onClose: () => void) {
	const [visible, setVisible] = React.useState(false);
	const [dragY, setDragY] = React.useState(0);
	const dragStart = React.useRef<number | null>(null);

	// Trigger enter animation on mount
	React.useEffect(() => {
		requestAnimationFrame(() => setVisible(true));
	}, []);

	const close = React.useCallback(() => {
		setVisible(false);
		setTimeout(onClose, 300);
	}, [onClose]);

	const onPointerDown = (e: React.PointerEvent) => {
		dragStart.current = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	};
	const onPointerMove = (e: React.PointerEvent) => {
		if (dragStart.current === null) return;
		const dy = e.clientY - dragStart.current;
		if (dy < 0) setDragY(dy);
	};
	const onPointerUp = (e: React.PointerEvent) => {
		if (dragStart.current === null) return;
		const dy = e.clientY - dragStart.current;
		dragStart.current = null;
		if (dy < -60) close();
		else setDragY(0);
	};

	const sheetStyle: React.CSSProperties = {
		transform: visible ? `translateY(${dragY}px)` : "translateY(-100%)",
		transition:
			dragY !== 0 ? "none" : "transform 0.32s cubic-bezier(0.22,1,0.36,1)",
		willChange: "transform",
	};

	return {
		close,
		sheetStyle,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		visible,
	};
}

// Top-sheet: Event info
const EventInfoSheet: React.FC<{
	event: Event;
	pitches: PitchWithPriceAndUser[];
	statusBadge: (e: Event) => React.ReactNode;
	formatEventDate: (d: string) => string;
	onClose: () => void;
	onShare: () => void;
}> = ({ event, pitches, statusBadge, formatEventDate, onClose, onShare }) => {
	const {
		close,
		sheetStyle,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		visible,
	} = useTopSheet(onClose);

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center"
			onClick={close}
		>
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s" }}
			/>
			<div
				className="relative w-full max-w-lg rounded-b-3xl overflow-hidden"
				style={{
					...sheetStyle,
					background: "linear-gradient(180deg, #13102e 0%, #0d0b22 100%)",
					border: "1px solid rgba(255,255,255,0.08)",
					borderTop: "none",
				}}
				onClick={(e) => e.stopPropagation()}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
			>
				<div className="px-6 pt-6 pb-4">
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1 min-w-0">
							<p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-1">
								Event
							</p>
							<h2 className="text-xl font-black text-white leading-tight">
								{event.name}
							</h2>
							{event.description && (
								<p className="text-white/45 text-sm mt-1.5 leading-relaxed">
									{event.description}
								</p>
							)}
						</div>
						<div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
							{statusBadge(event)}
							<button
								onClick={close}
								className="w-7 h-7 rounded-full flex items-center justify-center"
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
				</div>

				<div className="px-6 pb-4">
					<div className="grid grid-cols-2 gap-2">
						{[
							{ label: "Starts", value: formatEventDate(event.start_time) },
							{ label: "Ends", value: formatEventDate(event.end_time) },
						].map(({ label, value }) => (
							<div
								key={label}
								className="rounded-2xl px-4 py-3"
								style={{
									background: "rgba(255,255,255,0.04)",
									border: "1px solid rgba(255,255,255,0.06)",
								}}
							>
								<p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-1">
									{label}
								</p>
								<p className="text-white font-semibold text-sm leading-snug">
									{value}
								</p>
							</div>
						))}
						<div
							className="col-span-2 rounded-2xl px-4 py-3"
							style={{
								background: "rgba(255,255,255,0.04)",
								border: "1px solid rgba(255,255,255,0.06)",
							}}
						>
							<p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-1">
								Companies
							</p>
							<p className="text-white font-semibold text-sm">
								{pitches.length} pitch{pitches.length !== 1 ? "es" : ""}{" "}
								competing
							</p>
						</div>
					</div>
				</div>

				{/* Judges */}
				{event.judges && event.judges.length > 0 && (
					<div className="px-6 pb-4">
						<p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-2">
							Judges
						</p>
						<div className="space-y-2">
							{event.judges.map((judge: Judge) => (
								<div
									key={judge.name}
									className="rounded-2xl px-4 py-3 flex items-center gap-3"
									style={{
										background: "rgba(255,255,255,0.04)",
										border: "1px solid rgba(255,255,255,0.06)",
									}}
								>
									<div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-white/10">
										{judge.profile_picture ? (
											<img
												src={judge.profile_picture}
												alt={judge.name}
												className="w-full h-full object-cover"
											/>
										) : (
											<div className="w-full h-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
												{judge.name.charAt(0)}
											</div>
										)}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<p className="text-white font-semibold text-sm">
												{judge.name}
											</p>
											{judge.linkedin && (
												<a
													href={judge.linkedin}
													target="_blank"
													rel="noopener noreferrer"
													onClick={(e) => e.stopPropagation()}
													className="text-cyan-400/70 hover:text-cyan-400 transition-colors flex-shrink-0"
												>
													<svg
														className="w-3.5 h-3.5"
														fill="currentColor"
														viewBox="0 0 24 24"
													>
														<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
													</svg>
												</a>
											)}
										</div>
										{judge.bio && (
											<p className="text-white/45 text-xs mt-0.5 leading-relaxed line-clamp-2">
												{judge.bio}
											</p>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Sponsors */}
				{event.sponsors && event.sponsors.length > 0 && (
					<div className="px-6 pb-4">
						<p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-2">
							Sponsors
						</p>
						<div className="space-y-2">
							{event.sponsors.map((sponsor: Sponsor) => (
								<div
									key={sponsor.name}
									className="rounded-2xl px-4 py-3 flex items-center gap-3"
									style={{
										background: "rgba(255,255,255,0.04)",
										border: "1px solid rgba(255,255,255,0.06)",
									}}
								>
									<div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-white/5 flex items-center justify-center">
										{sponsor.logo ? (
											<img
												src={sponsor.logo}
												alt={sponsor.name}
												className="w-full h-full object-contain p-1"
											/>
										) : (
											<span className="text-white/40 font-bold text-sm">
												{sponsor.name.charAt(0)}
											</span>
										)}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<p className="text-white font-semibold text-sm">
												{sponsor.name}
											</p>
											{sponsor.website && (
												<a
													href={sponsor.website}
													target="_blank"
													rel="noopener noreferrer"
													onClick={(e) => e.stopPropagation()}
													className="text-cyan-400/70 hover:text-cyan-400 transition-colors flex-shrink-0"
												>
													<svg
														className="w-3.5 h-3.5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
														/>
													</svg>
												</a>
											)}
										</div>
										{sponsor.description && (
											<p className="text-white/45 text-xs mt-0.5 leading-relaxed line-clamp-2">
												{sponsor.description}
											</p>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				<div className="px-6 pb-6">
					<button
						onClick={onShare}
						className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
						style={{
							background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
							boxShadow: "0 0 20px rgba(34,211,238,0.25)",
						}}
					>
						<svg
							className="w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
							/>
						</svg>
						Share Event
					</button>
				</div>

				<div className="flex justify-center pb-3">
					<div className="w-10 h-1 rounded-full bg-white/15" />
				</div>
			</div>
		</div>
	);
};

// Top-sheet: Help guide
const HelpSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
	const {
		close,
		sheetStyle,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		visible,
	} = useTopSheet(onClose);

	const steps = [
		{
			icon: "💰",
			title: "Your balance",
			body: "You start with $1,000,000 in virtual money. It's shown at the top of the screen.",
		},
		{
			icon: "📋",
			title: "The market",
			body: "Scroll down to see all the pitches pitching today. Each card shows their current share price and a mini price chart.",
		},
		{
			icon: "📈",
			title: "Buying shares",
			body: "Tap a founder card to expand it, then press BUY. Choose how much to invest. Their price goes up the more people buy.",
		},
		{
			icon: "📉",
			title: "Selling shares",
			body: "Already own shares? Tap SELL to cash out. Selling lowers the price for others.",
		},
		{
			icon: "🏆",
			title: "Winning",
			body: "The investor whose portfolio is worth the most at the end of the event wins. Track your rank on the Leaderboard tab.",
		},
		{
			icon: "📊",
			title: "Event Performance",
			body: "The chart at the top tracks how your total portfolio value has moved over time during the event.",
		},
	];

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center"
			onClick={close}
		>
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s" }}
			/>
			<div
				className="relative w-full max-w-lg rounded-b-3xl overflow-y-auto"
				style={{
					...sheetStyle,
					maxHeight: "85vh",
					background: "linear-gradient(180deg, #13102e 0%, #0d0b22 100%)",
					border: "1px solid rgba(255,255,255,0.08)",
					borderTop: "none",
				}}
				onClick={(e) => e.stopPropagation()}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
			>
				<div className="px-6 pt-6 pb-4 flex items-center justify-between">
					<div>
						<p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-0.5">
							Guide
						</p>
						<h2 className="text-xl font-black text-white">How to play</h2>
					</div>
					<button
						onClick={close}
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

				<div className="px-6 pb-6 space-y-2.5">
					{steps.map(({ icon, title, body }) => (
						<div
							key={title}
							className="rounded-2xl px-4 py-3.5 flex items-start gap-3.5"
							style={{
								background: "rgba(255,255,255,0.04)",
								border: "1px solid rgba(255,255,255,0.06)",
							}}
						>
							<span className="text-xl flex-shrink-0 leading-none mt-0.5">
								{icon}
							</span>
							<div>
								<p className="text-white font-bold text-sm mb-0.5">{title}</p>
								<p className="text-white/50 text-sm leading-relaxed">{body}</p>
							</div>
						</div>
					))}
				</div>

				<div className="flex justify-center pb-3">
					<div className="w-10 h-1 rounded-full bg-white/15" />
				</div>
			</div>
		</div>
	);
};

// Loading skeleton shown while event data is fetching
const EventLoadingScreen: React.FC = () => (
	<>
		<style>{`
			@keyframes shimmer-sweep {
				0% { background-position: -600px 0; }
				100% { background-position: 600px 0; }
			}
			@keyframes ev-spin {
				from { transform: rotate(0deg); }
				to { transform: rotate(360deg); }
			}
			@keyframes ev-fade-up {
				from { opacity: 0; transform: translateY(8px); }
				to { opacity: 1; transform: translateY(0); }
			}
			@keyframes ev-pulse-dot {
				0%, 100% { opacity: 0.2; transform: scale(0.8); }
				50% { opacity: 1; transform: scale(1.2); }
			}
			.ev-shimmer {
				background: linear-gradient(90deg,
					rgba(255,255,255,0.04) 0%,
					rgba(255,255,255,0.11) 40%,
					rgba(255,255,255,0.04) 80%
				);
				background-size: 600px 100%;
				animation: shimmer-sweep 1.8s ease-in-out infinite;
				border-radius: 10px;
			}
		`}</style>

		{/* Spinner */}
		<div
			className="flex flex-col items-center pt-16 pb-8"
			style={{ animation: "ev-fade-up 0.4s ease both" }}
		>
			<div className="relative w-[72px] h-[72px]">
				<div
					className="absolute inset-0 rounded-full"
					style={{
						animation: "ev-spin 3s linear infinite",
						background:
							"conic-gradient(from 0deg, transparent 75%, rgba(34,211,238,0.45) 90%, transparent 100%)",
					}}
				/>
				<div
					className="absolute inset-2 rounded-full"
					style={{
						animation: "ev-spin 0.85s linear infinite",
						background:
							"conic-gradient(from 0deg, transparent 55%, #22d3ee 78%, #6366f1 94%, transparent 100%)",
					}}
				/>
				<div
					className="absolute inset-3 rounded-full"
					style={{ background: "var(--bg-base, #080616)" }}
				/>
				<div
					className="absolute inset-4 rounded-full"
					style={{
						background:
							"radial-gradient(circle, rgba(99,102,241,0.6) 0%, rgba(34,211,238,0.1) 70%, transparent 100%)",
					}}
				/>
			</div>
			<p
				className="mt-4 text-[10px] font-bold tracking-[0.3em] uppercase"
				style={{
					color: "rgba(255,255,255,0.25)",
					animation: "ev-fade-up 0.5s ease 0.15s both",
				}}
			>
				Loading Event
			</p>
			<div className="flex gap-1.5 mt-3">
				{[0, 0.3, 0.6].map((delay, i) => (
					<div
						key={i}
						className="w-1.5 h-1.5 rounded-full"
						style={{
							background: "#22d3ee",
							animation: `ev-pulse-dot 1.2s ease-in-out ${delay}s infinite`,
						}}
					/>
				))}
			</div>
		</div>

		{/* Skeleton content */}
		<div
			className="px-5 space-y-7"
			style={{ animation: "ev-fade-up 0.5s ease 0.1s both" }}
		>
			<div className="flex items-center gap-3">
				<div className="w-12 h-12 rounded-full ev-shimmer flex-shrink-0" />
				<div className="space-y-2 flex-1">
					<div className="h-2.5 w-16 ev-shimmer" />
					<div className="h-4 w-32 ev-shimmer" />
				</div>
				<div className="w-6 h-6 rounded-full ev-shimmer" />
				<div className="w-6 h-6 rounded-full ev-shimmer" />
			</div>
			<div className="space-y-2.5">
				<div className="h-2 w-20 ev-shimmer" />
				<div
					className="h-12 w-52 ev-shimmer"
					style={{ borderRadius: "14px" }}
				/>
				<div className="h-3 w-28 ev-shimmer" />
			</div>
			<div className="space-y-2.5">
				<div className="h-2 w-28 ev-shimmer" />
				<div
					className="h-48 w-full ev-shimmer"
					style={{ borderRadius: "18px" }}
				/>
			</div>
			<div className="flex items-end justify-between">
				<div className="space-y-2">
					<div
						className="h-10 w-44 ev-shimmer"
						style={{ borderRadius: "10px" }}
					/>
					<div
						className="h-10 w-36 ev-shimmer"
						style={{ borderRadius: "10px" }}
					/>
				</div>
				<div className="flex gap-2 pb-1">
					<div
						className="h-7 w-16 ev-shimmer"
						style={{ borderRadius: "99px" }}
					/>
					<div
						className="h-7 w-12 ev-shimmer"
						style={{ borderRadius: "99px" }}
					/>
				</div>
			</div>
			<div className="space-y-3">
				{[0, 0.08, 0.16].map((delay, i) => (
					<div
						key={i}
						className="rounded-2xl p-4 flex items-center gap-3"
						style={{
							background: "rgba(255,255,255,0.03)",
							border: "1px solid rgba(255,255,255,0.06)",
							animation: `ev-fade-up 0.4s ease ${0.2 + delay}s both`,
						}}
					>
						<div className="w-12 h-12 rounded-full ev-shimmer flex-shrink-0" />
						<div className="flex-1 space-y-2">
							<div
								className="h-4 ev-shimmer"
								style={{ width: `${52 + i * 14}%` }}
							/>
							<div className="h-2.5 w-24 ev-shimmer" />
						</div>
						<div className="flex flex-col items-end gap-1.5">
							<div
								className="h-5 w-16 ev-shimmer"
								style={{ borderRadius: "8px" }}
							/>
							<div
								className="h-8 w-20 ev-shimmer"
								style={{ borderRadius: "10px" }}
							/>
						</div>
					</div>
				))}
			</div>
		</div>
	</>
);

// ── Shell: mounts the provider, then renders the inner page ──────────────────
const EventPage: React.FC = () => {
	const { eventId } = useParams<{ eventId: string }>();
	const { user } = useAuth();

	if (!eventId) {
		return (
			<div className="mx-4 mt-6 bg-red-500/20 border border-red-500/50 text-red-400 p-4 rounded-2xl">
				No event ID provided.
			</div>
		);
	}

	return (
		<EventDataProvider eventId={eventId} userId={user?.id ?? null}>
			<EventPageInner eventId={eventId} />
		</EventDataProvider>
	);
};

// ── Inner page: consumes context ──────────────────────────────────────────────
const EventPageInner: React.FC<{ eventId: string }> = ({ eventId }) => {
	const navigate = useNavigate();
	const { user, isAdmin } = useAuth();

	const {
		event,
		pitches,
		investor,
		holdings,
		investorId,
		allInvestors,
		portfolioValue,
		roiPercent,
		isLoading,
		error,
		closingAt,
		tradingJustStarted,
		registerForEvent,
	} = useEventData();

	// ── UI-only state ────────────────────────────────────────────────────────
	const [activeTab, setActiveTab] = useState<"trade" | "admin-analytics">(
		"trade",
	);
	const [showLeaderboard, setShowLeaderboard] = useState(false);
	const [showQRModal, setShowQRModal] = useState(false);
	const [showScanner, setShowScanner] = useState(false);
	const [showEventInfoModal, setShowEventInfoModal] = useState(false);
	const [showHelpModal, setShowHelpModal] = useState(false);
	const [showSignInNotification, setShowSignInNotification] = useState(false);
	const [showRegisterNotification, setShowRegisterNotification] =
		useState(false);
	const [isRegistering, setIsRegistering] = useState(false);
	const [showFounderModal, setShowFounderModal] = useState(false);
	const [selectedFounderForModal, setSelectedFounderForModal] =
		useState<PitchWithPriceAndUser | null>(null);
	const [selectedPitch, setSelectedPitch] =
		useState<PitchWithPriceAndUser | null>(null);
	const [tradeModalInitialType, setTradeModalInitialType] = useState<
		"buy" | "sell"
	>("buy");
	const [sortBy, setSortBy] = useState<"price" | "alphabetical">("price");
	const [_showSortOptions, setShowSortOptions] = useState(false);
	const [expandedPitchId, setExpandedPitchId] = useState<string | null>(null);
	const [showPortfolioDropdown, setShowPortfolioDropdown] = useState(false);
	const [showChat, setShowChat] = useState(false);
	const [showSchedule, setShowSchedule] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const portfolioDropdownRef = useRef<HTMLDivElement>(null);
	const [profileUserId, setFounderUserId] = useState<string | null>(null);

	useEffect(() => {
		if (!user?.id) return;
		import("../lib/supabaseClient").then(({ supabase }) => {
			supabase
				.from("users")
				.select("id")
				.eq("auth_user_id", user.id)
				.maybeSingle()
				.then(({ data }) => {
					if (data) setFounderUserId(data.id);
				});
		});
	}, [user?.id]);

	// Closing countdown UI state (driven by context's closingAt signal)
	const [showTradingClosedNotification, setShowTradingClosedNotification] =
		useState(false);
	const [showClosingCountdown, setShowClosingCountdown] = useState(false);
	const [closingSecondsLeft, setClosingSecondsLeft] = useState(0);
	const [totalClosingSeconds, setTotalClosingSeconds] = useState(60);
	const [showTradingStartedToast, setShowTradingStartedToast] = useState(false);
	const prevClosingAtRef = useRef<string | null | undefined>(undefined);

	// Watch context.closingAt to drive countdown UI
	useEffect(() => {
		// Skip on first render (undefined sentinel)
		if (prevClosingAtRef.current === undefined) {
			prevClosingAtRef.current = closingAt;
			// If closingAt is already set on load, start countdown
			if (closingAt) {
				const secs = Math.max(
					0,
					Math.round((new Date(closingAt).getTime() - Date.now()) / 1000),
				);
				if (secs > 0) {
					setTotalClosingSeconds(secs);
					setClosingSecondsLeft(secs);
					setShowClosingCountdown(true);
				}
			}
			return;
		}
		const prev = prevClosingAtRef.current;
		prevClosingAtRef.current = closingAt;

		if (closingAt && !prev) {
			const secs = Math.max(
				0,
				Math.round((new Date(closingAt).getTime() - Date.now()) / 1000),
			);
			if (secs > 0) {
				setTotalClosingSeconds(secs);
				setClosingSecondsLeft(secs);
				setShowClosingCountdown(true);
			}
		}
		if (!closingAt && prev) {
			setShowClosingCountdown(false);
			setClosingSecondsLeft(0);
		}
	}, [closingAt]);

	// Watch context.tradingJustStarted to show toast
	useEffect(() => {
		if (tradingJustStarted) {
			setShowTradingStartedToast(true);
			const t = setTimeout(() => setShowTradingStartedToast(false), 4000);
			return () => clearTimeout(t);
		}
	}, [tradingJustStarted]);

	// Countdown tick
	useEffect(() => {
		if (!showClosingCountdown || closingSecondsLeft <= 0) return;
		const t = setTimeout(() => {
			const next = closingSecondsLeft - 1;
			setClosingSecondsLeft(next);
			if (next <= 0) setShowClosingCountdown(false);
		}, 1000);
		return () => clearTimeout(t);
	}, [showClosingCountdown, closingSecondsLeft]);

	// Lock body scroll when any panel or modal is open
	useEffect(() => {
		const anyOpen =
			showLeaderboard ||
			showChat ||
			showSchedule ||
			showSettings ||
			showQRModal ||
			showScanner ||
			showEventInfoModal ||
			showHelpModal ||
			showFounderModal ||
			!!selectedPitch;
		document.body.style.overflow = anyOpen ? "hidden" : "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [
		showLeaderboard,
		showChat,
		showSchedule,
		showSettings,
		showQRModal,
		showScanner,
		showEventInfoModal,
		showHelpModal,
		showFounderModal,
		selectedPitch,
	]);

	// Close portfolio dropdown on outside click
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				portfolioDropdownRef.current &&
				!portfolioDropdownRef.current.contains(e.target as Node)
			) {
				setShowPortfolioDropdown(false);
			}
		};
		if (showPortfolioDropdown) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [showPortfolioDropdown]);

	// ── Helpers ──────────────────────────────────────────────────────────────
	const formatEventDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const formatEventDateShort = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const eventDate = new Date(
			date.getFullYear(),
			date.getMonth(),
			date.getDate(),
		);

		if (eventDate.getTime() === today.getTime()) {
			return `Today ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
		}
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		if (eventDate.getTime() === tomorrow.getTime()) {
			return `Tomorrow ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
		}
		return date.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const isEventActive = (ev: Event) => ev.status === "active";

	const isEventNotStarted = (ev: Event) => new Date() < new Date(ev.start_time);

	const handleSignIn = () => {
		navigate(`/login?redirect=/events/${eventId}`);
		setShowSignInNotification(false);
	};

	const handleRegisterForEvent = async () => {
		if (!user || !eventId) return;
		setIsRegistering(true);
		try {
			await registerForEvent();
			setShowRegisterNotification(false);
		} catch (err: any) {
			console.error("Failed to register for event:", err);
		} finally {
			setIsRegistering(false);
		}
	};

	const handleBuyClick = (pitch: PitchWithPriceAndUser) => {
		if (!user) {
			setShowSignInNotification(true);
			return;
		}
		if (!investorId) {
			setShowRegisterNotification(true);
			return;
		}
		if (event?.status !== "active") {
			setShowTradingClosedNotification(true);
			return;
		}
		setTradeModalInitialType("buy");
		setSelectedPitch(pitch);
	};

	const handleSellClick = (pitch: PitchWithPriceAndUser) => {
		if (!user) {
			setShowSignInNotification(true);
			return;
		}
		if (!investorId) {
			setShowRegisterNotification(true);
			return;
		}
		if (event?.status !== "active") {
			setShowTradingClosedNotification(true);
			return;
		}
		setTradeModalInitialType("sell");
		setSelectedPitch(pitch);
	};

	const handleFounderProfileClick = (
		pitch: PitchWithPriceAndUser,
		e: React.MouseEvent,
	) => {
		e.stopPropagation();
		setSelectedFounderForModal(pitch);
		setShowFounderModal(true);
	};

	const getOwnedShares = (pitchId: string) => {
		const holding = holdings.find((h) => h.pitch_id === pitchId);
		return holding ? holding.shares : 0;
	};

	const formatCurrency = (value: number) =>
		value.toLocaleString("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		});

	const canTrade = event ? isEventActive(event) : false;
	const simpleMode = event?.hide_leaderboard_and_prices ?? false;

	const displayName = user ? (user.email?.split("@")[0] ?? "Trader") : null;

	const hour = new Date().getHours();
	const greeting =
		hour < 12
			? "Good Morning,"
			: hour < 17
				? "Good Afternoon,"
				: "Good Evening,";

	const isDemo = pitches.length === 0;

	const demoPitches: PitchWithPriceAndUser[] = [
		{
			id: "demo-1",
			event_id: eventId,
			user_id: null,
			name: "Maya Kapoor",
			bio: null,
			logo_url: null,
			pitch_summary: "LunaWorks AI",
			pitch_url: null,
			shares_in_pool: 8000,
			cash_in_pool: 190000,
			k_constant: 1520000000,
			min_reserve_shares: 1000,
			created_at: "",
			updated_at: "",
			current_price: 23.75,
			market_cap: 99900,
			user: null,
		},
		{
			id: "demo-2",
			event_id: eventId,
			user_id: null,
			name: "Arjun Reyes",
			bio: null,
			logo_url: null,
			pitch_summary: "NebulaPay",
			pitch_url: null,
			shares_in_pool: 9200,
			cash_in_pool: 169300,
			k_constant: 1557760000,
			min_reserve_shares: 1000,
			created_at: "",
			updated_at: "",
			current_price: 18.4,
			market_cap: 73600,
			user: null,
		},
		{
			id: "demo-3",
			event_id: eventId,
			user_id: null,
			name: "Priya Wen",
			bio: null,
			logo_url: null,
			pitch_summary: "OrbitMesh",
			pitch_url: null,
			shares_in_pool: 9500,
			cash_in_pool: 150300,
			k_constant: 1427850000,
			min_reserve_shares: 1000,
			created_at: "",
			updated_at: "",
			current_price: 15.82,
			market_cap: 63280,
			user: null,
		},
		{
			id: "demo-4",
			event_id: eventId,
			user_id: null,
			name: "Diego Marín",
			bio: null,
			logo_url: null,
			pitch_summary: "GreenCore",
			pitch_url: null,
			shares_in_pool: 9700,
			cash_in_pool: 120200,
			k_constant: 1165940000,
			min_reserve_shares: 1000,
			created_at: "",
			updated_at: "",
			current_price: 12.39,
			market_cap: 49560,
			user: null,
		},
		{
			id: "demo-5",
			event_id: eventId,
			user_id: null,
			name: "Sofia Nakamura",
			bio: null,
			logo_url: null,
			pitch_summary: "VoltStack",
			pitch_url: null,
			shares_in_pool: 9800,
			cash_in_pool: 98000,
			k_constant: 960400000,
			min_reserve_shares: 1000,
			created_at: "",
			updated_at: "",
			current_price: 10.0,
			market_cap: 40000,
			user: null,
		},
	];

	const displayPitches = pitches.length > 0 ? pitches : demoPitches;
	const sortedPitches = simpleMode
		? displayPitches
		: [...displayPitches].sort((a, b) => {
				if (sortBy === "alphabetical") return a.name.localeCompare(b.name);
				return b.current_price - a.current_price;
			});

	const top5Holdings = [...holdings]
		.sort((a, b) => b.current_value - a.current_value)
		.slice(0, 5);

	const statusBadge = (ev: Event) => {
		if (ev.status === "active" && isEventActive(ev)) {
			return (
				<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-300 border border-green-500/40 flex-shrink-0">
					Active
				</span>
			);
		}
		if (isEventNotStarted(ev)) {
			return (
				<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex-shrink-0">
					Starts {formatEventDateShort(ev.start_time)}
				</span>
			);
		}
		if (
			ev.status === "completed" ||
			(ev.status === "active" && !isEventActive(ev))
		) {
			return (
				<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40 flex-shrink-0">
					Ended
				</span>
			);
		}
		return (
			<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 flex-shrink-0">
				{ev.status.charAt(0).toUpperCase() + ev.status.slice(1)}
			</span>
		);
	};

	// Portfolio history (unchanged — already selective, no realtime)
	const { points: portfolioPoints } = usePortfolioHistory({
		investorId: investorId || undefined,
		initialBalance: investor?.initial_balance ?? 1000000,
	});

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<div
			className="min-h-screen relative"
			style={{ background: "var(--bg-base)" }}
		>
			{/* Background glows */}
			<div
				className="fixed inset-0 pointer-events-none overflow-hidden"
				style={{ filter: "blur(4px)" }}
			>
				<div
					className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[60vh] rounded-full opacity-70"
					style={{
						background:
							"radial-gradient(ellipse at center, #2d1b69 0%, #1a0e4a 35%, transparent 70%)",
					}}
				/>
				<div
					className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-30"
					style={{
						background: "radial-gradient(circle, #4f46e5 0%, transparent 70%)",
						filter: "blur(40px)",
					}}
				/>
				<div
					className="absolute top-1/3 -right-20 w-72 h-72 rounded-full opacity-25"
					style={{
						background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)",
						filter: "blur(50px)",
					}}
				/>
			</div>

			{/* Dark side curtains outside the center column */}
			<div
				className="fixed inset-y-0 left-0 z-[9] pointer-events-none"
				style={{
					width: "calc((100vw - 430px) / 2)",
					background: "rgba(4,3,12,0.92)",
				}}
			/>
			<div
				className="fixed inset-y-0 right-0 z-[9] pointer-events-none"
				style={{
					width: "calc((100vw - 430px) / 2)",
					background: "rgba(4,3,12,0.92)",
				}}
			/>

			<div className="relative z-10">
				<div
					className="xl:max-w-[430px] mx-auto min-h-screen"
					style={{
						background: "rgba(6,5,18,0.72)",
						borderLeft: "1px solid rgba(255,255,255,0.08)",
						borderRight: "1px solid rgba(255,255,255,0.08)",
						backdropFilter: "blur(2px)",
					}}
				>
					{isLoading ? (
						<EventLoadingScreen />
					) : error ? (
						<div className="mx-4 mt-6 bg-red-500/20 border border-red-500/50 text-red-400 p-4 rounded-2xl">
							{error}
						</div>
					) : !event ? (
						<div className="mx-4 mt-6 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 p-4 rounded-2xl">
							Event not found.
						</div>
					) : (
						<>
							{/* Hero greeting */}
							<div className="px-5 pt-6 pb-2 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<button
										onClick={() =>
											navigate(
												user
													? "/profile"
													: `/login?redirect=/events/${eventId}`,
											)
										}
										className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 flex-shrink-0 shadow-lg shadow-purple-500/30 transition-all active:scale-90 hover:border-white/40"
									>
										{user ? (
											<div className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-lg">
												{(displayName ?? "G").charAt(0).toUpperCase()}
											</div>
										) : (
											<div className="w-full h-full bg-white/10 flex items-center justify-center">
												<svg
													className="w-6 h-6 text-white/40"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
													/>
												</svg>
											</div>
										)}
									</button>
									<div>
										<p className="text-white/50 text-xs font-medium">
											{greeting}
										</p>
										<p className="text-white text-xl font-bold leading-tight">
											{displayName ?? "Guest"}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-1">
									<button
										onClick={() => setShowEventInfoModal(true)}
										className="flex items-center justify-center transition-all active:scale-90"
									>
										<Info className="w-6 h-6 text-white/50" />
									</button>
									<button
										onClick={() => setShowHelpModal(true)}
										className="flex items-center justify-center transition-all active:scale-90"
									>
										<CircleHelp className="w-6 h-6 text-white/50" />
									</button>
								</div>
							</div>

							{/* Balance block */}
							{user && investor && (
								<div className="px-5 mt-5">
									<p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-1">
										Your Balance
									</p>
									<div className="flex items-start justify-between gap-3">
										<div>
											<p className="text-white text-5xl font-black tabular-nums leading-none">
												{formatCurrency(investor.current_balance)}
											</p>
											<div className="flex items-center gap-2 mt-2">
												{!simpleMode && (
													<>
														<span
															className={`text-sm font-semibold flex items-center gap-1 ${roiPercent >= 0 ? "text-cyan-400" : "text-red-400"}`}
														>
															{roiPercent >= 0 ? (
																<svg
																	className="w-3.5 h-3.5"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={2.5}
																		d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
																	/>
																</svg>
															) : (
																<svg
																	className="w-3.5 h-3.5"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={2.5}
																		d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
																	/>
																</svg>
															)}
															<span
																className={
																	roiPercent >= 0
																		? "text-cyan-400"
																		: "text-red-400"
																}
															>
																{roiPercent >= 0 ? "+" : ""}
																{roiPercent.toFixed(1)}%
															</span>
														</span>
														<span className="text-white/30 text-xs">·</span>
													</>
												)}
												<span className="text-white/30 text-xs">
													{new Date().toLocaleTimeString(undefined, {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</span>
											</div>
										</div>
										{showClosingCountdown && closingSecondsLeft > 0 && (
											<button
												onClick={() => setShowClosingCountdown(false)}
												className="mt-1 px-3 py-2 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold flex-shrink-0 tabular-nums flex items-center gap-1.5 hover:bg-amber-500/25 transition-colors"
											>
												<svg
													className="w-3 h-3"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
												Trading closes in {Math.floor(closingSecondsLeft / 60)}:
												{String(closingSecondsLeft % 60).padStart(2, "0")}
											</button>
										)}
									</div>
								</div>
							)}

							{/* Portfolio Performance chart */}
							{!simpleMode && (
								<div className="mt-5">
									<p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2 px-5">
										Event Performance
									</p>
									<div
										className="relative pt-2 pb-1"
										style={{
											borderTop: "1px solid rgba(255,255,255,0.05)",
											overflow: "visible",
										}}
									>
										<PortfolioChart
											points={portfolioPoints}
											height={190}
											initialBalance={investor?.initial_balance ?? 1000000}
										/>
									</div>
								</div>
							)}

							<div
								style={{
									background: "rgba(255,255,255,0.03)",
									borderTop: "1px solid rgba(255,255,255,0.06)",
									paddingBottom: "120px",
									minHeight: "100vh",
								}}
							>
								{/* Your Holdings */}
								{user &&
									investor &&
									holdings.length > 0 &&
									!simpleMode &&
									portfolioValue > 0 && (
										<div className="px-5 mt-6">
											<div className="flex items-center justify-between mb-3">
												<p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">
													Your Holdings
												</p>
												<p className="text-white font-bold text-base tabular-nums">
													{formatCurrency(portfolioValue)}
												</p>
											</div>
											<div className="flex gap-1.5 h-14 items-stretch">
												{top5Holdings.map((h, i) => {
													const pct =
														portfolioValue > 0
															? Math.round(
																	(h.current_value / portfolioValue) * 100,
																)
															: 0;
													const segColors = [
														"bg-[#2a4fd6]",
														"bg-[#1a9e8f]",
														"bg-[#7c3dce]",
														"bg-[#b8326a]",
														"bg-[#c87a1a]",
													];
													return (
														<div
															key={h.pitch_id}
															className={`${segColors[i % segColors.length]} rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
															style={{
																width: `${(h.current_value / portfolioValue) * 100}%`,
																minWidth: pct > 3 ? undefined : "2rem",
															}}
														>
															{pct >= 6 ? `${pct}%` : ""}
														</div>
													);
												})}
											</div>
											<div className="flex mt-3 gap-3">
												{top5Holdings.map((h, i) => {
													const pitch = pitches.find(
														(f) => f.id === h.pitch_id,
													);
													const avatarBorders = [
														"border-[#2a4fd6]",
														"border-[#1a9e8f]",
														"border-[#7c3dce]",
														"border-[#b8326a]",
														"border-[#c87a1a]",
													];
													return (
														<div
															key={h.pitch_id}
															className="flex flex-col items-center gap-1 flex-1 min-w-0"
														>
															<button
																onClick={(e) =>
																	pitch && handleFounderProfileClick(pitch, e)
																}
																className={`w-11 h-11 rounded-full overflow-hidden border-2 ${avatarBorders[i % avatarBorders.length]} flex-shrink-0`}
															>
																{pitch?.user?.profile_picture_url ? (
																	<img
																		src={pitch.user.profile_picture_url}
																		alt={pitch.name}
																		className="w-full h-full object-cover"
																	/>
																) : (
																	<div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
																		{pitch?.name.charAt(0) ?? "?"}
																	</div>
																)}
															</button>
														</div>
													);
												})}
											</div>
										</div>
									)}

								{/* Sign in CTA */}
								{!user && (
									<div
										className="mx-4 mt-5 rounded-2xl p-5"
										style={{
											background:
												"linear-gradient(135deg, rgba(30,20,70,0.8) 0%, rgba(20,15,55,0.9) 100%)",
											border: "1px solid rgba(255,255,255,0.08)",
											boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
										}}
									>
										<h3 className="text-white font-bold text-lg mb-1">
											Sign in to start trading
										</h3>
										<p className="text-white/50 text-sm mb-5 leading-relaxed">
											Create an account or sign in to trade pitches in this
											event.
										</p>
										<div className="flex gap-3">
											<button
												onClick={() =>
													navigate(`/login?redirect=/events/${eventId}`)
												}
												className="flex-1 py-3.5 rounded-xl font-semibold text-sm text-white transition-colors"
												style={{
													background: "rgba(255,255,255,0.08)",
													border: "1px solid rgba(255,255,255,0.12)",
												}}
											>
												Sign In
											</button>
											<button
												onClick={() =>
													navigate(`/login?redirect=/events/${eventId}`)
												}
												className="flex-1 py-3.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
												style={{
													background:
														"linear-gradient(135deg, #22d3ee, #3b82f6)",
													boxShadow: "0 4px 15px rgba(34,211,238,0.25)",
												}}
											>
												Create Account
											</button>
										</div>
									</div>
								)}

								{/* Register CTA */}
								{user && !investorId && !isLoading && (
									<div
										className="mx-4 mt-5 rounded-2xl p-5"
										style={{
											background:
												"linear-gradient(135deg, rgba(30,20,70,0.8) 0%, rgba(20,15,55,0.9) 100%)",
											border: "1px solid rgba(255,255,255,0.08)",
											boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
										}}
									>
										<h3 className="text-white font-bold text-lg mb-1">
											Register for this event
										</h3>
										<p className="text-white/50 text-sm mb-5">
											You're signed in but haven't joined this event yet.
										</p>
										<button
											onClick={handleRegisterForEvent}
											disabled={isRegistering}
											className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
											style={{
												background: "linear-gradient(135deg, #22d3ee, #3b82f6)",
												boxShadow: "0 4px 15px rgba(34,211,238,0.25)",
											}}
										>
											{isRegistering ? "Registering..." : "Register for Event"}
										</button>
									</div>
								)}

								{/* Trade tab */}
								{activeTab === "trade" && (
									<div className="mt-6 px-4">
										<div className="flex items-end justify-between mb-5">
											<div>
												<p
													className="font-black leading-none tracking-tight"
													style={{
														fontSize: "clamp(2.5rem, 10vw, 3.5rem)",
														background:
															"linear-gradient(180deg, #ffffff 0%, #a78bfa 40%, #7c3aed 70%, #4f46e5 100%)",
														WebkitBackgroundClip: "text",
														WebkitTextFillColor: "transparent",
														backgroundClip: "text",
														filter:
															"drop-shadow(0 0 20px rgba(139,92,246,0.6))",
														textShadow: "none",
													}}
												>
													TRADING
												</p>
												<p
													className="font-black leading-none tracking-tight"
													style={{
														fontSize: "clamp(2.5rem, 10vw, 3.5rem)",
														background:
															"linear-gradient(180deg, #ffffff 0%, #a78bfa 40%, #7c3aed 70%, #4f46e5 100%)",
														WebkitBackgroundClip: "text",
														WebkitTextFillColor: "transparent",
														backgroundClip: "text",
														filter:
															"drop-shadow(0 0 20px rgba(139,92,246,0.6))",
														textShadow: "none",
													}}
												>
													MARKET
												</p>
											</div>
											{!simpleMode && (
												<div className="flex flex-col items-end gap-1.5 pb-1">
													<span className="text-white/30 text-[10px] uppercase tracking-widest">
														sort by
													</span>
													<div className="flex gap-2">
														<button
															onClick={() => {
																setSortBy("price");
																setShowSortOptions(false);
															}}
															className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${sortBy === "price" ? "bg-[#7c3aed] border-[#7c3aed] text-white shadow-[0_0_12px_rgba(124,58,237,0.5)]" : "bg-transparent border-white/20 text-white/60 hover:border-white/40"}`}
														>
															PRICE {sortBy === "price" ? "↑" : ""}
														</button>
														<button
															onClick={() => {
																setSortBy("alphabetical");
																setShowSortOptions(false);
															}}
															className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${sortBy === "alphabetical" ? "bg-[#7c3aed] border-[#7c3aed] text-white shadow-[0_0_12px_rgba(124,58,237,0.5)]" : "bg-transparent border-white/20 text-white/60 hover:border-white/40"}`}
														>
															A-Z
														</button>
													</div>
												</div>
											)}
										</div>

										{sortedPitches.length === 0 ? (
											<div className="text-center py-12 text-white/40">
												No pitches available for this event.
											</div>
										) : (
											<div className="space-y-3">
												{sortedPitches.map((pitch) => {
													const isExpanded = expandedPitchId === pitch.id;
													const ownedShares = getOwnedShares(pitch.id);
													const ownedValue = ownedShares * pitch.current_price;

													return (
														<div
															key={pitch.id}
															className="rounded-2xl overflow-hidden"
															style={{
																background:
																	"linear-gradient(135deg, rgba(20,15,50,0.9) 0%, rgba(15,10,40,0.95) 100%)",
																border: isExpanded
																	? "1px solid rgba(124,58,237,0.4)"
																	: "1px solid rgba(255,255,255,0.07)",
																boxShadow: isExpanded
																	? "0 0 30px rgba(124,58,237,0.15), inset 0 1px 0 rgba(255,255,255,0.05)"
																	: "0 2px 8px rgba(0,0,0,0.3)",
															}}
														>
															<div
																className={`flex items-center gap-3 px-4 py-3.5 ${!simpleMode ? "cursor-pointer" : ""}`}
																onClick={() => {
																	if (!simpleMode)
																		setExpandedPitchId(
																			isExpanded ? null : pitch.id,
																		);
																}}
															>
																<button
																	onClick={(e) =>
																		handleFounderProfileClick(pitch, e)
																	}
																	className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/15 hover:border-violet-400/60 transition-all flex-shrink-0 shadow-md"
																>
																	{pitch.user?.profile_picture_url ? (
																		<img
																			src={pitch.user.profile_picture_url}
																			alt={pitch.name}
																			className="w-full h-full object-cover"
																		/>
																	) : (
																		<div className="w-full h-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
																			{pitch.name.charAt(0)}
																		</div>
																	)}
																</button>
																<div className="flex-1 min-w-0">
																	<p className="text-white font-bold text-base truncate">
																		{pitch.name}
																	</p>
																	{pitch.pitch_summary && (
																		<p className="text-white/40 text-xs truncate mt-0.5">
																			{pitch.pitch_summary}
																		</p>
																	)}
																</div>
																<div className="flex items-center gap-2.5 flex-shrink-0">
																	{!simpleMode && !isExpanded && (
																		<SparklineWithButton
																			founderId={isDemo ? "" : pitch.id}
																			price={pitch.current_price}
																			canTrade={canTrade}
																			onTrade={() => handleBuyClick(pitch)}
																			formatCurrency={formatCurrency}
																		/>
																	)}
																	{simpleMode && (
																		<div className="flex gap-1.5">
																			<button
																				onClick={(e) => {
																					e.stopPropagation();
																					handleBuyClick(pitch);
																				}}
																				disabled={!canTrade}
																				className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!canTrade ? "bg-white/5 text-white/20 cursor-not-allowed" : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30"}`}
																			>
																				Buy
																			</button>
																			<button
																				onClick={(e) => {
																					e.stopPropagation();
																					handleSellClick(pitch);
																				}}
																				disabled={
																					!canTrade || ownedShares === 0
																				}
																				className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!canTrade || ownedShares === 0 ? "bg-white/5 text-white/20 cursor-not-allowed" : "bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30"}`}
																			>
																				Sell
																			</button>
																		</div>
																	)}
																</div>
															</div>

															{!simpleMode && isExpanded && (
																<div className="px-4 pb-5 border-t border-white/5">
																	{!isDemo && (
																		<div className="mt-3 -mx-1">
																			<FounderPriceChart
																				founderId={pitch.id}
																				height={160}
																				maxPoints={60}
																				showGrid={false}
																			/>
																		</div>
																	)}
																	<div className="grid grid-cols-3 gap-2 mt-4 py-3 border-t border-b border-white/5">
																		<div className="text-center">
																			<p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-1">
																				Market Cap.
																			</p>
																			<p className="text-white font-bold text-sm tabular-nums">
																				{formatCurrency(pitch.market_cap)}
																			</p>
																		</div>
																		<div className="text-center border-x border-white/5">
																			<p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-1">
																				Your Shares
																			</p>
																			<p className="text-white font-bold text-sm tabular-nums">
																				{user
																					? ownedShares.toLocaleString()
																					: "—"}
																			</p>
																		</div>
																		<div className="text-center">
																			<p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-1">
																				Your Value
																			</p>
																			<p className="text-white font-bold text-sm tabular-nums">
																				{user && ownedShares > 0
																					? formatCurrency(ownedValue)
																					: "—"}
																			</p>
																		</div>
																	</div>
																	<div className="flex gap-3 mt-4">
																		<button
																			onClick={(e) => {
																				e.stopPropagation();
																				handleBuyClick(pitch);
																			}}
																			disabled={!canTrade}
																			className={`flex-1 py-4 rounded-2xl font-bold text-base transition-all ${!canTrade ? "bg-white/5 text-white/20 cursor-not-allowed" : "text-white"}`}
																			style={
																				canTrade
																					? {
																							background:
																								"linear-gradient(135deg, #06b6d4, #3b82f6)",
																							boxShadow:
																								"0 0 20px rgba(6,182,212,0.3)",
																						}
																					: {}
																			}
																		>
																			BUY
																		</button>
																		<button
																			onClick={(e) => {
																				e.stopPropagation();
																				handleSellClick(pitch);
																			}}
																			disabled={!canTrade || ownedShares === 0}
																			className={`flex-1 py-4 rounded-2xl font-bold text-base transition-all ${!canTrade || ownedShares === 0 ? "bg-white/5 text-white/20 cursor-not-allowed" : "text-white"}`}
																			style={
																				canTrade && ownedShares > 0
																					? {
																							background:
																								"linear-gradient(135deg, #f97316, #ef4444)",
																							boxShadow:
																								"0 0 20px rgba(249,115,22,0.3)",
																						}
																					: {}
																			}
																		>
																			SELL
																		</button>
																	</div>
																</div>
															)}
														</div>
													);
												})}
											</div>
										)}
									</div>
								)}

								{/* Admin analytics tab */}
								{activeTab === "admin-analytics" && (
									<div className="mt-6 px-4 space-y-6">
										<div>
											<h2 className="text-2xl font-bold text-white flex items-center gap-3">
												Market Cap Analytics
												<span className="text-sm bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg px-2 py-1 font-medium">
													Admin Only
												</span>
											</h2>
											<p className="text-sm text-white/40 mt-1">
												Market cap history and peak values per founder — hidden
												from participants
											</p>
										</div>
										{pitches.length === 0 ? (
											<div className="rounded-2xl bg-white/5 border border-white/5 p-8 text-center text-white/40">
												No pitches for this event.
											</div>
										) : (
											<div className="space-y-6">
												<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
													{pitches.map((pitch) => (
														<div
															key={pitch.id}
															className="rounded-2xl bg-white/5 border border-white/5 p-4"
														>
															<div className="flex items-center gap-3 mb-3">
																<div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
																	{pitch.user?.profile_picture_url ? (
																		<img
																			src={pitch.user.profile_picture_url}
																			alt={pitch.name}
																			className="w-full h-full object-cover"
																		/>
																	) : (
																		<div className="w-full h-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold">
																			{pitch.name.charAt(0)}
																		</div>
																	)}
																</div>
																<h3 className="text-white font-semibold truncate">
																	{pitch.name}
																</h3>
															</div>
															<div className="grid grid-cols-2 gap-2 text-sm">
																<div>
																	<p className="text-white/40 text-xs">
																		Current Price
																	</p>
																	<p className="text-cyan-400 font-bold">
																		${pitch.current_price.toFixed(2)}
																	</p>
																</div>
																<div>
																	<p className="text-white/40 text-xs">
																		Market Cap
																	</p>
																	<p className="text-white font-bold">
																		{formatCurrency(pitch.market_cap)}
																	</p>
																</div>
															</div>
														</div>
													))}
												</div>
												{pitches.map((pitch) => (
													<div
														key={pitch.id}
														className="rounded-2xl bg-white/5 border border-white/5 p-5"
													>
														<h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
															<div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
																{pitch.user?.profile_picture_url ? (
																	<img
																		src={pitch.user.profile_picture_url}
																		alt={pitch.name}
																		className="w-full h-full object-cover"
																	/>
																) : (
																	<div className="w-full h-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
																		{pitch.name.charAt(0)}
																	</div>
																)}
															</div>
															{pitch.name} — Market Cap History
														</h3>
														<FounderMarketCapChart
															founderId={pitch.id}
															founderName={pitch.name}
															height={280}
															maxPoints={500}
														/>
													</div>
												))}
											</div>
										)}
									</div>
								)}
							</div>
						</>
					)}
				</div>
			</div>

			{/* Floating bottom nav */}
			<div
				className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-2 rounded-full"
				style={{
					background: "rgba(16, 14, 35, 0.92)",
					backdropFilter: "blur(20px)",
					border: "1px solid rgba(255,255,255,0.1)",
					boxShadow:
						"0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08)",
				}}
			>
				<button
					onClick={() => setShowLeaderboard(true)}
					className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-full transition-all ${showLeaderboard ? "text-cyan-400" : "text-white/35 hover:text-white/60"}`}
				>
					<svg
						className="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
						/>
					</svg>
					<span className="text-[9px] font-medium">Leaderboard</span>
				</button>
				<button
					onClick={() => setShowChat(true)}
					className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-full transition-all ${showChat ? "text-cyan-400" : "text-white/35 hover:text-white/60"}`}
				>
					<svg
						className="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
						/>
					</svg>
					<span className="text-[9px] font-medium">Chat</span>
				</button>
				<button
					onClick={() => setShowScanner(true)}
					className="relative -mt-6 w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 mx-1"
					style={{
						background: "linear-gradient(140deg, #22d3ee 0%, #6366f1 100%)",
						boxShadow:
							"0 0 20px rgba(34,211,238,0.6), 0 0 40px rgba(99,102,241,0.4), 0 4px 15px rgba(0,0,0,0.5)",
						border: "2px solid rgba(255,255,255,0.2)",
					}}
				>
					<svg
						className="w-6 h-6 text-white"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
						/>
					</svg>
					<span
						className="absolute inset-0 rounded-full animate-ping opacity-20"
						style={{ background: "linear-gradient(140deg, #22d3ee, #6366f1)" }}
					/>
				</button>
				<button
					onClick={() => setShowSchedule(true)}
					className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-full transition-all ${showSchedule ? "text-cyan-400" : "text-white/35 hover:text-white/60"}`}
				>
					<svg
						className="w-5 h-5"
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
					<span className="text-[9px] font-medium">Schedule</span>
				</button>
				<button
					onClick={() => setShowSettings(true)}
					className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-full transition-all ${showSettings ? "text-cyan-400" : "text-white/35 hover:text-white/60"}`}
				>
					<svg
						className="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						/>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
					<span className="text-[9px] font-medium">Settings</span>
				</button>
			</div>

			{/* Portfolio dropdown */}
			{showPortfolioDropdown && user && investor && (
				<div
					className="fixed bottom-20 left-0 right-0 z-40 mx-4 rounded-2xl bg-[#0d0e24] border border-white/10 shadow-2xl overflow-hidden"
					ref={portfolioDropdownRef}
				>
					<div className="p-4 border-b border-white/5 flex items-center justify-between">
						<h3 className="text-white font-bold text-lg">Your Holdings</h3>
						<button
							onClick={() => setShowPortfolioDropdown(false)}
							className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
						>
							<svg
								className="w-4 h-4 text-white/60"
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
					<div className="max-h-72 overflow-y-auto">
						{holdings.length === 0 ? (
							<div className="p-8 text-center text-white/40 text-sm">
								No holdings yet. Start trading to build your portfolio!
							</div>
						) : (
							<div className="divide-y divide-white/5">
								{holdings.map((holding) => {
									const pitch = pitches.find((f) => f.id === holding.pitch_id);
									if (!pitch) return null;
									const currentValue = holding.shares * pitch.current_price;
									const profitLoss =
										currentValue - holding.shares * holding.cost_basis;
									return (
										<div
											key={holding.id}
											className="px-4 py-3 flex items-center justify-between gap-4"
										>
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
													{pitch.user?.profile_picture_url ? (
														<img
															src={pitch.user.profile_picture_url}
															alt={pitch.name}
															className="w-full h-full object-cover"
														/>
													) : (
														<div className="w-full h-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-xs">
															{pitch.name.charAt(0)}
														</div>
													)}
												</div>
												<div>
													<p className="text-white font-semibold text-sm">
														{pitch.name}
													</p>
													<p className="text-white/40 text-xs">
														{holding.shares.toLocaleString()} shares
													</p>
												</div>
											</div>
											<div className="text-right">
												{!simpleMode && (
													<>
														<p className="text-cyan-400 font-bold text-sm">
															{formatCurrency(currentValue)}
														</p>
														<p
															className={`text-xs font-semibold ${profitLoss >= 0 ? "text-green-400" : "text-red-400"}`}
														>
															{profitLoss >= 0 ? "+" : ""}
															{formatCurrency(profitLoss)}
														</p>
													</>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
					<div className="p-4 border-t border-white/5 grid grid-cols-2 gap-3">
						<div className="text-center">
							<p className="text-white/40 text-xs">Liquid Cash</p>
							<p className="text-cyan-400 font-bold">
								{formatCurrency(investor.current_balance)}
							</p>
						</div>
						<div className="text-center">
							<p className="text-white/40 text-xs">ROI</p>
							<p
								className={`font-bold ${roiPercent >= 0 ? "text-green-400" : "text-red-400"}`}
							>
								{roiPercent >= 0 ? "+" : ""}
								{roiPercent.toFixed(1)}%
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Notifications */}
			{!user && !isLoading && event && showSignInNotification && (
				<div
					className="fixed bottom-24 right-4 z-50 animate-bounce"
					onClick={handleSignIn}
				>
					<div className="bg-red-500 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-xs">
						<svg
							className="w-5 h-5 flex-shrink-0"
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
						<p className="font-medium text-sm">
							Please sign in to start trading
						</p>
					</div>
				</div>
			)}

			{user &&
				!investorId &&
				!isLoading &&
				event &&
				showRegisterNotification && (
					<div className="fixed bottom-24 right-4 z-50 max-w-xs">
						<div className="bg-[#0d0e24] border border-blue-500/40 rounded-xl shadow-2xl p-4 flex items-start gap-3">
							<svg
								className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
								/>
							</svg>
							<div className="flex-1">
								<p className="font-semibold text-white text-sm">
									Register to trade
								</p>
								<p className="text-xs text-white/50 mt-0.5">
									You need to join this event before trading.
								</p>
								<button
									onClick={handleRegisterForEvent}
									disabled={isRegistering}
									className="mt-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-semibold disabled:opacity-60"
								>
									{isRegistering ? "Registering..." : "Register for Event"}
								</button>
							</div>
							<button
								onClick={() => setShowRegisterNotification(false)}
								className="text-white/30 hover:text-white transition-colors flex-shrink-0"
							>
								<svg
									className="w-4 h-4"
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
				)}

			{!isLoading && event && showTradingClosedNotification && (
				<div
					className="fixed bottom-24 right-4 z-50"
					onClick={() => setShowTradingClosedNotification(false)}
				>
					<div className="bg-amber-400 text-[#0a0b1a] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-xs">
						<svg
							className="w-5 h-5 flex-shrink-0"
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
						<p className="font-semibold text-sm">
							Trading has closed for this event
						</p>
					</div>
				</div>
			)}

			{showTradingStartedToast && (
				<div
					className="fixed bottom-24 left-4 z-50"
					onClick={() => setShowTradingStartedToast(false)}
				>
					<div className="bg-green-500 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-xs">
						<svg
							className="w-5 h-5 flex-shrink-0"
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
						<p className="font-semibold text-sm">Trading has started!</p>
					</div>
				</div>
			)}

			{showClosingCountdown && closingSecondsLeft > 0 && (
				<div className="fixed bottom-24 right-4 z-50 pointer-events-auto">
					<div className="bg-[#0d0e24] border border-amber-500/40 rounded-xl shadow-xl px-3 py-2.5 w-44">
						<div className="flex items-center justify-between gap-2 mb-1.5">
							<p className="text-amber-300 font-semibold text-xs">
								Closing soon
							</p>
							<button
								onClick={() => setShowClosingCountdown(false)}
								className="text-white/30 hover:text-white transition-colors"
							>
								<svg
									className="w-3 h-3"
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
						<span className="text-white font-black tabular-nums text-xl leading-none block mb-2">
							{Math.floor(closingSecondsLeft / 60)}:
							{String(closingSecondsLeft % 60).padStart(2, "0")}
						</span>
						<div className="h-1 bg-white/10 rounded-full overflow-hidden">
							<div
								className="h-full bg-amber-400 rounded-full transition-all duration-1000"
								style={{
									width: `${(closingSecondsLeft / totalClosingSeconds) * 100}%`,
								}}
							/>
						</div>
					</div>
				</div>
			)}

			{/* Modals */}
			{showEventInfoModal && event && (
				<EventInfoSheet
					event={event}
					pitches={pitches}
					statusBadge={statusBadge}
					formatEventDate={formatEventDate}
					onClose={() => setShowEventInfoModal(false)}
					onShare={() => {
						setShowEventInfoModal(false);
						setShowQRModal(true);
					}}
				/>
			)}
			{showHelpModal && <HelpSheet onClose={() => setShowHelpModal(false)} />}

			{showFounderModal && selectedFounderForModal && (
				<div
					className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
					onClick={() => setShowFounderModal(false)}
				>
					<div
						className="bg-[#0d0e24] rounded-2xl border border-white/10 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="sticky top-0 bg-[#0d0e24] border-b border-white/5 p-6">
							<div className="flex items-center justify-between">
								<h2 className="text-2xl font-bold text-white">
									Founder Profile
								</h2>
								<button
									onClick={() => setShowFounderModal(false)}
									className="p-2 hover:bg-white/5 rounded-xl transition-colors"
								>
									<svg
										className="w-5 h-5 text-white/60"
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
						<div className="p-6 space-y-6">
							<div className="flex items-start gap-6">
								<div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center border-2 border-white/10 flex-shrink-0">
									{selectedFounderForModal.user?.profile_picture_url ? (
										<img
											src={selectedFounderForModal.user.profile_picture_url}
											alt={selectedFounderForModal.name}
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="w-full h-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-3xl">
											{selectedFounderForModal.name.charAt(0)}
										</div>
									)}
								</div>
								<div className="flex-1">
									<h3 className="text-2xl font-bold text-white mb-1">
										{selectedFounderForModal.name}
									</h3>
									{selectedFounderForModal.user && (
										<p className="text-white/50">
											{selectedFounderForModal.user.first_name}{" "}
											{selectedFounderForModal.user.last_name}
										</p>
									)}
								</div>
							</div>
							{selectedFounderForModal.logo_url && (
								<div>
									<p className="text-sm text-white/40 mb-2">Project Logo</p>
									<div className="w-32 h-32 rounded-xl overflow-hidden border border-white/10">
										<img
											src={selectedFounderForModal.logo_url}
											alt={`${selectedFounderForModal.name} logo`}
											className="w-full h-full object-cover"
										/>
									</div>
								</div>
							)}
							{selectedFounderForModal.user?.bio && (
								<div>
									<p className="text-sm text-white/40 mb-2">Bio</p>
									<p className="text-white/80 leading-relaxed">
										{selectedFounderForModal.user.bio}
									</p>
								</div>
							)}
							{selectedFounderForModal.pitch_summary && (
								<div>
									<p className="text-sm text-white/40 mb-2">Pitch Summary</p>
									<p className="text-white/80 leading-relaxed">
										{selectedFounderForModal.pitch_summary}
									</p>
								</div>
							)}
							{!simpleMode && (
								<div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
									<div className="bg-white/5 p-4 rounded-xl">
										<p className="text-xs text-white/40 mb-1">Current Price</p>
										<p className="text-xl font-bold text-cyan-400">
											${selectedFounderForModal.current_price.toFixed(2)}
										</p>
									</div>
									<div className="bg-white/5 p-4 rounded-xl">
										<p className="text-xs text-white/40 mb-1">Market Cap</p>
										<p className="text-xl font-bold text-white">
											{formatCurrency(selectedFounderForModal.market_cap)}
										</p>
									</div>
								</div>
							)}
							<div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/5">
								<button
									onClick={() => {
										setShowFounderModal(false);
										handleBuyClick(selectedFounderForModal);
									}}
									disabled={!canTrade}
									className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${!canTrade ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 shadow-lg"}`}
								>
									<svg
										className="w-4 h-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 4v16m8-8H4"
										/>
									</svg>
									Buy Shares
								</button>
								{user && getOwnedShares(selectedFounderForModal.id) > 0 && (
									<button
										onClick={() => {
											setShowFounderModal(false);
											handleSellClick(selectedFounderForModal);
										}}
										disabled={!canTrade}
										className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${!canTrade ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90 shadow-lg"}`}
									>
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M20 12H4"
											/>
										</svg>
										Sell Shares
									</button>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			<SchedulePanel
				isOpen={showSchedule}
				onClose={() => setShowSchedule(false)}
				eventName={event?.name ?? ""}
				schedule={event?.schedule ?? []}
				eventStart={event?.start_time ?? ""}
				eventEnd={event?.end_time ?? ""}
			/>
			<SettingsPanel
				isOpen={showSettings}
				onClose={() => setShowSettings(false)}
				onSignOut={async () => {
					await import("../lib/supabaseClient").then((m) =>
						m.supabase.auth.signOut(),
					);
					setShowSettings(false);
				}}
				isAdmin={isAdmin}
				onOpenAdminAnalytics={() => setActiveTab("admin-analytics")}
			/>
			<QRShareModal
				eventId={eventId}
				eventName={event?.name || ""}
				isOpen={showQRModal}
				onClose={() => setShowQRModal(false)}
			/>
			<ScannerModal
				isOpen={showScanner}
				onClose={() => setShowScanner(false)}
				profileUrl={
					profileUserId
						? `${window.location.origin}/profile/${profileUserId}`
						: ""
				}
				profileName={displayName ?? undefined}
			/>
			<ChatPanel
				isOpen={showChat}
				onClose={() => setShowChat(false)}
				eventId={eventId}
				userId={user?.id ?? null}
				displayName={displayName ?? "Guest"}
			/>
			<LeaderboardPanel
				isOpen={showLeaderboard}
				onClose={() => setShowLeaderboard(false)}
				eventId={eventId}
				founders={pitches}
				allInvestors={allInvestors}
				currentInvestorId={investorId ?? undefined}
				eventDate={event?.start_time}
				simpleMode={simpleMode}
			/>

			{selectedPitch && investorId && investor && (
				<TradeModal
					isOpen={true}
					onClose={() => setSelectedPitch(null)}
					founder={selectedPitch}
					investorId={investorId}
					investorBalance={investor.current_balance}
					simpleMode={simpleMode}
					initialTradeType={tradeModalInitialType}
					initialShares={getOwnedShares(selectedPitch.id)}
					onTradeComplete={() => setSelectedPitch(null)}
				/>
			)}
		</div>
	);
};

export default EventPage;
