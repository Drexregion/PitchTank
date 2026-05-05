import React, { useEffect, useState } from "react";
import {
	Sparkles,
	MessageCircle,
	ArrowLeft,
	Send,
} from "lucide-react";
import { Avatar } from "../../components/design-system";

// Demo-only portraits (stable seeds via i.pravatar.cc). Avatar gracefully
// falls back to initials + gradient if these fail to load (offline, etc.).
const SUGGESTED = [
	{
		name: "Aria N.",
		subtitle: "Pulse · founder",
		reason: "Building infra you've backed before",
		photo: "https://i.pravatar.cc/160?img=47",
	},
	{
		name: "Devon C.",
		subtitle: "Vault · founder",
		reason: "Strong overlap on B2B SaaS thesis",
		photo: "https://i.pravatar.cc/160?img=33",
	},
	{
		name: "Sarah K.",
		subtitle: "Loop · investor",
		reason: "You both back early-stage AI tooling",
		photo: null as string | null,
	},
];

const PEER = SUGGESTED[1]; // Devon C. is the one we DM with
const ALEX_MESSAGE = "Loved your pitch on Vault.";
const DEVON_MESSAGE = "Thanks! Want to grab coffee?";

const STEP = {
	listIn: 0,
	idle: 1,
	dmTap: 2,
	panelUp: 3,
	msg1: 4, // Alex outgoing
	typing: 5,
	msg2: 6, // Devon incoming
	settled: 7,
	panelDown: 8,
} as const;
type Step = (typeof STEP)[keyof typeof STEP];

