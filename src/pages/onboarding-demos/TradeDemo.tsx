import React, { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, Check, MessageSquare } from "lucide-react";
import {
	Avatar,
	Button,
	GlassCard,
	Money,
	TrendValue,
	ExpandedSparkline,
	Sparkline,
} from "../../components/design-system";

const ARIA_SERIES = [
	245.1, 244.6, 245.9, 246.2, 245.4, 246.0, 247.3, 248.1, 247.4, 249.0,
	250.5, 250.1, 251.4, 252.0, 252.5,
];
const SARAH_SERIES = [
	186.4, 187.2, 186.9, 187.8, 188.4, 187.9, 188.7, 189.1, 189.6, 189.2,
];
const MARCUS_SERIES = [
	98.4, 97.8, 97.2, 96.5, 96.0, 95.8, 95.3, 95.1, 94.6, 94.8,
];

type Phase =
	| "idle"
	| "buyPress"
	| "typingFeedback"
	| "priceUp"
	| "celebrating"
	| "settling";

const PRICE_BASE = 245.5;
const PRICE_NEW = 252.3;
const CHANGE_BASE = 5.2;
const CHANGE_NEW = 7.6;

const FEEDBACK_TEXT = "Sharp founder, clear traction.";
const TYPE_INTERVAL_MS = 38;

