import React, { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

interface QRShareModalProps {
	eventId: string;
	eventName: string;
	isOpen: boolean;
	onClose: () => void;
}

export const QRShareModal: React.FC<QRShareModalProps> = ({
	eventId,
	eventName,
	isOpen,
	onClose,
}) => {
	const [copied, setCopied] = useState(false);

	if (!isOpen) return null;

	const eventUrl = `${window.location.origin}/events/${eventId}`;

	const handleCopyLink = () => {
		navigator.clipboard.writeText(eventUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleDownloadQR = () => {
		const canvas = document.getElementById(
			"qr-code-canvas"
		) as HTMLCanvasElement;
		if (canvas) {
			const url = canvas.toDataURL("image/png");
			const link = document.createElement("a");
			link.download = `${eventName}-QR.png`;
			link.href = url;
			link.click();
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
			<div className="relative w-full max-w-md bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 rounded-2xl shadow-2xl border border-primary-500/30 overflow-hidden">
				{/* Animated background effect */}
				<div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-accent-cyan/10 opacity-50" />

				{/* Content */}
				<div className="relative p-6">
					{/* Close button */}
					<button
						onClick={onClose}
						className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors"
					>
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>

					{/* Title */}
					<h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-accent-cyan to-primary-400 bg-clip-text text-transparent">
						Share Event
					</h2>
					<p className="text-dark-300 mb-6">{eventName}</p>

					{/* QR Code */}
					<div className="flex justify-center mb-6">
						<div className="p-4 bg-white rounded-xl shadow-lg">
							<QRCodeCanvas
								id="qr-code-canvas"
								value={eventUrl}
								size={200}
								level="H"
								includeMargin={true}
							/>
						</div>
					</div>

					{/* Instructions */}
					<p className="text-sm text-dark-400 text-center mb-6">
						Scan this QR code to join the event instantly
					</p>

					{/* URL Display */}
					<div className="mb-6">
						<label className="block text-sm font-medium text-dark-300 mb-2">
							Event Link
						</label>
						<div className="flex gap-2">
							<input
								type="text"
								value={eventUrl}
								readOnly
								className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
							/>
							<button
								onClick={handleCopyLink}
								className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
							>
								{copied ? (
									<>
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M5 13l4 4L19 7"
											/>
										</svg>
										Copied
									</>
								) : (
									<>
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
											/>
										</svg>
										Copy
									</>
								)}
							</button>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-3">
						<button
							onClick={handleDownloadQR}
							className="flex-1 px-4 py-3 bg-gradient-to-r from-accent-cyan to-primary-500 hover:from-accent-cyan/90 hover:to-primary-600 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-accent-cyan/50"
						>
							Download QR Code
						</button>
						<button
							onClick={onClose}
							className="px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
