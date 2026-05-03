import React, { useState, useEffect } from "react";
import { useSearchParams, Navigate, Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";

interface ApplicationData {
	id: string;
	event_id: string;
	applicant_email: string;
	status: "pending" | "approved" | "rejected";
	answers: Record<string, string>;
	submitted_at: string;
	claim_token: string;
	event?: { name: string };
	questions?: { id: string; question_text: string; question_type: string }[];
}

interface ProfileData {
	id: string;
	first_name: string;
	last_name: string;
	bio: string;
	profile_picture_url: string;
	linkedin_url: string;
	twitter_url: string;
	role: "pitcher" | "sponsor" | "judge" | "";
}

const ROLE_LABELS: Record<string, string> = {
	pitcher: "Pitcher",
	sponsor: "Sponsor",
	judge: "Judge",
};

const ROLE_COLORS: Record<string, string> = {
	pitcher: "bg-violet-500/20 text-violet-300 border-violet-500/40",
	sponsor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
	judge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

// ─── Background glows shared by both views ────────────────────────────────────
const BgGlow: React.FC = () => (
	<div className="fixed inset-0 pointer-events-none overflow-hidden">
		<div
			className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[60vh] rounded-full opacity-60"
			style={{ background: "radial-gradient(ellipse at center, #2d1b69 0%, #1a0e4a 35%, transparent 70%)" }}
		/>
		<div
			className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-20"
			style={{ background: "radial-gradient(circle, #4f46e5 0%, transparent 70%)", filter: "blur(40px)" }}
		/>
		<div
			className="absolute top-1/3 -right-20 w-72 h-72 rounded-full opacity-15"
			style={{ background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)", filter: "blur(50px)" }}
		/>
	</div>
);

// ─── Public view ──────────────────────────────────────────────────────────────
const PublicProfileView: React.FC<{ founderUserId: string }> = ({ founderUserId }) => {
	const [profile, setProfile] = useState<ProfileData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [copied, setCopied] = useState(false);
	const [showQR, setShowQR] = useState(false);

	const profileUrl = `${window.location.origin}/profile?id=${founderUserId}`;

	useEffect(() => {
		supabase
			.from("founder_users")
			.select("id, first_name, last_name, bio, profile_picture_url, linkedin_url, twitter_url, role")
			.eq("id", founderUserId)
			.maybeSingle()
			.then(({ data }) => {
				if (data) {
					setProfile({
						id: data.id,
						first_name: data.first_name ?? "",
						last_name: data.last_name ?? "",
						bio: data.bio ?? "",
						profile_picture_url: data.profile_picture_url ?? "",
						linkedin_url: data.linkedin_url ?? "",
						twitter_url: data.twitter_url ?? "",
						role: (data.role as ProfileData["role"]) ?? "",
					});
				}
				setIsLoading(false);
			});
	}, [founderUserId]);

	const handleCopy = () => {
		navigator.clipboard.writeText(profileUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{ background: "#080a14" }}>
				<div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
			</div>
		);
	}

	if (!profile) {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{ background: "#080a14" }}>
				<p className="text-white/40">Profile not found.</p>
			</div>
		);
	}

	const initials =
		profile.first_name || profile.last_name
			? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase()
			: "?";

	return (
		<div className="min-h-screen relative" style={{ background: "#080a14" }}>
			<BgGlow />
			<div className="relative z-10 max-w-lg mx-auto px-5 pt-10 pb-20">
				{/* Back + share row */}
				<div className="flex items-center justify-between mb-8">
					<Link
						to="/"
						className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
						Back
					</Link>
					<button
						onClick={() => setShowQR(!showQR)}
						className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-white/70 hover:text-white transition-all"
						style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
								d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
						</svg>
						Share
					</button>
				</div>

				{/* QR card */}
				{showQR && (
					<div
						className="mb-6 rounded-2xl p-5 flex flex-col items-center gap-4"
						style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
					>
						<div className="rounded-xl overflow-hidden bg-white p-3">
							<QRCodeCanvas value={profileUrl} size={160} level="H" includeMargin={false} />
						</div>
						<p className="text-white/30 text-xs">Scan to view this profile</p>
						<div
							className="w-full flex items-center gap-2 rounded-xl px-3 py-2"
							style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
						>
							<p className="flex-1 text-white/40 text-xs truncate">{profileUrl}</p>
							<button
								onClick={handleCopy}
								className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
								style={
									copied
										? { background: "rgba(34,197,94,0.15)", color: "#86efac" }
										: { background: "rgba(34,211,238,0.12)", color: "#67e8f9" }
								}
							>
								{copied ? "Copied!" : "Copy"}
							</button>
						</div>
					</div>
				)}

				{/* Avatar + name */}
				<div className="flex items-center gap-5 mb-6">
					<div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/15 flex-shrink-0 shadow-lg shadow-violet-500/20">
						{profile.profile_picture_url ? (
							<img src={profile.profile_picture_url} alt={profile.first_name} className="w-full h-full object-cover" />
						) : (
							<div className="w-full h-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white font-black text-3xl">
								{initials}
							</div>
						)}
					</div>
					<div>
						<h1 className="text-2xl font-black text-white leading-tight">
							{`${profile.first_name} ${profile.last_name}`.trim() || "Anonymous"}
						</h1>
						{profile.role && (
							<span
								className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${ROLE_COLORS[profile.role] ?? ""}`}
							>
								{ROLE_LABELS[profile.role] ?? profile.role}
							</span>
						)}
					</div>
				</div>

				{/* Bio */}
				{profile.bio && (
					<div
						className="rounded-2xl px-4 py-4 mb-4"
						style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
					>
						<p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-2">Bio</p>
						<p className="text-white/75 text-sm leading-relaxed">{profile.bio}</p>
					</div>
				)}

				{/* Contact */}
				{(profile.linkedin_url || profile.twitter_url) && (
					<div
						className="rounded-2xl px-4 py-4 space-y-3"
						style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
					>
						<p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider">Contact</p>
						{profile.linkedin_url && (
							<a
								href={profile.linkedin_url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
							>
								<svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
									<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
								</svg>
								<span className="truncate">{profile.linkedin_url.replace(/^https?:\/\/(www\.)?/, "")}</span>
							</a>
						)}
						{profile.twitter_url && (
							<a
								href={profile.twitter_url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
							>
								<svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
									<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
								</svg>
								<span className="truncate">{profile.twitter_url.replace(/^https?:\/\/(www\.)?/, "")}</span>
							</a>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

// ─── Own profile page ─────────────────────────────────────────────────────────
const ProfilePage: React.FC = () => {
	const { user, isLoading: authLoading } = useAuth();
	const [searchParams] = useSearchParams();
	const claimId = searchParams.get("id");

	const isLikelyProfileId = !!claimId && /^[0-9a-f-]{36}$/i.test(claimId);

	const [tab, setTab] = useState<"view" | "edit" | "qr">("view");
	const [application, setApplication] = useState<ApplicationData | null>(null);
	const [claimed, setClaimed] = useState(false);
	const [claimError, setClaimError] = useState<string | null>(null);
	const [isProcessingClaim, setIsProcessingClaim] = useState(false);

	const [profile, setProfile] = useState<ProfileData>({
		id: "",
		first_name: "",
		last_name: "",
		bio: "",
		profile_picture_url: "",
		linkedin_url: "",
		twitter_url: "",
		role: "",
	});
	const [draft, setDraft] = useState<ProfileData>(profile);
	const [isSaving, setIsSaving] = useState(false);
	const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
	const [isLoadingProfile, setIsLoadingProfile] = useState(true);
	const [copied, setCopied] = useState(false);

	// Load own profile
	useEffect(() => {
		if (!user) return;
		supabase
			.from("founder_users")
			.select("id, first_name, last_name, bio, profile_picture_url, linkedin_url, twitter_url, role")
			.eq("auth_user_id", user.id)
			.maybeSingle()
			.then(({ data }) => {
				if (data) {
					const p: ProfileData = {
						id: data.id ?? "",
						first_name: data.first_name ?? "",
						last_name: data.last_name ?? "",
						bio: data.bio ?? "",
						profile_picture_url: data.profile_picture_url ?? "",
						linkedin_url: data.linkedin_url ?? "",
						twitter_url: data.twitter_url ?? "",
						role: (data.role as ProfileData["role"]) ?? "",
					};
					setProfile(p);
					setDraft(p);
				}
				setIsLoadingProfile(false);
			});
	}, [user]);

	// Process claim token
	useEffect(() => {
		if (!claimId || !user || isProcessingClaim || isLikelyProfileId) return;
		setIsProcessingClaim(true);

		(async () => {
			const { data: app, error: appError } = await supabase
				.from("applications")
				.select("*, event:events(name), questions:event_questions(id, question_text, question_type)")
				.eq("claim_token", claimId)
				.maybeSingle();

			if (appError || !app) {
				setClaimError("This profile link is invalid or has already been used.");
				setIsProcessingClaim(false);
				return;
			}

			const { error: updateError } = await supabase
				.from("applications")
				.update({ claimed_by_auth_user_id: user.id })
				.eq("claim_token", claimId);

			if (updateError) {
				setClaimError("Failed to link your profile. Please try again.");
				setIsProcessingClaim(false);
				return;
			}

			setApplication(app);
			setClaimed(true);

			const questions: { id: string; question_text: string; question_type: string }[] = app.questions ?? [];
			const answers: Record<string, string> = app.answers ?? {};

			const findAnswer = (keywords: string[]) => {
				const q = questions.find((q) =>
					keywords.some((kw) => q.question_text.toLowerCase().includes(kw))
				);
				return q ? (answers[q.id] ?? "") : "";
			};

			const firstName = findAnswer(["first name", "first_name"]);
			const lastName = findAnswer(["last name", "last_name"]);
			const bio = findAnswer(["bio", "about", "description", "yourself"]);
			const photo = findAnswer(["photo", "headshot", "portrait", "picture"]);
			const logoUrl = findAnswer(["logo"]);

			setProfile((prev) => {
				const updated: ProfileData = {
					...prev,
					first_name: firstName || prev.first_name,
					last_name: lastName || prev.last_name,
					bio: bio || prev.bio,
					profile_picture_url: photo || logoUrl || prev.profile_picture_url,
				};
				setDraft(updated);
				return updated;
			});

			setIsProcessingClaim(false);
		})();
	}, [claimId, user, isProcessingClaim, isLikelyProfileId]);

	// Load existing linked application
	useEffect(() => {
		if (!user || claimId || application) return;
		supabase
			.from("applications")
			.select("*, event:events(name), questions:event_questions(id, question_text, question_type)")
			.eq("claimed_by_auth_user_id", user.id)
			.order("submitted_at", { ascending: false })
			.limit(1)
			.maybeSingle()
			.then(({ data }) => {
				if (data) setApplication(data);
			});
	}, [user, claimId, application]);

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;
		setIsSaving(true);
		setSaveMsg(null);

		const { error } = await supabase.from("founder_users").upsert(
			{
				auth_user_id: user.id,
				email: user.email ?? "",
				first_name: draft.first_name,
				last_name: draft.last_name,
				bio: draft.bio || null,
				profile_picture_url: draft.profile_picture_url || null,
				linkedin_url: draft.linkedin_url || null,
				twitter_url: draft.twitter_url || null,
				role: draft.role || null,
			},
			{ onConflict: "auth_user_id" }
		);

		if (error) {
			setSaveMsg({ ok: false, text: "Failed to save. Please try again." });
		} else {
			setProfile(draft);
			setSaveMsg({ ok: true, text: "Profile saved!" });
			setTimeout(() => {
				setSaveMsg(null);
				setTab("view");
			}, 1500);
		}
		setIsSaving(false);
	};

	const profileUrl = profile.id
		? `${window.location.origin}/profile?id=${profile.id}`
		: `${window.location.origin}/profile`;

	const handleCopy = () => {
		navigator.clipboard.writeText(profileUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleDownloadQR = () => {
		const canvas = document.getElementById("profile-qr-canvas") as HTMLCanvasElement;
		if (!canvas) return;
		const link = document.createElement("a");
		link.download = "my-profile-qr.png";
		link.href = canvas.toDataURL("image/png");
		link.click();
	};

	// Public view (no auth required)
	if (!authLoading && !user && isLikelyProfileId) {
		return <PublicProfileView founderUserId={claimId!} />;
	}

	if (authLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{ background: "#080a14" }}>
				<div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
			</div>
		);
	}

	if (!user) {
		return <Navigate to={claimId ? `/login?id=${claimId}` : "/login"} replace />;
	}

	const initials =
		profile.first_name || profile.last_name
			? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase()
			: (user.email ?? "?").charAt(0).toUpperCase();

	const inputClass = "w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none transition-colors";
	const inputStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" };

	const statusColors: Record<string, string> = {
		pending: "text-yellow-400 border-yellow-700/60 bg-yellow-500/10",
		approved: "text-green-400 border-green-700/60 bg-green-500/10",
		rejected: "text-red-400 border-red-700/60 bg-red-500/10",
	};

	return (
		<div className="min-h-screen relative" style={{ background: "#080a14" }}>
			<BgGlow />

			<div className="relative z-10 max-w-lg mx-auto px-5 pt-8 pb-20">
				{/* Top bar */}
				<div className="flex items-center justify-between mb-6">
					<Link
						to="/"
						className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
						Back
					</Link>
					<div>
						<p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest text-right">Account</p>
						<h1 className="text-xl font-black text-white">My Profile</h1>
					</div>
				</div>

				{/* Banners */}
				{claimed && (
					<div
						className="mb-5 rounded-2xl px-4 py-3.5 text-sm text-green-300"
						style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
					>
						Profile linked! Application answers have been pre-filled where possible.
					</div>
				)}
				{claimError && (
					<div
						className="mb-5 rounded-2xl px-4 py-3.5 text-sm text-red-300"
						style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
					>
						{claimError}
					</div>
				)}

				{/* Tab bar */}
				<div className="flex gap-2 mb-5">
					{(["view", "edit", "qr"] as const).map((t) => (
						<button
							key={t}
							onClick={() => setTab(t)}
							className="px-4 py-1.5 rounded-full text-xs font-bold transition-all border"
							style={
								tab === t
									? { background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.6)", color: "#c4b5fd" }
									: { background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" }
							}
						>
							{t === "view" ? "Profile" : t === "edit" ? "Edit" : "Share QR"}
						</button>
					))}
				</div>

				{isLoadingProfile ? (
					<div className="flex items-center justify-center py-20">
						<div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
					</div>
				) : (
					<>
						{/* ── VIEW TAB ── */}
						{tab === "view" && (
							<div className="space-y-4">
								{/* Avatar + name */}
								<div className="flex items-center gap-4">
									<div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/15 flex-shrink-0 shadow-lg shadow-violet-500/20">
										{profile.profile_picture_url ? (
											<img src={profile.profile_picture_url} alt={profile.first_name} className="w-full h-full object-cover" />
										) : (
											<div className="w-full h-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white font-black text-2xl">
												{initials}
											</div>
										)}
									</div>
									<div className="flex-1 min-w-0">
										<h2 className="text-white font-black text-xl leading-tight">
											{profile.first_name || profile.last_name
												? `${profile.first_name} ${profile.last_name}`.trim()
												: "Your Name"}
										</h2>
										<p className="text-white/40 text-sm mt-0.5 truncate">{user.email}</p>
										{profile.role && (
											<span
												className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${ROLE_COLORS[profile.role] ?? ""}`}
											>
												{ROLE_LABELS[profile.role] ?? profile.role}
											</span>
										)}
									</div>
								</div>

								{/* Bio */}
								{profile.bio && (
									<div
										className="rounded-2xl px-4 py-3.5"
										style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
									>
										<p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Bio</p>
										<p className="text-white/75 text-sm leading-relaxed">{profile.bio}</p>
									</div>
								)}

								{/* Contact */}
								{(profile.linkedin_url || profile.twitter_url) && (
									<div
										className="rounded-2xl px-4 py-3.5 space-y-2.5"
										style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
									>
										<p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider">Contact</p>
										{profile.linkedin_url && (
											<a
												href={profile.linkedin_url}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center gap-2.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
											>
												<svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
													<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
												</svg>
												<span className="truncate">{profile.linkedin_url.replace(/^https?:\/\/(www\.)?/, "")}</span>
											</a>
										)}
										{profile.twitter_url && (
											<a
												href={profile.twitter_url}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center gap-2.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
											>
												<svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
													<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
												</svg>
												<span className="truncate">{profile.twitter_url.replace(/^https?:\/\/(www\.)?/, "")}</span>
											</a>
										)}
									</div>
								)}

								{/* Empty state */}
								{!profile.first_name && !profile.last_name && !profile.bio && (
									<div className="text-center py-8">
										<p className="text-white/30 text-sm mb-3">Your profile is empty.</p>
										<button
											onClick={() => setTab("edit")}
											className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
											style={{ background: "linear-gradient(135deg, #22d3ee, #6366f1)", boxShadow: "0 0 16px rgba(34,211,238,0.25)" }}
										>
											Set up profile
										</button>
									</div>
								)}

								{/* Application card */}
								{application && (
									<div
										className="rounded-2xl px-4 py-4 mt-2"
										style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
									>
										<div className="flex items-center justify-between mb-4">
											<div>
												<p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Application</p>
												{application.event?.name && (
													<p className="text-white/70 text-sm font-semibold">{application.event.name}</p>
												)}
											</div>
											<span
												className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusColors[application.status] ?? "text-white/40 border-white/10 bg-white/5"}`}
											>
												{application.status.charAt(0).toUpperCase() + application.status.slice(1)}
											</span>
										</div>
										<div className="space-y-3">
											{(application.questions ?? []).map((q) => {
												const answer = application.answers[q.id];
												if (!answer) return null;
												return (
													<div key={q.id}>
														<p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">{q.question_text}</p>
														{q.question_type === "image" ? (
															<img src={answer} alt={q.question_text} className="max-h-40 rounded-xl border border-white/10 object-contain" />
														) : q.question_type === "url" || q.question_type === "website_url" ? (
															<a href={answer} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline text-sm break-all">
																{answer}
															</a>
														) : (
															<p className="text-white/65 text-sm leading-relaxed">{answer}</p>
														)}
													</div>
												);
											})}
											{(application.questions ?? []).length === 0 && (
												<p className="text-white/25 text-sm">Application answers not available.</p>
											)}
										</div>
									</div>
								)}

								{!application && !isProcessingClaim && (
									<div
										className="rounded-2xl px-4 py-5 text-center"
										style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
									>
										<p className="text-white/25 text-sm">
											No application linked yet. Use the link from your confirmation email to connect your profile.
										</p>
									</div>
								)}
							</div>
						)}

						{/* ── EDIT TAB ── */}
						{tab === "edit" && (
							<form onSubmit={handleSave} className="space-y-4">
								{/* Avatar preview */}
								<div className="flex items-center gap-4">
									<div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/15 flex-shrink-0">
										{draft.profile_picture_url ? (
											<img src={draft.profile_picture_url} alt="" className="w-full h-full object-cover" />
										) : (
											<div className="w-full h-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white font-black text-xl">
												{(draft.first_name.charAt(0) + draft.last_name.charAt(0)).toUpperCase() || "?"}
											</div>
										)}
									</div>
									<div className="flex-1">
										<label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
											Profile picture URL
										</label>
										<input
											type="url"
											value={draft.profile_picture_url}
											onChange={(e) => setDraft((d) => ({ ...d, profile_picture_url: e.target.value }))}
											placeholder="https://..."
											className={inputClass}
											style={inputStyle}
										/>
									</div>
								</div>

								{/* Name */}
								<div className="grid grid-cols-2 gap-3">
									{(["first_name", "last_name"] as const).map((field) => (
										<div key={field}>
											<label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
												{field === "first_name" ? "First name" : "Last name"}
											</label>
											<input
												type="text"
												value={draft[field]}
												onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
												className={inputClass}
												style={inputStyle}
											/>
										</div>
									))}
								</div>

								{/* Role */}
								<div>
									<label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
										Role at event
									</label>
									<div className="flex gap-2">
										{(["pitcher", "sponsor", "judge"] as const).map((r) => (
											<button
												key={r}
												type="button"
												onClick={() => setDraft((d) => ({ ...d, role: d.role === r ? "" : r }))}
												className="flex-1 py-2 rounded-xl text-xs font-bold border transition-all capitalize"
												style={
													draft.role === r
														? { background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.6)", color: "#c4b5fd" }
														: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
												}
											>
												{ROLE_LABELS[r]}
											</button>
										))}
									</div>
								</div>

								{/* Bio */}
								<div>
									<label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Bio</label>
									<textarea
										value={draft.bio}
										onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
										rows={3}
										placeholder="Tell people about yourself..."
										className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none resize-none"
										style={inputStyle}
									/>
								</div>

								{/* LinkedIn */}
								<div>
									<label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
										LinkedIn URL
									</label>
									<input
										type="url"
										value={draft.linkedin_url}
										onChange={(e) => setDraft((d) => ({ ...d, linkedin_url: e.target.value }))}
										placeholder="https://linkedin.com/in/..."
										className={inputClass}
										style={inputStyle}
									/>
								</div>

								{/* Twitter */}
								<div>
									<label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
										X (Twitter) URL
									</label>
									<input
										type="url"
										value={draft.twitter_url}
										onChange={(e) => setDraft((d) => ({ ...d, twitter_url: e.target.value }))}
										placeholder="https://x.com/..."
										className={inputClass}
										style={inputStyle}
									/>
								</div>

								{saveMsg && (
									<p className={`text-sm font-medium ${saveMsg.ok ? "text-green-400" : "text-red-400"}`}>
										{saveMsg.text}
									</p>
								)}

								<div className="flex gap-3 pt-1 pb-4">
									<button
										type="submit"
										disabled={isSaving}
										className="flex-1 py-4 rounded-2xl font-bold text-white text-sm transition-all disabled:opacity-50"
										style={{ background: "linear-gradient(135deg, #22d3ee, #6366f1)", boxShadow: "0 0 16px rgba(34,211,238,0.25)" }}
									>
										{isSaving ? "Saving..." : "Save Profile"}
									</button>
									<button
										type="button"
										onClick={() => { setDraft(profile); setTab("view"); }}
										className="px-5 py-4 rounded-2xl font-bold text-white/50 text-sm transition-all hover:text-white/80"
										style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
									>
										Cancel
									</button>
								</div>
							</form>
						)}

						{/* ── QR TAB ── */}
						{tab === "qr" && (
							<div className="flex flex-col items-center gap-5 pb-4">
								{/* Profile preview strip */}
								<div
									className="w-full flex items-center gap-3 rounded-2xl px-4 py-3"
									style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
								>
									<div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
										{profile.profile_picture_url ? (
											<img src={profile.profile_picture_url} alt="" className="w-full h-full object-cover" />
										) : (
											<div className="w-full h-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white font-black text-base">
												{initials}
											</div>
										)}
									</div>
									<div>
										<p className="text-white font-bold text-sm leading-tight">
											{profile.first_name || profile.last_name
												? `${profile.first_name} ${profile.last_name}`.trim()
												: "Your Profile"}
										</p>
										<p className="text-white/40 text-xs">{user.email}</p>
									</div>
								</div>

								{/* QR code */}
								<div
									className="rounded-2xl p-4"
									style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
								>
									<div className="rounded-xl overflow-hidden bg-white p-3">
										<QRCodeCanvas id="profile-qr-canvas" value={profileUrl} size={200} level="H" includeMargin={false} />
									</div>
									<p className="text-white/30 text-[10px] text-center mt-2 font-medium">Scan to view profile</p>
								</div>

								{/* URL row */}
								<div
									className="w-full flex items-center gap-2 rounded-2xl px-4 py-3"
									style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
								>
									<p className="flex-1 text-white/50 text-xs truncate">{profileUrl}</p>
									<button
										onClick={handleCopy}
										className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
										style={
											copied
												? { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#86efac" }
												: { background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)", color: "#67e8f9" }
										}
									>
										{copied ? "Copied!" : "Copy"}
									</button>
								</div>

								{/* Download */}
								<button
									onClick={handleDownloadQR}
									className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
									style={{ background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)", boxShadow: "0 0 20px rgba(34,211,238,0.2)" }}
								>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
									</svg>
									Download QR
								</button>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
};

export default ProfilePage;
