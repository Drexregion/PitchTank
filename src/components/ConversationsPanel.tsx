import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Users, Hash, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { gradientForUser } from "./design-system";

interface DMThread {
	peerId: string;
	peerName: string;
	peerAvatar: string | null;
	peerColor: string | null;
	lastMessage: string;
	lastAt: string;
	unread: number;
}

interface ConversationsPanelProps {
	isOpen: boolean;
	onClose: () => void;
	userId: string;
	displayName: string;
	publicOnlineCount?: number;
	onOpenPublicChat?: () => void;
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

function Avatar({
	name,
	size = 32,
	gradient,
}: {
	name: string;
	size?: number;
	gradient?: [string, string];
}) {
	const [from, to] = gradient ?? avatarGradient(name);
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

function buildThreads(
	userId: string,
	rows: {
		sender_id: string;
		recipient_id: string;
		sender_name: string;
		recipient_name: string;
		text: string;
		is_read: boolean;
		created_at: string;
	}[],
): DMThread[] {
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
				peerAvatar: null,
				peerColor: null,
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
	userId,
	displayName: _displayName,
	publicOnlineCount,
	onOpenPublicChat,
	onOpenDM,
}) => {
	const [threads, setThreads] = useState<DMThread[]>([]);
	const [loading, setLoading] = useState(true);
	const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

	const loadThreads = useCallback(async () => {
		if (!userId) return;
		setLoading(true);
		const { data } = await supabase
			.from("direct_messages")
			.select("sender_id, recipient_id, sender_name, recipient_name, text, is_read, created_at")
			.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
			.order("created_at", { ascending: true });
		if (data) {
			const builtThreads = buildThreads(userId, data as Parameters<typeof buildThreads>[1]);
			const peerIds = builtThreads.map((t) => t.peerId);
			if (peerIds.length > 0) {
				const { data: investors } = await supabase
					.from("investors")
					.select(
						"id, name, users!investors_profile_user_id_fkey(profile_picture_url, profile_color)",
					)
					.in("id", peerIds);
				if (investors) {
					const infoMap = new Map(
						investors.map((inv: any) => [
							inv.id,
							{
								name: inv.name,
								avatar: inv.users?.profile_picture_url ?? null,
								color: inv.users?.profile_color ?? null,
							},
						]),
					);
					setThreads(
						builtThreads.map((t) => {
							const info = infoMap.get(t.peerId);
							return {
								...t,
								peerName: info?.name ?? t.peerName,
								peerAvatar: info?.avatar ?? null,
								peerColor: info?.color ?? null,
							};
						}),
					);
				} else {
					setThreads(builtThreads);
				}
			} else {
				setThreads(builtThreads);
			}
		}
		setLoading(false);
	}, [userId]);

	// Re-fetch threads whenever the panel opens
	useEffect(() => {
		if (!isOpen || !userId) return;
		loadThreads();
	}, [isOpen, userId, loadThreads]);

	// Mark all unread DMs as read when the panel opens
	useEffect(() => {
		if (!isOpen || !userId) return;
		supabase
			.from("direct_messages")
			.update({ is_read: true })
			.eq("recipient_id", userId)
			.eq("is_read", false)
			.then(() => {
				setThreads((prev) => prev.map((t) => ({ ...t, unread: 0 })));
			});
	}, [isOpen, userId]);

	useEffect(() => {
		if (!userId) return;

		const channel = supabase
			.channel(`conversations_global_${userId}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "direct_messages",
				},
				(payload) => {
					const row = payload.new as Parameters<typeof buildThreads>[1][number];
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
							peerAvatar: existing?.peerAvatar ?? null,
							peerColor: existing?.peerColor ?? null,
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
				},
				(payload) => {
					const row = payload.new as Parameters<typeof buildThreads>[1][number];
					if (row.recipient_id !== userId) return;
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
	}, [userId, loadThreads]);

	const totalUnread = threads.reduce((s, t) => s + t.unread, 0);
	const onlineCount = publicOnlineCount ?? 0;

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
								aria-label="Close messages"
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
							{/* Public channel hero — only when a public chat handler is provided */}
							{onOpenPublicChat && (
								<div className="px-5 pt-7 pb-5">
									<button
										onClick={onOpenPublicChat}
										className="group relative w-full rounded-3xl overflow-hidden transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
										style={{
											background:
												"linear-gradient(135deg, rgba(34,211,238,0.14) 0%, rgba(99,102,241,0.16) 60%, rgba(139,92,246,0.14) 100%)",
											border: "1px solid rgba(99,102,241,0.32)",
											boxShadow:
												"0 0 32px rgba(34,211,238,0.18), 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
										}}
										aria-label="Open public channel"
									>
										{/* subtle inner glow */}
										<div
											aria-hidden="true"
											className="absolute -top-16 left-1/2 -translate-x-1/2 w-[120%] h-32 rounded-full pointer-events-none"
											style={{
												background:
													"radial-gradient(ellipse at center, rgba(34,211,238,0.25) 0%, transparent 70%)",
												filter: "blur(8px)",
											}}
										/>

										<div className="relative flex items-center gap-4 px-5 py-5">
											<div
												className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
												style={{
													background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
													boxShadow:
														"0 0 24px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
												}}
											>
												<Hash size={28} className="text-white" strokeWidth={2.5} />
											</div>

											<div className="flex-1 min-w-0 text-left">
												<p className="text-white/40 text-[9px] font-bold uppercase tracking-[0.2em] mb-1">
													Live channel
												</p>
												<p className="text-white font-black text-xl leading-none mb-1.5">
													Public Channel
												</p>
												<div className="flex items-center gap-2">
													<p className="text-white/55 text-xs">
														Everyone in this event
													</p>
													{onlineCount > 0 && (
														<div
															className="flex items-center gap-1 px-2 py-0.5 rounded-full flex-shrink-0"
															style={{
																background: "rgba(34,197,94,0.12)",
																border: "1px solid rgba(34,197,94,0.25)",
															}}
														>
															<Users size={9} className="text-green-400" />
															<span className="text-green-400 text-[10px] font-bold tabular-nums">
																{onlineCount >= 1000
																	? `${(onlineCount / 1000).toFixed(1)}k`
																	: onlineCount}
															</span>
														</div>
													)}
												</div>
											</div>

											<div
												className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:translate-x-0.5"
												style={{
													background: "rgba(255,255,255,0.08)",
													border: "1px solid rgba(255,255,255,0.14)",
												}}
											>
												<ChevronRight size={18} className="text-white/85" />
											</div>
										</div>
									</button>
								</div>
							)}

							{/* DM section header */}
							<div className="px-5 pt-2 pb-2">
								<p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.18em]">
									Direct Messages
								</p>
							</div>

							{/* DM threads */}
							{loading ? (
								<div className="flex items-center justify-center py-10">
									<div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
								</div>
							) : threads.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-14 px-8 gap-3 text-center">
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
										Open the People tab inside an event to find attendees and start a conversation
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
										{(() => {
											const grad = thread.peerColor
												? gradientForUser(thread.peerColor, thread.peerId)
												: undefined;
											if (thread.peerAvatar) {
												return (
													<div
														className="rounded-full p-[2px] flex-shrink-0"
														style={{
															background: grad
																? `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`
																: "transparent",
														}}
													>
														<img
															src={thread.peerAvatar}
															alt={thread.peerName}
															className="w-10 h-10 rounded-full object-cover"
														/>
													</div>
												);
											}
											return (
												<Avatar
													name={thread.peerName}
													size={40}
													gradient={grad}
												/>
											);
										})()}
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
