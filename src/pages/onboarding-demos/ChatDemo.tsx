import React, { useEffect, useState } from "react";
import { Avatar } from "../../components/design-system";

const STEP = {
	empty: 0,
	q: 1,
	reply: 2,
	comment: 3,
	typing: 4,
	settled: 5,
} as const;
type Step = (typeof STEP)[keyof typeof STEP];

interface Msg {
	id: string;
	name: string;
	color: string;
	text: string;
	isQuestion?: boolean;
	time: string;
}

const QUESTION: Msg = {
	id: "q",
	name: "Maya R.",
	color: "#22d3ee",
	text: "How big is the market?",
	isQuestion: true,
	time: "2:14",
};
const REPLY: Msg = {
	id: "reply",
	name: "Aria N.",
	color: "#a78bfa",
	text: "$120B and growing fast — early-stage tools are exploding.",
	time: "2:14",
};
const COMMENT: Msg = {
	id: "comment",
	name: "Devon C.",
	color: "#f97316",
	text: "Bullish on this team 🔥",
	time: "2:15",
};

// Reactions that float up from the founder reply
const REACTIONS = ["🔥", "👏", "🚀"];

export const ChatDemo: React.FC = () => {
	const [step, setStep] = useState<Step>(STEP.empty);
	const [reactionKey, setReactionKey] = useState(0);

	useEffect(() => {
		const reduce = window.matchMedia?.(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduce) {
			setStep(STEP.settled);
			return;
		}

		let cancelled = false;
		const timeouts: number[] = [];

		const run = () => {
			if (cancelled) return;
			setStep(STEP.empty);
			const at = (ms: number, s: Step) =>
				timeouts.push(
					window.setTimeout(() => {
						if (!cancelled) setStep(s);
					}, ms),
				);
			at(450, STEP.q);
			at(1500, STEP.reply);
			// trigger reactions just after reply lands
			timeouts.push(
				window.setTimeout(() => {
					if (!cancelled) setReactionKey((k) => k + 1);
				}, 1700),
			);
			at(2700, STEP.comment);
			at(3700, STEP.typing);
			at(4500, STEP.settled);
			timeouts.push(window.setTimeout(run, 5500));
		};
		run();

		return () => {
			cancelled = true;
			timeouts.forEach(clearTimeout);
		};
	}, []);

	const showQ = step >= STEP.q;
	const showReply = step >= STEP.reply;
	const showComment = step >= STEP.comment;
	const showTyping = step >= STEP.typing;

	return (
		<div className="ch-demo w-full select-none">
			{/* Header */}
			<div className="flex items-center justify-between mb-2 px-1">
				<div className="text-[10px] uppercase tracking-widest text-pt-text-2 font-display font-semibold">
					Live Q&amp;A
				</div>
				<div className="flex items-center gap-1.5">
					<span className="ch-live-dot" aria-hidden="true" />
					<span className="text-[10px] text-pt-text-2 font-display font-semibold uppercase tracking-wider">
						47 watching
					</span>
				</div>
			</div>

			<div className="ch-stage relative">
				{/* Soft ambient glow inside the stage */}
				<div
					aria-hidden="true"
					className="absolute -top-12 left-1/2 -translate-x-1/2 w-[120%] h-[40%] pointer-events-none"
					style={{
						background:
							"radial-gradient(ellipse at center, rgba(162,89,255,0.18) 0%, transparent 70%)",
						filter: "blur(20px)",
					}}
				/>

				<div className="ch-thread">
					<MessageRow msg={QUESTION} show={showQ} />
					<div className="relative">
						<MessageRow msg={REPLY} show={showReply} />
						{/* Floating reactions emerging from the founder reply */}
						{showReply && (
							<div className="ch-reactions" key={reactionKey} aria-hidden="true">
								{REACTIONS.map((emoji, i) => (
									<span
										key={`${reactionKey}-${i}`}
										className="ch-reaction"
										style={
											{
												"--delay": `${i * 220}ms`,
												"--drift": `${(i - 1) * 12}px`,
											} as React.CSSProperties
										}
									>
										{emoji}
									</span>
								))}
							</div>
						)}
					</div>
					<MessageRow msg={COMMENT} show={showComment} />
				</div>

				{/* Composer area — typing indicator */}
				<div className="ch-composer">
					<div
						aria-hidden="true"
						className="h-px w-full mb-3"
						style={{
							background:
								"linear-gradient(to right, transparent 0%, rgba(0,229,255,0.55) 25%, rgba(162,89,255,0.7) 60%, transparent 100%)",
						}}
					/>
					<div className="ch-typing-row" data-show={showTyping}>
						<div className="w-6 h-6 shrink-0">
							<Avatar size="sm" name="Alex" className="!w-full !h-full" />
						</div>
						<div className="ch-typing-bubble">
							<span className="ch-dot" style={{ animationDelay: "0ms" }} />
							<span className="ch-dot" style={{ animationDelay: "180ms" }} />
							<span className="ch-dot" style={{ animationDelay: "360ms" }} />
						</div>
						<span className="text-pt-text-3 text-[10.5px] font-display">
							Alex is typing…
						</span>
					</div>
				</div>
			</div>

			<ChatDemoStyles />
		</div>
	);
};

