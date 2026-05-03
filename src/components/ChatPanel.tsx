import React, { useState, useEffect, useRef } from "react";
import { HelpCircle, X, Users, Send, ArrowUp } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

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

// Mini avatar circle with initial + deterministic gradient
const AVATAR_COLORS = [
	["#6366f1", "#22d3ee"],
	["#a855f7", "#ec4899"],
	["#06b6d4", "#3b82f6"],
	["#8b5cf6", "#6366f1"],
	["#14b8a6", "#22d3ee"],
	["#e879f9", "#a855f7"],
];
function avatarColors(name: string) {
	let h = 0;
	for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
	return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Avatar({ name, size = 20 }: { name: string; size?: number }) {
	const [from, to] = avatarColors(name);
	return (
		<div
			className="rounded-full flex items-center justify-center font-black text-white flex-shrink-0"
			style={{
				width: size,
				height: size,
				background: `linear-gradient(135deg, ${from}, ${to})`,
				fontSize: size * 0.45,
			}}
		>
			{name.charAt(0).toUpperCase()}
		</div>
	);
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
	isOpen,
	onClose,
	eventId,
	userId,
	displayName,
}) => {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [questionsOpen, setQuestionsOpen] = useState(false);
	const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
	const [inputText, setInputText] = useState("");
	const [loading, setLoading] = useState(true);
	const [onlineCount, setOnlineCount] = useState(0);
	const [showAutocomplete, setShowAutocomplete] = useState(false);
	const guestIdRef = useRef<string>(crypto.randomUUID());
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const effectiveUserId = userId ?? guestIdRef.current;

	useEffect(() => {
		if (!eventId) return;

		const load = async () => {
			setLoading(true);
			const { data } = await supabase
				.from("chat_messages")
				.select("id, event_id, user_id, display_name, text, type, upvotes, created_at")
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

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setInputText(val);
		// Show autocomplete if user typed @ but hasn't completed "@Question "
		setShowAutocomplete(
			val.startsWith("@") &&
				!"@question ".startsWith(val.toLowerCase()) === false &&
				!val.toLowerCase().startsWith("@question "),
		);
	};

	const applyAutocomplete = () => {
		setInputText("@Question ");
		setShowAutocomplete(false);
		inputRef.current?.focus();
	};

	const handleSend = async () => {
		const text = inputText.trim();
		if (!text) return;
		setInputText("");
		setShowAutocomplete(false);
		const isQuestion = /^@question\s/i.test(text);
		await supabase.from("chat_messages").insert({
			event_id: eventId,
			user_id: effectiveUserId,
			display_name: displayName,
			text,
			type: isQuestion ? "question" : "message",
			upvotes: 0,
		});
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
		if (e.key === "Tab" && showAutocomplete) {
			e.preventDefault();
			applyAutocomplete();
			return;
		}
		if (e.key === "Enter" && showAutocomplete) {
			e.preventDefault();
			applyAutocomplete();
			return;
		}
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
		if (e.key === "Escape") setShowAutocomplete(false);
	};

	const formatTime = (ts: string) =>
		new Date(ts).toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		});

	const chatMessages = messages;
	const questions = messages
		.filter((m) => m.type === "question")
		.sort((a, b) => b.upvotes - a.upvotes);
	const isQuestionMode = inputText.toLowerCase().startsWith("@question");

	return (
		<div
			className="fixed inset-0 z-[60] flex flex-col"
			style={{
				background: "#080a14",
				transform: isOpen ? "translateX(0)" : "translateX(100%)",
				transition: "transform 300ms cubic-bezier(0.22,1,0.36,1)",
				pointerEvents: isOpen ? "auto" : "none",
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
						background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)",
						filter: "blur(40px)",
					}}
				/>
			</div>

			{/* ── Header ── */}
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
						Live Chat
					</h2>
				</div>

				<div className="flex items-center gap-2">
					<div
						className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
						style={{
							background: "rgba(34,197,94,0.1)",
							border: "1px solid rgba(34,197,94,0.25)",
						}}
					>
						<span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
						<span className="text-green-400 text-[10px] font-bold tracking-widest">
							LIVE
						</span>
					</div>

					{onlineCount > 0 && (
						<div
							className="flex items-center gap-1 px-2.5 py-1 rounded-full"
							style={{
								background: "rgba(255,255,255,0.05)",
								border: "1px solid rgba(255,255,255,0.08)",
							}}
						>
							<Users size={11} className="text-white/40" />
							<span className="text-white/50 text-[10px] font-bold tabular-nums">
								{onlineCount >= 1000
									? `${(onlineCount / 1000).toFixed(1)}k`
									: onlineCount}
							</span>
						</div>
					)}

					<button
						onClick={() => setQuestionsOpen((o) => !o)}
						className="relative w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
						style={{
							background: questionsOpen
								? "rgba(99,102,241,0.2)"
								: "rgba(255,255,255,0.05)",
							border: questionsOpen
								? "1px solid rgba(99,102,241,0.4)"
								: "1px solid rgba(255,255,255,0.08)",
						}}
					>
						<HelpCircle
							size={15}
							className={questionsOpen ? "text-indigo-300" : "text-white/40"}
						/>
						{questions.length > 0 && (
							<span
								className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-white font-black tabular-nums"
								style={{
									background: "#ef4444",
									fontSize: 9,
									padding: "0 3px",
									boxShadow: "0 0 8px rgba(239,68,68,0.7)",
								}}
							>
								{questions.length}
							</span>
						)}
					</button>
				</div>
			</div>

			{/* ── Chat + questions overlay ── */}
			<div className="relative flex-1 min-h-0">
				{/* Messages */}
				<div className="absolute inset-0 overflow-y-auto px-4 py-3">
					{loading ? (
						<div className="flex items-center justify-center h-full">
							<div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
						</div>
					) : chatMessages.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
							<div
								className="w-12 h-12 rounded-2xl flex items-center justify-center"
								style={{
									background: "rgba(99,102,241,0.08)",
									border: "1px solid rgba(99,102,241,0.15)",
								}}
							>
								<HelpCircle size={20} className="text-indigo-400/40" />
							</div>
							<p className="text-white/25 text-sm">No messages yet</p>
						</div>
					) : (
						<div className="space-y-2.5">
							{chatMessages.map((msg) => {
								const nameCol = usernameColor(msg.display_name);
								const isQ = msg.type === "question";
								return (
									<div
										key={msg.id}
										className="flex items-start gap-2 leading-snug"
									>
										<Avatar name={msg.display_name} size={22} />
										<p className="flex-1 text-[15px] min-w-0 break-words mt-px">
											{isQ && (
												<span
													className="inline-flex items-center gap-1 mr-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black"
													style={{
														background: "rgba(99,102,241,0.2)",
														color: "#a5b4fc",
														border: "1px solid rgba(99,102,241,0.3)",
														verticalAlign: "middle",
													}}
												>
													<HelpCircle size={9} />Q
												</span>
											)}
											<span
												className="font-bold mr-1"
												style={{ color: nameCol }}
											>
												{msg.display_name}:
											</span>
											<span className="text-white/80">
												{isQ
													? msg.text.replace(/^@[Qq]uestion\s*/i, "")
													: msg.text}
											</span>
										</p>
									</div>
								);
							})}
							<div ref={messagesEndRef} />
						</div>
					)}
				</div>

				{/* Dim backdrop */}
				<div
					className="absolute inset-0 z-10"
					style={{
						background: "rgba(4,5,14,0.82)",
						backdropFilter: "blur(4px)",
						opacity: questionsOpen ? 1 : 0,
						transition: "opacity 260ms ease",
						pointerEvents: questionsOpen ? "auto" : "none",
					}}
					onClick={() => setQuestionsOpen(false)}
				/>

				{/* Questions drawer */}
				{questionsOpen && (
					<div className="absolute left-0 right-0 top-0 z-20">
						<div
							className="overflow-y-auto"
							style={{
								maxHeight: "72vh",
								background: "rgba(10,9,26,0.98)",
								backdropFilter: "blur(28px)",
								borderBottom: "1px solid rgba(99,102,241,0.18)",
								boxShadow:
									"0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.08)",
							}}
						>
							{/* Drawer header */}
							<div
								className="sticky top-0 flex items-center justify-between px-5 py-3.5 z-10"
								style={{
									background: "rgba(10,9,26,0.99)",
									backdropFilter: "blur(20px)",
									borderBottom: "1px solid rgba(99,102,241,0.1)",
								}}
							>
								<div className="flex items-center gap-2.5">
									<div
										className="w-6 h-6 rounded-lg flex items-center justify-center"
										style={{
											background: "linear-gradient(135deg, #6366f1, #22d3ee)",
											boxShadow: "0 0 12px rgba(99,102,241,0.5)",
										}}
									>
										<HelpCircle size={13} className="text-white" />
									</div>
									<span className="text-white font-black text-sm">
										Questions
									</span>
									<span
										className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
										style={{
											background: "rgba(99,102,241,0.2)",
											color: "#818cf8",
											border: "1px solid rgba(99,102,241,0.3)",
										}}
									>
										{questions.length}
									</span>
								</div>
								<button
									onClick={() => setQuestionsOpen(false)}
									className="w-7 h-7 rounded-full flex items-center justify-center text-white/30 hover:text-white/70 transition-colors"
									style={{ background: "rgba(255,255,255,0.05)" }}
								>
									<X size={14} />
								</button>
							</div>

							{/* Question items */}
							{questions.length === 0 ? (
								<div className="px-5 py-10 text-center text-white/20 text-sm">
									No questions yet
								</div>
							) : (
								questions.map((q, i) => {
									const questionText = q.text.replace(/^@[Qq]uestion\s*/i, "");
									const hasUpvoted = upvotedIds.has(q.id);
									const nameCol = usernameColor(q.display_name);
									return (
										<div
											key={q.id}
											className="flex items-start gap-3 px-5 py-3.5"
											style={{
												borderTop:
													i > 0
														? "1px solid rgba(255,255,255,0.04)"
														: undefined,
												background:
													i === 0 ? "rgba(99,102,241,0.04)" : undefined,
											}}
										>
											<div
												className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
												style={
													i === 0
														? {
																background: "rgba(99,102,241,0.3)",
																color: "#818cf8",
																border: "1px solid rgba(99,102,241,0.5)",
															}
														: {
																background: "rgba(255,255,255,0.05)",
																color: "rgba(255,255,255,0.2)",
															}
												}
											>
												{i + 1}
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-white/85 text-sm leading-snug">
													{questionText}
												</p>
												<div className="flex items-center gap-1.5 mt-1">
													<Avatar name={q.display_name} size={14} />
													<p
														className="text-[10px] font-semibold"
														style={{ color: nameCol }}
													>
														{q.display_name}
														<span className="text-white/20 font-normal">
															{" "}
															· {formatTime(q.created_at)}
														</span>
													</p>
												</div>
											</div>
											<button
												onClick={() => handleUpvote(q.id)}
												disabled={hasUpvoted}
												className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl flex-shrink-0 transition-all active:scale-95"
												style={
													hasUpvoted
														? {
																background: "rgba(34,211,238,0.12)",
																border: "1px solid rgba(34,211,238,0.3)",
																color: "#22d3ee",
															}
														: {
																background: "rgba(255,255,255,0.04)",
																border: "1px solid rgba(255,255,255,0.08)",
																color: "rgba(255,255,255,0.25)",
															}
												}
											>
												<ArrowUp size={12} />
												<span className="text-[9px] font-black tabular-nums">
													{q.upvotes}
												</span>
											</button>
										</div>
									);
								})
							)}

							<div
								className="px-5 py-3 text-center"
								style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
							>
								<p className="text-white/15 text-[10px]">
									Type{" "}
									<span className="font-mono text-indigo-400/50">
										@Question your question
									</span>{" "}
									in chat
								</p>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* ── Input ── */}
			<div
				className="relative z-20 flex-shrink-0 px-4 pt-3"
				style={{
					borderTop: "1px solid rgba(99,102,241,0.15)",
					background:
						"linear-gradient(180deg, rgba(13,11,32,0.98) 0%, rgba(8,10,20,0.99) 100%)",
					backdropFilter: "blur(24px)",
					boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
					paddingBottom: "max(env(safe-area-inset-bottom, 0px) + 16px, 28px)",
				}}
			>
				{/* @Question autocomplete popup */}
				{showAutocomplete && (
					<button
						onMouseDown={(e) => {
							e.preventDefault();
							applyAutocomplete();
						}}
						className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl mb-2 text-left transition-all"
						style={{
							background: "rgba(99,102,241,0.15)",
							border: "1px solid rgba(99,102,241,0.35)",
							boxShadow: "0 4px 16px rgba(99,102,241,0.15)",
						}}
					>
						<div
							className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
							style={{
								background: "linear-gradient(135deg, #6366f1, #22d3ee)",
							}}
						>
							<HelpCircle size={13} className="text-white" />
						</div>
						<div className="flex-1 min-w-0">
							<span className="text-indigo-300 font-bold text-sm">
								@Question
							</span>
							<span className="text-white/40 text-sm">
								{" "}
								— submit a question
							</span>
						</div>
						<span className="text-white/25 text-[10px] font-mono border border-white/15 rounded px-1.5 py-0.5">
							Tab
						</span>
					</button>
				)}

				{/* Quick chip row */}
				<div className="flex items-center gap-2 mb-2.5">
					<button
						onClick={() => {
							setInputText("@Question ");
							setShowAutocomplete(false);
							inputRef.current?.focus();
						}}
						className="flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all active:scale-95"
						style={{
							background: "rgba(99,102,241,0.1)",
							border: "1px solid rgba(99,102,241,0.18)",
						}}
					>
						<HelpCircle size={10} className="text-indigo-400/70" />
						<span className="text-indigo-300/70 text-[10px] font-semibold">
							Ask a question
						</span>
					</button>
					<span className="text-white/15 text-[10px]">Be respectful</span>
				</div>

				{/* Input row */}
				<div
					className="flex items-center gap-2 rounded-2xl px-3 py-2"
					style={{
						background: "rgba(255,255,255,0.05)",
						border: isQuestionMode
							? "1px solid rgba(99,102,241,0.4)"
							: "1px solid rgba(255,255,255,0.08)",
						boxShadow: isQuestionMode
							? "0 0 20px rgba(99,102,241,0.12)"
							: undefined,
						transition: "border-color 180ms ease, box-shadow 180ms ease",
					}}
				>
					{isQuestionMode && (
						<div
							className="flex items-center gap-1 px-2 py-0.5 rounded-lg flex-shrink-0"
							style={{
								background: "rgba(99,102,241,0.2)",
								border: "1px solid rgba(99,102,241,0.3)",
							}}
						>
							<HelpCircle size={10} className="text-indigo-300" />
							<span className="text-indigo-300 text-[10px] font-black">Q</span>
						</div>
					)}

					<input
						ref={inputRef}
						type="text"
						value={inputText}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
						placeholder="Message..."
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
	);
};