export const TradeDemo: React.FC = () => {
	const [phase, setPhase] = useState<Phase>("idle");
	const [typedChars, setTypedChars] = useState(0);

	useEffect(() => {
		const reduce = window.matchMedia?.(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduce) {
			setTypedChars(FEEDBACK_TEXT.length);
			return;
		}

		let cancelled = false;
		const timeouts: number[] = [];

		const run = () => {
			if (cancelled) return;
			setPhase("idle");
			setTypedChars(0);
			const at = (ms: number, p: Phase) =>
				timeouts.push(
					window.setTimeout(() => {
						if (!cancelled) setPhase(p);
					}, ms),
				);
			at(800, "buyPress");
			at(1100, "typingFeedback");
			at(2500, "priceUp");
			at(2900, "celebrating");
			at(4200, "settling");
			timeouts.push(window.setTimeout(run, 5200));
		};
		run();

		return () => {
			cancelled = true;
			timeouts.forEach(clearTimeout);
		};
	}, []);

	// Drive the typing cursor when entering the typingFeedback phase
	useEffect(() => {
		if (phase !== "typingFeedback") return;
		setTypedChars(0);
		let chars = 0;
		const interval = window.setInterval(() => {
			chars += 1;
			setTypedChars(chars);
			if (chars >= FEEDBACK_TEXT.length) window.clearInterval(interval);
		}, TYPE_INTERVAL_MS);
		return () => window.clearInterval(interval);
	}, [phase]);

	// Hold the full feedback during later phases (no re-typing)
	useEffect(() => {
		if (
			phase === "priceUp" ||
			phase === "celebrating" ||
			phase === "settling"
		) {
			setTypedChars(FEEDBACK_TEXT.length);
		}
	}, [phase]);

	const showElevated =
		phase === "priceUp" || phase === "celebrating" || phase === "settling";
	const price = showElevated ? PRICE_NEW : PRICE_BASE;
	const change = showElevated ? CHANGE_NEW : CHANGE_BASE;
	const showToast = phase === "celebrating" || phase === "settling";
	const buyActive = phase === "buyPress";
	const priceFlash = phase === "priceUp";
	const feedbackOpen =
		phase === "typingFeedback" ||
		phase === "priceUp" ||
		phase === "celebrating" ||
		phase === "settling";
	const isTyping = phase === "typingFeedback";

	const typedText = FEEDBACK_TEXT.slice(0, typedChars);

	return (
		<div className="trade-demo w-full select-none">
			{/* Header */}
			<div className="flex items-center justify-between mb-2 px-1">
				<div className="text-[10px] uppercase tracking-widest text-pt-text-2 font-display font-semibold">
					Trade Market
				</div>
				<div className="text-[10px] text-pt-text-2 num font-semibold">
					$1,000,000
				</div>
			</div>

			{/* Card + floating toast wrapper. Wrapper is .relative but does NOT
			    clip overflow, so the toast can render above the card. */}
			<div className="relative mb-2.5">
				{/* Floating success toast — sits above the card */}
				<div className="td-toast" data-show={showToast} aria-hidden="true">
					<Check size={12} strokeWidth={2.5} />
					<span>Bought 5 shares · $50K</span>
				</div>

				<GlassCard tone="purple" active size="md" className="relative">
					<button
						type="button"
						tabIndex={-1}
						aria-hidden="true"
						className="p-1 absolute top-3 right-3 z-10"
					>
						<ChevronUp size={16} color="#A7B3C9" strokeWidth={1.5} />
					</button>

					<div className="flex items-start gap-3">
						<Avatar size="md" name="Aria N." />
						<div className="flex-1 leading-tight pt-0.5">
							<div className="font-display text-white text-[15px] font-semibold tracking-tight">
								Aria N.
							</div>
							<div className="text-[12px] text-pt-text-2">Pulse</div>
						</div>
						<div className="text-right pt-0.5 pr-7">
							<div
								className={`font-display text-white text-[15px] font-semibold tracking-tight ${
									priceFlash ? "td-flash" : ""
								}`}
								style={{ transition: "color 240ms ease" }}
							>
								<Money value={price} />
							</div>
							<div className="text-[12px] flex items-center justify-end">
								<TrendValue value={change} />
							</div>
						</div>
					</div>

					<div className="mt-2 mb-3 -mx-1 overflow-hidden">
						<ExpandedSparkline
							width={358}
							height={62}
							series={ARIA_SERIES}
							color="#40F3C5"
							live
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<Button
							variant="buy"
							size="md"
							tabIndex={-1}
							className={buyActive ? "td-buy-active" : ""}
						>
							Buy
						</Button>
						<Button variant="sell" size="md" tabIndex={-1}>
							Sell
						</Button>
					</div>

					{/* Inline feedback box — appears after buy press, types in */}
					<div className="td-feedback" data-open={feedbackOpen}>
						<div className="td-feedback-inner">
							<div className="flex items-center gap-1.5 mb-1.5">
								<MessageSquare
									size={11}
									strokeWidth={1.8}
									className="text-pt-text-3"
								/>
								<span className="text-[10px] uppercase tracking-widest font-display font-semibold text-pt-text-3">
									Feedback
								</span>
							</div>
							<div className="td-feedback-text">
								{typedText}
								{isTyping && <span className="td-cursor" aria-hidden="true" />}
							</div>
						</div>
					</div>
				</GlassCard>
			</div>

			{/* Collapsed rows for context */}
			<CollapsedRow
				name="Sarah K."
				company="Vault"
				price={189.2}
				change={1.8}
				series={SARAH_SERIES}
				isUp={true}
			/>
			<CollapsedRow
				name="Marcus T."
				company="Loop"
				price={94.8}
				change={-3.2}
				series={MARCUS_SERIES}
				isUp={false}
			/>

			<TradeDemoStyles />
		</div>
	);
};

interface CollapsedRowProps {
	name: string;
	company: string;
	price: number;
	change: number;
	series: number[];
	isUp: boolean;
}

const CollapsedRow: React.FC<CollapsedRowProps> = ({
	name,
	company,
	price,
	change,
	series,
	isUp,
}) => (
	<GlassCard tone="frame" size="sm" className="mb-2">
		<div className="flex items-center gap-2">
			<Avatar size="sm" name={name} />
			<div className="leading-tight min-w-0 flex-1">
				<div className="font-display text-white text-[12.5px] font-semibold truncate">
					{name}
				</div>
				<div className="text-[10.5px] text-pt-text-2 truncate">{company}</div>
			</div>
			<div className="opacity-90 shrink-0">
				<Sparkline
					width={42}
					height={22}
					series={series}
					color={isUp ? "#40F3C5" : "#FF8A2B"}
				/>
			</div>
			<div className="text-right leading-tight shrink-0">
				<div className="font-display text-white text-[11.5px] font-semibold num">
					<Money value={price} />
				</div>
				<TrendValue value={change} className="text-[10.5px]" />
			</div>
			<ChevronDown
				size={13}
				color="#7C8AA6"
				strokeWidth={1.5}
				className="shrink-0 ml-1"
			/>
		</div>
	</GlassCard>
);

