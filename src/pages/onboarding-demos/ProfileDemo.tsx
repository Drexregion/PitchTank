import React, { useEffect, useState } from "react";
import { Briefcase, Check, Share2 } from "lucide-react";
import { Avatar } from "../../components/design-system";

const NAME = "Alex Chen";
const HANDLE = "@alex.chen";
const ROLE = "Pitcher";
const BIO =
	"Building tools for early-stage founders. Previously at Vault.";
const TYPE_INTERVAL_MS = 75;

// Step progression — each subsequent element becomes visible at its step.
const STEP = {
	cover: 0,
	avatar: 1,
	name: 2,
	role: 3,
	bio: 4,
	socials: 5,
	share: 6,
	settled: 7,
} as const;
type Step = (typeof STEP)[keyof typeof STEP];

const LinkedinIcon: React.FC = () => (
	<svg
		viewBox="0 0 24 24"
		width="22"
		height="22"
		fill="#0A66C2"
		aria-hidden
		className="rounded-[4px]"
	>
		<rect width="24" height="24" rx="4" />
		<path
			fill="#fff"
			d="M7.1 9.4h2.6V17H7.1V9.4Zm1.3-3.6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm3.4 3.6h2.5v1h.04c.35-.66 1.2-1.36 2.46-1.36 2.64 0 3.13 1.74 3.13 4V17H17.4v-3.5c0-.84-.02-1.92-1.17-1.92-1.17 0-1.35.92-1.35 1.86V17h-2.5V9.4Z"
		/>
	</svg>
);

const XIcon: React.FC = () => (
	<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden>
		<path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.94l-5.43-6.4L4.4 22H1.14l8.05-9.2L1 2h7.13l4.91 6.05L18.244 2Zm-2.43 18h1.93L7.27 4H5.2l10.62 16Z" />
	</svg>
);

