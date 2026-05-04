import React, { useState, useEffect, useRef, useCallback } from "react";
import { ScheduleItem } from "../types/Event";
import { supabase } from "../lib/supabaseClient";
import { MessageCircle } from "lucide-react";

interface SchedulePanelProps {
	isOpen: boolean;
	onClose: () => void;
	eventName: string;
	schedule: ScheduleItem[];
	eventStart: string;
	eventEnd: string;
	eventId: string;
	currentUserId?: string | null;
	onStartDM?: (peerId: string, peerName: string) => void;
}

interface Attendee {
	id: string;
	name: string;
	profile_picture_url: string | null;
	bio: string | null;
	role: string | null;
	linkedin_url: string | null;
	twitter_url: string | null;
	profile_user_id: string | null;
	auth_user_id: string | null;
}

const PAGE_SIZE = 20;

const AVATAR_COLORS = [
	["#6366f1", "#22d3ee"],
	["#a855f7", "#ec4899"],
	["#06b6d4", "#3b82f6"],
	["#8b5cf6", "#6366f1"],
	["#14b8a6", "#22d3ee"],
	["#e879f9", "#a855f7"],
];
function avatarGradient(name: string): [string, string] {
	let h = 0;
	for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
	return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] as [string, string];
}

function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
	const [from, to] = avatarGradient(name);
	if (url) {
		return (
			<img
				src={url}
				alt={name}
				className="rounded-full object-cover flex-shrink-0"
				style={{ width: size, height: size }}
			/>
		);
	}
	return (
		<div
			className="rounded-full flex items-center justify-center font-black text-white flex-shrink-0"
			style={{
				width: size,
				height: size,
				background: `linear-gradient(135deg, ${from}, ${to})`,
				fontSize: size * 0.42,
			}}
		>
			{name.charAt(0).toUpperCase()}
		</div>
	);
}

const ROLE_LABELS: Record<string, string> = {
	pitcher: "Pitcher",
	sponsor: "Sponsor",
	judge: "Judge",
	investor: "Investor",
	member: "Member",
};

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
	pitcher: { bg: "rgba(234,179,8,0.12)", text: "#fde047", border: "rgba(234,179,8,0.25)" },
	sponsor: { bg: "rgba(34,211,238,0.1)", text: "#22d3ee", border: "rgba(34,211,238,0.22)" },
	judge: { bg: "rgba(168,85,247,0.12)", text: "#d8b4fe", border: "rgba(168,85,247,0.25)" },
	investor: { bg: "rgba(52,211,153,0.1)", text: "#34d399", border: "rgba(52,211,153,0.22)" },
	member: { bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.4)", border: "rgba(255,255,255,0.08)" },
};

