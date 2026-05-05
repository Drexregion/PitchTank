import React, { useState, useEffect, useRef } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { Event } from "../types/Event";
import { useAuth } from "../contexts/AuthContext";
import { useGlobalUnreadDMs } from "../hooks/useGlobalUnreadDMs";
import { useMyProfile } from "../hooks/useMyProfile";
import {
	Avatar,
	Button as PtButton,
	GlassCard,
	Tabs as PtTabs,
	type TabOption,
} from "../components/design-system";

type EventFilter = "active" | "completed";

const FILTER_OPTIONS: ReadonlyArray<TabOption<EventFilter>> = [
	{ value: "active", label: "Active" },
	{ value: "completed", label: "Completed" },
];

type EventTone = "live" | "upcoming" | "draft" | "ended" | "completed";

function deriveTone(event: Event): EventTone {
	const now = Date.now();
	const start = new Date(event.start_time).getTime();
	const end = new Date(event.end_time).getTime();
	if (event.status === "completed") return "completed";
	if (event.status === "draft") return "draft";
	if (now >= start && now <= end) return "live";
	if (start > now) return "upcoming";
	return "ended";
}

const TONE_CARD: Record<EventTone, "featured" | "purple" | "neutral" | "frame"> =
	{
		live: "featured",
		upcoming: "purple",
		draft: "neutral",
		ended: "frame",
		completed: "frame",
	};

const STATUS_PILL: Record<
	EventTone,
	{ label: string; bg: string; border: string; color: string; dot?: string }
> = {
	live: {
		label: "Live now",
		bg: "rgba(255,138,0,0.14)",
		border: "rgba(255,138,0,0.45)",
		color: "#ffc896",
		dot: "#FF8A00",
	},
	upcoming: {
		label: "Upcoming",
		bg: "rgba(162,89,255,0.14)",
		border: "rgba(162,89,255,0.4)",
		color: "#dcc8ff",
	},
	draft: {
		label: "Draft",
		bg: "rgba(234,179,8,0.10)",
		border: "rgba(234,179,8,0.30)",
		color: "#fde047",
	},
	ended: {
		label: "Ended",
		bg: "rgba(255,255,255,0.06)",
		border: "rgba(255,255,255,0.10)",
		color: "rgba(255,255,255,0.55)",
	},
	completed: {
		label: "Completed",
		bg: "rgba(79,124,255,0.12)",
		border: "rgba(79,124,255,0.32)",
		color: "#b8d4ff",
	},
};

