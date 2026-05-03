import React, { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

interface QRShareModalProps {
	eventId: string;
	eventName: string;
	isOpen: boolean;
	onClose: () => void;
}

export const QRShareModal: React.FC<QRShareModalProps> = ({ eventId, eventName, isOpen, onClose }) => {
	const [copied, setCopied] = useState(false);
	const [visible, setVisible] = React.useState(false);

	React.useEffect(() => {
		if (isOpen) requestAnimationFrame(() => setVisible(true));
		else setVisible(false);
	}, [isOpen]);

	if (!isOpen) return null;

	const eventUrl = `${window.location.origin}/events/${eventId}`;

	const handleCopy = () => {
		navigator.clipboard.writeText(eventUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleDownload = () => {
		const canvas = document.getElementById("qr-code-canvas") as HTMLCanvasElement;
		if (canvas) {
			const link = document.createElement("a");
			link.download = `${eventName}-QR.png`;
			link.href = canvas.toDataURL("image/png");
			link.click();
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
			<div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s" }} />
			<div
				className="relative w-full max-w-lg rounded-t-3xl overflow-hidden"
				style={{
					background: "linear-gradient(180deg, #13102e 0%, #0d0b22 100%)",
					border: "1px solid rgba(255,255,255,0.08)",
					borderBottom: "none",
					transform: visible ? "translateY(0)" : "translateY(100%)",
					transition: "transform 0.32s cubic-bezier(0.22,1,0.36,1)",
				}}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Drag handle */}
				<div className="flex justify-center pt-3 pb-1">
					<div className="w-10 h-1 rounded-full bg-white/15" />
				</div>

				{/* Header */}
				<div className="px-6 pt-3 pb-4 flex items-center justify-between">
					<div>
						<p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Invite</p>
						<h2 className="text-xl font-black text-white">Share Event</h2>
						<p className="text-white/40 text-sm mt-0.5 truncate max-w-[260px]">{eventName}</p>
					</div>
					<button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
						style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
						<svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* QR code */}
				<div className="flex justify-center px-6 pb-4">
					<div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
						<div className="rounded-xl overflow-hidden bg-white p-3">
							<QRCodeCanvas id="qr-code-canvas" value={eventUrl} size={180} level="H" includeMargin={false} />
						</div>
						<p className="text-white/30 text-[10px] text-center mt-2 font-medium">Scan to join</p>
					</div>
				</div>

				{/* URL row */}
				<div className="px-6 pb-4">
					<div className="flex items-center gap-2 rounded-2xl px-4 py-3"
						style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
						<p className="flex-1 text-white/50 text-xs truncate">{eventUrl}</p>
						<button onClick={handleCopy}
							className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
							style={copied
								? { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#86efac" }
								: { background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)", color: "#67e8f9" }}>
							{copied ? "Copied!" : "Copy"}
						</button>
					</div>
				</div>

				{/* Actions */}
				<div className="px-6 pb-8 flex gap-3">
					<button onClick={handleDownload}
						className="flex-1 py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
						style={{ background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)", boxShadow: "0 0 20px rgba(34,211,238,0.2)" }}>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
						</svg>
						Download QR
					</button>
					<button onClick={onClose}
						className="px-5 py-4 rounded-2xl font-bold text-white/50 text-sm transition-all hover:text-white/80 active:scale-[0.98]"
						style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
						Close
					</button>
				</div>
			</div>
		</div>
	);
};
