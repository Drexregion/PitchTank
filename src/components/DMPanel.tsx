import React, { useState, useEffect, useRef } from "react";
import { X, Send, ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { gradientForUser } from "./design-system";

interface DMMessage {
	id: string;
	sender_id: string;
	sender_name: string;
	recipient_id: string;
	recipient_name: string;
	text: string;
	is_read: boolean;
	created_at: string;
}

interface DMPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onBack: () => void;
	userId: string;
	displayName: string;
	peerId: string;
	peerName: string;
	onOpenProfile?: () => void;
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
	url,
	size = 28,
	gradient,
}: {
	name: string;
	url?: string | null;
	size?: number;
	gradient?: [string, string];
}) {
	const [from, to] = gradient ?? avatarGradient(name);
	if (url) {
		const ringWidth = gradient ? 2 : 0;
		const inner = size - ringWidth * 2;
		return (
			<div
				className="rounded-full flex-shrink-0"
				style={{
					width: size,
					height: size,
					padding: ringWidth,
					background: gradient
						? `linear-gradient(135deg, ${from}, ${to})`
						: "transparent",
				}}
			>
				<img
					src={url}
					alt={name}
					className="rounded-full object-cover"
					style={{ width: inner, height: inner }}
				/>
			</div>
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

function formatTime(ts: string): string {
	return new Date(ts).toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export const DMPanel: React.FC<DMPanelProps> = ({
	isOpen,
	onClose,
	onBack,
	userId,
	displayName,
	peerId,
	peerName,
	onOpenProfile,
}) => {
	const [messages, setMessages] = useState<DMMessage[]>([]);
	const [inputText, setInputText] = useState("");
	const [loading, setLoading] = useState(true);
	const [peerProfilePic, setPeerProfilePic] = useState<string | null>(null);
	const [peerProfileColor, setPeerProfileColor] = useState<string | null>(null);
	const peerGradient = peerProfileColor
		? gradientForUser(peerProfileColor, peerId)
		: undefined;
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!isOpen || !userId || !peerId) return;

		const load = async () => {
			setLoading(true);
			const { data } = await supabase
				.from("direct_messages")
				.select("id, sender_id, sender_name, recipient_id, recipient_name, text, is_read, created_at")
				.or(
					`and(sender_id.eq.${userId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${userId})`,
				)
				.order("created_at", { ascending: true });
			if (data) setMessages(data as DMMessage[]);
			setLoading(false);
		};
		load();

		const channel = supabase
			.channel(`dm_global_${[userId, peerId].sort().join("_")}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "direct_messages",
				},
				(payload) => {
					const msg = payload.new as DMMessage;
					const inConversation =
						(msg.sender_id === userId && msg.recipient_id === peerId) ||
						(msg.sender_id === peerId && msg.recipient_id === userId);
					if (!inConversation) return;
					setMessages((prev) =>
						prev.find((m) => m.id === msg.id) ? prev : [...prev, msg],
					);
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [isOpen, userId, peerId]);

	// Fetch peer's profile picture + color via investors → users join
	useEffect(() => {
		if (!isOpen || !peerId) {
			setPeerProfilePic(null);
			setPeerProfileColor(null);
			return;
		}
		supabase
			.from("investors")
			.select(
				"users!investors_profile_user_id_fkey(profile_picture_url, profile_color)",
			)
			.eq("id", peerId)
			.maybeSingle()
			.then(({ data }) => {
				const u = (data?.users as any) ?? null;
				setPeerProfilePic(u?.profile_picture_url ?? null);
				setPeerProfileColor(u?.profile_color ?? null);
			});
	}, [isOpen, peerId]);

	// Mark incoming messages as read when panel is open
	useEffect(() => {
		if (!isOpen || !userId || !peerId || messages.length === 0) return;
		const unread = messages.filter(
			(m) => m.recipient_id === userId && m.sender_id === peerId && !m.is_read,
		);
		if (unread.length === 0) return;
		const ids = unread.map((m) => m.id);
		supabase
			.from("direct_messages")
			.update({ is_read: true })
			.in("id", ids)
			.then(() => {
				setMessages((prev) =>
					prev.map((m) => (ids.includes(m.id) ? { ...m, is_read: true } : m)),
				);
			});
	}, [isOpen, messages, userId, peerId]);

	useEffect(() => {
		if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isOpen]);

	useEffect(() => {
		if (isOpen) setTimeout(() => inputRef.current?.focus(), 320);
	}, [isOpen]);

	const handleSend = async () => {
		const text = inputText.trim();
		if (!text) return;
		setInputText("");
		const tempId = crypto.randomUUID();
		const optimistic: DMMessage = {
			id: tempId,
			sender_id: userId,
			sender_name: displayName,
			recipient_id: peerId,
			recipient_name: peerName,
			text,
			is_read: false,
			created_at: new Date().toISOString(),
		};
		setMessages((prev) => [...prev, optimistic]);
		const { data, error } = await supabase
			.from("direct_messages")
			.insert({
				sender_id: userId,
				recipient_id: peerId,
				sender_name: displayName,
				recipient_name: peerName,
				text,
				is_read: false,
			})
			.select()
			.single();
		if (error) {
			setMessages((prev) => prev.filter((m) => m.id !== tempId));
			return;
		}
		if (data) {
			setMessages((prev) =>
				prev.map((m) => (m.id === tempId ? (data as DMMessage) : m)),
			);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	// Group consecutive messages from same sender
	const grouped = messages.map((msg, i) => ({
		...msg,
		isFirst: i === 0 || messages[i - 1].sender_id !== msg.sender_id,
		isLast:
			i === messages.length - 1 || messages[i + 1].sender_id !== msg.sender_id,
	}));

	return (
		<div
			className="fixed inset-0 z-[70]"
			style={{ pointerEvents: isOpen ? "auto" : "none" }}
		>
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60"
				style={{
					opacity: isOpen ? 1 : 0,
					transition: "opacity 300ms cubic-bezier(0.22,1,0.36,1)",
				}}
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
							className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[55vh] rounded-full opacity-30"
							style={{ background: "radial-gradient(ellipse at center, #1a0e4a 0%, transparent 70%)" }}
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
								onClick={onBack}
								className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 transition-all active:scale-90 flex-shrink-0"
								style={{
									background: "rgba(255,255,255,0.05)",
									border: "1px solid rgba(255,255,255,0.08)",
								}}
								aria-label="Back"
							>
								<ArrowLeft size={15} />
							</button>

							{onOpenProfile ? (
								<button
									onClick={onOpenProfile}
									className="group flex-1 min-w-0 flex items-center gap-3 -ml-1 pl-2 pr-2 py-1 rounded-xl text-left transition-all hover:bg-white/[0.04] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
									aria-label={`Open ${peerName}'s profile`}
								>
									<Avatar name={peerName} url={peerProfilePic} size={30} gradient={peerGradient} />
									<div className="flex-1 min-w-0">
										<p className="text-white/30 text-[9px] font-semibold uppercase tracking-[0.2em] leading-none mb-1">
											View profile
										</p>
										<h2 className="text-white font-black text-base leading-none truncate">
											{peerName}
										</h2>
									</div>
									<ChevronRight
										size={14}
										className="text-white/25 group-hover:text-white/55 transition-colors flex-shrink-0"
									/>
								</button>
							) : (
								<>
									<Avatar name={peerName} url={peerProfilePic} size={30} gradient={peerGradient} />
									<div className="flex-1 min-w-0">
										<p className="text-white/30 text-[9px] font-semibold uppercase tracking-[0.2em] leading-none mb-1">
											Direct Message
										</p>
										<h2 className="text-white font-black text-base leading-none truncate">
											{peerName}
										</h2>
									</div>
								</>
							)}

							<button
								onClick={onClose}
								className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 transition-all active:scale-90 flex-shrink-0"
								style={{
									background: "rgba(255,255,255,0.05)",
									border: "1px solid rgba(255,255,255,0.08)",
								}}
								aria-label="Close"
							>
								<X size={15} />
							</button>
						</div>

						{/* Messages */}
						<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
							{loading ? (
								<div className="flex items-center justify-center h-full">
									<div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
								</div>
							) : grouped.length === 0 ? (
								<div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
									<Avatar name={peerName} url={peerProfilePic} size={48} gradient={peerGradient} />
									<p className="text-white/50 font-bold text-sm">{peerName}</p>
									<p className="text-white/20 text-xs">
										Send a message to start the conversation
									</p>
								</div>
							) : (
								<div className="space-y-0.5">
									{grouped.map((msg) => {
										const isMine = msg.sender_id === userId;
										return (
											<div
												key={msg.id}
												className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"} ${msg.isFirst ? "mt-3" : "mt-0.5"}`}
											>
												{/* Avatar spacer for alignment in grouped messages */}
												{!isMine ? (
													msg.isFirst ? (
														<Avatar name={msg.sender_name} size={22} gradient={peerGradient} />
													) : (
														<div style={{ width: 22 }} className="flex-shrink-0" />
													)
												) : null}

												<div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[75%]`}>
													{msg.isFirst && !isMine && (
														<p className="text-[10px] font-semibold text-white/30 mb-0.5 ml-1">
															{msg.sender_name}
														</p>
													)}
													<div
														className="px-3 py-2 text-sm leading-snug break-words"
														style={{
															background: isMine
																? "linear-gradient(135deg, #6366f1, #4f46e5)"
																: "rgba(255,255,255,0.07)",
															color: isMine ? "#fff" : "rgba(255,255,255,0.85)",
															borderRadius: isMine
																? msg.isFirst
																	? "18px 18px 4px 18px"
																	: msg.isLast
																	? "18px 4px 18px 18px"
																	: "18px 4px 4px 18px"
																: msg.isFirst
																? "18px 18px 18px 4px"
																: msg.isLast
																? "4px 18px 18px 18px"
																: "4px 18px 18px 4px",
															boxShadow: isMine
																? "0 2px 12px rgba(99,102,241,0.3)"
																: undefined,
														}}
													>
														{msg.text}
													</div>
													{msg.isLast && (
														<p className="text-[10px] text-white/20 mt-0.5 mx-1">
															{formatTime(msg.created_at)}
														</p>
													)}
												</div>
											</div>
										);
									})}
									<div ref={messagesEndRef} />
								</div>
							)}
						</div>

						{/* Input */}
						<div
							className="relative z-20 flex-shrink-0 px-4 pt-3"
							style={{
								borderTop: "1px solid rgba(99,102,241,0.15)",
								background: "linear-gradient(180deg, rgba(13,11,32,0.98) 0%, rgba(8,10,20,0.99) 100%)",
								backdropFilter: "blur(24px)",
								boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
								paddingBottom: "max(env(safe-area-inset-bottom, 0px) + 16px, 28px)",
							}}
						>
							<div
								className="flex items-center gap-2 rounded-2xl px-3 py-2"
								style={{
									background: "rgba(255,255,255,0.05)",
									border: "1px solid rgba(255,255,255,0.08)",
								}}
							>
								<input
									ref={inputRef}
									type="text"
									value={inputText}
									onChange={(e) => setInputText(e.target.value)}
									onKeyDown={handleKeyDown}
									placeholder={`Message ${peerName}...`}
									className="flex-1 bg-transparent text-white placeholder-white/20 text-sm outline-none py-1.5 min-w-0"
								/>
								<button
									onClick={handleSend}
									disabled={!inputText.trim()}
									className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
									style={
										inputText.trim()
											? {
													background: "linear-gradient(135deg, #22d3ee, #6366f1)",
													boxShadow: "0 0 14px rgba(34,211,238,0.35)",
												}
											: {
													background: "rgba(255,255,255,0.04)",
													border: "1px solid rgba(255,255,255,0.07)",
												}
									}
								>
									<Send
										size={13}
										className={inputText.trim() ? "text-white" : "text-white/20"}
									/>
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
