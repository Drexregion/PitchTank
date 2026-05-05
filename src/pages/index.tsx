import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Event } from "../types/Event";
import { useAuth } from "../contexts/AuthContext";
import { useGlobalUnreadDMs } from "../hooks/useGlobalUnreadDMs";

type EventFilter = "active" | "completed";

const HomePage: React.FC = () => {
	console.log("[HomePage] render");
	const [events, setEvents] = useState<Event[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
	const [filter, setFilter] = useState<EventFilter>("active");
	const avatarRef = useRef<HTMLDivElement>(null);
	const { isAdmin, user, signOut } = useAuth();
	const navigate = useNavigate();
	const unreadDMs = useGlobalUnreadDMs(user?.id ?? null);

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

	// Filtered + sorted events: Active prioritizes soonest (live > upcoming > recently ended);
	// Completed shows most recent completions first.
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

	const getStatusBadge = (status: string) => {
		const styles: Record<string, React.CSSProperties> = {
			active: { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#86efac" },
			completed: { background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.35)", color: "#93c5fd" },
			draft: { background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)", color: "#fde047" },
			cancelled: { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" },
		};
		return (
			<span
				className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0"
				style={styles[status] ?? { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
			>
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</span>
		);
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		if (d.getTime() === today.getTime()) {
			return `Today · ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
		}
		return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
	};

	return (
		<div className="min-h-screen relative overflow-hidden" style={{ background: "#080a14" }}>
			{/* Leaderboard background image — blurred full-width */}
			<div
				aria-hidden="true"
				className="fixed inset-0 bg-cover bg-center bg-no-repeat"
				style={{ backgroundImage: "url('/leaderboard/leaderboard-bg.webp')", filter: "blur(6px)", transform: "scale(1.04)" }}
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
					style={{ background: "radial-gradient(ellipse at center, #2d1b69 0%, #1a0e4a 35%, transparent 70%)" }}
				/>
				<div
					className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-20"
					style={{ background: "radial-gradient(circle, #4f46e5 0%, transparent 70%)", filter: "blur(40px)" }}
				/>
				<div
					className="absolute top-1/3 -right-20 w-72 h-72 rounded-full opacity-15"
					style={{ background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)", filter: "blur(50px)" }}
				/>
			</div>

			{/* Skyline at bottom */}
			<div aria-hidden="true" className="fixed bottom-0 left-0 right-0 z-[5] pointer-events-none">
				<img
					src="/leaderboard/skyline.webp"
					alt=""
					onError={(e) => (e.currentTarget.style.display = "none")}
					className="w-full h-auto object-cover opacity-40"
				/>
			</div>

			{/* Dark side curtains outside the center column */}
			<div className="fixed inset-y-0 left-0 z-[9] pointer-events-none" style={{ width: "calc((100vw - 430px) / 2)", background: "rgba(4,3,12,0.92)" }} />
			<div className="fixed inset-y-0 right-0 z-[9] pointer-events-none" style={{ width: "calc((100vw - 430px) / 2)", background: "rgba(4,3,12,0.92)" }} />

			{/* Content */}
			<div
				className="relative z-10 xl:max-w-[430px] mx-auto px-5 py-10 pb-28 min-h-screen"
				style={{
					background: "rgba(6,5,18,0.72)",
					borderLeft: "1px solid rgba(255,255,255,0.08)",
					borderRight: "1px solid rgba(255,255,255,0.08)",
					backdropFilter: "blur(2px)",
				}}
			>
				{/* Header */}
				<header className="mb-10 flex items-end justify-between">
					<div>
						<p className="text-white/35 text-[10px] font-semibold uppercase tracking-widest mb-1">
							Welcome to
						</p>
						<h1
							className="font-black text-5xl leading-none tracking-tight"
							style={{
								background: "linear-gradient(180deg, #ffffff 0%, #a78bfa 45%, #6366f1 100%)",
								WebkitBackgroundClip: "text",
								WebkitTextFillColor: "transparent",
								backgroundClip: "text",
								filter: "drop-shadow(0 0 24px rgba(139,92,246,0.55))",
							}}
						>
							PitchTank
						</h1>
					</div>
					<div className="flex items-center gap-2">
						{isAdmin && (
							<Link
								to="/admin/events/new"
								className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-[0.97]"
								style={{
									background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
									boxShadow: "0 0 18px rgba(34,211,238,0.3)",
								}}
							>
								+ Create Event
							</Link>
						)}
						{user ? (
							<div ref={avatarRef} className="relative">
								<button
									onClick={() => setAvatarMenuOpen((o) => !o)}
									className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white transition-all hover:opacity-80 active:scale-95"
									style={{
										background: "linear-gradient(135deg, #7c3aed 0%, #22d3ee 100%)",
										boxShadow: "0 0 14px rgba(124,58,237,0.4)",
									}}
								>
									{(user.email ?? "?").charAt(0).toUpperCase()}
								</button>
								{avatarMenuOpen && (
									<div
										className="absolute right-0 top-11 rounded-2xl overflow-hidden z-50 min-w-[150px] py-1"
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
														background: "linear-gradient(135deg, #6366f1, #22d3ee)",
														boxShadow: "0 0 8px rgba(99,102,241,0.5)",
													}}
												>
													{unreadDMs > 99 ? "99+" : unreadDMs}
												</span>
											)}
										</Link>
										<div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} className="mt-1 pt-1">
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
								className="px-4 py-2 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-[0.97]"
								style={{
									background: "rgba(255,255,255,0.07)",
									border: "1px solid rgba(255,255,255,0.12)",
								}}
							>
								Log in
							</Link>
						)}
					</div>
				</header>

				<div
					className="flex items-center gap-3 mb-5"
					style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.75rem" }}
				>
					<span
						aria-hidden="true"
						className="h-px flex-1 max-w-[60px]"
						style={{ background: "linear-gradient(to right, transparent, #22d3ee)" }}
					/>
					<p className="text-2xl font-black uppercase tracking-wider text-white"
						style={{ textShadow: "rgba(184,212,255,0.3) 0px 0px 16px" }}>
						Events
					</p>
					<span
						aria-hidden="true"
						className="h-px flex-1"
						style={{ background: "linear-gradient(to left, transparent, #8b5cf6)" }}
					/>
				</div>

				{/* Filter pills */}
				<div
					role="tablist"
					aria-label="Filter events"
					className="flex p-1 mb-6 rounded-full"
					style={{
						background: "rgba(255,255,255,0.04)",
						border: "1px solid rgba(255,255,255,0.08)",
					}}
				>
					{(
						[
							{ id: "active", label: "Active" },
							{ id: "completed", label: "Completed" },
						] as { id: EventFilter; label: string }[]
					).map(({ id, label }) => {
						const isSelected = filter === id;
						return (
							<button
								key={id}
								type="button"
								role="tab"
								aria-selected={isSelected}
								onClick={() => setFilter(id)}
								className={`flex-1 px-4 py-2 rounded-full text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${
									isSelected
										? "text-white"
										: "text-white/55 hover:text-white/85"
								}`}
								style={
									isSelected
										? {
												background:
													"linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
												boxShadow: "0 0 14px rgba(34,211,238,0.3)",
											}
										: undefined
								}
							>
								{label}
							</button>
						);
					})}
				</div>

				{isLoading ? (
					<div className="flex justify-center items-center py-20">
						<div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
					</div>
				) : error ? (
					<div
						className="rounded-2xl p-4 text-red-400 text-sm"
						style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}
					>
						{error}
					</div>
				) : filteredEvents.length === 0 ? (
					<div
						className="rounded-2xl p-10 text-center"
						style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
					>
						<p className="text-white font-semibold mb-1">
							{filter === "active" ? "No Active Events" : "No Completed Events"}
						</p>
						<p className="text-white/35 text-sm">
							{filter === "active"
								? isAdmin
									? 'Click "Create Event" to get started.'
									: "Check back later for upcoming events."
								: "Completed events will show up here once they wrap up."}
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4">
						{filteredEvents.map((event) => (
							<div
								key={event.id}
								className="rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.01]"
								style={{
									background:
										"linear-gradient(135deg, rgba(20,15,50,0.85) 0%, rgba(13,11,34,0.90) 100%)",
									border: "1px solid rgba(255,255,255,0.08)",
									boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
								}}
							>
								<div className="p-5">
									<div className="flex items-start justify-between gap-3 mb-3">
										<h2 className="text-white font-bold text-lg leading-tight">
											{event.name}
										</h2>
										{getStatusBadge(event.status)}
									</div>

									{event.description && (
										<p className="text-white/40 text-sm mb-4 line-clamp-2 leading-relaxed">
											{event.description}
										</p>
									)}

									<div
										className="grid grid-cols-2 gap-2 mb-5"
									>
										{[
											{ label: "Starts", value: formatDate(event.start_time) },
											{ label: "Ends", value: formatDate(event.end_time) },
										].map(({ label, value }) => (
											<div
												key={label}
												className="rounded-xl px-3 py-2"
												style={{
													background: "rgba(255,255,255,0.04)",
													border: "1px solid rgba(255,255,255,0.06)",
												}}
											>
												<p className="text-white/30 text-[9px] font-semibold uppercase tracking-widest mb-0.5">
													{label}
												</p>
												<p className="text-white/80 text-xs font-medium leading-snug">
													{value}
												</p>
											</div>
										))}
									</div>

									<Link
										to={`/events/${event.id}`}
										className="block w-full text-center py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
										style={{
											background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
											boxShadow: "0 0 16px rgba(34,211,238,0.2)",
										}}
									>
										View Event
									</Link>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default HomePage;
