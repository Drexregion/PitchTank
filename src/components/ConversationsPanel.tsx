import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Users, Hash, Sparkles, RefreshCw, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseUrl, supabaseAnonKey } from "../lib/supabaseClient";

interface DMThread {
	peerId: string;
	peerName: string;
	lastMessage: string;
	lastAt: string;
	unread: number;
}

interface Recommendation {
	investor_id: string;
	name: string;
	reason: string;
	bio: string | null;
	profile_picture_url: string | null;
}

interface ConversationsPanelProps {
	isOpen: boolean;
	onClose: () => void;
	eventId: string;
	userId: string;
	displayName: string;
	publicOnlineCount: number;
	onOpenPublicChat: () => void;
	onOpenDM: (peerId: string, peerName: string) => void;
}

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

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
	const [from, to] = avatarGradient(name);
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

function formatPreviewTime(ts: string): string {
	const d = new Date(ts);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	if (diffMins < 1) return "now";
	if (diffMins < 60) return `${diffMins}m`;
	const diffHrs = Math.floor(diffMins / 60);
	if (diffHrs < 24) return `${diffHrs}h`;
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const ConversationsPanel: React.FC<ConversationsPanelProps> = ({
	isOpen,
	onClose,
	eventId,
	userId,
	displayName: _displayName,
	publicOnlineCount,
	onOpenPublicChat,
	onOpenDM,
}) => {
	const navigate = useNavigate();
	const [threads, setThreads] = useState<DMThread[]>([]);
	const [loading, setLoading] = useState(true);
	const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

	const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
	const [recLoading, setRecLoading] = useState(false);
	const [recEmpty, setRecEmpty] = useState(false);
	const recFetchedRef = useRef(false);

	const fetchRecommendations = useCallback(async (force = false) => {
		if ((recFetchedRef.current && !force) || !eventId || !userId) return;
		recFetchedRef.current = true;
		setRecLoading(true);
		try {
			const { data: { session } } = await supabase.auth.getSession();
			if (!session) return;
			const res = await fetch(`${supabaseUrl}/functions/v1/recommend-connections`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`,
					apikey: supabaseAnonKey,
				},
				body: JSON.stringify({ eventId }),
			});
			if (res.ok) {
				const json = await res.json();
				const recs = json.recommendations ?? [];
				setRecommendations(recs);
				setRecEmpty(recs.length === 0);
			}
		} catch {
			// silently fail — recommendations are non-critical
		} finally {
			setRecLoading(false);
		}
	}, [eventId, userId]);

	const buildThreads = (rows: {
		sender_id: string;
		recipient_id: string;
		sender_name: string;
		recipient_name: string;
		text: string;
		is_read: boolean;
		created_at: string;
	}[]) => {
		const map = new Map<string, DMThread>();
		for (const row of rows) {
			const isSender = row.sender_id === userId;
			const peerId = isSender ? row.recipient_id : row.sender_id;
			const peerName = isSender ? row.recipient_name : row.sender_name;
			const existing = map.get(peerId);
			const unreadDelta = !isSender && !row.is_read ? 1 : 0;
			if (!existing || row.created_at > existing.lastAt) {
				map.set(peerId, {
					peerId,
					peerName,
					lastMessage: row.text,
					lastAt: row.created_at,
					unread: (existing?.unread ?? 0) + unreadDelta,
				});
			} else {
				map.set(peerId, {
					...existing,
					unread: existing.unread + unreadDelta,
				});
			}
		}
		return Array.from(map.values()).sort(
			(a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
		);
	};

	useEffect(() => {
		if (isOpen && eventId && userId) {
			fetchRecommendations();
		}
	}, [isOpen, eventId, userId, fetchRecommendations]);

	// Mark all unread DMs as read when the panel opens
	useEffect(() => {
		if (!isOpen || !userId || !eventId) return;
		supabase
			.from("direct_messages")
			.update({ is_read: true })
			.eq("event_id", eventId)
			.eq("recipient_id", userId)
			.eq("is_read", false)
			.then(() => {
				setThreads((prev) => prev.map((t) => ({ ...t, unread: 0 })));
			});
	}, [isOpen, userId, eventId]);

	useEffect(() => {
		if (!eventId || !userId) return;

		const load = async () => {
			setLoading(true);
			const { data } = await supabase
				.from("direct_messages")
				.select("sender_id, recipient_id, sender_name, recipient_name, text, is_read, created_at")
				.eq("event_id", eventId)
				.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
				.order("created_at", { ascending: true });
			if (data) setThreads(buildThreads(data as Parameters<typeof buildThreads>[0]));
			setLoading(false);
		};
		load();

		const channel = supabase
			.channel(`conversations_${eventId}_${userId}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "direct_messages",
					filter: `event_id=eq.${eventId}`,
				},
				(payload) => {
					const row = payload.new as Parameters<typeof buildThreads>[0][number];
					if (row.sender_id !== userId && row.recipient_id !== userId) return;
					setThreads((prev) => {
						const isSender = row.sender_id === userId;
						const peerId = isSender ? row.recipient_id : row.sender_id;
						const peerName = isSender ? row.recipient_name : row.sender_name;
						const unreadDelta = !isSender && !row.is_read ? 1 : 0;
						const existing = prev.find((t) => t.peerId === peerId);
						const updated: DMThread = {
							peerId,
							peerName,
							lastMessage: row.text,
							lastAt: row.created_at,
							unread: (existing?.unread ?? 0) + unreadDelta,
						};
						return [updated, ...prev.filter((t) => t.peerId !== peerId)];
					});
				},
			)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "direct_messages",
					filter: `event_id=eq.${eventId}`,
				},
				(payload) => {
					const row = payload.new as Parameters<typeof buildThreads>[0][number];
					if (row.recipient_id !== userId) return;
					// Recalculate unread when a message is marked read
					if (row.is_read) {
						setThreads((prev) =>
							prev.map((t) => {
								const isSender = row.sender_id === userId;
								const peerId = isSender ? row.recipient_id : row.sender_id;
								if (t.peerId !== peerId) return t;
								return { ...t, unread: Math.max(0, t.unread - 1) };
							}),
						);
					}
				},
			)
			.subscribe();

		channelRef.current = channel;
		return () => {
			supabase.removeChannel(channel);
		};
	}, [eventId, userId]);

	const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

	return (
		<div
			className="fixed inset-0 z-[60]"
			style={{ pointerEvents: isOpen ? "auto" : "none" }}
		>
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60"
				style={{
					opacity: isOpen ? 1 : 0,
					transition: "opacity 300ms cubic-bezier(0.22,1,0.36,1)",
				}}
				onClick={onClose}
			/>

			{/* Centering wrapper */}
			<div className="absolute inset-0 xl:max-w-[430px] xl:left-1/2 xl:-translate-x-1/2 overflow-hidden">
				<div
					className="absolute inset-0 flex flex-col overflow-hidden"
					style={{
						background: "#080a14",
						transform: isOpen ? "translateX(0)" : "translateX(100%)",
						transition: "transform 300ms cubic-bezier(0.22,1,0.36,1)",
					}}
				>
					{/* Ambient glow */}
					<div className="absolute inset-0 pointer-events-none overflow-hidden">
						<div
							className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[55vh] rounded-full opacity-40"
							style={{ background: "radial-gradient(ellipse at center, #2d1b69 0%, #1a0e4a 35%, transparent 70%)" }}
						/>
					</div>

					<div className="relative z-10 flex flex-col flex-1 min-h-0">
						{/* Header */}
						<div
							className="relative z-20 flex-shrink-0 flex items-center gap-3 px-5 pt-6 pb-4"
							style={{
								borderBottom: "1px solid rgba(255,255,255,0.06)",
								background: "rgba(8,10,20,0.8)",
								backdropFilter: "blur(24px)",
							}}
						>
							<button
								onClick={onClose}
								className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 transition-all active:scale-90 flex-shrink-0"
								style={{
									background: "rgba(255,255,255,0.05)",
									border: "1px solid rgba(255,255,255,0.08)",
								}}
							>
								<X size={15} />
							</button>

							<div className="flex-1 min-w-0">
								<p className="text-white/30 text-[9px] font-semibold uppercase tracking-[0.2em] leading-none mb-1">
									PitchTank Live
								</p>
								<h2 className="text-white font-black text-lg leading-none">
									Messages
								</h2>
							</div>

							{totalUnread > 0 && (
								<div
									className="flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-white font-black text-[11px] tabular-nums px-1"
									style={{
										background: "linear-gradient(135deg, #6366f1, #22d3ee)",
										boxShadow: "0 0 12px rgba(99,102,241,0.5)",
									}}
								>
									{totalUnread}
								</div>
							)}
						</div>

						{/* List */}
						<div className="flex-1 min-h-0 overflow-y-auto">
							{/* Public channel row */}
							<button
								onClick={onOpenPublicChat}
								className="w-full flex items-center gap-3 px-5 py-4 text-left transition-all active:scale-[0.98]"
								style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
							>
								<div
									className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
									style={{
										background: "linear-gradient(135deg, #6366f1, #22d3ee)",
										boxShadow: "0 0 16px rgba(99,102,241,0.35)",
									}}
								>
									<Hash size={18} className="text-white" />
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-white font-bold text-sm leading-none mb-1">
										Public Channel
									</p>
									<p className="text-white/30 text-xs truncate">
										Everyone in this event
									</p>
								</div>
								{publicOnlineCount > 0 && (
									<div
										className="flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0"
										style={{
											background: "rgba(34,197,94,0.1)",
											border: "1px solid rgba(34,197,94,0.2)",
										}}
									>
										<Users size={10} className="text-green-400" />
										<span className="text-green-400 text-[10px] font-bold tabular-nums">
											{publicOnlineCount >= 1000
												? `${(publicOnlineCount / 1000).toFixed(1)}k`
												: publicOnlineCount}
										</span>
									</div>
								)}
							</button>

							{/* Suggested connections */}
							<div>
								<div className="px-5 pt-4 pb-2 flex items-center gap-1.5">
									<Sparkles size={11} className="text-violet-400/60" />
									<p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.18em] flex-1">
										Suggested for You
									</p>
									<button
										onClick={() => fetchRecommendations(true)}
										disabled={recLoading}
										className="text-white/20 hover:text-white/50 transition-colors disabled:opacity-30"
									>
										<RefreshCw size={11} className={recLoading ? "animate-spin" : ""} />
									</button>
								</div>
								{recLoading ? (
									<div className="flex items-center gap-2 px-5 py-3">
										<div className="w-4 h-4 rounded-full border-2 border-white/10 border-t-white/40 animate-spin flex-shrink-0" />
										<p className="text-white/25 text-xs">Finding connections...</p>
									</div>
								) : recEmpty ? (
									<div
										className="mx-5 mb-3 rounded-2xl px-4 py-3.5 flex items-start gap-3"
										style={{
											background: "rgba(99,102,241,0.07)",
											border: "1px solid rgba(99,102,241,0.15)",
										}}
									>
										<Sparkles size={14} className="text-violet-400/50 flex-shrink-0 mt-0.5" />
										<div className="flex-1 min-w-0">
											<p className="text-white/50 text-xs leading-snug mb-2">
												Add a bio and what you're looking to connect on to your profile — Claude will suggest the best people to meet here.
											</p>
											<button
												onClick={() => { onClose(); navigate("/profile"); }}
												className="flex items-center gap-1 text-indigo-300/80 text-xs font-semibold hover:text-indigo-300 transition-colors"
											>
												Complete your profile <ArrowRight size={11} />
											</button>
										</div>
									</div>
								) : (
									recommendations.map((rec) => (
										<button
											key={rec.investor_id}
											onClick={() => onOpenDM(rec.investor_id, rec.name)}
											className="w-full flex items-start gap-3 px-5 py-3.5 text-left transition-all active:scale-[0.98]"
											style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
										>
											{rec.profile_picture_url ? (
												<img
													src={rec.profile_picture_url}
													alt={rec.name}
													className="w-10 h-10 rounded-full object-cover flex-shrink-0"
												/>
											) : (
												<Avatar name={rec.name} size={40} />
											)}
											<div className="flex-1 min-w-0">
												<p className="text-white font-bold text-sm leading-none mb-0.5">{rec.name}</p>
												{rec.bio && (
													<p className="text-white/40 text-xs leading-snug line-clamp-1 mb-1">{rec.bio}</p>
												)}
												<div className="flex items-start gap-1 mt-1">
													<Sparkles size={10} className="text-violet-400/60 mt-0.5 flex-shrink-0" />
													<p className="text-violet-300/70 text-xs leading-snug line-clamp-2">{rec.reason}</p>
												</div>
											</div>
											<div
												className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
												style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}
											>
												<MessageCircle size={13} className="text-indigo-300/70" />
											</div>
										</button>
									))
								)}
							</div>

							{/* DM section header */}
							{!loading && threads.length > 0 && (
								<div className="px-5 pt-4 pb-2">
									<p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.18em]">
										Direct Messages
									</p>
								</div>
							)}

							{/* DM threads */}
							{loading ? (
								<div className="flex items-center justify-center py-10">
									<div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
								</div>
							) : threads.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-16 px-8 gap-3 text-center">
									<div
										className="w-12 h-12 rounded-2xl flex items-center justify-center"
										style={{
											background: "rgba(99,102,241,0.08)",
											border: "1px solid rgba(99,102,241,0.15)",
										}}
									>
										<MessageCircle size={20} className="text-indigo-400/40" />
									</div>
									<p className="text-white/25 text-sm">No direct messages yet</p>
									<p className="text-white/15 text-xs leading-snug">
										Tap a username in the public channel to start a conversation
									</p>
								</div>
							) : (
								threads.map((thread) => (
									<button
										key={thread.peerId}
										onClick={() => onOpenDM(thread.peerId, thread.peerName)}
										className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all active:scale-[0.98]"
										style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
									>
										<Avatar name={thread.peerName} size={40} />
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-1.5 mb-0.5">
												<p className="text-white font-bold text-sm leading-none truncate">
													{thread.peerName}
												</p>
												{thread.unread > 0 && (
													<span
														className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full text-white font-black text-[9px] tabular-nums px-1 flex-shrink-0"
														style={{
															background: "#6366f1",
															boxShadow: "0 0 8px rgba(99,102,241,0.6)",
														}}
													>
														{thread.unread}
													</span>
												)}
											</div>
											<p
												className="text-xs truncate"
												style={{
													color: thread.unread > 0 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.28)",
													fontWeight: thread.unread > 0 ? 500 : 400,
												}}
											>
												{thread.lastMessage}
											</p>
										</div>
										<span className="text-white/20 text-[10px] flex-shrink-0 ml-1">
											{formatPreviewTime(thread.lastAt)}
										</span>
									</button>
								))
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
