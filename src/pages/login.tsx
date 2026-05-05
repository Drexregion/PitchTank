import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";

function friendlyAuthError(message: string): string {
	const m = message.toLowerCase();
	if (m.includes("invalid login credentials"))
		return "Wrong email or password. Please try again.";
	return message;
}

const AuthPage: React.FC = () => {
	const [searchParams] = useSearchParams();
	const location = useLocation();
	const [ssoError, setSsoError] = useState<string | null>(null);

	// Start on sign-up tab if arriving from /signup route
	const initialTab = location.pathname === "/signup" ? "signup" : "login";
	const [tab, setTab] = useState<"login" | "signup">(initialTab);

	// Shared fields
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Sign-up only fields
	const [name, setName] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	// Hold last error message so the box can animate closed with its content
	// still rendered (only updates while an error is set).
	const [displayError, setDisplayError] = useState<string | null>(null);
	useEffect(() => {
		if (error) setDisplayError(friendlyAuthError(error));
	}, [error]);

	const { signIn, signUp, user } = useAuth();

	// Redirect params
	const claimId = searchParams.get("id");
	const redirectPath = claimId
		? `/profile?id=${claimId}`
		: searchParams.get("redirect") || location.state?.from || "/";

	const eventIdMatch = redirectPath?.match(/\/events?\/([^/]+)/);
	const eventId = eventIdMatch ? eventIdMatch[1] : undefined;
	if (user) return <Navigate to={redirectPath} replace />;

	const switchTab = (t: "login" | "signup") => {
		setTab(t);
		setError(null);
		setSuccess(null);
	};

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsSubmitting(true);
		try {
			if (!email || !password)
				throw new Error("Please enter both email and password");
			await signIn(email, password);
		} catch (err: any) {
			setError(err.message || "Failed to sign in");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSignup = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccess(null);
		setIsSubmitting(true);
		try {
			if (!name || !email || !password || !confirmPassword)
				throw new Error("Please fill in all fields");
			if (password !== confirmPassword)
				throw new Error("Passwords do not match");
			if (password.length < 8)
				throw new Error("Password must be at least 8 characters long");

			const { user: newUser, error: signUpError } = await signUp(
				email,
				password,
				name,
			);
			if (signUpError) throw signUpError;

			if (eventId && newUser?.id) {
				try {
					// Resolve users.id (row created by DB trigger on signup)
					const { data: userRow } = await supabase
						.from("users")
						.select("id")
						.eq("auth_user_id", newUser.id)
						.maybeSingle();

					await supabase.from("investors").insert({
						event_id: eventId,
						name: name || email.split("@")[0],
						email,
						profile_user_id: userRow?.id ?? null,
						initial_balance: 1000000,
						current_balance: 1000000,
					});
				} catch {
					/* non-fatal */
				}
			}

			setSuccess("Account created! Check your email to confirm.");
			setName("");
			setEmail("");
			setPassword("");
			setConfirmPassword("");
		} catch (err: any) {
			setError(err.message || "Failed to create account");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSSOLogin = async (provider: "google" | "linkedin_oidc") => {
		setSsoError(null);
		const { error } = await supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: `${window.location.origin}${redirectPath}`,
				scopes:
					provider === "linkedin_oidc" ? "openid profile email" : undefined,
			},
		});
		if (error) setSsoError(error.message);
	};

	const inputBase =
		"auth-input w-full px-4 py-3.5 rounded-xl text-white text-sm placeholder-white/20 outline-none transition-all duration-200";
	const inputStyle = {
		background: "rgba(255,255,255,0.05)",
		border: "1px solid rgba(255,255,255,0.08)",
	};
	const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
		e.currentTarget.style.border = "1px solid rgba(255,255,255,0.22)";
		e.currentTarget.style.boxShadow =
			"0 0 0 3px rgba(255,255,255,0.04), 0 0 14px rgba(255,255,255,0.10)";
	};
	const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
		e.currentTarget.style.boxShadow = "none";
	};

	return (
		<div
			className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-4 py-12"
			style={{ background: "#080a14" }}
		>
			{/* Leaderboard background image */}
			<div
				aria-hidden="true"
				className="fixed inset-0 bg-cover bg-center bg-no-repeat"
				style={{ backgroundImage: "url('/leaderboard/leaderboard-bg.webp')" }}
			/>
			{/* Dark overlay — keeps the bg subtle */}
			<div
				className="fixed inset-0"
				style={{
					background:
						"linear-gradient(160deg, rgba(6,12,28,0.87) 0%, rgba(8,16,40,0.80) 50%, rgba(4,10,24,0.88) 100%)",
				}}
			/>
			{/* Ambient glows on top */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden">
				<div
					className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[60vh] rounded-full opacity-60"
					style={{
						background:
							"radial-gradient(ellipse at center, #1b3a8a 0%, #0e1e6b 35%, transparent 70%)",
					}}
				/>
				<div
					className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-25"
					style={{
						background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)",
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
				{/* Wordmark */}
				<div className="text-center mb-8 flex flex-col items-center">
					<img
						src="/icons/icon-text-horizontal.webp"
						alt="PitchTank"
						className="h-20 w-auto"
						style={{
							filter: "drop-shadow(0 0 20px rgba(139,92,246,0.5))",
						}}
					/>
					<p
						className="text-white text-xs mt-2"
						style={{
							textShadow:
								"0 0 8px rgba(255,255,255,0.6), 0 0 16px rgba(255,255,255,0.35)",
						}}
					>
						The new way to discover and connect with founders
					</p>
				</div>

				<div>
					{/* Tab toggle */}
					<div
						className="flex mb-6 p-1 rounded-xl gap-1"
						style={{
							background: "rgba(255,255,255,0.04)",
							border: "1px solid rgba(255,255,255,0.06)",
						}}
					>
						{(["login", "signup"] as const).map((t) => (
							<button
								key={t}
								type="button"
								onClick={() => switchTab(t)}
								className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
								style={
									tab === t
										? {
												background:
													"linear-gradient(135deg, rgba(34,211,238,0.15), rgba(99,102,241,0.15))",
												border: "1px solid rgba(99,102,241,0.3)",
												color: "#e0e7ff",
											}
										: {
												color: "rgba(255,255,255,0.3)",
												border: "1px solid transparent",
											}
								}
							>
								{t === "login" ? "Sign In" : "Create Account"}
							</button>
						))}
					</div>

					{success && (
						<div
							className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3"
							style={{
								background: "rgba(34,197,94,0.1)",
								border: "1px solid rgba(34,197,94,0.25)",
							}}
						>
							<svg
								className="w-4 h-4 text-green-400 flex-shrink-0"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fillRule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clipRule="evenodd"
								/>
							</svg>
							<p className="text-green-400 text-sm">{success}</p>
						</div>
					)}

					{/* ── UNIFIED FORM (animated) ── */}
					<form
						onSubmit={tab === "login" ? handleLogin : handleSignup}
						className="space-y-4"
					>
						{/* Full Name (signup only) */}
						<div
							className="auth-collapse"
							data-open={tab === "signup"}
							aria-hidden={tab !== "signup"}
						>
							<div className="auth-collapse-inner auth-field">
								<label
									htmlFor="signup-name"
									className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2"
								>
									Full Name
								</label>
								<input
									id="signup-name"
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Alex Chen"
									required={tab === "signup"}
									disabled={tab !== "signup"}
									tabIndex={tab === "signup" ? 0 : -1}
									className={inputBase}
									style={inputStyle}
									onFocus={onFocus}
									onBlur={onBlur}
								/>
							</div>
						</div>

						<div className="auth-field">
							<label
								htmlFor="auth-email"
								className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2"
							>
								Email
							</label>
							<input
								id="auth-email"
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

						<div className="auth-field">
							<div className="flex items-center justify-between mb-2 min-h-[18px]">
								<label
									htmlFor="auth-password"
									className="text-white/40 text-xs font-semibold uppercase tracking-widest"
								>
									Password
								</label>
								<Link
									to="/forgot-password"
									className="text-xs text-indigo-400 hover:text-cyan-400 transition-all duration-300"
									style={{
										opacity: tab === "login" ? 1 : 0,
										pointerEvents: tab === "login" ? "auto" : "none",
									}}
								>
									Forgot?
								</Link>
							</div>
							<input
								id="auth-password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder={
									tab === "signup" ? "min. 8 characters" : "••••••••"
								}
								required
								minLength={tab === "signup" ? 8 : undefined}
								className={inputBase}
								style={inputStyle}
								onFocus={onFocus}
								onBlur={onBlur}
							/>
						</div>

						{/* Auth error (animated) */}
						<div
							className="auth-collapse"
							data-open={!!error}
							aria-hidden={!error}
							role="alert"
						>
							<div className="auth-collapse-inner">
								<div
									className="px-4 py-3 rounded-xl flex items-center gap-3"
									style={{
										background: "rgba(239,68,68,0.12)",
										border: "1px solid rgba(239,68,68,0.25)",
									}}
								>
									<svg
										className="w-4 h-4 text-red-400 flex-shrink-0"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<path
											fillRule="evenodd"
											d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
											clipRule="evenodd"
										/>
									</svg>
									<p className="text-red-400 text-sm">{displayError}</p>
								</div>
							</div>
						</div>

						{/* Confirm Password (signup only) */}
						<div
							className="auth-collapse"
							data-open={tab === "signup"}
							aria-hidden={tab !== "signup"}
						>
							<div className="auth-collapse-inner auth-field">
								<label
									htmlFor="signup-confirm"
									className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2"
								>
									Confirm Password
								</label>
								<input
									id="signup-confirm"
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder="••••••••"
									required={tab === "signup"}
									disabled={tab !== "signup"}
									tabIndex={tab === "signup" ? 0 : -1}
									className={inputBase}
									style={inputStyle}
									onFocus={onFocus}
									onBlur={onBlur}
								/>
							</div>
						</div>

						<p className="text-white/45 text-[11px] text-center leading-relaxed pt-1">
							{tab === "login"
								? "By signing in you agree to our "
								: "By creating an account you agree to our "}
							<Link
								to="/terms"
								className="text-white/60 hover:text-white/80 underline underline-offset-2 transition-colors"
							>
								Terms
							</Link>{" "}
							&{" "}
							<Link
								to="/privacy"
								className="text-white/60 hover:text-white/80 underline underline-offset-2 transition-colors"
							>
								Privacy Policy
							</Link>
						</p>
						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full py-4 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
							style={{
								background:
									"linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
								boxShadow: isSubmitting
									? "none"
									: "0 0 20px rgba(34,211,238,0.3), 0 4px 15px rgba(0,0,0,0.3)",
							}}
						>
							{isSubmitting
								? tab === "login"
									? "Signing in..."
									: "Creating account..."
								: tab === "login"
									? "Sign In"
									: "Create Account"}
						</button>

						{/* SSO */}
						<div className="flex items-center gap-3 mt-5">
							<div
								className="flex-1 h-px"
								style={{ background: "rgba(255,255,255,0.07)" }}
							/>
							<span className="text-white/50 text-xs">
								{tab === "login" ? "or sign in with" : "or sign up with"}
							</span>
							<div
								className="flex-1 h-px"
								style={{ background: "rgba(255,255,255,0.07)" }}
							/>
						</div>
						{ssoError && (
							<p className="text-red-400 text-xs text-center mt-2">
								{ssoError}
							</p>
						)}
						<div className="flex gap-3 mt-3">
							<button
								type="button"
								onClick={() => handleSSOLogin("google")}
								className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white/60 text-sm font-medium transition-all hover:bg-white/10 active:scale-[0.98]"
								style={{
									background: "rgba(255,255,255,0.04)",
									border: "1px solid rgba(255,255,255,0.08)",
								}}
							>
								<svg className="w-4 h-4" viewBox="0 0 24 24">
									<path
										fill="#4285F4"
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									/>
									<path
										fill="#34A853"
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									/>
									<path
										fill="#FBBC05"
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
									/>
									<path
										fill="#EA4335"
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									/>
								</svg>
								Google
							</button>
							<button
								type="button"
								onClick={() => handleSSOLogin("linkedin_oidc")}
								className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white/60 text-sm font-medium transition-all hover:bg-white/10 active:scale-[0.98]"
								style={{
									background: "rgba(255,255,255,0.04)",
									border: "1px solid rgba(255,255,255,0.08)",
								}}
							>
								<svg className="w-4 h-4" viewBox="0 0 24 24" fill="#0A66C2">
									<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
								</svg>
								LinkedIn
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

export default AuthPage;
