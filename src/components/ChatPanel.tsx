import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
	ArrowLeft,
	ArrowUp,
	AtSign,
	ChevronDown,
	Send,
	ShieldCheck,
	Smile,
	Sparkles,
	Users,
	X as XIcon,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
	Avatar as PtAvatar,
	GlassCard,
	IconButton,
	gradientForUser,
} from "./design-system";

interface UserProfileLite {
	picture: string | null;
	color: string | null;
}

interface ChatMessage {
	id: string;
	event_id: string;
	user_id: string;
	display_name: string;
	text: string;
	type: "message" | "question";
	upvotes: number;
	created_at: string;
}

interface ChatPanelProps {
	isOpen: boolean;
	onClose: () => void;
	eventId: string;
	userId: string | null;
	displayName: string;
}

const USERNAME_COLORS = [
	"#22d3ee",
	"#818cf8",
	"#a78bfa",
	"#67e8f9",
	"#c4b5fd",
	"#38bdf8",
	"#e879f9",
	"#34d399",
	"#60a5fa",
	"#f0abfc",
	"#4ade80",
	"#fb7185",
];

function usernameColor(name: string): string {
	let h = 0;
	for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
	return USERNAME_COLORS[Math.abs(h) % USERNAME_COLORS.length];
}

const AVATAR_GRADIENTS: [string, string][] = [
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
	return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

const EMOJIS = [
	"🔥",
	"❤️",
	"😂",
	"👍",
	"🎉",
	"💯",
	"✨",
	"🚀",
	"😢",
	"😎",
	"🤔",
	"🙌",
	"👀",
	"🥹",
	"🙏",
	"😅",
	"😍",
	"👏",
	"💪",
	"⚡️",
];

const formatCount = (n: number) =>
	n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

export const ChatPanel: React.FC<ChatPanelProps> = ({
	isOpen,
	onClose,
	eventId,
	userId,
	displayName,
}) => {
	const navigate = useNavigate();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [questionsOpen, setQuestionsOpen] = useState(false);
	const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
	const [inputText, setInputText] = useState("");
	const [loading, setLoading] = useState(true);
	const [onlineCount, setOnlineCount] = useState(0);
	const [emojiOpen, setEmojiOpen] = useState(false);
	const [showRules, setShowRules] = useState(false);
	const [profileLookup, setProfileLookup] = useState<
		Record<string, UserProfileLite>
	>({});
	const guestIdRef = useRef<string>(crypto.randomUUID());
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const emojiRootRef = useRef<HTMLDivElement>(null);

	const effectiveUserId = userId ?? guestIdRef.current;

	useEffect(() => {
		if (!eventId) return;

		const load = async () => {
			setLoading(true);
			const { data } = await supabase
				.from("chat_messages")
				.select(
					"id, event_id, user_id, display_name, text, type, upvotes, created_at",
				)
				.eq("event_id", eventId)
				.order("created_at", { ascending: true })
				.limit(100);
			if (data) setMessages(data as ChatMessage[]);
			setLoading(false);
		};
		load();

		if (userId) {
			supabase
				.from("chat_upvotes")
				.select("message_id")
				.eq("user_id", userId)
				.then(({ data }) => {
					if (data) setUpvotedIds(new Set(data.map((r) => r.message_id)));
				});
		}

		const channel = supabase
			.channel(`chat_realtime_${eventId}`, {
				config: { presence: { key: effectiveUserId } },
			})
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "chat_messages",
					filter: `event_id=eq.${eventId}`,
				},
				(payload) => {
					const msg = payload.new as ChatMessage;
					setMessages((prev) =>
						prev.find((m) => m.id === msg.id) ? prev : [...prev, msg],
					);
				},
			)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "chat_messages",
					filter: `event_id=eq.${eventId}`,
				},
				(payload) => {
					const updated = payload.new as ChatMessage;
					setMessages((prev) =>
						prev.map((m) => (m.id === updated.id ? updated : m)),
					);
				},
			)
			.on("presence", { event: "sync" }, () => {
				setOnlineCount(Object.keys(channel.presenceState()).length);
			})
			.subscribe(async (status) => {
				if (status === "SUBSCRIBED")
					await channel.track({
						user_id: effectiveUserId,
						display_name: displayName,
					});
			});

		return () => {
			supabase.removeChannel(channel);
		};
	}, [eventId, userId]);

	useEffect(() => {
		if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isOpen]);

	useEffect(() => {
		if (isOpen) setTimeout(() => inputRef.current?.focus(), 320);
	}, [isOpen]);

	useEffect(() => {
		if (!emojiOpen) return;
		const onDocPointerDown = (e: MouseEvent) => {
			if (emojiRootRef.current?.contains(e.target as Node)) return;
			setEmojiOpen(false);
		};
		document.addEventListener("mousedown", onDocPointerDown);
		return () => document.removeEventListener("mousedown", onDocPointerDown);
	}, [emojiOpen]);

	// Lazily fetch real profile pictures for message authors. UUIDs only —
	// guest messages use random IDs that won't match users.auth_user_id.
	const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	useEffect(() => {
		const ids = Array.from(
			new Set(messages.map((m) => m.user_id).filter((id) => UUID_RE.test(id))),
		);
		const missing = ids.filter((id) => !(id in profileLookup));
		if (missing.length === 0) return;
		supabase
			.from("users")
			.select("auth_user_id, profile_picture_url, profile_color")
			.in("auth_user_id", missing)
			.then(({ data }) => {
				const next: Record<string, UserProfileLite> = {};
				missing.forEach((id) => {
					next[id] = { picture: null, color: null };
				});
				(data ?? []).forEach(
					(row: {
						auth_user_id: string;
						profile_picture_url: string | null;
						profile_color: string | null;
					}) => {
						if (row.auth_user_id)
							next[row.auth_user_id] = {
								picture: row.profile_picture_url ?? null,
								color: row.profile_color ?? null,
							};
					},
				);
				setProfileLookup((prev) => ({ ...prev, ...next }));
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [messages]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setInputText(e.target.value);
	};

	const insertMention = () => {
		const next = inputText.toLowerCase().startsWith("@question ")
			? inputText
			: `@Question ${inputText}`;
		setInputText(next);
		requestAnimationFrame(() => {
			const el = inputRef.current;
			if (!el) return;
			el.focus();
			const pos = next.length;
			el.setSelectionRange(pos, pos);
		});
	};

	const insertEmoji = (emoji: string) => {
		setInputText((prev) => prev + emoji);
		requestAnimationFrame(() => inputRef.current?.focus());
	};

	const handleSend = async () => {
		const text = inputText.trim();
		if (!text) return;
		setInputText("");
		setEmojiOpen(false);
		const isQuestion = /^@question\s/i.test(text);
		const tempId = crypto.randomUUID();
		const optimistic: ChatMessage = {
			id: tempId,
			event_id: eventId,
			user_id: effectiveUserId,
			display_name: displayName,
			text,
			type: isQuestion ? "question" : "message",
			upvotes: 0,
			created_at: new Date().toISOString(),
		};
		setMessages((prev) => [...prev, optimistic]);
		const { data, error } = await supabase
			.from("chat_messages")
			.insert({
				event_id: eventId,
				user_id: effectiveUserId,
				display_name: displayName,
				text,
				type: isQuestion ? "question" : "message",
				upvotes: 0,
			})
			.select()
			.single();
		if (error) {
			setMessages((prev) => prev.filter((m) => m.id !== tempId));
			return;
		}
		if (data) {
			setMessages((prev) =>
				prev.map((m) => (m.id === tempId ? (data as ChatMessage) : m)),
			);
		}
	};

	const handleUpvote = async (msgId: string) => {
		if (upvotedIds.has(msgId)) return;
		setUpvotedIds((prev) => new Set([...prev, msgId]));
		setMessages((prev) =>
			prev.map((m) => (m.id === msgId ? { ...m, upvotes: m.upvotes + 1 } : m)),
		);
		await supabase
			.from("chat_upvotes")
			.insert({ message_id: msgId, user_id: effectiveUserId });
		const { error: rpcErr } = await supabase.rpc("increment_chat_upvotes", {
			msg_id: msgId,
		});
		if (rpcErr) {
			const current = messages.find((m) => m.id === msgId)?.upvotes ?? 0;
			await supabase
				.from("chat_messages")
				.update({ upvotes: current + 1 })
				.eq("id", msgId);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
		if (e.key === "Escape") {
			setEmojiOpen(false);
		}
	};

	const formatTime = (ts: string) =>
		new Date(ts).toLocaleTimeString(undefined, {
			hour: "numeric",
			minute: "2-digit",
		});

	const chatMessages = messages;
	const questions = messages
		.filter((m) => m.type === "question")
		.sort((a, b) => b.upvotes - a.upvotes);
	const isQuestionMode = inputText.toLowerCase().startsWith("@question");
	const hasContent = inputText.trim().length > 0;
	const topQuestionText = questions[0]
		? questions[0].text.replace(/^@[Qq]uestion\s*/i, "")
		: null;

	return (
		<div
			className="fixed inset-0 z-[60]"
			style={{ pointerEvents: isOpen ? "auto" : "none" }}
		>
			{/* Full-screen dark backdrop */}
			<div
				className="absolute inset-0 bg-black/60"
				style={{
					opacity: isOpen ? 1 : 0,
					transition: "opacity 300ms cubic-bezier(0.22,1,0.36,1)",
				}}
			/>

			{/* Centering wrapper — matches the 430px main column */}
			<div className="absolute inset-0 xl:max-w-[430px] xl:left-1/2 xl:-translate-x-1/2 overflow-hidden">
				{/* Panel column — slides in from right */}
				<div
					className="absolute inset-0 flex flex-col overflow-hidden"
					style={{
						background: "var(--c-bg-deep)",
						transform: isOpen ? "translateX(0)" : "translateX(100%)",
						transition: "transform 300ms cubic-bezier(0.22,1,0.36,1)",
					}}
				>
					{/* Ambient glow */}
					<div className="absolute inset-0 pointer-events-none overflow-hidden">
						<div
							className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[55vh] rounded-full opacity-40"
							style={{
								background:
									"radial-gradient(ellipse at center, #2d1b69 0%, #1a0e4a 35%, transparent 70%)",
							}}
						/>
						<div
							className="absolute top-1/3 -right-24 w-64 h-64 rounded-full opacity-15"
							style={{
								background:
									"radial-gradient(circle, #0ea5e9 0%, transparent 70%)",
								filter: "blur(40px)",
							}}
						/>
					</div>

					<div className="relative z-10 flex flex-col flex-1 min-h-0">
						{/* ── Header ── */}
						<div className="relative z-20 flex-shrink-0 px-4 pt-4 pb-3 bg-transparent">
							<div className="flex items-stretch justify-between gap-2">
								<div className="flex items-center gap-2 flex-1 min-w-0">
									<IconButton
										size="sm"
										aria-label="Close chat"
										icon={<ArrowLeft size={14} strokeWidth={1.75} />}
										onClick={onClose}
										className="shrink-0"
									/>
									<img
										src="/icons/icon-192.png"
										alt=""
										aria-hidden
										className="w-8 h-8 rounded-xl object-cover shrink-0"
									/>
									<div className="leading-tight min-w-0 flex-1">
										<div className="flex items-center gap-1.5">
											<span className="font-display font-semibold text-white text-[14px] tracking-tight truncate">
												PitchTank Live
											</span>
											<span
												className="inline-flex items-center px-1.5 h-[16px] rounded-full text-[8.5px] font-display font-semibold tracking-wider uppercase shrink-0"
												style={{
													color: "var(--c-purple)",
													background: "rgba(162,89,255,0.15)",
													boxShadow:
														"inset 0 0 0 1px rgba(162,89,255,0.4)",
												}}
											>
												Live
											</span>
										</div>
										<div className="flex items-center gap-1.5 text-[10.5px] text-pt-text-2 mt-0.5">
											<span className="truncate">Audience chat</span>
											<span
												aria-hidden
												className="inline-flex items-center gap-1 shrink-0"
											>
												<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
											</span>
										</div>
									</div>
									<div
										className="inline-flex items-center gap-1 px-2 h-7 rounded-xl shrink-0"
										style={{
											background: "rgba(255,255,255,0.03)",
											boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)",
										}}
									>
										<Users
											size={11}
											strokeWidth={1.75}
											className="text-pt-text-2"
										/>
										<span className="font-display font-semibold text-white text-[11px] num">
											{formatCount(onlineCount)}
										</span>
									</div>
								</div>
								<button
									type="button"
									aria-label="Open chat room rules"
									onClick={() => setShowRules(true)}
									className="shrink-0 self-center w-10 h-10 hover:brightness-125 transition-all"
								>
									<img
										src="/chat/chat-question.png"
										alt=""
										aria-hidden
										className="w-full h-full object-contain"
									/>
								</button>
							</div>

							{/* Top Questions — single card that expands/collapses */}
							{questions.length > 0 && (
								<div className="mt-3">
									<GlassCard tone="neutral" size="sm">
										<button
											type="button"
											onClick={() => setQuestionsOpen((o) => !o)}
											aria-label={
												questionsOpen
													? "Collapse questions panel"
													: "Expand questions panel"
											}
											aria-expanded={questionsOpen}
											className="block w-full text-left hover:brightness-110 transition-all"
										>
											<div className="flex items-center gap-3">
												<Sparkles
													size={18}
													strokeWidth={1.75}
													className="text-pt-cyan shrink-0"
												/>
												<div className="leading-tight min-w-0 flex-1">
													<div className="text-[10px] text-pt-text-2 font-display tracking-wider uppercase">
														Top Questions
													</div>
													<div className="font-display text-white text-[13px] font-semibold truncate mt-0.5">
														<span className="text-pt-cyan num mr-1">
															[{questions.length}]
														</span>
														{questionsOpen
															? "Sorted by audience upvotes"
															: topQuestionText}
													</div>
												</div>
												<ChevronDown
													size={16}
													strokeWidth={1.75}
													className="text-pt-text-2 shrink-0 transition-transform duration-300 ease-out"
													style={{
														transform: questionsOpen
															? "rotate(180deg)"
															: "rotate(0deg)",
													}}
												/>
											</div>
										</button>

										{/* Animated expandable list */}
										<div
											aria-hidden={!questionsOpen}
											className="overflow-hidden ease-out"
											style={{
												maxHeight: questionsOpen ? 600 : 0,
												opacity: questionsOpen ? 1 : 0,
												transition:
													"max-height 320ms ease-out, opacity 220ms ease-out",
											}}
										>
											<ul className="mt-3 pt-3 max-h-[42vh] overflow-y-auto divide-y divide-white/5 border-t border-white/5">
												{questions.map((q) => {
													const text = q.text.replace(/^@[Qq]uestion\s*/i, "");
													const active = upvotedIds.has(q.id);
													return (
														<li
															key={q.id}
															className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
														>
															<span className="flex-1 min-w-0 text-white text-[12.5px] leading-snug break-words">
																{text}
															</span>
															<button
																type="button"
																onClick={() => handleUpvote(q.id)}
																disabled={active}
																aria-label={
																	active
																		? "Already upvoted"
																		: "Upvote question"
																}
																aria-pressed={active}
																className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl shrink-0 transition-all active:scale-95"
																style={
																	active
																		? {
																				color: "var(--c-cyan)",
																				background: "rgba(0,229,255,0.12)",
																				boxShadow:
																					"inset 0 0 0 1px rgba(0,229,255,0.4), 0 0 10px rgba(0,229,255,0.18)",
																			}
																		: {
																				color: "rgba(255,255,255,0.45)",
																				background: "rgba(255,255,255,0.04)",
																				boxShadow:
																					"inset 0 0 0 1px rgba(255,255,255,0.10)",
																			}
																}
															>
																<ArrowUp size={12} strokeWidth={2} />
																<span className="text-[9px] font-display font-semibold num">
																	{q.upvotes}
																</span>
															</button>
														</li>
													);
												})}
											</ul>
											<p className="mt-3 text-center text-[10.5px] text-pt-text-3">
												Type{" "}
												<span className="font-mono text-pt-purple">
													@Question your question
												</span>{" "}
												in chat
											</p>
										</div>
									</GlassCard>
								</div>
							)}
						</div>

						{/* ── Messages ── */}
						<div className="relative flex-1 min-h-0">
							<div className="absolute inset-0 overflow-y-auto px-4 pt-3 pb-3">
								{loading ? (
									<div className="flex items-center justify-center h-full">
										<div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-pt-purple animate-spin" />
									</div>
								) : chatMessages.length === 0 ? (
									<div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
										<div
											className="w-12 h-12 rounded-2xl flex items-center justify-center"
											style={{
												background: "rgba(162,89,255,0.08)",
												boxShadow: "inset 0 0 0 1px rgba(162,89,255,0.18)",
											}}
										>
											<Sparkles size={20} className="text-pt-purple/60" />
										</div>
										<p className="text-pt-text-3 text-sm">No messages yet</p>
									</div>
								) : (
									<div className="flex flex-col gap-4">
										{chatMessages.map((msg) => {
											const nameCol = usernameColor(msg.display_name);
											const lookup = profileLookup[msg.user_id];
											const grad = lookup?.color
												? gradientForUser(lookup.color, msg.user_id)
												: avatarGradient(msg.display_name);
											const userPic = lookup?.picture ?? undefined;
											const isQ = msg.type === "question";
											const cleanText = isQ
												? msg.text.replace(/^@[Qq]uestion\s*/i, "")
												: msg.text;
											const isOwnMsg = msg.user_id === userId;
											const goToProfile = () =>
												navigate(`/profile/${msg.user_id}`);
											return (
												<div
													key={msg.id}
													className="flex items-start gap-3"
												>
													{isOwnMsg ? (
														<PtAvatar
															size="md"
															name={msg.display_name}
															gradient={grad}
															photo={userPic}
															className="shrink-0"
														/>
													) : (
														<button
															type="button"
															onClick={goToProfile}
															aria-label={`View ${msg.display_name}'s profile`}
															className="shrink-0 rounded-full transition-transform active:scale-95 hover:brightness-110"
														>
															<PtAvatar
																size="md"
																name={msg.display_name}
																gradient={grad}
																photo={userPic}
															/>
														</button>
													)}
													<div className="leading-tight min-w-0 flex-1 pt-0.5">
														<div className="flex items-baseline gap-2 flex-wrap">
															{!isOwnMsg ? (
																<button
																	type="button"
																	onClick={goToProfile}
																	aria-label={`View ${msg.display_name}'s profile`}
																	className="font-display font-semibold text-[13px] hover:underline active:opacity-70 transition-opacity"
																	style={{ color: nameCol }}
																>
																	{msg.display_name}
																</button>
															) : (
																<span
																	className="font-display font-semibold text-[13px]"
																	style={{ color: nameCol }}
																>
																	{msg.display_name}
																</span>
															)}
															<span className="text-[10px] text-pt-text-3 num">
																{formatTime(msg.created_at)}
															</span>
															{isQ && (
																<span
																	className="inline-flex items-center gap-1 px-1.5 h-[16px] rounded-full text-[8.5px] font-display font-semibold tracking-wider uppercase"
																	style={{
																		color: "var(--c-cyan)",
																		background: "rgba(0,229,255,0.12)",
																		boxShadow:
																			"inset 0 0 0 1px rgba(0,229,255,0.35)",
																	}}
																>
																	Q
																</span>
															)}
														</div>
														<p className="mt-0.5 text-[13px] text-white/90 whitespace-pre-line break-words">
															{cleanText}
														</p>
													</div>
												</div>
											);
										})}
										<div ref={messagesEndRef} />
									</div>
								)}
							</div>
						</div>

						{/* ── Composer ── */}
						<div
							className="relative z-20 flex-shrink-0"
							style={{
								background: "rgba(3,4,13,0.85)",
								backdropFilter: "blur(24px)",
								WebkitBackdropFilter: "blur(24px)",
							}}
						>
							<div
								aria-hidden
								className="h-px w-full"
								style={{
									background:
										"linear-gradient(to right, transparent 0%, rgba(0,229,255,0.6) 25%, rgba(162,89,255,0.85) 60%, transparent 100%)",
								}}
							/>
							<div
								className="px-4 pt-3"
								style={{
									paddingBottom:
										"max(env(safe-area-inset-bottom, 0px) + 12px, 16px)",
								}}
							>
								{/* "Ask a question" tag — toggles @Question mode */}
								<div className="mb-2">
									<button
										type="button"
										onClick={insertMention}
										aria-pressed={isQuestionMode}
										aria-label="Ask a question to the founder"
										className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full font-display font-semibold tracking-[0.14em] uppercase text-[10.5px] transition-all active:scale-95"
										style={
											isQuestionMode
												? {
														color: "var(--c-purple)",
														background: "rgba(162,89,255,0.15)",
														boxShadow:
															"inset 0 0 0 1px rgba(162,89,255,0.5), 0 0 12px rgba(162,89,255,0.18)",
													}
												: {
														color: "var(--c-text-2)",
														background: "rgba(255,255,255,0.04)",
														boxShadow:
															"inset 0 0 0 1px rgba(255,255,255,0.12)",
													}
										}
									>
										<AtSign size={11} strokeWidth={2} />
										Ask a question
									</button>
								</div>

								<div className="flex items-center gap-2">
									<label
										className="relative flex-1 flex items-center h-10 rounded-xl transition-all"
										style={{
											background: "rgba(255,255,255,0.03)",
											boxShadow: hasContent
												? `inset 0 0 0 1px ${isQuestionMode ? "rgba(162,89,255,0.7)" : "rgba(79,124,255,0.7)"}, 0 0 14px ${isQuestionMode ? "rgba(162,89,255,0.20)" : "rgba(79,124,255,0.25)"}`
												: "inset 0 0 0 1px rgba(255,255,255,0.12)",
											transition: "box-shadow 180ms ease",
										}}
									>
										{isQuestionMode && (
											<span
												className="ml-2 inline-flex items-center px-1.5 h-[18px] rounded-full text-[9px] font-display font-semibold tracking-wider uppercase shrink-0"
												style={{
													color: "var(--c-purple)",
													background: "rgba(162,89,255,0.15)",
													boxShadow:
														"inset 0 0 0 1px rgba(162,89,255,0.4)",
												}}
											>
												Q
											</span>
										)}
										<input
											ref={inputRef}
											type="text"
											value={inputText}
											onChange={handleInputChange}
											onKeyDown={handleKeyDown}
											placeholder="Message…"
											aria-label="Message"
											className="flex-1 bg-transparent border-0 outline-none px-3 text-[16px] text-white placeholder:text-pt-text-3 min-w-0"
										/>
										<div ref={emojiRootRef} className="relative shrink-0">
											<button
												type="button"
												aria-label="Open emoji picker"
												aria-expanded={emojiOpen}
												aria-haspopup="dialog"
												onClick={() => setEmojiOpen((v) => !v)}
												className="px-2.5 h-full flex items-center justify-center text-pt-text-2 hover:text-white transition-all"
											>
												<Smile size={20} strokeWidth={1.75} />
											</button>
											{emojiOpen && (
												<div
													role="dialog"
													aria-label="Emoji picker"
													className="absolute bottom-full right-0 mb-3 z-50 w-[232px]"
												>
													<GlassCard tone="neutral" size="sm">
														<div className="grid grid-cols-5 gap-1">
															{EMOJIS.map((emo) => (
																<button
																	key={emo}
																	type="button"
																	onClick={() => insertEmoji(emo)}
																	className="h-9 rounded-xl text-[18px] leading-none hover:bg-white/[0.08] transition-all"
																>
																	{emo}
																</button>
															))}
														</div>
													</GlassCard>
												</div>
											)}
										</div>
									</label>

									<IconButton
										type="button"
										size="md"
										aria-label="Send message"
										icon={<Send size={15} strokeWidth={1.75} />}
										onClick={handleSend}
										disabled={!hasContent}
										className="shrink-0"
										style={
											hasContent
												? ({
														color: "var(--c-cyan)",
														boxShadow:
															"inset 0 0 0 1px rgba(0,229,255,0.6), 0 0 14px rgba(0,229,255,0.30)",
													} as React.CSSProperties)
												: undefined
										}
									/>
								</div>

								<div className="flex items-center justify-center gap-2 mt-2 text-[10.5px] text-pt-text-2">
									<ShieldCheck
										size={11}
										strokeWidth={1.75}
										className="text-pt-text-3"
									/>
									<span>Be respectful. Keep it constructive.</span>
								</div>
							</div>
						</div>
					</div>

					{/* Chat Rules modal */}
					<div
						className="absolute inset-0 z-30 flex items-center justify-center px-5"
						aria-hidden={!showRules}
						style={{
							pointerEvents: showRules ? "auto" : "none",
							opacity: showRules ? 1 : 0,
							transition: "opacity 200ms ease-out",
						}}
						onClick={() => setShowRules(false)}
					>
						<div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
						<div
							className="relative w-full max-w-[360px] max-h-[calc(100%-32px)] overflow-y-auto"
							style={{
								transform: showRules ? "scale(1)" : "scale(0.96)",
								transition: "transform 240ms cubic-bezier(0.22,1,0.36,1)",
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<GlassCard tone="neutral" size="lg">
								<button
									type="button"
									onClick={() => setShowRules(false)}
									aria-label="Close rules"
									className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-pt-text-2 hover:text-white"
									style={{
										background: "rgba(255,255,255,0.05)",
										boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
									}}
								>
									<XIcon size={14} />
								</button>
								<div className="flex flex-col items-center text-center pt-2">
									<img
										src="/chat/chat-rule-top.png"
										alt=""
										aria-hidden
										className="w-20 h-20 object-contain"
									/>
									<h2 className="mt-3 font-display font-semibold text-white text-[22px] tracking-tight">
										Chat Room Rules
									</h2>
									<p className="mt-2 text-[13px] text-pt-text-2 leading-snug px-2">
										Ask smart questions. Vote for the ones you want answered.
									</p>
								</div>
								<ul className="mt-5 flex flex-col gap-3.5">
									{[
										{ icon: "/chat/chat-rule-1.png", heading: "Ask with @Question", body: "Use @Question to ask the founder a question." },
										{ icon: "/chat/chat-rule-2.png", heading: "Upvote questions", body: "Tap the upvote on questions you also want answered." },
										{ icon: "/chat/chat-rule-3.png", heading: "Top questions go to the MC", body: "The most-upvoted questions may be read live during the event." },
										{ icon: "/chat/chat-rule-4.png", heading: "Win the audience reward", body: "The most-upvoted question receives the audience prize." },
									].map((r) => (
										<li key={r.heading} className="flex items-start gap-3">
											<img
												src={r.icon}
												alt=""
												aria-hidden
												className="w-14 h-14 object-contain shrink-0"
											/>
											<div className="leading-tight pt-1 min-w-0">
												<div className="font-display font-semibold text-white text-[14px]">
													{r.heading}
												</div>
												<div className="text-[12px] text-pt-text-2 mt-1">
													{r.body}
												</div>
											</div>
										</li>
									))}
								</ul>
								<button
									type="button"
									onClick={() => setShowRules(false)}
									className="pt-btn pt-btn-primary pt-btn-lg w-full mt-5"
								>
									Got it
								</button>
							</GlassCard>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