export const NetworkDemo: React.FC = () => {
	const [step, setStep] = useState<Step>(STEP.listIn);

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
			setStep(STEP.listIn);
			const at = (ms: number, s: Step) =>
				timeouts.push(
					window.setTimeout(() => {
						if (!cancelled) setStep(s);
					}, ms),
				);
			at(700, STEP.idle);
			at(1400, STEP.dmTap);
			at(1700, STEP.panelUp);
			at(2400, STEP.msg1);
			at(3100, STEP.typing);
			at(3900, STEP.msg2);
			at(4600, STEP.settled);
			at(5400, STEP.panelDown);
			timeouts.push(window.setTimeout(run, 6100));
		};
		run();

		return () => {
			cancelled = true;
			timeouts.forEach(clearTimeout);
		};
	}, []);

	const listVisible = step >= STEP.listIn;
	const dmTapped = step === STEP.dmTap;
	const panelOpen =
		step >= STEP.panelUp && step !== STEP.panelDown;
	const showMsg1 = step >= STEP.msg1 && step !== STEP.panelDown;
	const showTyping = step === STEP.typing;
	const showMsg2 = step >= STEP.msg2 && step !== STEP.panelDown;

	return (
		<div className="nw-demo w-full select-none relative overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between mb-2 px-1">
				<div className="text-[10px] uppercase tracking-widest text-pt-text-2 font-display font-semibold">
					Network
				</div>
				<div className="text-[10px] text-pt-text-2 font-display font-semibold uppercase tracking-wider">
					Live event
				</div>
			</div>

			{/* The card surface — fixed-ish height so the DM panel can overlay it. */}
			<div className="nw-stage relative">
				{/* Suggested list */}
				<div className="nw-list">
					<div className="px-4 pt-3 pb-2 flex items-center gap-1.5">
						<Sparkles size={11} className="text-violet-400/70" />
						<p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.18em]">
							Suggested for You
						</p>
					</div>
					{SUGGESTED.map((person, idx) => {
						const isHighlighted = idx === 1; // Devon C.
						const dmActive = isHighlighted && dmTapped;
						return (
							<div
								key={person.name}
								className="nw-row flex items-start gap-3 px-4 py-3"
								data-show={listVisible}
								style={
									{
										"--delay": `${idx * 110}ms`,
										borderTop:
											idx === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
									} as React.CSSProperties
								}
							>
								<div className="w-10 h-10 shrink-0">
									<Avatar
										size="md"
										name={person.name}
										photo={person.photo}
										className="!w-full !h-full"
									/>
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-white font-display font-bold text-[13px] leading-none mb-0.5 truncate">
										{person.name}
									</p>
									<p className="text-white/40 text-[11px] leading-snug truncate mb-1">
										{person.subtitle}
									</p>
									<div className="flex items-start gap-1">
										<Sparkles
											size={9}
											className="text-violet-400/60 mt-0.5 shrink-0"
										/>
										<p className="text-violet-300/75 text-[11px] leading-snug">
											{person.reason}
										</p>
									</div>
								</div>
								<button
									tabIndex={-1}
									aria-hidden="true"
									className={`nw-dm-btn shrink-0 mt-0.5 ${
										dmActive ? "is-active" : ""
									}`}
								>
									<MessageCircle
										size={13}
										className="text-indigo-300/80"
										strokeWidth={2.2}
									/>
								</button>
							</div>
						);
					})}
				</div>

				{/* DM panel — slides up from the bottom, covering the list */}
				<div className="nw-dm-panel" data-show={panelOpen}>
					<div className="nw-dm-header">
						<button
							tabIndex={-1}
							aria-hidden="true"
							className="nw-dm-back"
						>
							<ArrowLeft size={14} strokeWidth={2} />
						</button>
						<div className="w-8 h-8">
							<Avatar
								size="sm"
								name={PEER.name}
								photo={PEER.photo}
								className="!w-full !h-full"
							/>
						</div>
						<div className="leading-tight">
							<p className="text-white font-display font-semibold text-[13px]">
								{PEER.name}
							</p>
							<p className="text-pt-text-3 text-[10px]">{PEER.subtitle}</p>
						</div>
					</div>

					<div className="nw-dm-thread">
						{/* Outgoing — Alex */}
						<div className="nw-bubble-row outgoing" data-show={showMsg1}>
							<div className="nw-bubble outgoing">{ALEX_MESSAGE}</div>
						</div>

						{/* Typing dots — Devon */}
						<div className="nw-bubble-row incoming" data-show={showTyping}>
							<div className="w-7 h-7 shrink-0 self-end mb-0.5">
								<Avatar
									size="sm"
									name={PEER.name}
									photo={PEER.photo}
									className="!w-full !h-full"
								/>
							</div>
							<div className="nw-bubble incoming nw-typing">
								<span className="nw-dot" style={{ animationDelay: "0ms" }} />
								<span className="nw-dot" style={{ animationDelay: "180ms" }} />
								<span className="nw-dot" style={{ animationDelay: "360ms" }} />
							</div>
						</div>

						{/* Incoming — Devon */}
						<div className="nw-bubble-row incoming" data-show={showMsg2}>
							<div className="w-7 h-7 shrink-0 self-end mb-0.5">
								<Avatar
									size="sm"
									name={PEER.name}
									photo={PEER.photo}
									className="!w-full !h-full"
								/>
							</div>
							<div className="nw-bubble incoming">{DEVON_MESSAGE}</div>
						</div>
					</div>

					{/* Composer (decorative) */}
					<div className="nw-composer">
						<div className="nw-composer-input">Reply…</div>
						<div className="nw-composer-send">
							<Send size={12} strokeWidth={2} />
						</div>
					</div>
				</div>
			</div>

			<NetworkDemoStyles />
		</div>
	);
};

