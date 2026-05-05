import React, { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Avatar, Money } from "../../components/design-system";

type Phase =
	| "intro"
	| "idle"
	| "ticking"
	| "climbing"
	| "settling";

const VALUE_BASE = 1_180_000;
const VALUE_NEW = 1_345_000;
const JORDAN_VALUE = 1_320_000;
const ROW_STRIDE_PX = 48; // approx row height + gap (used for swap translate)

const PODIUM = [
	{ rank: 1 as const, name: "Devon C.", value: 2_450_000 },
	{ rank: 2 as const, name: "Aria N.", value: 2_180_000 },
	{ rank: 3 as const, name: "Sarah K.", value: 1_920_000 },
];

type RowKind = "jordan" | "you" | "riley";

const ROWS: { kind: RowKind; name: string; baseValue: number }[] = [
	{ kind: "jordan", name: "Jordan T.", baseValue: JORDAN_VALUE },
	{ kind: "you", name: "Alex", baseValue: VALUE_BASE },
	{ kind: "riley", name: "Riley M.", baseValue: 1_050_000 },
];

export const LeaderboardDemo: React.FC = () => {
	const [phase, setPhase] = useState<Phase>("intro");
	const [tickedValue, setTickedValue] = useState(VALUE_BASE);

	useEffect(() => {
		const reduce = window.matchMedia?.(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduce) {
			setPhase("settling");
			setTickedValue(VALUE_NEW);
			return;
		}

		let cancelled = false;
		const timeouts: number[] = [];

		const run = () => {
			if (cancelled) return;
			setPhase("intro");
			setTickedValue(VALUE_BASE);
			const at = (ms: number, p: Phase) =>
				timeouts.push(
					window.setTimeout(() => {
						if (!cancelled) setPhase(p);
					}, ms),
				);
			at(700, "idle");
			at(1500, "ticking");
			at(2700, "climbing");
			at(3700, "settling");
			timeouts.push(window.setTimeout(run, 5000));
		};
		run();

		return () => {
			cancelled = true;
			timeouts.forEach(clearTimeout);
		};
	}, []);

	// Counter animation: tween VALUE_BASE → VALUE_NEW during the ticking phase
	useEffect(() => {
		if (phase !== "ticking") return;
		const duration = 900;
		const start = performance.now();
		let raf = 0;
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / duration);
			const eased = 1 - Math.pow(1 - t, 3);
			setTickedValue(VALUE_BASE + (VALUE_NEW - VALUE_BASE) * eased);
			if (t < 1) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [phase]);

	useEffect(() => {
		if (phase === "climbing" || phase === "settling") {
			setTickedValue(VALUE_NEW);
		}
	}, [phase]);

	const isSwapped = phase === "climbing" || phase === "settling";
	const showRankBadge = isSwapped;
	const youGlow = isSwapped;
	const visible = phase !== "intro";

	return (
		<div className="lb-demo w-full select-none">
			{/* Header */}
			<div className="flex items-center justify-between mb-2 px-1">
				<div className="text-[10px] uppercase tracking-widest text-pt-text-2 font-display font-semibold">
					Leaderboard
				</div>
				<div className="text-[10px] text-pt-text-2 font-display font-semibold uppercase tracking-wider">
					Investors
				</div>
			</div>

			{/* Podium */}
			<div className="grid grid-cols-3 gap-2 items-end mb-3">
				<PodiumSlot entry={PODIUM[1]} delay={120} visible={visible} />
				<PodiumSlot entry={PODIUM[0]} delay={0} visible={visible} />
				<PodiumSlot entry={PODIUM[2]} delay={220} visible={visible} />
			</div>

			{/* Rank rows. DOM order is fixed (Jordan, You, Riley); swap is done
			    via translateY on the two affected rows + rank-label flips. */}
			<div className="space-y-1.5 relative">
				{ROWS.map((row, idx) => {
					const isYou = row.kind === "you";
					const isJordan = row.kind === "jordan";
					const animatedValue = isYou ? tickedValue : row.baseValue;

					// Display rank: shifts during the swap.
					let displayRank = idx + 4; // 4, 5, 6
					if (isSwapped && isYou) displayRank = 4;
					else if (isSwapped && isJordan) displayRank = 5;

					// Translation during swap.
					let translateY = 0;
					if (isSwapped && isYou) translateY = -ROW_STRIDE_PX;
					else if (isSwapped && isJordan) translateY = ROW_STRIDE_PX;

					const isPulsing = isYou && phase === "ticking";

					return (
						<RankRow
							key={row.kind}
							rank={displayRank}
							name={row.name}
							value={animatedValue}
							isYou={isYou}
							isGlowing={isYou && youGlow}
							isPulsing={isPulsing}
							delay={350 + idx * 100}
							visible={visible}
							translateY={translateY}
						>
							{isYou && showRankBadge && <RankBadge />}
						</RankRow>
					);
				})}
			</div>

			<LeaderboardDemoStyles />
		</div>
	);
};

