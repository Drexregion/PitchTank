import React, { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import jsQR from "jsqr";

interface ScannerModalProps {
	isOpen: boolean;
	onClose: () => void;
	profileUrl: string;
	profileName?: string;
	profileAvatarUrl?: string;
}

type Tab = "mycode" | "scan";

export const ScannerModal: React.FC<ScannerModalProps> = ({
	isOpen,
	onClose,
	profileUrl,
	profileName,
	profileAvatarUrl,
}) => {
	const [visible, setVisible] = useState(false);
	const [tab, setTab] = useState<Tab>("mycode");
	const [cameraError, setCameraError] = useState<string | null>(null);
	const [scannedUrl, setScannedUrl] = useState<string | null>(null);
	const [isScanning, setIsScanning] = useState(false);

	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		if (isOpen) requestAnimationFrame(() => setVisible(true));
		else setVisible(false);
	}, [isOpen]);

	useEffect(() => {
		if (isOpen && tab === "scan") {
			startCamera();
		} else {
			stopCamera();
		}
		return () => stopCamera();
	}, [isOpen, tab]);

	const startCamera = async () => {
		setCameraError(null);
		setScannedUrl(null);
		setIsScanning(true);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "environment" },
			});
			streamRef.current = stream;
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				videoRef.current.play();
				videoRef.current.onloadedmetadata = () => scheduleScan();
			}
		} catch (err: any) {
			if (err.name === "NotAllowedError") {
				setCameraError("Camera access was denied. Please allow camera access in your browser settings.");
			} else if (err.name === "NotFoundError") {
				setCameraError("No camera found on this device.");
			} else {
				setCameraError("Could not start camera: " + (err.message ?? "unknown error"));
			}
			setIsScanning(false);
		}
	};

	const stopCamera = () => {
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((t) => t.stop());
			streamRef.current = null;
		}
		setIsScanning(false);
	};

	const scheduleScan = () => {
		rafRef.current = requestAnimationFrame(scanFrame);
	};

	const scanFrame = () => {
		const video = videoRef.current;
		const canvas = canvasRef.current;
		if (!video || !canvas || video.readyState < 2) {
			scheduleScan();
			return;
		}
		const ctx = canvas.getContext("2d");
		if (!ctx) { scheduleScan(); return; }

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		ctx.drawImage(video, 0, 0);

		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const result = jsQR(imageData.data, imageData.width, imageData.height);
		if (result?.data) {
			setScannedUrl(result.data);
			stopCamera();
			return;
		}
		scheduleScan();
	};

	const handleNavigate = () => {
		if (scannedUrl) window.location.href = scannedUrl;
	};

	const handleRescan = () => {
		setScannedUrl(null);
		startCamera();
	};

	if (!isOpen) return null;

	const initials = profileName
		? profileName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
		: "?";

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s" }}
			/>
			<div
				className="relative w-full max-w-lg rounded-t-3xl overflow-hidden"
				style={{
					background: "linear-gradient(180deg, #13102e 0%, #0d0b22 100%)",
					border: "1px solid rgba(255,255,255,0.08)",
					borderBottom: "none",
					transform: visible ? "translateY(0)" : "translateY(100%)",
					transition: "transform 0.32s cubic-bezier(0.22,1,0.36,1)",
					maxHeight: "90vh",
					display: "flex",
					flexDirection: "column",
				}}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Drag handle */}
				<div className="flex justify-center pt-3 pb-1 flex-shrink-0">
					<div className="w-10 h-1 rounded-full bg-white/15" />
				</div>

				{/* Header */}
				<div className="px-6 pt-3 pb-4 flex items-center justify-between flex-shrink-0">
					<div>
						<p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-0.5">
							Connect
						</p>
						<h2 className="text-xl font-black text-white">QR Scanner</h2>
					</div>
					<button
						onClick={onClose}
						className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
						style={{
							background: "rgba(255,255,255,0.06)",
							border: "1px solid rgba(255,255,255,0.1)",
						}}
					>
						<svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* Tabs */}
				<div className="px-6 pb-4 flex-shrink-0">
					<div
						className="flex rounded-2xl p-1 gap-1"
						style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}
					>
						{(["mycode", "scan"] as Tab[]).map((t) => (
							<button
								key={t}
								onClick={() => setTab(t)}
								className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
									tab === t ? "text-white" : "text-white/40 hover:text-white/60"
								}`}
								style={
									tab === t
										? {
												background: "linear-gradient(135deg, rgba(34,211,238,0.2) 0%, rgba(99,102,241,0.25) 100%)",
												border: "1px solid rgba(99,102,241,0.35)",
												boxShadow: "0 0 12px rgba(99,102,241,0.2)",
											}
										: {}
								}
							>
								{t === "mycode" ? (
									<>
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
										</svg>
										My Code
									</>
								) : (
									<>
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
										</svg>
										Scan
									</>
								)}
							</button>
						))}
					</div>
				</div>

				{/* Tab content */}
				<div className="flex-1 overflow-y-auto">
					{tab === "mycode" && (
						<div className="px-6 pb-8 flex flex-col items-center gap-5">
							{/* Profile strip */}
							{(profileName || profileAvatarUrl) && (
								<div
									className="w-full flex items-center gap-3 rounded-2xl px-4 py-3"
									style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
								>
									<div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
										{profileAvatarUrl ? (
											<img src={profileAvatarUrl} alt={profileName} className="w-full h-full object-cover" />
										) : (
											<div className="w-full h-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white font-black text-base">
												{initials}
											</div>
										)}
									</div>
									<p className="text-white font-bold text-sm leading-tight">{profileName}</p>
								</div>
							)}

							{/* QR code */}
							<div
								className="rounded-2xl p-4"
								style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
							>
								<div className="rounded-xl overflow-hidden bg-white p-3">
									<QRCodeCanvas
										id="scanner-modal-qr"
										value={profileUrl}
										size={200}
										level="H"
										includeMargin={false}
									/>
								</div>
								<p className="text-white/30 text-[10px] text-center mt-2 font-medium">
									Scan to view profile
								</p>
							</div>

						</div>
					)}

					{tab === "scan" && (
						<div className="px-6 pb-8">
							{cameraError ? (
								<div
									className="rounded-2xl p-5 text-center"
									style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
								>
									<svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
									</svg>
									<p className="text-red-300 text-sm font-semibold mb-1">Camera Error</p>
									<p className="text-red-300/60 text-xs leading-relaxed">{cameraError}</p>
								</div>
							) : scannedUrl ? (
								<div className="space-y-4">
									<div
										className="rounded-2xl p-5"
										style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
									>
										<div className="flex items-center gap-3 mb-3">
											<div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
												<svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
												</svg>
											</div>
											<div>
												<p className="text-green-300 font-bold text-sm">QR Code Detected!</p>
												<p className="text-green-300/50 text-xs mt-0.5">Ready to navigate</p>
											</div>
										</div>
										<p className="text-white/60 text-xs break-all leading-relaxed bg-white/5 rounded-xl px-3 py-2">
											{scannedUrl}
										</p>
									</div>
									<div className="flex gap-3">
										<button
											onClick={handleNavigate}
											className="flex-1 py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
											style={{
												background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
												boxShadow: "0 0 20px rgba(34,211,238,0.2)",
											}}
										>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
											</svg>
											Open Link
										</button>
										<button
											onClick={handleRescan}
											className="px-5 py-4 rounded-2xl font-bold text-white/60 text-sm hover:text-white/80 transition-all active:scale-[0.98]"
											style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
										>
											Scan Again
										</button>
									</div>
								</div>
							) : (
								<div>
									<div
										className="relative rounded-2xl overflow-hidden mb-4"
										style={{
											background: "#000",
											border: "1px solid rgba(255,255,255,0.08)",
											aspectRatio: "1 / 1",
										}}
									>
										<video
											ref={videoRef}
											className="w-full h-full object-cover"
											playsInline
											muted
										/>
										<div className="absolute inset-0 pointer-events-none">
											<div className="absolute top-5 left-5 w-8 h-8 border-t-2 border-l-2 border-cyan-400 rounded-tl-md" />
											<div className="absolute top-5 right-5 w-8 h-8 border-t-2 border-r-2 border-cyan-400 rounded-tr-md" />
											<div className="absolute bottom-5 left-5 w-8 h-8 border-b-2 border-l-2 border-cyan-400 rounded-bl-md" />
											<div className="absolute bottom-5 right-5 w-8 h-8 border-b-2 border-r-2 border-cyan-400 rounded-br-md" />
											{isScanning && (
												<div
													className="absolute left-5 right-5 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-70"
													style={{ animation: "scan-line 2s ease-in-out infinite", top: "50%" }}
												/>
											)}
										</div>
										{!isScanning && !cameraError && (
											<div className="absolute inset-0 flex items-center justify-center bg-black/40">
												<div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
											</div>
										)}
									</div>
									<canvas ref={canvasRef} className="hidden" />
									<p className="text-white/30 text-xs text-center">
										Point your camera at a QR code
									</p>
								</div>
							)}
						</div>
					)}
				</div>
			</div>

			<style>{`
				@keyframes scan-line {
					0%, 100% { top: 20%; }
					50% { top: 80%; }
				}
			`}</style>
		</div>
	);
};