export const SchedulePanel: React.FC<SchedulePanelProps> = ({
	isOpen,
	onClose,
	eventName,
	schedule,
	eventStart,
	eventEnd,
	eventId,
	currentUserId,
	onStartDM,
}) => {
	const [visible, setVisible] = useState(false);
	const [activeTab, setActiveTab] = useState<"schedule" | "people">("schedule");

	// People tab state
	const [attendees, setAttendees] = useState<Attendee[]>([]);
	const [loadingPeople, setLoadingPeople] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [offset, setOffset] = useState(0);
	const scrollRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const loadingRef = useRef(false);

	useEffect(() => {
		if (isOpen) requestAnimationFrame(() => setVisible(true));
		else {
			setVisible(false);
			// Reset people state when closing so re-open is fresh
			setActiveTab("schedule");
			setAttendees([]);
			setOffset(0);
			setHasMore(true);
		}
	}, [isOpen]);

	const fetchPage = useCallback(async (pageOffset: number) => {
		if (loadingRef.current || !eventId) return;
		loadingRef.current = true;
		setLoadingPeople(true);
		const { data: investorData, error } = await supabase
			.from("investors")
			.select("id, name, profile_user_id")
			.eq("event_id", eventId)
			.order("name", { ascending: true })
			.range(pageOffset, pageOffset + PAGE_SIZE - 1);

		if (error) console.error("SchedulePanel: failed to load attendees", error);

		if (investorData) {
			const profileIds = investorData
				.map((r: any) => r.profile_user_id)
				.filter(Boolean) as string[];

			let userMap: Record<string, any> = {};
			if (profileIds.length > 0) {
				const { data: userData } = await supabase
					.from("users")
					.select("id, auth_user_id, profile_picture_url, bio, role, linkedin_url, twitter_url")
					.in("id", profileIds);
				if (userData) {
					for (const u of userData) userMap[u.id] = u;
				}
			}

			const mapped: Attendee[] = investorData.map((row: any) => {
				const u = row.profile_user_id ? (userMap[row.profile_user_id] ?? {}) : {};
				return {
					id: row.id,
					name: row.name,
					profile_user_id: row.profile_user_id,
					auth_user_id: u.auth_user_id ?? null,
					profile_picture_url: u.profile_picture_url ?? null,
					bio: u.bio ?? null,
					role: u.role ?? null,
					linkedin_url: u.linkedin_url ?? null,
					twitter_url: u.twitter_url ?? null,
				};
			});
			setAttendees((prev) => (pageOffset === 0 ? mapped : [...prev, ...mapped]));
			setHasMore(investorData.length === PAGE_SIZE);
			setOffset(pageOffset + investorData.length);
		}
		setLoadingPeople(false);
		loadingRef.current = false;
	}, [eventId]);

	// Load first page when switching to people tab
	useEffect(() => {
		if (activeTab === "people" && attendees.length === 0 && hasMore) {
			fetchPage(0);
		}
	}, [activeTab]);

	// Infinite scroll via IntersectionObserver on sentinel
	useEffect(() => {
		if (activeTab !== "people") return;
		const sentinel = sentinelRef.current;
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
					fetchPage(offset);
				}
			},
			{ threshold: 0.1 },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [activeTab, hasMore, offset, fetchPage]);

	if (!isOpen) return null;

	const formatTime = (iso: string) =>
		new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s" }}
			/>
			<div
				className="relative w-full xl:max-w-[430px] rounded-t-3xl overflow-hidden flex flex-col"
				style={{
					background: "linear-gradient(180deg, #13102e 0%, #0d0b22 100%)",
					border: "1px solid rgba(255,255,255,0.08)",
					borderBottom: "none",
					maxHeight: "85vh",
					transform: visible ? "translateY(0)" : "translateY(100%)",
					transition: "transform 0.32s cubic-bezier(0.22,1,0.36,1)",
				}}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Drag handle */}
				<div className="flex justify-center pt-3 pb-1 flex-shrink-0">
					<div className="w-10 h-1 rounded-full bg-white/15" />
				</div>

				{/* Header */}
				<div className="px-6 pt-2 pb-3 flex items-center justify-between flex-shrink-0">
					<div>
						<p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-0.5">
							Event
						</p>
						<h2 className="text-xl font-black text-white">{eventName}</h2>
					</div>
					<button
						onClick={onClose}
						className="w-8 h-8 rounded-full flex items-center justify-center"
						style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
					>
						<svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* Tabs */}
				<div className="px-6 pb-3 flex-shrink-0">
					<div
						className="flex rounded-xl p-1 gap-1"
						style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
					>
						{(["schedule", "people"] as const).map((tab) => (
							<button
								key={tab}
								onClick={() => setActiveTab(tab)}
								className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
								style={
									activeTab === tab
										? {
												background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(34,211,238,0.15))",
												color: "#e0e7ff",
												border: "1px solid rgba(99,102,241,0.3)",
												boxShadow: "0 0 12px rgba(99,102,241,0.15)",
											}
										: {
												color: "rgba(255,255,255,0.35)",
												border: "1px solid transparent",
											}
								}
							>
								{tab === "schedule" ? "Schedule" : "People"}
							</button>
						))}
					</div>
				</div>

				{/* ── Schedule tab ── */}
				{activeTab === "schedule" && (
					<div className="flex-1 overflow-y-auto px-6 pb-8 min-h-0">
						{/* Event time range */}
						{eventStart && (
							<div className="mb-4">
								<div
									className="flex items-center gap-3 rounded-2xl px-4 py-3"
									style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
								>
									<div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
										<svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
									</div>
									<div>
										<p className="text-white font-semibold text-sm">{formatDate(eventStart)}</p>
										<p className="text-white/40 text-xs mt-0.5">
											{formatTime(eventStart)} — {formatTime(eventEnd)}
										</p>
									</div>
								</div>
							</div>
						)}

						{schedule.length === 0 ? (
							<div
								className="rounded-2xl p-8 text-center"
								style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
							>
								<svg className="w-10 h-10 text-white/15 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
								</svg>
								<p className="text-white/30 text-sm">No schedule added yet.</p>
							</div>
						) : (
							<div className="relative">
								<div
									className="absolute left-[19px] top-2 bottom-2 w-px"
									style={{ background: "rgba(124,58,237,0.25)" }}
								/>
								<div className="space-y-3">
									{schedule.map((item, i) => (
										<div key={i} className="flex gap-4">
											<div className="flex flex-col items-center flex-shrink-0 pt-3.5">
												<div
													className="w-[10px] h-[10px] rounded-full z-10"
													style={{ background: "linear-gradient(135deg, #a78bfa, #6366f1)", boxShadow: "0 0 8px rgba(139,92,246,0.5)" }}
												/>
											</div>
											<div
												className="flex-1 rounded-2xl px-4 py-3.5 mb-0.5"
												style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
											>
												<div className="flex items-start justify-between gap-2">
													<p className="text-white font-bold text-sm leading-snug">{item.title}</p>
													{item.time && (
														<span
															className="text-[10px] font-semibold flex-shrink-0 px-2 py-0.5 rounded-full"
															style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.3)" }}
														>
															{item.time}
														</span>
													)}
												</div>
												{item.description && (
													<p className="text-white/45 text-xs mt-1.5 leading-relaxed">{item.description}</p>
												)}
												{item.duration && (
													<p className="text-white/25 text-[10px] mt-1.5 font-medium flex items-center gap-1">
														<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
														</svg>
														{item.duration}
													</p>
												)}
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				)}

				{/* ── People tab ── */}
				{activeTab === "people" && (
					<div ref={scrollRef} className="flex-1 overflow-y-auto pb-8 min-h-0">
						{attendees.length === 0 && loadingPeople ? (
							<div className="flex items-center justify-center py-16">
								<div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
							</div>
						) : attendees.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
								<div
									className="w-12 h-12 rounded-2xl flex items-center justify-center"
									style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}
								>
									<svg className="w-5 h-5 text-indigo-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
								</div>
								<p className="text-white/25 text-sm">No attendees yet</p>
							</div>
						) : (
							<div>
								<p className="px-6 pt-2 pb-3 text-white/25 text-[10px] font-bold uppercase tracking-[0.18em]">
									{attendees.length}{hasMore ? "+" : ""} attendee{attendees.length !== 1 ? "s" : ""}
								</p>
								<div className="space-y-px">
									{attendees.map((person) => {
										const roleStyle = person.role ? ROLE_COLORS[person.role] ?? ROLE_COLORS.member : null;
										const isSelf = person.auth_user_id === currentUserId;
										return (
											<div
												key={person.id}
												className="flex items-center gap-3 px-6 py-3.5"
												style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
											>
												<Avatar name={person.name} url={person.profile_picture_url} size={44} />
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 flex-wrap">
														<p className="text-white font-bold text-sm leading-none">
															{person.name}
															{isSelf && (
																<span className="ml-1.5 text-white/25 font-normal text-xs">you</span>
															)}
														</p>
														{roleStyle && person.role && (
															<span
																className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
																style={{ background: roleStyle.bg, color: roleStyle.text, border: `1px solid ${roleStyle.border}` }}
															>
																{ROLE_LABELS[person.role] ?? person.role}
															</span>
														)}
													</div>
													{person.bio && (
														<p className="text-white/35 text-xs mt-1 leading-snug line-clamp-2">
															{person.bio}
														</p>
													)}
													{(person.linkedin_url || person.twitter_url) && (
														<div className="flex items-center gap-2 mt-1.5">
															{person.linkedin_url && (
																<a
																	href={person.linkedin_url}
																	target="_blank"
																	rel="noopener noreferrer"
																	onClick={(e) => e.stopPropagation()}
																	className="text-white/25 hover:text-white/60 transition-colors"
																>
																	<svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
																		<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
																	</svg>
																</a>
															)}
															{person.twitter_url && (
																<a
																	href={person.twitter_url}
																	target="_blank"
																	rel="noopener noreferrer"
																	onClick={(e) => e.stopPropagation()}
																	className="text-white/25 hover:text-white/60 transition-colors"
																>
																	<svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
																		<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
																	</svg>
																</a>
															)}
														</div>
													)}
												</div>

												{onStartDM && !isSelf && (
													<button
														onClick={() => person.auth_user_id && onStartDM(person.auth_user_id, person.name)}
														disabled={!person.auth_user_id}
														className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:cursor-not-allowed"
														style={{
															background: person.auth_user_id ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.04)",
															border: person.auth_user_id ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(255,255,255,0.06)",
														}}
														title={person.auth_user_id ? `Message ${person.name}` : "No account to message"}
													>
														<MessageCircle size={14} className={person.auth_user_id ? "text-indigo-300/70" : "text-white/20"} />
													</button>
												)}
											</div>
										);
									})}
								</div>

								{/* Infinite scroll sentinel */}
								<div ref={sentinelRef} className="h-4" />

								{/* Loading indicator for next page */}
								{loadingPeople && (
									<div className="flex items-center justify-center py-4">
										<div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
									</div>
								)}

								{!hasMore && attendees.length > 0 && (
									<p className="text-center text-white/15 text-xs py-4">
										All {attendees.length} attendees loaded
									</p>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};