const PodiumSlot: React.FC<{
	entry: { rank: 1 | 2 | 3; name: string; value: number };
	delay: number;
	visible: boolean;
}> = ({ entry, delay, visible }) => {
	const isFirst = entry.rank === 1;
	const accent =
		entry.rank === 1
			? { color: "#f97316", glow: "rgba(249,115,22,0.40)", border: "rgba(249,115,22,0.30)" }
			: entry.rank === 2
				? { color: "#22d3ee", glow: "rgba(34,211,238,0.35)", border: "rgba(34,211,238,0.22)" }
				: { color: "#a78bfa", glow: "rgba(167,139,250,0.35)", border: "rgba(167,139,250,0.22)" };

	return (
		<div
			className="lb-stagger flex flex-col items-center"
			data-show={visible}
			style={{ "--delay": `${delay}ms` } as React.CSSProperties}
		>
			<div
				className={`relative ${isFirst ? "w-[78px] h-[78px] -mt-2" : "w-[68px] h-[68px]"}`}
			>
				<div className="absolute inset-[18%]">
					<div className="lb-avatar-ring relative w-full h-full">
						<div
							className="absolute -inset-[3px] rounded-full opacity-60 blur-md"
							style={{
								background:
									"linear-gradient(135deg, #3b82f6, #8b5cf6)",
							}}
						/>
						<div
							className="relative w-full h-full rounded-full p-[2px]"
							style={{
								background:
									"linear-gradient(135deg, #3b82f6, #8b5cf6)",
							}}
						>
							<div className="w-full h-full rounded-full overflow-hidden">
								<Avatar
									size={isFirst ? "lg" : "md"}
									name={entry.name}
									className="!w-full !h-full"
								/>
							</div>
						</div>
					</div>
				</div>
				<img
					src={`/leaderboard/ranking-${entry.rank}.webp`}
					alt=""
					aria-hidden="true"
					onError={(e) => (e.currentTarget.style.display = "none")}
					className="pointer-events-none absolute inset-0 w-full h-full object-contain"
				/>
			</div>
			<div
				className="mt-2 w-full text-center px-1.5 py-1.5 rounded-lg"
				style={{
					background: "rgba(255,255,255,0.04)",
					border: `1px solid ${accent.border}`,
					boxShadow: `0 0 12px ${accent.glow}`,
				}}
			>
				<div className="text-white text-[10.5px] font-display font-semibold leading-tight truncate">
					{entry.name}
				</div>
				<div
					className="mt-0.5 text-[10.5px] font-display font-semibold num"
					style={{ color: accent.color }}
				>
					<CompactMoney value={entry.value} />
				</div>
			</div>
		</div>
	);
};

