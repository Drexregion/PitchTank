import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";

type Step = "email" | "checking" | "existing" | "new";

function friendlyAuthError(message: string): string {
	const m = message.toLowerCase();
	if (m.includes("invalid login credentials"))
		return "Wrong email or password. Please try again.";
	return message;
}

const Spinner = () => (
	<svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
		<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
		<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
	</svg>
);

const AuthPage: React.FC = () => {
	const [searchParams] = useSearchParams();
	const location = useLocation();

	const [step, setStep] = useState<Step>("email");
	const [existingName, setExistingName] = useState<string | null>(null);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [ssoError, setSsoError] = useState<string | null>(null);
	const [magicLinkSent, setMagicLinkSent] = useState(false);
	const [displayError, setDisplayError] = useState<string | null>(null);

	useEffect(() => {
		if (error) setDisplayError(friendlyAuthError(error));
	}, [error]);

	const { signIn, signUp, user } = useAuth();

	const claimId = searchParams.get("id");
	const redirectPath = claimId
		? `/profile?id=${claimId}`
		: searchParams.get("redirect") || location.state?.from || "/";

	const eventIdMatch = redirectPath?.match(/\/events?\/([^/]+)/);
	const eventId = eventIdMatch ? eventIdMatch[1] : undefined;

	if (user) return <Navigate to={redirectPath} replace />;

	const handleEmailContinue = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = email.trim().toLowerCase();
		if (!trimmed) { setError("Please enter your email"); return; }
		setError(null);
		setStep("checking");

		const { data } = await supabase
			.from("users")
			.select("first_name")
			.eq("email", trimmed)
			.maybeSingle();

		if (data) {
			setExistingName(data.first_name || null);
			setStep("existing");
		} else {
			setStep("new");
		}
	};

	const handleSignIn = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsSubmitting(true);
		try {
			if (!password) throw new Error("Please enter your password");
			await signIn(email, password);
		} catch (err: any) {
			setError(err.message || "Failed to sign in");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSendMagicLink = async () => {
		setError(null);
		setIsSubmitting(true);
		try {
			const { error: e } = await supabase.auth.signInWithOtp({
				email,
				options: { emailRedirectTo: `${window.location.origin}${redirectPath}` },
			});
			if (e) throw e;
			setMagicLinkSent(true);
		} catch (err: any) {
			setError(err.message || "Failed to send link");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSignUp = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsSubmitting(true);
		try {
			if (!name || !password || !confirmPassword)
				throw new Error("Please fill in all fields");
			if (password !== confirmPassword)
				throw new Error("Passwords do not match");
			if (password.length < 8)
				throw new Error("Password must be at least 8 characters");

			const { user: newUser, error: signUpError } = await signUp(email, password, name);
			if (signUpError) throw signUpError;

			if (newUser?.id) {
				const trimmedName = name.trim();
				const spaceIdx = trimmedName.indexOf(" ");
				const firstName = spaceIdx === -1 ? trimmedName : trimmedName.slice(0, spaceIdx);
				const lastName = spaceIdx === -1 ? "" : trimmedName.slice(spaceIdx + 1).trim();
				try {
					await supabase.from("users").upsert(
						{ auth_user_id: newUser.id, email, first_name: firstName, last_name: lastName || null },
						{ onConflict: "auth_user_id" },
					);
				} catch { /* non-fatal */ }
			}

			if (eventId && newUser?.id) {
				try {
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
				} catch { /* non-fatal */ }
			}

			setSuccess("Account created! Check your email to confirm.");
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
				scopes: provider === "linkedin_oidc" ? "openid profile email" : undefined,
			},
		});
		if (error) setSsoError(error.message);
	};

	const resetToEmail = () => {
		setStep("email");
		setPassword("");
		setName("");
		setConfirmPassword("");
		setError(null);
		setSuccess(null);
		setMagicLinkSent(false);
		setExistingName(null);
	};

	const inputBase = "auth-input w-full px-4 py-3.5 rounded-xl text-white text-sm placeholder-white/20 outline-none transition-all duration-200";
	const inputStyle = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" };
	const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
		e.currentTarget.style.border = "1px solid rgba(255,255,255,0.22)";
		e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,255,255,0.04), 0 0 14px rgba(255,255,255,0.10)";
	};
	const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
		e.currentTarget.style.boxShadow = "none";
	};

	const isEmailStep = step === "email" || step === "checking";

	const errorBox = !!error && (
		<div className="px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }} role="alert">
			<svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
				<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
			</svg>
			<p className="text-red-400 text-sm">{displayError}</p>
		</div>
	);

	const ssoSection = (
		<>
			<div className="flex items-center gap-3">
				<div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
				<span className="text-white/50 text-xs">or continue with</span>
				<div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
			</div>
			{ssoError && <p className="text-red-400 text-xs text-center">{ssoError}</p>}
			<div className="flex gap-3">
				<button
					type="button"
					onClick={() => handleSSOLogin("google")}
					className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white/60 text-sm font-medium transition-all hover:bg-white/10 active:scale-[0.98]"
					style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
				>
					<svg className="w-4 h-4" viewBox="0 0 24 24">
						<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
						<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
						<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
						<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
					</svg>
					Google
				</button>
				<button
					type="button"
					onClick={() => handleSSOLogin("linkedin_oidc")}
					className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white/60 text-sm font-medium transition-all hover:bg-white/10 active:scale-[0.98]"
					style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
				>
					<svg className="w-4 h-4" viewBox="0 0 24 24" fill="#0A66C2">
						<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
					</svg>
					LinkedIn
				</button>
			</div>
		</>
	);

	return (
		<div
			className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-4 py-12"
			style={{ background: "#080a14" }}
		>
			<div aria-hidden="true" className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/leaderboard/leaderboard-bg.webp')" }} />
			<div className="fixed inset-0" style={{ background: "linear-gradient(160deg, rgba(6,12,28,0.87) 0%, rgba(8,16,40,0.80) 50%, rgba(4,10,24,0.88) 100%)" }} />
			<div className="fixed inset-0 pointer-events-none overflow-hidden">
				<div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[60vh] rounded-full opacity-60" style={{ background: "radial-gradient(ellipse at center, #1b3a8a 0%, #0e1e6b 35%, transparent 70%)" }} />
				<div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-25" style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)", filter: "blur(40px)" }} />
				<div className="absolute top-1/3 -right-20 w-72 h-72 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)", filter: "blur(50px)" }} />
			</div>

			<div className="relative z-10 w-full max-w-sm">
				{/* Logo */}
				<div className="text-center mb-8 flex flex-col items-center">
					<img
						src="/icons/icon-text-horizontal.webp"
						alt="PitchTank"
						className="h-20 w-auto"
						style={{ filter: "drop-shadow(0 0 20px rgba(139,92,246,0.5))" }}
					/>
					<p className="text-white text-xs mt-2" style={{ textShadow: "0 0 8px rgba(255,255,255,0.6), 0 0 16px rgba(255,255,255,0.35)" }}>
						The new way to discover and connect with founders
					</p>
				</div>

				{/* ── STEP: EMAIL ── */}
				{isEmailStep && (
					<form onSubmit={handleEmailContinue} className="space-y-4">
						<div>
							<label htmlFor="auth-email" className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">
								Email
							</label>
							<input
								id="auth-email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
								required
								autoFocus
								className={inputBase}
								style={inputStyle}
								onFocus={onFocus}
								onBlur={onBlur}
							/>
						</div>

						{errorBox}

						<button
							type="submit"
							disabled={step === "checking"}
							className="w-full py-4 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-70 hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
							style={{ background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)", boxShadow: "0 0 20px rgba(34,211,238,0.3), 0 4px 15px rgba(0,0,0,0.3)" }}
						>
							{step === "checking" ? <><Spinner /> Checking...</> : "Continue"}
						</button>

						{ssoSection}
					</form>
				)}

				{/* ── STEP: EXISTING ACCOUNT ── */}
				{step === "existing" && (
					<div className="space-y-4">
						{/* Locked email with back link */}
						<div>
							<div className="flex items-center justify-between mb-2">
								<label className="text-white/40 text-xs font-semibold uppercase tracking-widest">Email</label>
								<button type="button" onClick={resetToEmail} className="text-xs text-indigo-400 hover:text-cyan-400 transition-colors">
									Change
								</button>
							</div>
							<div className="w-full px-4 py-3.5 rounded-xl text-white/60 text-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
								{email}
							</div>
						</div>

						{!magicLinkSent ? (
							<form onSubmit={handleSignIn} className="space-y-4">
								{existingName && (
									<p className="text-white/60 text-sm">
										Welcome back, <span className="text-white font-semibold">{existingName}</span>
									</p>
								)}

								<div>
									<div className="flex items-center justify-between mb-2">
										<label htmlFor="auth-password" className="text-white/40 text-xs font-semibold uppercase tracking-widest">
											Password
										</label>
										<Link to="/forgot-password" className="text-xs text-indigo-400 hover:text-cyan-400 transition-colors">
											Forgot?
										</Link>
									</div>
									<input
										id="auth-password"
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										placeholder="••••••••"
										required
										autoFocus
										className={inputBase}
										style={inputStyle}
										onFocus={onFocus}
										onBlur={onBlur}
									/>
								</div>

								{errorBox}

								<button
									type="submit"
									disabled={isSubmitting}
									className="w-full py-4 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
									style={{ background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)", boxShadow: isSubmitting ? "none" : "0 0 20px rgba(34,211,238,0.3), 0 4px 15px rgba(0,0,0,0.3)" }}
								>
									{isSubmitting ? <><Spinner /> Signing in...</> : "Sign In"}
								</button>

								<div className="flex items-center gap-3">
									<div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
									<span className="text-white/50 text-xs">or</span>
									<div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
								</div>

								<button
									type="button"
									onClick={handleSendMagicLink}
									disabled={isSubmitting}
									className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all hover:bg-white/10 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
									style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" }}
								>
									{isSubmitting ? <><Spinner /> Sending...</> : (
										<>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
											</svg>
											Email me a sign-in link
										</>
									)}
								</button>

								{ssoSection}
							</form>
						) : (
							/* Magic link sent */
							<div className="text-center py-6 space-y-4">
								<div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
									<svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
									</svg>
								</div>
								<div>
									<p className="text-white font-semibold text-base">Check your inbox</p>
									<p className="text-white/50 text-sm mt-1.5 leading-relaxed">
										We sent a sign-in link to <span className="text-white/80">{email}</span>.<br />
										Click it to sign in — no password needed.
									</p>
								</div>
								<button
									type="button"
									onClick={() => { setMagicLinkSent(false); setError(null); }}
									className="text-xs text-indigo-400 hover:text-cyan-400 transition-colors"
								>
									Use password instead
								</button>
							</div>
						)}
					</div>
				)}

				{/* ── STEP: NEW ACCOUNT ── */}
				{step === "new" && (
					<div className="space-y-4">
						{/* Locked email with back link */}
						<div>
							<div className="flex items-center justify-between mb-2">
								<label className="text-white/40 text-xs font-semibold uppercase tracking-widest">Email</label>
								<button type="button" onClick={resetToEmail} className="text-xs text-indigo-400 hover:text-cyan-400 transition-colors">
									Change
								</button>
							</div>
							<div className="w-full px-4 py-3.5 rounded-xl text-white/60 text-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
								{email}
							</div>
						</div>

						{success ? (
							<div className="py-4 space-y-3 text-center">
								<div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
									<svg className="w-7 h-7 text-green-400" fill="currentColor" viewBox="0 0 20 20">
										<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
									</svg>
								</div>
								<p className="text-white font-semibold">Account created!</p>
								<p className="text-white/50 text-sm">Check your email to confirm your account.</p>
							</div>
						) : (
							<form onSubmit={handleSignUp} className="space-y-4">
								<div>
									<label htmlFor="signup-name" className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">
										Full Name
									</label>
									<input
										id="signup-name"
										type="text"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="Alex Chen"
										required
										autoFocus
										className={inputBase}
										style={inputStyle}
										onFocus={onFocus}
										onBlur={onBlur}
									/>
								</div>
								<div>
									<label htmlFor="signup-password" className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">
										Password
									</label>
									<input
										id="signup-password"
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
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
									<label htmlFor="signup-confirm" className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">
										Confirm Password
									</label>
									<input
										id="signup-confirm"
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

								{errorBox}

								<p className="text-white/45 text-[11px] text-center leading-relaxed">
									By creating an account you agree to our{" "}
									<Link to="/terms" className="text-white/60 hover:text-white/80 underline underline-offset-2 transition-colors">Terms</Link>
									{" "}&{" "}
									<Link to="/privacy" className="text-white/60 hover:text-white/80 underline underline-offset-2 transition-colors">Privacy Policy</Link>
								</p>

								<button
									type="submit"
									disabled={isSubmitting}
									className="w-full py-4 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
									style={{ background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)", boxShadow: isSubmitting ? "none" : "0 0 20px rgba(34,211,238,0.3), 0 4px 15px rgba(0,0,0,0.3)" }}
								>
									{isSubmitting ? <><Spinner /> Creating account...</> : "Create Account"}
								</button>

								{ssoSection}
							</form>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default AuthPage;