const NetworkDemoStyles: React.FC = () => (
	<style>{`
		.nw-stage {
			position: relative;
			height: 320px;
			border-radius: 18px;
			overflow: hidden;
			background:
				linear-gradient(180deg, rgba(20,15,50,0.55) 0%, rgba(13,11,34,0.55) 100%);
			border: 1px solid rgba(184,212,255,0.12);
			box-shadow:
				inset 0 1px 0 rgba(184,212,255,0.10),
				0 12px 32px rgba(0,0,0,0.40);
		}
		.nw-list {
			position: absolute;
			inset: 0;
			overflow: hidden;
		}

		.nw-row {
			opacity: 0;
			transform: translateY(6px);
			transition:
				opacity 380ms cubic-bezier(0.22, 1, 0.36, 1) var(--delay, 0ms),
				transform 380ms cubic-bezier(0.22, 1, 0.36, 1) var(--delay, 0ms);
		}
		.nw-row[data-show="true"] {
			opacity: 1;
			transform: translateY(0);
		}

		.nw-dm-btn {
			width: 28px;
			height: 28px;
			border-radius: 10px;
			background: rgba(99,102,241,0.12);
			border: 1px solid rgba(99,102,241,0.22);
			display: inline-flex;
			align-items: center;
			justify-content: center;
			transition: all 200ms ease;
		}
		.nw-dm-btn.is-active {
			background: rgba(99,102,241,0.32);
			border-color: rgba(140,180,255,0.7);
			box-shadow:
				inset 0 1px 0 rgba(255,255,255,0.20),
				0 0 18px rgba(99,102,241,0.6),
				0 0 28px rgba(34,211,238,0.40);
			transform: scale(1.08);
		}

		/* DM panel slides up from below, covering the list */
		.nw-dm-panel {
			position: absolute;
			inset: 0;
			background:
				linear-gradient(180deg, rgba(20,15,50,0.92) 0%, rgba(13,11,34,0.94) 100%);
			border-radius: 18px;
			display: flex;
			flex-direction: column;
			transform: translateY(102%);
			opacity: 0;
			transition:
				transform 520ms cubic-bezier(0.4, 0, 0.2, 1),
				opacity 280ms ease;
		}
		.nw-dm-panel[data-show="true"] {
			transform: translateY(0);
			opacity: 1;
		}

		.nw-dm-header {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 12px 14px;
			border-bottom: 1px solid rgba(255,255,255,0.05);
		}
		.nw-dm-back {
			width: 26px;
			height: 26px;
			border-radius: 9px;
			background: rgba(255,255,255,0.04);
			border: 1px solid rgba(255,255,255,0.08);
			color: rgba(255,255,255,0.55);
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}

		.nw-dm-thread {
			flex: 1;
			padding: 12px 14px;
			display: flex;
			flex-direction: column;
			gap: 8px;
			overflow: hidden;
		}

		.nw-bubble-row {
			display: flex;
			align-items: flex-end;
			gap: 6px;
			max-width: 100%;
			opacity: 0;
			transform: translateY(8px);
			transition:
				opacity 320ms cubic-bezier(0.22, 1, 0.36, 1),
				transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
		}
		.nw-bubble-row[data-show="true"] {
			opacity: 1;
			transform: translateY(0);
		}
		.nw-bubble-row.outgoing {
			justify-content: flex-end;
		}

		.nw-bubble {
			padding: 8px 12px;
			font-size: 12.5px;
			line-height: 1.35;
			max-width: 75%;
		}
		.nw-bubble.outgoing {
			background: linear-gradient(135deg, #6366f1, #4f46e5);
			color: #fff;
			border-radius: 16px 16px 4px 16px;
			box-shadow: 0 2px 12px rgba(99,102,241,0.32);
		}
		.nw-bubble.incoming {
			background: rgba(255,255,255,0.07);
			color: rgba(255,255,255,0.88);
			border-radius: 16px 16px 16px 4px;
		}
		.nw-bubble.nw-typing {
			padding: 9px 12px;
			display: inline-flex;
			align-items: center;
			gap: 4px;
		}
		.nw-dot {
			width: 5px;
			height: 5px;
			border-radius: 50%;
			background: rgba(255,255,255,0.65);
			animation: nw-dot-bounce 1.1s infinite ease-in-out;
		}
		@keyframes nw-dot-bounce {
			0%, 80%, 100% { transform: scale(0.65); opacity: 0.4; }
			40%           { transform: scale(1);    opacity: 1; }
		}

		.nw-composer {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 10px 14px 14px;
			border-top: 1px solid rgba(255,255,255,0.05);
		}
		.nw-composer-input {
			flex: 1;
			padding: 8px 12px;
			border-radius: 999px;
			background: rgba(255,255,255,0.04);
			border: 1px solid rgba(255,255,255,0.08);
			color: rgba(255,255,255,0.30);
			font-size: 11.5px;
		}
		.nw-composer-send {
			width: 30px;
			height: 30px;
			border-radius: 999px;
			background: linear-gradient(135deg, rgba(34,211,238,0.20), rgba(99,102,241,0.25));
			border: 1px solid rgba(140,180,255,0.4);
			display: inline-flex;
			align-items: center;
			justify-content: center;
			color: #dbe6ff;
			box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 0 12px rgba(99,102,241,0.25);
		}
	`}</style>
);

export default NetworkDemo;
