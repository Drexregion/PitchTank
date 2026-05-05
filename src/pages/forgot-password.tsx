import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const ForgotPasswordPage: React.FC = () => {
	const navigate = useNavigate();

	// "request" = send reset email; "reset" = user arrived via recovery link
	const [mode, setMode] = useState<"request" | "reset">("request");

	const [email, setEmail] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Detect Supabase PASSWORD_RECOVERY session (user clicked the email link)
	useEffect(() => {
		const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
			if (event === "PASSWORD_RECOVERY") setMode("reset");
		});
		return () => subscription.unsubscribe();
	}, []);

	const handleRequest = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (!email.trim()) { setError("Please enter your email address."); return; }
		setIsSubmitting(true);
		const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
			redirectTo: `${window.location.origin}/forgot-password`,
		});
		setIsSubmitting(false);
		if (err) { setError(err.message); return; }
		setSuccess("Check your inbox — we sent you a password reset link.");
	};

	const handleReset = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
		if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
		setIsSubmitting(true);
		const { error: err } = await supabase.auth.updateUser({ password: newPassword });
		setIsSubmitting(false);
		if (err) { setError(err.message); return; }
		setSuccess("Password updated! Redirecting to sign in…");
		setTimeout(() => navigate("/login"), 2000);
	};

	const inputBase = "w-full px-4 py-3.5 rounded-xl text-white text-sm placeholder-white/20 outline-none transition-all";
	const inputStyle = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" };
	const onFocus = (e: React.FocusEvent<HTMLInputElement>) =>
		(e.currentTarget.style.border = "1px solid rgba(99,102,241,0.6)");
	const onBlur = (e: React.FocusEvent<HTMLInputElement>) =>
		(e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)");

	return (
		<div
			className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-4 py-12"
			style={{ background: "#080a14" }}
		>
			<div
				aria-hidden="true"
				className="fixed inset-0 bg-cover bg-center bg-no-repeat"
				style={{ backgroundImage: "url('/leaderboard/leaderboard-bg.webp')" }}
			/>
			<div
				className="fixed inset-0"
				style={{
					background:
						"linear-gradient(160deg, rgba(8,6,20,0.87) 0%, rgba(10,8,28,0.80) 50%, rgba(6,8,16,0.88) 100%)",
				}}
			/>
			<div className="fixed inset-0 pointer-events-none overflow-hidden">
				<div
					className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[60vh] rounded-full opacity-60"
					style={{
						background:
							"radial-gradient(ellipse at center, #2d1b69 0%, #1a0e4a 35%, transparent 70%)",
					}}
				/>
				<div
					className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-25"
					style={{
						background: "radial-gradient(circle, #4f46e5 0%, transparent 70%)",
						filter: "blur(40px)",
					}}
				/>
				<div
					className="absolute top-1/3 -right-20 w-72 h-72 rounded-full opacity-20"
					style={{
						background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)",
						filter: "blur(50px)",
					}}
				/>
			</div>

			<div className="relative z-10 w-full max-w-sm">
				<div className="text-center mb-8">
					<h1
						className="font-black text-4xl tracking-tight"
						style={{
							background:
								"linear-gradient(180deg, #ffffff 0%, #a78bfa 50%, #6366f1 100%)",
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
							backgroundClip: "text",
							filter: "drop-shadow(0 0 20px rgba(139,92,246,0.5))",
						}}
					>
						PitchTank
					</h1>
					<p className="text-white/50 text-xs mt-2">
						{mode === "request" ? "Reset your password" : "Set a new password"}
					</p>
				</div>

				{error && (
					<div
						className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3"
						style={{
							background: "rgba(239,68,68,0.12)",
							border: "1px solid rgba(239,68,68,0.25)",
						}}
					>
						<svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
						</svg>
						<p className="text-red-400 text-sm">{error}</p>
					</div>
				)}
				{success && (
					<div
						className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3"
						style={{
							background: "rgba(34,197,94,0.1)",
							border: "1px solid rgba(34,197,94,0.25)",
						}}
					>
						<svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
						</svg>
						<p className="text-green-400 text-sm">{success}</p>
					</div>
				)}

				{mode === "request" ? (
					<form onSubmit={handleRequest} className="space-y-4">
						<div>
							<label
								htmlFor="reset-email"
								className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2"
							>
								Email
							</label>
							<input
								id="reset-email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
								required
								className={inputBase}
								style={inputStyle}
								onFocus={onFocus}
								onBlur={onBlur}
							/>
						</div>
						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full py-4 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
							style={{
								background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
								boxShadow: isSubmitting
									? "none"
									: "0 0 20px rgba(34,211,238,0.3), 0 4px 15px rgba(0,0,0,0.3)",
							}}
						>
							{isSubmitting ? "Sending…" : "Send reset link"}
						</button>
					</form>
				) : (
					<form onSubmit={handleReset} className="space-y-4">
						<div>
							<label
								htmlFor="new-password"
								className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2"
							>
								New password
							</label>
							<input
								id="new-password"
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								placeholder="min. 8 characters"
								required
								minLength={8}
								className={inputBase}
								style={inputStyle}
								onFocus={onFocus}
								onBlur={onBlur}
							/>
						</div>
						<div>
							<label
								htmlFor="confirm-new-password"
								className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2"
							>
								Confirm password
							</label>
							<input
								id="confirm-new-password"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								placeholder="••••••••"
								required
								className={inputBase}
								style={inputStyle}
								onFocus={onFocus}
								onBlur={onBlur}
							/>
						</div>
						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full py-4 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
							style={{
								background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
								boxShadow: isSubmitting
									? "none"
									: "0 0 20px rgba(34,211,238,0.3), 0 4px 15px rgba(0,0,0,0.3)",
							}}
						>
							{isSubmitting ? "Updating…" : "Set new password"}
						</button>
					</form>
				)}

				<p className="text-center mt-6">
					<Link
						to="/login"
						className="text-xs text-indigo-400 hover:text-cyan-400 transition-colors"
					>
						Back to sign in
					</Link>
				</p>
			</div>
		</div>
	);
};

export default ForgotPasswordPage;
