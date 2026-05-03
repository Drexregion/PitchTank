import React, { useState, useEffect } from "react";
import { ScheduleItem } from "../types/Event";

interface SchedulePanelProps {
	isOpen: boolean;
	onClose: () => void;
	eventName: string;
	schedule: ScheduleItem[];
	eventStart: string;
	eventEnd: string;
}

export const SchedulePanel: React.FC<SchedulePanelProps> = ({
	isOpen,
	onClose,
	eventName,
	schedule,
	eventStart,
	eventEnd,
}) => {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (isOpen) requestAnimationFrame(() => setVisible(true));
		else setVisible(false);
	}, [isOpen]);

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
				<div className="px-6 pt-2 pb-4 flex items-center justify-between flex-shrink-0">
					<div>
						<p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-0.5">
							Event
						</p>
						<h2 className="text-xl font-black text-white">Schedule</h2>
						<p className="text-white/40 text-sm mt-0.5 truncate max-w-[260px]">{eventName}</p>
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

				{/* Event time range */}
				<div className="px-6 pb-4 flex-shrink-0">
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

				{/* Schedule items */}
				<div className="flex-1 overflow-y-auto px-6 pb-8">
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
							{/* Vertical timeline line */}
							<div
								className="absolute left-[19px] top-2 bottom-2 w-px"
								style={{ background: "rgba(124,58,237,0.25)" }}
							/>
							<div className="space-y-3">
								{schedule.map((item, i) => (
									<div key={i} className="flex gap-4">
										{/* Dot */}
										<div className="flex flex-col items-center flex-shrink-0 pt-3.5">
											<div
												className="w-[10px] h-[10px] rounded-full z-10"
												style={{ background: "linear-gradient(135deg, #a78bfa, #6366f1)", boxShadow: "0 0 8px rgba(139,92,246,0.5)" }}
											/>
										</div>
										{/* Card */}
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
			</div>
		</div>
	);
};