const MessageRow: React.FC<{ msg: Msg; show: boolean }> = ({ msg, show }) => (
	<div className="ch-msg-row" data-show={show}>
		<div className="w-9 h-9 shrink-0">
			<Avatar size="md" name={msg.name} className="!w-full !h-full" />
		</div>
		<div className="leading-tight min-w-0 flex-1 pt-0.5">
			<div className="flex items-baseline gap-2 flex-wrap">
				<span
					className="font-display font-semibold text-[12.5px]"
					style={{ color: msg.color }}
				>
					{msg.name}
				</span>
				<span className="text-[9.5px] text-pt-text-3 num">{msg.time}</span>
				{msg.isQuestion && (
					<span
						className="inline-flex items-center px-1.5 h-[14px] rounded-full text-[8px] font-display font-semibold tracking-wider uppercase"
						style={{
							color: "var(--c-cyan)",
							background: "rgba(0,229,255,0.14)",
							boxShadow: "inset 0 0 0 1px rgba(0,229,255,0.40)",
						}}
					>
						Q
					</span>
				)}
			</div>
			<p className="mt-0.5 text-[12.5px] text-white/90 whitespace-pre-line break-words leading-snug">
				{msg.text}
			</p>
		</div>
	</div>
);

const ChatDemoStyles: React.FC = () => (
	<style>{`
		.ch-stage {
			position: relative;
			border-radius: 18px;
			background:
				linear-gradient(180deg, rgba(20,15,50,0.55) 0%, rgba(13,11,34,0.55) 100%);
			border: 1px solid rgba(184,212,255,0.12);
			box-shadow:
				inset 0 1px 0 rgba(184,212,255,0.10),
				0 12px 32px rgba(0,0,0,0.40);
			overflow: hidden;
		}

		.ch-thread {
			padding: 16px 14px 6px;
			display: flex;
			flex-direction: column;
			gap: 14px;
			min-height: 200px;
		}

		.ch-msg-row {
			display: flex;
			align-items: flex-start;
			gap: 10px;
			opacity: 0;
			transform: translateY(6px);
			transition:
				opacity 360ms cubic-bezier(0.22, 1, 0.36, 1),
				transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
		}
		.ch-msg-row[data-show="true"] {
			opacity: 1;
			transform: translateY(0);
		}

		/* Live dot on header */
		.ch-live-dot {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: #34d399;
			box-shadow: 0 0 8px rgba(52,211,153,0.7);
			animation: ch-live-pulse 1.6s ease-in-out infinite;
		}
		@keyframes ch-live-pulse {
			0%, 100% { opacity: 1;   transform: scale(1); }
			50%      { opacity: 0.5; transform: scale(0.85); }
		}

		/* Floating reactions */
		.ch-reactions {
			position: absolute;
			right: 12px;
			top: 28px;
			width: 60px;
			height: 0;
			pointer-events: none;
		}
		.ch-reaction {
			position: absolute;
			right: 0;
			top: 0;
			font-size: 18px;
			line-height: 1;
			opacity: 0;
			transform: translate(0, 0) scale(0.6);
			animation: ch-reaction-rise 1.6s cubic-bezier(0.22, 1, 0.36, 1) var(--delay, 0ms) forwards;
			text-shadow: 0 0 12px rgba(255,138,0,0.4);
		}
		@keyframes ch-reaction-rise {
			0%   { opacity: 0;   transform: translate(0, 6px) scale(0.6); }
			15%  { opacity: 1;   transform: translate(var(--drift, 0), -8px) scale(1.1); }
			60%  { opacity: 0.9; transform: translate(var(--drift, 0), -38px) scale(1); }
			100% { opacity: 0;   transform: translate(var(--drift, 0), -64px) scale(0.85); }
		}

		/* Composer */
		.ch-composer {
			padding: 10px 14px 14px;
			background: rgba(3,4,13,0.50);
		}
		.ch-typing-row {
			display: flex;
			align-items: center;
			gap: 8px;
			opacity: 0;
			transform: translateY(4px);
			transition:
				opacity 280ms ease,
				transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
		}
		.ch-typing-row[data-show="true"] {
			opacity: 1;
			transform: translateY(0);
		}
		.ch-typing-bubble {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 7px 11px;
			border-radius: 14px;
			background: rgba(255,255,255,0.06);
			border: 1px solid rgba(255,255,255,0.08);
		}
		.ch-dot {
			width: 4.5px;
			height: 4.5px;
			border-radius: 50%;
			background: rgba(255,255,255,0.65);
			animation: ch-dot-bounce 1.1s infinite ease-in-out;
		}
		@keyframes ch-dot-bounce {
			0%, 80%, 100% { transform: scale(0.65); opacity: 0.4; }
			40%           { transform: scale(1);    opacity: 1; }
		}
	`}</style>
);

export default ChatDemo;