const RankRow: React.FC<{
	rank: number;
	name: string;
	value: number;
	isYou: boolean;
	isGlowing: boolean;
	isPulsing: boolean;
	delay: number;
	visible: boolean;
	translateY?: number;
	children?: React.ReactNode;
}> = ({
	rank,
	name,
	value,
	isYou,
	isGlowing,
	isPulsing,
	delay,
	visible,
	translateY = 0,
	children,
}) => {
	const baseBg = isYou ? "rgba(34,211,238,0.07)" : "rgba(255,255,255,0.03)";
	const baseBorder = isYou
		? "rgba(34,211,238,0.25)"
		: "rgba(255,255,255,0.07)";
	const glowBg = "rgba(34,211,238,0.14)";
	const glowBorder = "rgba(34,211,238,0.55)";

	return (
		<div
			className="lb-stagger lb-row relative px-3 py-2 rounded-xl flex items-center gap-2.5"
			data-show={visible}
			data-glow={isGlowing}
			data-pulse={isPulsing}
			style={{
				background: isGlowing ? glowBg : baseBg,
				border: `1px solid ${isGlowing ? glowBorder : baseBorder}`,
				boxShadow: isGlowing
					? "0 0 22px rgba(34,211,238,0.35)"
					: undefined,
				zIndex: translateY !== 0 ? 5 : 1,
				"--delay": `${delay}ms`,
				"--swap-y": `${translateY}px`,
			} as React.CSSProperties}
		>
			<span
				className="font-display font-bold text-[12.5px] num w-5 text-center shrink-0"
				style={{ color: isYou ? "#22d3ee" : "rgba(255,255,255,0.40)" }}
			>
				{rank}
			</span>
			<div className="relative w-7 h-7 shrink-0">
				<div
					className="absolute -inset-[2px] rounded-full opacity-55 blur-sm"
					style={{
						background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
					}}
				/>
				<div
					className="relative w-full h-full rounded-full p-[1.5px]"
					style={{
						background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
					}}
				>
					<div className="w-full h-full rounded-full overflow-hidden">
						<Avatar size="sm" name={name} className="!w-full !h-full" />
					</div>
				</div>
			</div>
			<div className="leading-tight min-w-0 flex-1">
				<div className="text-white text-[12px] font-display font-semibold truncate">
					{name}
				</div>
			</div>
			<div className="text-right shrink-0">
				<div
					className="text-white text-[11.5px] font-display font-semibold num"
					style={{
						textShadow: isPulsing ? "0 0 8px rgba(34,211,238,0.7)" : undefined,
					}}
				>
					<CompactMoney value={value} />
				</div>
			</div>
			{children}
		</div>
	);
};

const RankBadge: React.FC = () => (
	<span className="lb-rank-badge" aria-hidden="true">
		<TrendingUp size={10} strokeWidth={2.5} />
		+1 rank
	</span>
);

const CompactMoney: React.FC<{ value: number }> = ({ value }) => {
	if (value >= 1_000_000) {
		const m = value / 1_000_000;
		return (
			<>
				$
				<Money value={m} decimals={m % 1 === 0 ? 0 : 2} withSymbol={false} />M
			</>
		);
	}
	if (value >= 1000) {
		const k = value / 1000;
		return (
			<>
				$
				<Money value={k} decimals={k % 1 === 0 ? 0 : 1} withSymbol={false} />K
			</>
		);
	}
	return <Money value={value} decimals={0} />;
};

const LeaderboardDemoStyles: React.FC = () => (
	<style>{`
		.lb-stagger {
			opacity: 0;
			transform: translateY(8px);
			transition:
				opacity 360ms cubic-bezier(0.22, 1, 0.36, 1) var(--delay, 0ms),
				transform 520ms cubic-bezier(0.4, 0, 0.2, 1) var(--delay, 0ms);
		}
		.lb-stagger[data-show="true"] {
			opacity: 1;
			transform: translateY(var(--swap-y, 0px));
		}
		/* During swap, transform should react immediately (ignore stagger delay) */
		.lb-row[data-show="true"] {
			transition:
				background 320ms ease,
				border 320ms ease,
				box-shadow 320ms ease,
				transform 520ms cubic-bezier(0.4, 0, 0.2, 1);
		}

		[data-pulse="true"] {
			animation: lb-row-pulse 0.9s ease-in-out;
		}
		@keyframes lb-row-pulse {
			0%, 100% { transform: scale(1); }
			50%      { transform: scale(1.015); }
		}

		.lb-rank-badge {
			position: absolute;
			top: -10px;
			right: 8px;
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 4px 8px;
			border-radius: 999px;
			background: linear-gradient(135deg, rgba(64,243,197,0.20), rgba(34,211,238,0.20));
			border: 1px solid rgba(64,243,197,0.45);
			color: #b8fdea;
			font-family: 'Tomorrow', system-ui, sans-serif;
			font-size: 9.5px;
			font-weight: 600;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			box-shadow:
				0 0 14px rgba(64,243,197,0.35),
				0 0 22px rgba(34,211,238,0.20);
			animation: lb-badge-pop 480ms cubic-bezier(0.34, 1.56, 0.64, 1);
			z-index: 10;
		}
		@keyframes lb-badge-pop {
			0%   { opacity: 0; transform: translateY(6px) scale(0.8); }
			60%  { opacity: 1; transform: translateY(-1px) scale(1.05); }
			100% { opacity: 1; transform: translateY(0) scale(1); }
		}
	`}</style>
);

export default LeaderboardDemo;