const TradeDemoStyles: React.FC = () => (
	<style>{`
		.td-flash {
			color: #40F3C5 !important;
			text-shadow: 0 0 12px rgba(64,243,197,0.7);
			animation: td-flash-anim 600ms ease-out;
		}
		@keyframes td-flash-anim {
			0%   { transform: translateY(2px) scale(0.96); opacity: 0.6; }
			40%  { transform: translateY(-1px) scale(1.06); opacity: 1; }
			100% { transform: translateY(0) scale(1); opacity: 1; }
		}

		.td-buy-active {
			transform: translateY(1px) scale(0.97);
			filter: brightness(1.25);
			box-shadow:
				inset 0 1px 0 rgba(184,240,255,0.45),
				0 0 30px rgba(0,229,255,0.55) !important;
			transition: all 200ms ease;
		}

		/* Floating toast — sits above the card */
		.td-toast {
			position: absolute;
			left: 50%;
			top: -14px;
			transform: translate(-50%, -10px);
			display: inline-flex;
			align-items: center;
			gap: 6px;
			padding: 7px 12px;
			border-radius: 999px;
			background: linear-gradient(135deg, rgba(64,243,197,0.20), rgba(34,211,238,0.20));
			border: 1px solid rgba(64,243,197,0.45);
			color: #b8fdea;
			font-family: 'Tomorrow', system-ui, sans-serif;
			font-size: 11px;
			font-weight: 600;
			letter-spacing: 0.04em;
			white-space: nowrap;
			box-shadow:
				0 0 18px rgba(64,243,197,0.40),
				0 0 28px rgba(34,211,238,0.25);
			opacity: 0;
			pointer-events: none;
			transition: opacity 280ms ease, transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1);
			z-index: 30;
		}
		.td-toast[data-show="true"] {
			opacity: 1;
			transform: translate(-50%, 0);
		}

		/* Inline feedback box — collapses with grid-rows trick */
		.td-feedback {
			display: grid;
			grid-template-rows: 0fr;
			opacity: 0;
			transform: translateY(-2px);
			transition:
				grid-template-rows 320ms cubic-bezier(0.22, 1, 0.36, 1),
				opacity 220ms ease,
				transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
				margin-top 320ms cubic-bezier(0.22, 1, 0.36, 1);
			margin-top: 0;
		}
		.td-feedback[data-open="true"] {
			grid-template-rows: 1fr;
			opacity: 1;
			transform: translateY(0);
			margin-top: 12px;
		}
		.td-feedback-inner {
			overflow: hidden;
			min-height: 0;
		}
		.td-feedback-inner > * {
			padding: 10px 12px;
		}
		.td-feedback-inner > .flex {
			padding-bottom: 0;
		}
		.td-feedback-text {
			font-family: 'Tomorrow', system-ui, sans-serif;
			font-size: 12px;
			line-height: 1.45;
			color: var(--c-text-1, #fff);
			min-height: 28px;
			padding: 6px 12px 10px 12px;
			background: rgba(255,255,255,0.025);
			border: 1px solid rgba(184,212,255,0.16);
			border-radius: 10px;
			letter-spacing: 0.01em;
		}
		.td-cursor {
			display: inline-block;
			width: 1px;
			height: 12px;
			margin-left: 2px;
			vertical-align: -1px;
			background: var(--c-cyan, #00E5FF);
			box-shadow: 0 0 6px rgba(0,229,255,0.6);
			animation: td-cursor-blink 0.9s steps(2, end) infinite;
		}
		@keyframes td-cursor-blink {
			0%, 100% { opacity: 1; }
			50%      { opacity: 0; }
		}

		.trade-demo .pt-btn:not(.td-buy-active) {
			pointer-events: none;
		}
	`}</style>
);

export default TradeDemo;
