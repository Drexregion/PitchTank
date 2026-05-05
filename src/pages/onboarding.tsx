import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button, IridescentArc } from "../components/design-system";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { TradeDemo } from "./onboarding-demos/TradeDemo";
import { LeaderboardDemo } from "./onboarding-demos/LeaderboardDemo";
import { ProfileDemo } from "./onboarding-demos/ProfileDemo";
import { NetworkDemo } from "./onboarding-demos/NetworkDemo";
import { ChatDemo } from "./onboarding-demos/ChatDemo";

type StepKind = "welcome" | "feature" | "team" | "complete";

interface Step {
	kind: StepKind;
	id: string;
	title: string;
	subtitle: string;
	body?: string;
	icon?: React.ReactNode;
	demo?: React.ComponentType;
	accent: [string, string];
}

const ICON_SIZE = 56;

const TradeIcon = (
	<svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 64 64" fill="none">
		<defs>
			<linearGradient id="ob-trade" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stopColor="#4F7CFF" />
				<stop offset="100%" stopColor="#A259FF" />
			</linearGradient>
		</defs>
		<path
			d="M8 44 L20 30 L30 38 L44 18 L56 18"
			stroke="url(#ob-trade)"
			strokeWidth="3"
			strokeLinecap="round"
			strokeLinejoin="round"
			fill="none"
		/>
		<circle cx="44" cy="18" r="3.5" fill="#A259FF" />
		<circle cx="20" cy="30" r="3" fill="#4F7CFF" />
		<path
			d="M50 42 L56 42 L56 36"
			stroke="#A259FF"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const LeaderboardIcon = (
	<svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 64 64" fill="none">
		<defs>
			<linearGradient id="ob-lb" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stopColor="#FFD37A" />
				<stop offset="100%" stopColor="#FF8A00" />
			</linearGradient>
		</defs>
		<rect x="14" y="34" width="10" height="18" rx="2" fill="#4F7CFF" opacity="0.7" />
		<rect x="27" y="22" width="10" height="30" rx="2" fill="url(#ob-lb)" />
		<rect x="40" y="40" width="10" height="12" rx="2" fill="#A259FF" opacity="0.7" />
		<path
			d="M32 12 L34 18 L40 18 L35 22 L37 28 L32 24 L27 28 L29 22 L24 18 L30 18 Z"
			fill="url(#ob-lb)"
		/>
	</svg>
);

const ProfileIcon = (
	<svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 64 64" fill="none">
		<defs>
			<linearGradient id="ob-prof" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stopColor="#22D3EE" />
				<stop offset="100%" stopColor="#A259FF" />
			</linearGradient>
		</defs>
		<circle cx="32" cy="22" r="8" stroke="url(#ob-prof)" strokeWidth="2.5" fill="none" />
		<path
			d="M16 50 C16 40 22 36 32 36 C42 36 48 40 48 50"
			stroke="url(#ob-prof)"
			strokeWidth="2.5"
			strokeLinecap="round"
			fill="none"
		/>
		<circle cx="48" cy="20" r="4" fill="#FF8A00" />
		<path
			d="M46 20 L47.5 21.5 L50 19" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
		/>
	</svg>
);

const NetworkIcon = (
	<svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 64 64" fill="none">
		<defs>
			<linearGradient id="ob-net" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stopColor="#A259FF" />
				<stop offset="100%" stopColor="#22D3EE" />
			</linearGradient>
		</defs>
		<line x1="32" y1="14" x2="14" y2="34" stroke="url(#ob-net)" strokeWidth="2" />
		<line x1="32" y1="14" x2="50" y2="34" stroke="url(#ob-net)" strokeWidth="2" />
		<line x1="14" y1="34" x2="32" y2="50" stroke="url(#ob-net)" strokeWidth="2" />
		<line x1="50" y1="34" x2="32" y2="50" stroke="url(#ob-net)" strokeWidth="2" />
		<line x1="14" y1="34" x2="50" y2="34" stroke="url(#ob-net)" strokeWidth="2" opacity="0.5" />
		<circle cx="32" cy="14" r="5" fill="#A259FF" />
		<circle cx="14" cy="34" r="5" fill="#4F7CFF" />
		<circle cx="50" cy="34" r="5" fill="#22D3EE" />
		<circle cx="32" cy="50" r="5" fill="#FF8A00" />
	</svg>
);

const ChatIcon = (
	<svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 64 64" fill="none">
		<defs>
			<linearGradient id="ob-chat" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stopColor="#4F7CFF" />
				<stop offset="100%" stopColor="#22D3EE" />
			</linearGradient>
		</defs>
		<path
			d="M12 18 C12 15 14 13 17 13 L43 13 C46 13 48 15 48 18 L48 34 C48 37 46 39 43 39 L26 39 L18 47 L18 39 L17 39 C14 39 12 37 12 34 Z"
			fill="url(#ob-chat)"
			opacity="0.85"
		/>
		<circle cx="22" cy="26" r="2.2" fill="#fff" />
		<circle cx="30" cy="26" r="2.2" fill="#fff" />
		<circle cx="38" cy="26" r="2.2" fill="#fff" />
		<circle cx="52" cy="42" r="3" fill="#FF4757">
			<animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
		</circle>
	</svg>
);

const TeamIcon = (
	<svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 64 64" fill="none">
		<defs>
			<linearGradient id="ob-team" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stopColor="#FFD37A" />
				<stop offset="100%" stopColor="#FF8A00" />
			</linearGradient>
		</defs>
		<path
			d="M14 32 C14 22 22 14 32 14 C42 14 50 22 50 32"
			stroke="url(#ob-team)"
			strokeWidth="3"
			strokeLinecap="round"
			fill="none"
		/>
		<rect x="11" y="30" width="9" height="16" rx="3" fill="url(#ob-team)" />
		<rect x="44" y="30" width="9" height="16" rx="3" fill="url(#ob-team)" />
		<path
			d="M44 44 C44 48 40 50 34 50"
			stroke="url(#ob-team)"
			strokeWidth="2.5"
			strokeLinecap="round"
			fill="none"
		/>
		<circle cx="32" cy="50" r="3" fill="#FF8A00" />
	</svg>
);

const STEPS: Step[] = [
	{
		kind: "welcome",
		id: "welcome",
		title: "Welcome to PitchTank",
		subtitle: "The new way to discover and connect with founders",
		body:
			"We've made some big upgrades. Take 60 seconds to see what's new — then let's get you in.",
		accent: ["#4F7CFF", "#A259FF"],
	},
	{
		kind: "feature",
		id: "trade",
		title: "Trade & share feedback",
		subtitle: "Buy and sell investor seats on founders you believe in",
		body:
			"Back the pitches that move you. Share feedback that helps founders sharpen their story.",
		icon: TradeIcon,
		demo: TradeDemo,
		accent: ["#4F7CFF", "#A259FF"],
	},
	{
		kind: "feature",
		id: "leaderboard",
		title: "Climb the leaderboard",
		subtitle: "See how your bets stack up against the room",
		body:
			"Top investors get featured. Sharper picks earn better placement and reputation over time.",
		icon: LeaderboardIcon,
		demo: LeaderboardDemo,
		accent: ["#FFD37A", "#FF8A00"],
	},
	{
		kind: "feature",
		id: "profile",
		title: "Build your profile",
		subtitle: "Show your background, expertise, and interests",
		body:
			"A strong profile gets you noticed. Share it anywhere — founders and investors discover you through it.",
		icon: ProfileIcon,
		demo: ProfileDemo,
		accent: ["#22D3EE", "#A259FF"],
	},
	{
		kind: "feature",
		id: "network",
		title: "Match & message",
		subtitle: "Get matched with the right people in the room",
		body:
			"Smart matching surfaces the founders and investors most relevant to you. DM them directly — no warm intro needed.",
		icon: NetworkIcon,
		demo: NetworkDemo,
		accent: ["#A259FF", "#22D3EE"],
	},
	{
		kind: "feature",
		id: "chat",
		title: "Live chat & Q&A",
		subtitle: "Engage with the room in real time",
		body:
			"Drop questions during pitches, react to moments, and feel the room move with you.",
		icon: ChatIcon,
		demo: ChatDemo,
		accent: ["#4F7CFF", "#22D3EE"],
	},
	{
		kind: "team",
		id: "team",
		title: "We're here if you need us",
		subtitle: "The PitchTank team is one message away",
		body:
			"Hit a snag, have a suggestion, or just want to say hi? Reach out anytime in chat or email and a real human will get back to you.",
		icon: TeamIcon,
		accent: ["#FFD37A", "#FF8A00"],
	},
	{
		kind: "complete",
		id: "complete",
		title: "You're all set",
		subtitle: "Welcome to the future of founder discovery",
		accent: ["#22D3EE", "#A259FF"],
	},
];

const TOTAL = STEPS.length;

const OnboardingPage: React.FC = () => {
	const navigate = useNavigate();
	const { user, isLoading: authLoading } = useAuth();
	const [step, setStep] = useState(0);
	const [direction, setDirection] = useState<1 | -1>(1);
	const [animKey, setAnimKey] = useState(0);
	const [isFinishing, setIsFinishing] = useState(false);

	const current = STEPS[step];
	const isFirst = step === 0;
	const isLast = step === TOTAL - 1;

	const finish = async () => {
		if (isFinishing) return;
		setIsFinishing(true);
		// Wait for the DB write to land before navigating, otherwise the
		// gate races the update and bounces the user right back to
		// /onboarding.
		if (user?.id) {
			const onboardedAt = new Date().toISOString();
			try {
				// Try update first (covers existing users). .select() so we
				// can detect the 0-row case — without it, the response is
				// always { data: null, error: null } and we can't tell.
				const { data, error } = await supabase
					.from("users")
					.update({ onboarded_at: onboardedAt })
					.eq("auth_user_id", user.id)
					.select("id")
					.maybeSingle();

				if (error) {
					console.warn("[onboarding] update errored", error);
				}

				// 0 rows affected → row doesn't exist yet (e.g. new signup
				// where the auth-trigger row hasn't been created). Fall back
				// to upsert so we both create and mark it onboarded.
				if (!error && !data) {
					const { error: upsertError } = await supabase
						.from("users")
						.upsert(
							{
								auth_user_id: user.id,
								email: user.email ?? "",
								onboarded_at: onboardedAt,
							},
							{ onConflict: "auth_user_id" },
						);
					if (upsertError) {
						console.warn(
							"[onboarding] upsert fallback errored",
							upsertError,
						);
					}
				}
			} catch (err) {
				console.warn("[onboarding] failed to mark complete", err);
			}

			// Mark in sessionStorage so the gate trusts this for the rest
			// of the session, even if realtime delivery for the user's row
			// is delayed or doesn't arrive (which we've seen happen for
			// brand-new accounts). Cleared automatically when the tab closes.
			try {
				sessionStorage.setItem(`pt_onboarded:${user.id}`, "1");
			} catch {
				/* sessionStorage unavailable — fall back to realtime/refetch */
			}
		}
		// Hint to the global OnboardingGate that we just finished, so it
		// doesn't bounce the user back if its hook hasn't refreshed yet.
		navigate("/", { state: { justOnboarded: true } });
	};

	const goNext = () => {
		if (isFinishing) return;
		if (isLast) {
			void finish();
			return;
		}
		setDirection(1);
		setStep((s) => Math.min(s + 1, TOTAL - 1));
		setAnimKey((k) => k + 1);
	};

	const goBack = () => {
		if (isFirst) return;
		setDirection(-1);
		setStep((s) => Math.max(s - 1, 0));
		setAnimKey((k) => k + 1);
	};

	const skip = () => {
		setDirection(1);
		setStep(TOTAL - 1);
		setAnimKey((k) => k + 1);
	};

	// Keyboard nav
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowRight" || e.key === "Enter") goNext();
			if (e.key === "ArrowLeft") goBack();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [step]);

	// Pre-spawn confetti pieces for the completion step (stable per mount)
	const confetti = useMemo(
		() =>
			Array.from({ length: 36 }).map((_, i) => ({
				i,
				angle: (i / 36) * Math.PI * 2 + Math.random() * 0.4,
				dist: 180 + Math.random() * 140,
				delay: Math.random() * 0.25,
				duration: 1.1 + Math.random() * 0.7,
				size: 5 + Math.random() * 6,
				color:
					i % 4 === 0
						? "#A259FF"
						: i % 4 === 1
							? "#22D3EE"
							: i % 4 === 2
								? "#FF8A00"
								: "#4F7CFF",
			})),
		[step === TOTAL - 1],
	);

	// Auth gate: while resolving, show a quiet spinner; if logged out,
	// send them to /welcome (they need a user record to mark onboarded).
	if (authLoading) {
		return (
			<div
				className="min-h-screen flex items-center justify-center"
				style={{ background: "#080a14" }}
			>
				<div className="w-8 h-8 rounded-full border-2 border-pt-purple border-t-transparent animate-spin" />
			</div>
		);
	}
	if (!user) {
		return <Navigate to="/welcome" replace />;
	}

	const ctaLabel = isFirst
		? "Get started"
		: isLast
			? "Enter PitchTank"
			: current.kind === "team"
				? "Got it"
				: "Continue";

	return (
		<div
			className="min-h-screen relative overflow-hidden flex flex-col"
			style={{ background: "#080a14" }}
		>
			{/* Background image + overlays (matches login look) */}
			<div
				aria-hidden="true"
				className="fixed inset-0 bg-cover bg-center bg-no-repeat"
				style={{ backgroundImage: "url('/leaderboard/leaderboard-bg.webp')" }}
			/>
			<div
				className="fixed inset-0"
				style={{
					background:
						"linear-gradient(160deg, rgba(6,12,28,0.90) 0%, rgba(8,16,40,0.84) 50%, rgba(4,10,24,0.92) 100%)",
				}}
			/>
			{/* Accent-driven ambient glows that change per step */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden">
				<div
					key={`g1-${step}`}
					className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[60vh] rounded-full ob-fade-glow"
					style={{
						background: `radial-gradient(ellipse at center, ${current.accent[0]}55 0%, ${current.accent[1]}22 40%, transparent 70%)`,
						opacity: 0.55,
					}}
				/>
				<div
					key={`g2-${step}`}
					className="absolute bottom-[-20vh] right-[-10vw] w-[60vw] h-[50vh] rounded-full ob-fade-glow"
					style={{
						background: `radial-gradient(circle, ${current.accent[1]}44 0%, transparent 70%)`,
						filter: "blur(50px)",
						opacity: 0.45,
					}}
				/>
			</div>

			{/* Top bar: progress dots + skip */}
			<div className="relative z-10 w-full max-w-md mx-auto px-6 pt-6 flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					{STEPS.map((s, i) => (
						<button
							key={s.id}
							type="button"
							onClick={() => {
								setDirection(i > step ? 1 : -1);
								setStep(i);
								setAnimKey((k) => k + 1);
							}}
							className="ob-dot"
							data-active={i === step}
							data-done={i < step}
							aria-label={`Go to step ${i + 1} of ${TOTAL}`}
						/>
					))}
				</div>
				{!isLast && (
					<button
						type="button"
						onClick={skip}
						className="text-white/40 hover:text-white/70 text-xs uppercase tracking-widest transition-colors"
					>
						Skip
					</button>
				)}
			</div>

			{/* Content */}
			<div className="relative z-10 flex-1 flex items-center justify-center px-6 py-8">
				<div
					key={animKey}
					className="w-full max-w-md ob-slide"
					data-dir={direction === 1 ? "forward" : "back"}
				>
					{current.kind === "complete" ? (
						<CompleteStep step={current} confetti={confetti} />
					) : (
						<ContentStep step={current} />
					)}
				</div>
			</div>

			{/* Bottom nav */}
			<div className="relative z-10 w-full max-w-md mx-auto px-6 pb-8 pt-2 flex items-center gap-3">
				{!isFirst && !isLast && (
					<button
						type="button"
						onClick={goBack}
						className="ob-back"
						aria-label="Go back"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
							<path
								d="M15 6 L9 12 L15 18"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
				)}
				<Button
					variant="primary"
					size="lg"
					className="flex-1"
					onClick={goNext}
					loading={isFinishing}
					loadingText="Finishing up…"
				>
					{ctaLabel}
				</Button>
			</div>

			<OnboardingStyles />
		</div>
	);
};

