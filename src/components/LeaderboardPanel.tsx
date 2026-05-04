import React, { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { calculateCurrentPrice, calculateMarketCap } from "../lib/ammEngine";
import { PitchWithPriceAndUser } from "../types/Pitch";
import { EventInvestorEntry } from "../types/Investor";

interface LeaderboardPanelProps {
	isOpen: boolean;
	onClose: () => void;
	eventId: string;
	founders?: PitchWithPriceAndUser[];
	allInvestors?: EventInvestorEntry[];
	currentInvestorId?: string;
	eventDate?: string;
	simpleMode?: boolean;
}

type InvestorEntry = {
	id: string;
	name: string;
	initial_balance: number;
	total_value: number;
	roi_percent: number;
};

type FounderEntry = {
	id: string;
	name: string;
	price: number;
	market_cap: number;
	price_change_percent: number;
	profile_picture_url?: string | null;
};

// ─── Avatar with gradient glow ring ───────────────────────────────────────────
const GlowAvatar: React.FC<{
	name: string;
	imageUrl?: string | null;
	sizeClass?: string;
	textClass?: string;
}> = ({ name, imageUrl, sizeClass = "w-8 h-8", textClass = "text-xs" }) => (
	<div className={`relative inline-flex flex-shrink-0 ${sizeClass}`}>
		<span
			aria-hidden="true"
			className="pointer-events-none absolute -inset-[3px] rounded-full opacity-55 blur-md"
			style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
		/>
		<span
			className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full font-bold text-white p-[2px]"
			style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
		>
			{imageUrl ? (
				<img
					src={imageUrl}
					alt={name}
					loading="lazy"
					decoding="async"
					className="h-full w-full rounded-full object-cover"
				/>
			) : (
				<span
					className={`flex h-full w-full items-center justify-center rounded-full ${textClass} font-bold text-white`}
					style={{ background: "linear-gradient(135deg, #4f46e5, #06b6d4)" }}
				>
					{name.charAt(0).toUpperCase()}
				</span>
			)}
		</span>
	</div>
);

// ─── Podium card (top 3) ───────────────────────────────────────────────────────
const PodiumCard: React.FC<{
	entry: InvestorEntry | FounderEntry;
	rank: 1 | 2 | 3;
	isFounder: boolean;
	formatValue: (v: number) => string;
}> = ({ entry, rank, isFounder, formatValue }) => {
	const isFirst = rank === 1;
	const value = isFounder
		? (entry as FounderEntry).market_cap
		: (entry as InvestorEntry).total_value;
	const imageUrl = isFounder ? (entry as FounderEntry).profile_picture_url : undefined;

	const accent =
		rank === 1
			? { color: "#f97316", glow: "rgba(249,115,22,0.35)", border: "rgba(249,115,22,0.25)" }
			: rank === 2
			? { color: "#22d3ee", glow: "rgba(34,211,238,0.3)", border: "rgba(34,211,238,0.2)" }
			: { color: "#a78bfa", glow: "rgba(167,139,250,0.3)", border: "rgba(167,139,250,0.2)" };

	const containerSize = isFirst ? "w-28 h-28" : "w-24 h-24";

	return (
		<div className={`flex flex-col items-center ${isFirst ? "-mt-3" : ""}`}>
			<div className={`relative flex-shrink-0 ${containerSize}`}>
				<div className="absolute inset-[18%]">
					<GlowAvatar
						name={entry.name}
						imageUrl={imageUrl}
						sizeClass="w-full h-full"
						textClass={isFirst ? "text-2xl" : "text-xl"}
					/>
				</div>
				<img
					src={`/leaderboard/ranking-${rank}.webp`}
					alt=""
					aria-hidden="true"
					onError={(e) => (e.currentTarget.style.display = "none")}
					className="pointer-events-none absolute inset-0 w-full h-full object-contain"
				/>
			</div>
			<div
				className="mt-3 w-full text-center px-2 py-2 rounded-xl"
				style={{
					background: "rgba(255,255,255,0.04)",
					border: `1px solid ${accent.border}`,
					boxShadow: `0 0 14px ${accent.glow}`,
				}}
			>
				<div className="text-white text-[12.5px] font-semibold leading-tight truncate">
					{entry.name}
				</div>
				<div className="mt-1 text-[11.5px] font-semibold tabular-nums" style={{ color: accent.color }}>
					{formatValue(value)}
				</div>
			</div>
		</div>
	);
};

// ─── Regular rank row (4+) ─────────────────────────────────────────────────────
const RankRow: React.FC<{
	entry: InvestorEntry | FounderEntry;
	rank: number;
	isCurrentUser: boolean;
	isFounder: boolean;
	formatValue: (v: number) => string;
}> = ({ entry, rank, isCurrentUser, isFounder, formatValue }) => {
	const value = isFounder
		? (entry as FounderEntry).market_cap
		: (entry as InvestorEntry).total_value;
	const imageUrl = isFounder ? (entry as FounderEntry).profile_picture_url : undefined;

	return (
		<div
			className="mb-2.5 px-3 py-2.5 rounded-xl flex items-center gap-2.5 hover:brightness-110 transition-all"
			style={{
				background: isCurrentUser ? "rgba(34,211,238,0.07)" : "rgba(255,255,255,0.04)",
				border: isCurrentUser
					? "1px solid rgba(34,211,238,0.25)"
					: "1px solid rgba(255,255,255,0.07)",
				boxShadow: isCurrentUser ? "0 0 16px rgba(34,211,238,0.08)" : undefined,
			}}
		>
			<span
				className="font-bold text-[12.5px] tabular-nums w-5 text-center shrink-0"
				style={{ color: isCurrentUser ? "#22d3ee" : "rgba(255,255,255,0.35)" }}
			>
				{rank}
			</span>
			<GlowAvatar name={entry.name} imageUrl={imageUrl} sizeClass="w-8 h-8" textClass="text-xs" />
			<div className="leading-tight min-w-0 flex-1">
				<div className="text-white text-[12.5px] font-semibold truncate">{entry.name}</div>
			</div>
			<div className="text-right shrink-0">
				<div className="text-white text-[11.5px] font-semibold tabular-nums">
					{formatValue(value)}
				</div>
			</div>
		</div>
	);
};

// ─── Main panel ────────────────────────────────────────────────────────────────
export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
	isOpen,
	onClose,
	founders: foundersProp = [],
	allInvestors = [],
	currentInvestorId,
	eventDate,
	simpleMode = false,
}) => {
	const [activeTab, setActiveTab] = useState<"investors" | "founders">("investors");

	// Derive investor rankings from allInvestors + live founder prices — no network call
	const investorRankings = useMemo<InvestorEntry[]>(() => {
		const priceMap = new Map<string, number>();
		foundersProp.forEach((f) => priceMap.set(f.id, f.current_price));

		return allInvestors
			.map((inv) => {
				let portfolioValue = 0;
				inv.holdings.forEach((h) => {
					portfolioValue += h.shares * (priceMap.get(h.pitch_id) ?? 0);
				});
				const totalValue = portfolioValue + inv.current_balance;
				return {
					id: inv.id,
					name: inv.name,
					initial_balance: inv.initial_balance,
					total_value: totalValue,
					roi_percent: (totalValue / inv.initial_balance - 1) * 100,
				};
			})
			.sort((a, b) => b.total_value - a.total_value);
	}, [allInvestors, foundersProp]);

	// Derive founder rankings from live founder prices — no network call
	const founderRankings = useMemo<FounderEntry[]>(() => {
		return foundersProp
			.map((f) => ({
				id: f.id,
				name: f.name,
				price: calculateCurrentPrice(f),
				market_cap: calculateMarketCap(f),
				price_change_percent: (calculateCurrentPrice(f) / 10 - 1) * 100,
				profile_picture_url: f.user?.profile_picture_url ?? null,
			}))
			.sort((a, b) => b.market_cap - a.market_cap);
	}, [foundersProp]);

	const formatCurrency = (v: number) =>
		v.toLocaleString("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		});

	const rankings = activeTab === "investors" ? investorRankings : founderRankings;
	const top3 = rankings.slice(0, 3);
	const rest = rankings.slice(3);

	const podiumOrder: { entry: InvestorEntry | FounderEntry; rank: 1 | 2 | 3 }[] = [];
	if (top3[1]) podiumOrder.push({ entry: top3[1], rank: 2 });
	if (top3[0]) podiumOrder.push({ entry: top3[0], rank: 1 });
	if (top3[2]) podiumOrder.push({ entry: top3[2], rank: 3 });

	const currentUserRank =
		activeTab === "investors" && currentInvestorId
			? investorRankings.findIndex((r) => r.id === currentInvestorId)
			: -1;
	const currentUserEntry = currentUserRank >= 0 ? investorRankings[currentUserRank] : null;

	const displayDate = eventDate
		? new Date(eventDate).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
		: new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

	const isLoading = false; // Data always comes from context props — never loading independently

	return (
		<div
			className="fixed inset-0 z-[55] overflow-hidden"
			style={{ pointerEvents: isOpen ? "auto" : "none" }}
		>
			{/* Full-screen dark backdrop */}
			<div
				className="absolute inset-0 bg-black/60"
				style={{
					opacity: isOpen ? 1 : 0,
					transition: "opacity 320ms cubic-bezier(0.22,1,0.36,1)",
				}}
			/>

			{/* Centering wrapper — matches the 430px main column */}
			<div className="absolute inset-0 xl:max-w-[430px] xl:left-1/2 xl:-translate-x-1/2 overflow-hidden">

			{/* The actual panel — slides in from right */}
			<div
				className="absolute inset-0 overflow-hidden"
				style={{
					transform: isOpen ? "translateX(0)" : "translateX(100%)",
					transition: "transform 320ms cubic-bezier(0.22,1,0.36,1)",
				}}
			>
			{/* Panel backgrounds */}
			<div
				aria-hidden="true"
				className="absolute inset-0 bg-cover bg-center bg-no-repeat"
				style={{ backgroundImage: "url('/leaderboard/leaderboard-bg.webp')" }}
			/>
			<div
				className="absolute inset-0"
				style={{ background: "linear-gradient(160deg, rgba(10,8,24,0.88) 0%, rgba(13,11,34,0.82) 50%, rgba(8,10,20,0.9) 100%)" }}
			/>
			<div className="absolute inset-0 pointer-events-none overflow-hidden">
				<div
					className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[60vh] rounded-full opacity-50"
					style={{ background: "radial-gradient(ellipse at center, #2d1b69 0%, #1a0e4a 35%, transparent 70%)" }}
				/>
				<div
					className="absolute top-1/3 -right-24 w-64 h-64 rounded-full opacity-20"
					style={{ background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)", filter: "blur(40px)" }}
				/>
				<div
					className="absolute bottom-1/4 -left-20 w-56 h-56 rounded-full opacity-15"
					style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)", filter: "blur(35px)" }}
				/>
			</div>
			<div aria-hidden="true" className="absolute bottom-0 left-0 right-0 z-[5] pointer-events-none">
				<img
					src="/leaderboard/skyline.webp"
					alt=""
					onError={(e) => (e.currentTarget.style.display = "none")}
					className="w-full h-auto object-cover"
				/>
			</div>

			{simpleMode && (
				<div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-8 text-center" style={{ backdropFilter: "blur(12px)", background: "rgba(8,8,20,0.6)" }}>
					<div
						className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
						style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
					>
						<svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
						</svg>
					</div>
					<p className="text-white font-bold text-lg mb-2">Leaderboard Disabled</p>
					<p className="text-white/40 text-sm leading-relaxed">The leaderboard has been disabled for this event.</p>
					<button
						onClick={onClose}
						className="mt-8 px-6 py-3 rounded-2xl font-bold text-white/70 text-sm transition-all hover:text-white active:scale-95"
						style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
					>
						Go Back
					</button>
				</div>
			)}

			<div className="absolute inset-0 z-10 overflow-y-auto pb-28 px-5" style={{ scrollbarWidth: "none" }}>
			<div>
				<div className="relative pt-6">
					<button
						onClick={onClose}
						aria-label="Back"
						className="absolute left-0 top-6 flex items-center justify-center w-9 h-9 rounded-full transition-all active:scale-90"
						style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
					>
						<ArrowLeft size={18} className="text-white/70" />
					</button>

					<header className="flex flex-col items-center text-center pt-2">
						<img
							src="/leaderboard/logo.png"
							alt="PitchTank"
							onError={(e) => (e.currentTarget.style.display = "none")}
							className="h-[12vh] w-auto object-contain"
						/>
						<div
							className="mt-2 text-sm font-bold tracking-[0.2em]"
							style={{ background: "linear-gradient(90deg, #93c5fd, #c4b5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 0 8px rgba(140,180,255,0.45))" }}
						>
							{displayDate}
						</div>
						<div className="mt-3 flex items-center justify-center gap-3 w-full">
							<span aria-hidden="true" className="h-px flex-1 max-w-[80px]" style={{ background: "linear-gradient(to right, transparent, #22d3ee)" }} />
							<h1 className="text-3xl font-black uppercase tracking-wider text-white whitespace-nowrap" style={{ textShadow: "rgba(184,212,255,0.35) 0px 0px 20px" }}>
								Leaderboard
							</h1>
							<span aria-hidden="true" className="h-px flex-1 max-w-[80px]" style={{ background: "linear-gradient(to left, transparent, #8b5cf6)" }} />
						</div>
					</header>

					<div className="mt-4 flex justify-center">
						<div
							className="flex rounded-full p-1 gap-1"
							style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
							role="tablist"
						>
							{(["investors", "founders"] as const).map((tab) => (
								<button
									key={tab}
									role="tab"
									aria-selected={activeTab === tab}
									onClick={() => setActiveTab(tab)}
									className="px-5 py-1.5 rounded-full text-sm font-semibold capitalize transition-all"
									style={
										activeTab === tab
											? { background: "linear-gradient(135deg, rgba(99,102,241,0.6), rgba(34,211,238,0.4))", color: "#fff", boxShadow: "0 0 14px rgba(99,102,241,0.35)" }
											: { color: "rgba(255,255,255,0.4)" }
									}
								>
									{tab.charAt(0).toUpperCase() + tab.slice(1)}
								</button>
							))}
						</div>
					</div>

					{isLoading ? (
						<div className="flex items-center justify-center py-20">
							<div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
						</div>
					) : rankings.length === 0 ? (
						<div className="text-center py-16 text-white/30 text-sm">No data yet</div>
					) : (
						<>
							{top3.length > 0 && (
								<div className="mt-8 grid grid-cols-3 gap-3 items-end">
									{podiumOrder.map(({ entry, rank }) => (
										<PodiumCard key={entry.id} entry={entry} rank={rank} isFounder={activeTab === "founders"} formatValue={formatCurrency} />
									))}
								</div>
							)}

							{activeTab === "investors" && currentUserEntry && currentUserRank >= 3 && (
								<div className="mt-5">
									<p className="text-xs text-center mb-2 tracking-wider" style={{ color: "#22d3ee", textShadow: "rgba(0,229,255,0.45) 0px 0px 8px" }}>
										You are at
									</p>
									<RankRow entry={currentUserEntry} rank={currentUserRank + 1} isCurrentUser isFounder={false} formatValue={formatCurrency} />
								</div>
							)}

							{rest.length > 0 && (
								<div className="mt-4">
									{rest.map((entry, i) => {
										const rank = i + 4;
										const isCurrentUser =
											activeTab === "investors" && (entry as InvestorEntry).id === currentInvestorId;
										return (
											<RankRow key={entry.id} entry={entry} rank={rank} isCurrentUser={isCurrentUser} isFounder={activeTab === "founders"} formatValue={formatCurrency} />
										);
									})}
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
		</div>
		</div>
	</div>
	);
};