export const ProfileDemo: React.FC = () => {
	const [step, setStep] = useState<Step>(STEP.cover);
	const [typedName, setTypedName] = useState(0);

	useEffect(() => {
		const reduce = window.matchMedia?.(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduce) {
			setStep(STEP.settled);
			setTypedName(NAME.length);
			return;
		}

		let cancelled = false;
		const timeouts: number[] = [];

		const run = () => {
			if (cancelled) return;
			setStep(STEP.cover);
			setTypedName(0);
			const at = (ms: number, s: Step) =>
				timeouts.push(
					window.setTimeout(() => {
						if (!cancelled) setStep(s);
					}, ms),
				);
			at(450, STEP.avatar);
			at(900, STEP.name);
			at(1900, STEP.role);
			at(2400, STEP.bio);
			at(2950, STEP.socials);
			at(3550, STEP.share);
			at(4400, STEP.settled);
			timeouts.push(window.setTimeout(run, 5400));
		};
		run();

		return () => {
			cancelled = true;
			timeouts.forEach(clearTimeout);
		};
	}, []);

	// Type the name during the "name" step
	useEffect(() => {
		if (step !== STEP.name) return;
		setTypedName(0);
		let chars = 0;
		const interval = window.setInterval(() => {
			chars += 1;
			setTypedName(chars);
			if (chars >= NAME.length) window.clearInterval(interval);
		}, TYPE_INTERVAL_MS);
		return () => window.clearInterval(interval);
	}, [step]);

	// Hold full name once past the typing step
	useEffect(() => {
		if (step >= STEP.role) setTypedName(NAME.length);
	}, [step]);

	const showAvatar = step >= STEP.avatar;
	const showHandle = step >= STEP.role;
	const showRole = step >= STEP.role;
	const showBio = step >= STEP.bio;
	const showSocials = step >= STEP.socials;
	const showShareGlow = step === STEP.share;
	const showShareToast = step === STEP.share || step === STEP.settled;
	const isTyping = step === STEP.name && typedName < NAME.length;

	const gradient = "linear-gradient(135deg, #4F7CFF, #A259FF, #22D3EE)";

	return (
		<div className="pf-demo w-full select-none">
			{/* Header */}
			<div className="flex items-center justify-between mb-2 px-1">
				<div className="text-[10px] uppercase tracking-widest text-pt-text-2 font-display font-semibold">
					Profile
				</div>
				<div className="text-[10px] text-pt-text-2 font-display font-semibold uppercase tracking-wider">
					Public
				</div>
			</div>

			{/* Card surface (mirrors ProfileFrame inner column) */}
			<div className="pf-card relative">
				{/* Cover banner */}
				<div className="pf-cover" style={{ background: gradient }}>
					<div className="pf-cover-fade" aria-hidden="true" />
				</div>

				{/* Avatar overlapping cover + Share button on the right */}
				<div className="flex items-end justify-between -mt-9 px-4 mb-2 relative z-10">
					<div
						className={`pf-avatar-frame rounded-full p-1 transition-all ${showAvatar ? "is-visible" : ""}`}
						style={{ background: "rgba(6,5,18,0.95)" }}
					>
						<div className="w-[64px] h-[64px] rounded-full overflow-hidden">
							<Avatar
								size="lg"
								name={NAME}
								className="!w-full !h-full"
							/>
						</div>
					</div>

					<div className={`relative ${showShareGlow ? "pf-share-pulse" : ""}`}>
						<button
							type="button"
							tabIndex={-1}
							aria-hidden="true"
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold mb-0.5"
							style={{
								background:
									"linear-gradient(140deg, rgba(34,211,238,0.18), rgba(99,102,241,0.22))",
								border: "1px solid rgba(140,180,255,0.4)",
								color: "#dbe6ff",
								boxShadow:
									"inset 0 1px 0 rgba(255,255,255,0.1), 0 0 12px rgba(99,102,241,0.25)",
							}}
						>
							<Share2 size={11} strokeWidth={2.2} />
							Share
						</button>

						{/* Share success toast — sits above the Share button */}
						<div
							className="pf-toast"
							data-show={showShareToast}
							aria-hidden="true"
						>
							<Check size={11} strokeWidth={2.5} />
							Profile shared
						</div>
					</div>
				</div>

				{/* Name + handle + role */}
				<div className="px-4 mb-3">
					<h1 className="pf-name-line">
						<span
							className="font-display font-bold text-[20px] leading-tight text-white"
							style={{
								opacity: showAvatar ? 1 : 0,
								transition: "opacity 240ms ease",
							}}
						>
							{NAME.slice(0, typedName)}
							{isTyping && <span className="pf-cursor" aria-hidden="true" />}
						</span>
					</h1>
					<div
						className="flex items-center gap-2 mt-1 flex-wrap pf-fade"
						data-show={showHandle}
					>
						<span className="text-pt-text-3 text-[11.5px] font-medium">
							{HANDLE}
						</span>
						<span className="text-pt-text-3 text-[10px]">·</span>
						<span
							className="pf-role-pill pf-pop"
							data-show={showRole}
						>
							<Briefcase size={10} strokeWidth={2.4} />
							{ROLE}
						</span>
					</div>
				</div>

				{/* Bio */}
				<div
					className="px-4 mb-3 pf-fade"
					data-show={showBio}
				>
					<p className="text-pt-text-2 text-[12.5px] leading-relaxed">
						{BIO}
					</p>
				</div>

				{/* Social cards */}
				<div className="px-4 pb-4 flex items-center gap-2">
					<SocialTile
						icon={<LinkedinIcon />}
						label="LinkedIn"
						visible={showSocials}
						delay={0}
					/>
					<SocialTile
						icon={<XIcon />}
						label="X"
						visible={showSocials}
						delay={120}
					/>
				</div>
			</div>

			<ProfileDemoStyles />
		</div>
	);
};

const SocialTile: React.FC<{
	icon: React.ReactNode;
	label: string;
	visible: boolean;
	delay: number;
}> = ({ icon, label, visible, delay }) => (
	<div
		className="pf-social pf-pop"
		data-show={visible}
		style={{ "--delay": `${delay}ms` } as React.CSSProperties}
	>
		<div className="h-7 flex items-center justify-center">{icon}</div>
		<span className="text-[10px] uppercase tracking-[0.14em] font-display text-pt-text-2 mt-1.5">
			{label}
		</span>
	</div>
);