const ContentStep: React.FC<{ step: Step }> = ({ step }) => {
	const isLogoStep = step.kind === "welcome" || step.kind === "complete";
	const accentVars = {
		"--a1": step.accent[0],
		"--a2": step.accent[1],
	} as React.CSSProperties;

	if (step.demo) {
		const Demo = step.demo;
		return (
			<div className="flex flex-col w-full">
				<div className="ob-demo-wrap" style={accentVars}>
					<div className="ob-demo-glow" aria-hidden="true" />
					<div className="ob-demo-stage">
						<Demo />
					</div>
				</div>
				<IridescentArc className="w-3/4 self-center mt-3 mb-2" />
				<div className="text-center px-2">
					<h1 className="ob-title ob-title-compact font-display">
						{step.title}
					</h1>
					<p className="ob-subtitle">{step.subtitle}</p>
					{step.body && <p className="ob-body">{step.body}</p>}
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center text-center px-2 py-4">
			{isLogoStep ? (
				<div className="ob-logo-wrap mb-6" style={accentVars}>
					<div className="ob-icon-glow" />
					<img
						src="/leaderboard/logo.png"
						alt="PitchTank"
						className="ob-logo-img"
					/>
				</div>
			) : (
				<div className="ob-icon-wrap mb-6" style={accentVars}>
					<div className="ob-icon-glow" />
					<div className="ob-icon-inner">{step.icon}</div>
				</div>
			)}

			<IridescentArc className="w-3/4 -mt-2 mb-2" />

			<h1 className="ob-title font-display">{step.title}</h1>
			<p className="ob-subtitle">{step.subtitle}</p>
			{step.body && <p className="ob-body">{step.body}</p>}
		</div>
	);
};

const CompleteStep: React.FC<{
	step: Step;
	confetti: Array<{
		i: number;
		angle: number;
		dist: number;
		delay: number;
		duration: number;
		size: number;
		color: string;
	}>;
}> = ({ step, confetti }) => (
	<div className="text-center relative">
		{/* Expanding rings */}
		<div className="ob-burst" aria-hidden>
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					className="ob-ring"
					style={{ animationDelay: `${i * 0.25}s` }}
				/>
			))}
		</div>

		{/* Confetti */}
		<div className="ob-confetti" aria-hidden>
			{confetti.map((c) => (
				<span
					key={c.i}
					className="ob-piece"
					style={
						{
							"--tx": `${Math.cos(c.angle) * c.dist}px`,
							"--ty": `${Math.sin(c.angle) * c.dist}px`,
							"--rot": `${(Math.random() - 0.5) * 720}deg`,
							"--delay": `${c.delay}s`,
							"--duration": `${c.duration}s`,
							"--size": `${c.size}px`,
							"--color": c.color,
						} as React.CSSProperties
					}
				/>
			))}
		</div>

		<div
			className="ob-logo-wrap ob-icon-pulse mb-6 mx-auto"
			style={
				{
					"--a1": step.accent[0],
					"--a2": step.accent[1],
				} as React.CSSProperties
			}
		>
			<div className="ob-icon-glow" />
			<img
				src="/leaderboard/logo.png"
				alt="PitchTank"
				className="ob-logo-img"
			/>
		</div>

		<IridescentArc className="w-3/4 mx-auto -mt-2 mb-2" />

		<h1 className="ob-title ob-title-mega font-display">{step.title}</h1>
		<p className="ob-subtitle">{step.subtitle}</p>
	</div>
);