const HomePage: React.FC = () => {
	const [events, setEvents] = useState<Event[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
	const [filter, setFilter] = useState<EventFilter>("active");
	const avatarRef = useRef<HTMLDivElement>(null);
	const { isAdmin, user, isLoading: authLoading, signOut } = useAuth();
	const navigate = useNavigate();
	const unreadDMs = useGlobalUnreadDMs(user?.id ?? null);
	const myProfile = useMyProfile(user?.id ?? null);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
				setAvatarMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleLogout = async () => {
		setAvatarMenuOpen(false);
		await signOut();
		navigate("/login");
	};

	useEffect(() => {
		const fetchEvents = async () => {
			try {
				setIsLoading(true);
				setError(null);
				const { data, error: fetchError } = await supabase
					.from("events")
					.select("*")
					.order("start_time", { ascending: false });
				if (fetchError) throw fetchError;
				setEvents(data || []);
			} catch (err: any) {
				setError(err.message || "Failed to fetch events");
			} finally {
				setIsLoading(false);
			}
		};
		fetchEvents();
	}, [user?.id]);

	const filteredEvents = React.useMemo(() => {
		const now = Date.now();
		if (filter === "completed") {
			return events
				.filter((e) => e.status === "completed")
				.sort(
					(a, b) =>
						new Date(b.end_time).getTime() - new Date(a.end_time).getTime(),
				);
		}
		const score = (e: Event): [number, number] => {
			const start = new Date(e.start_time).getTime();
			const end = new Date(e.end_time).getTime();
			if (now >= start && now <= end) return [0, start];
			if (start > now) return [1, start - now];
			return [2, now - end];
		};
		return events
			.filter((e) => e.status === "active" || e.status === "draft")
			.sort((a, b) => {
				const [ag, av] = score(a);
				const [bg, bv] = score(b);
				return ag !== bg ? ag - bg : av - bv;
			});
	}, [events, filter]);

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		if (d.getTime() === today.getTime()) {
			return `Today · ${date.toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
			})}`;
		}
		return date.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Auth gate: while resolving, show a quiet spinner; if logged out,
	// redirect to /welcome. The global OnboardingGate handles the
	// not-yet-onboarded redirect for every protected route.
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

	return (
		<div
			className="min-h-screen relative overflow-hidden"
			style={{ background: "#080a14" }}
		>
			{/* Background image — blurred full-width */}
			<div
				aria-hidden="true"
				className="fixed inset-0 bg-cover bg-center bg-no-repeat"
				style={{
					backgroundImage: "url('/leaderboard/leaderboard-bg.webp')",
					filter: "blur(6px)",
					transform: "scale(1.04)",
				}}
			/>
			{/* Dark overlay */}
			<div
				className="fixed inset-0"
				style={{
					background:
						"linear-gradient(160deg, rgba(8,6,20,0.87) 0%, rgba(10,8,28,0.80) 50%, rgba(6,8,16,0.88) 100%)",
				}}
			/>
			{/* Ambient glows */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden">
				<div
					className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[60vh] rounded-full opacity-50"
					style={{
						background:
							"radial-gradient(ellipse at center, #2d1b69 0%, #1a0e4a 35%, transparent 70%)",
					}}
				/>
				<div
					className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-20"
					style={{
						background:
							"radial-gradient(circle, #4f46e5 0%, transparent 70%)",
						filter: "blur(40px)",
					}}
				/>
				<div
					className="absolute top-1/3 -right-20 w-72 h-72 rounded-full opacity-15"
					style={{
						background:
							"radial-gradient(circle, #0ea5e9 0%, transparent 70%)",
						filter: "blur(50px)",
					}}
				/>
			</div>

			{/* Skyline at bottom */}
			<div
				aria-hidden="true"
				className="fixed bottom-0 left-0 right-0 z-[5] pointer-events-none"
			>
				<img
					src="/leaderboard/skyline.webp"
					alt=""
					onError={(e) => (e.currentTarget.style.display = "none")}
					className="w-full h-auto object-cover opacity-40"
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

			{/* Content */}
			<div
				className="relative z-10 xl:max-w-[430px] mx-auto px-5 pt-6 pb-28 min-h-screen"
				style={{
					background: "rgba(6,5,18,0.72)",
					borderLeft: "1px solid rgba(255,255,255,0.08)",
					borderRight: "1px solid rgba(255,255,255,0.08)",
					backdropFilter: "blur(2px)",
				}}
			>
				{/* Top bar: account / admin actions, with centered wordmark */}
				<div className="relative flex items-center mb-2 min-h-[48px]">
					<img
						src="/icons/icon-text-horizontal.webp"
						alt="PitchTank"
						aria-hidden="true"
						className="absolute left-1/2 -translate-x-1/2 h-12 w-auto pointer-events-none"
						style={{
							filter: "drop-shadow(0 0 16px rgba(139,92,246,0.45))",
						}}
					/>
					<div className="ml-auto flex items-center gap-2">
					{isAdmin && (
						<PtButton
							variant="primary"
							size="md"
							onClick={() => navigate("/admin/events/new")}
						>
							<Plus size={14} strokeWidth={2.2} />
							Create Event
						</PtButton>
					)}
					{user ? (
						<div ref={avatarRef} className="relative">
							<button
								type="button"
								onClick={() => setAvatarMenuOpen((o) => !o)}
								aria-label="Account menu"
								className="rounded-full transition-all hover:opacity-90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
							>
								<Avatar
									size="md"
									name={myProfile.displayName || user.email || "?"}
									photo={
										myProfile.profilePictureUrl ??
										(user as any)?.user_metadata?.avatar_url
									}
									gradient={myProfile.gradient}
								/>
								{unreadDMs > 0 && (
									<span
										className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-white font-black text-[10px] tabular-nums px-1"
										style={{
											background:
												"linear-gradient(135deg, #6366f1, #22d3ee)",
											boxShadow: "0 0 8px rgba(99,102,241,0.5)",
										}}
									>
										{unreadDMs > 99 ? "99+" : unreadDMs}
									</span>
								)}
							</button>
							{avatarMenuOpen && (
								<div
									className="absolute right-0 top-12 rounded-2xl overflow-hidden z-50 min-w-[170px] py-1"
									style={{
										background: "rgba(16,12,40,0.97)",
										border: "1px solid rgba(255,255,255,0.1)",
										boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
										backdropFilter: "blur(12px)",
									}}
								>
									{[
										{ label: "Profile", to: "/profile" },
										{ label: "Settings", to: "/settings" },
									].map(({ label, to }) => (
										<Link
											key={label}
											to={to}
											onClick={() => setAvatarMenuOpen(false)}
											className="block px-4 py-2.5 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors"
										>
											{label}
										</Link>
									))}
									<Link
										to="/messages"
										onClick={() => setAvatarMenuOpen(false)}
										className="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors"
									>
										<span>Messages</span>
										{unreadDMs > 0 && (
											<span
												className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-white font-black text-[10px] tabular-nums px-1"
												style={{
													background:
														"linear-gradient(135deg, #6366f1, #22d3ee)",
													boxShadow: "0 0 8px rgba(99,102,241,0.5)",
												}}
											>
												{unreadDMs > 99 ? "99+" : unreadDMs}
											</span>
										)}
									</Link>
									<div
										style={{
											borderTop: "1px solid rgba(255,255,255,0.07)",
										}}
										className="mt-1 pt-1"
									>
										<button
											onClick={handleLogout}
											className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
										>
											Log out
										</button>
									</div>
								</div>
							)}
						</div>
					) : (
						<Link
							to="/login"
							className="px-4 py-2 rounded-xl font-semibold text-xs text-white/80 transition-all hover:text-white hover:bg-white/10 active:scale-[0.97]"
							style={{
								background: "rgba(255,255,255,0.05)",
								border: "1px solid rgba(255,255,255,0.10)",
							}}
						>
							Log in
						</Link>
					)}
					</div>
				</div>

				{/* Section heading */}
				<div className="flex items-center justify-center gap-3 mt-4 mb-5">
					<span
						aria-hidden="true"
						className="h-px w-[80px]"
						style={{
							background:
								"linear-gradient(to right, transparent, var(--c-cyan))",
						}}
					/>
					<h1
						className="font-display text-2xl uppercase font-bold tracking-wider text-pt-text-1 whitespace-nowrap"
						style={{ textShadow: "0 0 18px rgba(184,212,255,0.30)" }}
					>
						Events
					</h1>
					<span
						aria-hidden="true"
						className="h-px w-[80px]"
						style={{
							background:
								"linear-gradient(to left, transparent, var(--c-purple))",
						}}
					/>
				</div>

				{/* Filter tabs */}
				<div className="flex justify-center mb-6">
					<PtTabs<EventFilter>
						options={FILTER_OPTIONS}
						value={filter}
						onChange={setFilter}
					/>
				</div>

				{isLoading ? (
					<div className="flex justify-center items-center py-20">
						<div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
					</div>
				) : error ? (
					<GlassCard tone="frame" size="md" className="text-red-400 text-sm">
						{error}
					</GlassCard>
				) : filteredEvents.length === 0 ? (
					<GlassCard tone="frame" size="lg" className="text-center">
						<p className="text-white font-semibold mb-1 font-display">
							{filter === "active"
								? "No active events"
								: "No completed events"}
						</p>
						<p className="text-pt-text-2 text-sm">
							{filter === "active"
								? isAdmin
									? 'Tap "Create Event" to get started.'
									: "Check back later for upcoming events."
								: "Completed events will show up here once they wrap up."}
						</p>
					</GlassCard>
				) : (
					<div className="grid grid-cols-1 gap-4">
						{filteredEvents.map((event) => {
							const tone = deriveTone(event);
							const pill = STATUS_PILL[tone];
							return (
								<GlassCard
									key={event.id}
									tone={TONE_CARD[tone]}
									size="md"
									className="transition-transform hover:scale-[1.01]"
								>
									<div className="flex items-start justify-between gap-3 mb-3">
										<h2 className="font-display font-semibold text-white text-[17px] leading-tight tracking-tight">
											{event.name}
										</h2>
										<span
											className="px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0 inline-flex items-center gap-1.5 uppercase tracking-wider"
											style={{
												background: pill.bg,
												border: `1px solid ${pill.border}`,
												color: pill.color,
											}}
										>
											{pill.dot && (
												<span
													className="w-1.5 h-1.5 rounded-full"
													style={{
														background: pill.dot,
														boxShadow: `0 0 6px ${pill.dot}`,
														animation: "pt-live-pulse 1.6s ease-in-out infinite",
													}}
												/>
											)}
											{pill.label}
										</span>
									</div>

									{event.description && (
										<p className="text-pt-text-2 text-sm mb-4 line-clamp-2 leading-relaxed">
											{event.description}
										</p>
									)}

									<div className="grid grid-cols-2 gap-2 mb-4">
										{[
											{ label: "Starts", value: formatDate(event.start_time) },
											{ label: "Ends", value: formatDate(event.end_time) },
										].map(({ label, value }) => (
											<div
												key={label}
												className="rounded-xl px-3 py-2"
												style={{
													background: "rgba(255,255,255,0.03)",
													border: "1px solid rgba(255,255,255,0.06)",
												}}
											>
												<p className="text-pt-text-3 text-[9px] font-semibold uppercase tracking-widest mb-0.5">
													{label}
												</p>
												<p className="text-white/85 text-xs font-medium leading-snug num">
													{value}
												</p>
											</div>
										))}
									</div>

									<PtButton
										variant="primary"
										size="lg"
										className="w-full"
										onClick={() => navigate(`/events/${event.id}`)}
									>
										View Event
									</PtButton>
								</GlassCard>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
};

export default HomePage;