const ProfileDemoStyles: React.FC = () => (
	<style>{`
		.pf-card {
			border-radius: 18px;
			overflow: hidden;
			background:
				linear-gradient(180deg, rgba(20,15,50,0.55) 0%, rgba(13,11,34,0.55) 100%);
			border: 1px solid rgba(184,212,255,0.12);
			box-shadow:
				inset 0 1px 0 rgba(184,212,255,0.10),
				0 12px 32px rgba(0,0,0,0.40);
		}
		.pf-cover {
			height: 78px;
			width: 100%;
			position: relative;
		}
		.pf-cover-fade {
			position: absolute;
			inset: 0;
			background: linear-gradient(180deg, transparent 30%, rgba(13,11,34,0.45) 100%);
		}

		.pf-avatar-frame {
			opacity: 0;
			transform: scale(0.6);
			transition:
				opacity 360ms cubic-bezier(0.34, 1.56, 0.64, 1),
				transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
		}
		.pf-avatar-frame.is-visible {
			opacity: 1;
			transform: scale(1);
		}

		.pf-cursor {
			display: inline-block;
			width: 1.5px;
			height: 16px;
			margin-left: 3px;
			vertical-align: -2px;
			background: var(--c-cyan, #00E5FF);
			box-shadow: 0 0 8px rgba(0,229,255,0.7);
			animation: pf-cursor-blink 0.9s steps(2, end) infinite;
		}
		@keyframes pf-cursor-blink {
			0%, 100% { opacity: 1; }
			50%      { opacity: 0; }
		}

		.pf-fade {
			opacity: 0;
			transform: translateY(4px);
			transition:
				opacity 360ms cubic-bezier(0.22, 1, 0.36, 1),
				transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
		}
		.pf-fade[data-show="true"] {
			opacity: 1;
			transform: translateY(0);
		}

		.pf-role-pill {
			display: inline-flex;
			align-items: center;
			gap: 5px;
			padding: 3px 10px;
			border-radius: 999px;
			font-family: 'Tomorrow', system-ui, sans-serif;
			font-size: 9.5px;
			font-weight: 500;
			text-transform: uppercase;
			letter-spacing: 0.16em;
			color: #fff;
			background: linear-gradient(135deg, rgba(79,124,255,0.25), rgba(0,229,255,0.15));
			box-shadow:
				inset 0 0 0 1px rgba(140,180,255,0.55),
				0 0 12px rgba(79,124,255,0.30);
		}

		.pf-pop {
			opacity: 0;
			transform: translateY(4px) scale(0.92);
			transition:
				opacity 320ms cubic-bezier(0.34, 1.56, 0.64, 1) var(--delay, 0ms),
				transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1) var(--delay, 0ms);
		}
		.pf-pop[data-show="true"] {
			opacity: 1;
			transform: translateY(0) scale(1);
		}

		.pf-social {
			flex: 1;
			padding: 8px 6px;
			border-radius: 12px;
			background: rgba(255,255,255,0.03);
			box-shadow: inset 0 0 0 1px rgba(184,212,255,0.18);
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
		}

		/* Share button pulse + share toast (above) */
		.pf-share-pulse {
			animation: pf-share-pulse-anim 0.9s ease-in-out;
		}
		@keyframes pf-share-pulse-anim {
			0%, 100% { transform: scale(1); filter: brightness(1); }
			50%      { transform: scale(1.06); filter: brightness(1.25); }
		}

		.pf-toast {
			position: absolute;
			top: -14px;
			right: 0;
			display: inline-flex;
			align-items: center;
			gap: 5px;
			padding: 4px 9px;
			border-radius: 999px;
			background: linear-gradient(135deg, rgba(64,243,197,0.22), rgba(34,211,238,0.22));
			border: 1px solid rgba(64,243,197,0.45);
			color: #b8fdea;
			font-family: 'Tomorrow', system-ui, sans-serif;
			font-size: 10px;
			font-weight: 600;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			white-space: nowrap;
			box-shadow:
				0 0 14px rgba(64,243,197,0.40),
				0 0 22px rgba(34,211,238,0.20);
			opacity: 0;
			transform: translateY(-6px);
			pointer-events: none;
			transition:
				opacity 280ms ease,
				transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1);
			z-index: 30;
		}
		.pf-toast[data-show="true"] {
			opacity: 1;
			transform: translateY(0);
		}
	`}</style>
);

export default ProfileDemo;