const OnboardingStyles: React.FC = () => (
	<style>{`
		/* Step dots */
		.ob-dot {
			width: 6px; height: 6px; border-radius: 999px;
			background: rgba(255,255,255,0.18);
			transition: all 280ms cubic-bezier(0.22, 1, 0.36, 1);
			border: 0; padding: 0; cursor: pointer;
		}
		.ob-dot[data-done="true"] {
			background: rgba(184,212,255,0.5);
		}
		.ob-dot[data-active="true"] {
			width: 22px;
			background: linear-gradient(90deg, #4F7CFF 0%, #A259FF 100%);
			box-shadow: 0 0 10px rgba(162,89,255,0.6);
		}

		/* Slide transition */
		.ob-slide {
			animation: ob-slide-in 380ms cubic-bezier(0.22, 1, 0.36, 1);
		}
		.ob-slide[data-dir="back"] {
			animation-name: ob-slide-in-back;
		}
		@keyframes ob-slide-in {
			from { opacity: 0; transform: translateX(24px); }
			to   { opacity: 1; transform: translateX(0); }
		}
		@keyframes ob-slide-in-back {
			from { opacity: 0; transform: translateX(-24px); }
			to   { opacity: 1; transform: translateX(0); }
		}

		/* Ambient glow fade-in on step change */
		.ob-fade-glow {
			animation: ob-glow-in 700ms cubic-bezier(0.22, 1, 0.36, 1);
		}
		@keyframes ob-glow-in {
			from { opacity: 0; transform: scale(0.96); }
			to   { opacity: var(--target-opacity, 0.55); transform: scale(1); }
		}

		/* Icon container */
		.ob-icon-wrap {
			position: relative;
			width: 110px; height: 110px;
			display: flex; align-items: center; justify-content: center;
		}

		/* Demo stage — feature steps that show real UI loops */
		.ob-demo-wrap {
			position: relative;
			width: 100%;
			padding: 4px;
			margin: 0 auto;
		}
		.ob-demo-glow {
			position: absolute;
			inset: -28px -8px -8px -8px;
			border-radius: 22px;
			background:
				radial-gradient(60% 80% at 50% 0%, var(--a1, #4F7CFF)45 0%, transparent 60%),
				radial-gradient(50% 70% at 50% 100%, var(--a2, #A259FF)33 0%, transparent 65%);
			filter: blur(12px);
			opacity: 0.55;
			pointer-events: none;
			z-index: 0;
		}
		.ob-demo-stage {
			position: relative;
			z-index: 1;
		}

		.ob-title-compact {
			font-size: 22px;
			line-height: 1.15;
			margin-top: 6px;
			margin-bottom: 4px;
		}

		/* Logo container — used for welcome + complete steps */
		.ob-logo-wrap {
			position: relative;
			width: 220px;
			height: 140px;
			display: flex; align-items: center; justify-content: center;
		}
		.ob-logo-img {
			position: relative;
			z-index: 1;
			width: 100%;
			height: 100%;
			object-fit: contain;
			filter: drop-shadow(0 0 22px rgba(162,89,255,0.45))
				drop-shadow(0 0 12px rgba(34,211,238,0.30));
		}
		.ob-icon-glow {
			position: absolute; inset: -18px;
			border-radius: 50%;
			background: radial-gradient(circle, var(--a1, #4F7CFF)55 0%, var(--a2, #A259FF)22 40%, transparent 70%);
			filter: blur(14px);
			opacity: 0.85;
			animation: ob-icon-breathe 2.8s ease-in-out infinite;
		}
		.ob-icon-inner {
			position: relative;
			width: 96px; height: 96px;
			border-radius: 24px;
			display: flex; align-items: center; justify-content: center;
			background:
				radial-gradient(ellipse 70% 60% at 30% 20%, rgba(255,255,255,0.10) 0%, transparent 60%),
				linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
			box-shadow:
				inset 0 1px 0 rgba(255,255,255,0.12),
				0 8px 30px rgba(0,0,0,0.35),
				0 0 30px var(--a1, #4F7CFF)33;
			border: 1px solid rgba(255,255,255,0.08);
		}
		@keyframes ob-icon-breathe {
			0%, 100% { opacity: 0.7; transform: scale(1); }
			50%      { opacity: 1; transform: scale(1.06); }
		}

		/* Typography */
		.ob-title {
			font-size: 28px;
			line-height: 1.15;
			font-weight: 600;
			color: var(--c-metal-white, #E8F2FF);
			margin: 8px 0 6px;
			text-shadow: 0 0 14px rgba(184,212,255,0.35);
			letter-spacing: -0.01em;
		}
		.ob-title-mega {
			font-size: 36px;
			background: linear-gradient(90deg, #DCC8FF 0%, #FFC896 100%);
			-webkit-background-clip: text;
			background-clip: text;
			-webkit-text-fill-color: transparent;
			text-shadow: 0 0 20px rgba(220,150,200,0.55);
		}
		.ob-subtitle {
			color: var(--c-text-1, #fff);
			opacity: 0.78;
			font-size: 14px;
			line-height: 1.5;
			margin: 0 0 10px;
			max-width: 32ch;
			margin-left: auto;
			margin-right: auto;
		}
		.ob-body {
			color: var(--c-text-2, rgba(255,255,255,0.6));
			font-size: 13px;
			line-height: 1.6;
			margin: 0;
			max-width: 36ch;
			margin-left: auto;
			margin-right: auto;
		}

		/* Back button */
		.ob-back {
			height: 52px; width: 52px;
			border-radius: 12px;
			display: inline-flex; align-items: center; justify-content: center;
			background: rgba(255,255,255,0.03);
			border: 1px solid rgba(255,255,255,0.10);
			color: rgba(255,255,255,0.7);
			cursor: pointer;
			transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
			backdrop-filter: blur(12px);
			-webkit-backdrop-filter: blur(12px);
		}
		.ob-back:hover {
			color: #fff;
			background: rgba(255,255,255,0.06);
			border-color: rgba(255,255,255,0.18);
		}
		.ob-back:active { transform: translateY(1px); }

		/* Completion: rings */
		.ob-burst {
			position: absolute; inset: 0;
			display: flex; align-items: center; justify-content: center;
			pointer-events: none;
			top: 8px;
		}
		.ob-ring {
			position: absolute;
			width: 110px; height: 110px;
			border-radius: 50%;
			border: 2px solid rgba(162,89,255,0.55);
			animation: ob-ring-expand 1.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
			opacity: 0;
		}
		@keyframes ob-ring-expand {
			0%   { transform: scale(0.6); opacity: 0.9; border-color: rgba(220,200,255,0.9); }
			60%  { opacity: 0.4; border-color: rgba(162,89,255,0.5); }
			100% { transform: scale(2.4); opacity: 0; border-color: rgba(79,124,255,0.0); }
		}

		/* Completion: pulsing icon */
		.ob-icon-pulse {
			animation: ob-icon-pulse-in 700ms cubic-bezier(0.34, 1.56, 0.64, 1);
		}
		@keyframes ob-icon-pulse-in {
			0%   { transform: scale(0.4); opacity: 0; }
			60%  { transform: scale(1.12); opacity: 1; }
			100% { transform: scale(1); opacity: 1; }
		}

		/* Confetti */
		.ob-confetti {
			position: absolute;
			top: 55px; left: 50%;
			width: 0; height: 0;
			pointer-events: none;
		}
		.ob-piece {
			position: absolute;
			top: 0; left: 0;
			width: var(--size, 6px);
			height: var(--size, 6px);
			background: var(--color, #A259FF);
			border-radius: 2px;
			transform: translate(-50%, -50%);
			opacity: 0;
			animation:
				ob-confetti-fly var(--duration, 1.4s) cubic-bezier(0.22, 1, 0.36, 1) var(--delay, 0s) forwards;
			box-shadow: 0 0 6px var(--color, #A259FF);
		}
		@keyframes ob-confetti-fly {
			0% {
				opacity: 0;
				transform: translate(-50%, -50%) scale(0.4) rotate(0deg);
			}
			15% { opacity: 1; }
			100% {
				opacity: 0;
				transform:
					translate(calc(-50% + var(--tx)), calc(-50% + var(--ty)))
					scale(0.8)
					rotate(var(--rot, 360deg));
			}
		}

		/* Mobile tighter spacing */
		@media (max-height: 700px) {
			.ob-title { font-size: 24px; }
			.ob-title-mega { font-size: 30px; }
			.ob-icon-wrap { width: 90px; height: 90px; }
			.ob-icon-inner { width: 80px; height: 80px; border-radius: 20px; }
			.ob-logo-wrap { width: 180px; height: 110px; }
		}
	`}</style>
);

export default OnboardingPage;
