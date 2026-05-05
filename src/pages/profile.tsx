import React, { useState, useEffect, type ReactNode } from "react";
import {
	useSearchParams,
	Navigate,
	useNavigate,
	useParams,
	useLocation,
} from "react-router-dom";
import {
	ArrowLeft,
	Briefcase,
	Sparkles,
	Mail,
	Share2,
	Pencil,
	Check,
	MessageCircle,
	X as XIconLucide,
	Home,
	User as UserIcon,
	Settings as SettingsIcon,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { useGlobalUnreadDMs } from "../hooks/useGlobalUnreadDMs";
import { ScannerModal } from "../components/ScannerModal";
import { DMPanel } from "../components/DMPanel";
import {
	Avatar,
	Button as PtButton,
	GlassCard,
	IconButton,
	IridescentArc,
	gradientForUser,
	GRADIENT_PRESETS,
	GRADIENT_PRESET_KEYS,
	DEFAULT_USER_GRADIENT,
	type GradientPresetKey,
} from "../components/design-system";

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
	role: "pitcher" | "sponsor" | "judge" | "member" | "";
	looking_to_connect: string;
	profile_color: GradientPresetKey | null;
}

const ROLE_LABELS: Record<string, string> = {
	member: "Member",
	pitcher: "Pitcher",
	sponsor: "Sponsor",
	judge: "Judge",
};

// ─── Background glows shared by both views ────────────────────────────────────
const BgGlow: React.FC = () => (
	<div className="fixed inset-0 pointer-events-none overflow-hidden">
		<div
			className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[60vh] rounded-full opacity-60"
			style={{
				background:
					"radial-gradient(ellipse at center, #2d1b69 0%, #1a0e4a 35%, transparent 70%)",
			}}
		/>
		<div
			className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-20"
			style={{
				background: "radial-gradient(circle, #4f46e5 0%, transparent 70%)",
				filter: "blur(40px)",
			}}
		/>
		<div
			className="absolute top-1/3 -right-20 w-72 h-72 rounded-full opacity-15"
			style={{
				background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)",
				filter: "blur(50px)",
			}}
		/>
	</div>
);

// ─── Local helpers ────────────────────────────────────────────────────────────

type PillTone = "role" | "featured" | "frame";

const PILL_TONE_CLASS: Record<PillTone, string> = {
	role: "bg-gradient-to-r from-pt-blue/25 to-pt-cyan/15 text-white shadow-[inset_0_0_0_1px_rgba(140,180,255,0.55),0_0_14px_rgba(79,124,255,0.35)]",
	featured:
		"bg-gradient-to-r from-pt-purple/30 to-pt-orange/25 text-white shadow-[inset_0_0_0_1px_rgba(220,200,255,0.45),0_0_14px_rgba(162,89,255,0.35)]",
	frame:
		"bg-white/[0.02] text-pt-text-1 shadow-[inset_0_0_0_1px_rgba(184,212,255,0.35)]",
};

const Pill: React.FC<{
	tone: PillTone;
	icon?: ReactNode;
	children: ReactNode;
}> = ({ tone, icon, children }) => (
	<span
		className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-[5px] text-[10px] font-display font-medium uppercase tracking-[0.16em] rounded-full ${PILL_TONE_CLASS[tone]}`}
	>
		{icon && <span className="inline-flex">{icon}</span>}
		{children}
	</span>
);

const SectionHeading: React.FC<{ children: ReactNode }> = ({ children }) => (
	<h2 className="font-display text-[15px] uppercase tracking-[0.18em] text-white relative inline-block pb-1.5">
		{children}
		<span
			aria-hidden
			className="absolute left-0 bottom-0 h-[2px] w-12 rounded-full"
			style={{
				background:
					"linear-gradient(90deg, var(--c-purple), var(--c-cyan) 60%, transparent)",
			}}
		/>
	</h2>
);

const SocialCard: React.FC<{
	icon: ReactNode;
	label: string;
	href: string;
}> = ({ icon, label, href }) => (
	<a
		href={href}
		target="_blank"
		rel="noopener noreferrer"
		className="block transition-transform active:scale-95"
	>
		<GlassCard tone="frame" size="sm" className="!p-2.5">
			<div className="flex flex-col items-center gap-1.5">
				<div className="h-7 flex items-center justify-center">{icon}</div>
				<span className="text-[10px] uppercase tracking-[0.14em] font-display text-pt-text-2">
					{label}
				</span>
			</div>
		</GlassCard>
	</a>
);

const hasSocialLinks = (p: Pick<ProfileData, "linkedin_url" | "twitter_url">) =>
	!!(p.linkedin_url || p.twitter_url);

const SocialInput: React.FC<{
	label: string;
	value: string;
	placeholder?: string;
	onChange?: (v: string) => void;
	type?: string;
	readOnly?: boolean;
}> = ({ label, value, placeholder, onChange, type = "text", readOnly }) => (
	<label className="flex items-center gap-3 bg-white/[0.02] rounded-xl px-3 py-2 shadow-[inset_0_0_0_1px_rgba(184,212,255,0.18)]">
		<span className="text-[10px] uppercase tracking-[0.16em] font-display text-pt-text-3 w-16 shrink-0">
			{label}
		</span>
		<input
			value={value}
			type={type}
			placeholder={placeholder}
			onChange={onChange ? (e) => onChange(e.target.value) : undefined}
			readOnly={readOnly}
			className={`flex-1 bg-transparent text-sm outline-none placeholder-white/20 ${readOnly ? "text-pt-text-3 cursor-not-allowed" : "text-pt-text-1"}`}
		/>
	</label>
);

const LinkedinIcon: React.FC = () => (
	<svg
		viewBox="0 0 24 24"
		width="22"
		height="22"
		fill="#0A66C2"
		aria-hidden
		className="rounded-[4px]"
	>
		<rect width="24" height="24" rx="4" />
		<path
			fill="#fff"
			d="M7.1 9.4h2.6V17H7.1V9.4Zm1.3-3.6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm3.4 3.6h2.5v1h.04c.35-.66 1.2-1.36 2.46-1.36 2.64 0 3.13 1.74 3.13 4V17H17.4v-3.5c0-.84-.02-1.92-1.17-1.92-1.17 0-1.35.92-1.35 1.86V17h-2.5V9.4Z"
		/>
	</svg>
);

const XIcon: React.FC = () => (
	<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden>
		<path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.94l-5.43-6.4L4.4 22H1.14l8.05-9.2L1 2h7.13l4.91 6.05L18.244 2Zm-2.43 18h1.93L7.27 4H5.2l10.62 16Z" />
	</svg>
);

// ─── Bottom navigation bar ────────────────────────────────────────────────────
const BottomNav: React.FC = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { user } = useAuth();
	const unreadDMs = useGlobalUnreadDMs(user?.id ?? null);

	const items: {
		label: string;
		to: string;
		icon: ReactNode;
		isActive: boolean;
		badge?: number;
	}[] = [
		{
			label: "Home",
			to: "/",
			icon: <Home size={20} strokeWidth={1.9} />,
			isActive: location.pathname === "/",
		},
		{
			label: "Messages",
			to: "/messages",
			icon: <MessageCircle size={20} strokeWidth={1.9} />,
			isActive: location.pathname.startsWith("/messages"),
			badge: unreadDMs,
		},
		{
			label: "Profile",
			to: "/profile",
			icon: <UserIcon size={20} strokeWidth={1.9} />,
			isActive: location.pathname.startsWith("/profile"),
		},
		{
			label: "Settings",
			to: "/settings",
			icon: <SettingsIcon size={20} strokeWidth={1.9} />,
			isActive: location.pathname.startsWith("/settings"),
		},
	];

	return (
		<div
			className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-2 rounded-full"
			style={{
				background:
					"linear-gradient(rgba(16,14,35,0.92), rgba(16,14,35,0.92)) padding-box, linear-gradient(140deg, #22d3ee 0%, #6366f1 100%) border-box",
				backdropFilter: "blur(20px)",
				border: "2px solid transparent",
				boxShadow:
					"0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
			}}
		>
			{items.map((item) => (
				<button
					key={item.label}
					type="button"
					onClick={() => navigate(item.to)}
					className={`relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-full transition-all ${
						item.isActive
							? "text-cyan-400"
							: "text-white/40 hover:text-white/70"
					}`}
				>
					{item.badge && item.badge > 0 ? (
						<span
							className="absolute -top-0.5 right-2 min-w-[16px] h-4 rounded-full flex items-center justify-center text-white font-black tabular-nums"
							style={{
								background: "#6366f1",
								fontSize: 9,
								padding: "0 3px",
								boxShadow: "0 0 8px rgba(99,102,241,0.7)",
							}}
						>
							{item.badge > 99 ? "99+" : item.badge}
						</span>
					) : null}
					{item.icon}
					<span className="text-[9px] font-medium">{item.label}</span>
				</button>
			))}
		</div>
	);
};

// ─── Social-media-style profile header ────────────────────────────────────────
const CoverBanner: React.FC<{
	gradient: [string, string];
	onBack: () => void;
	onShare?: () => void;
	shareDisabled?: boolean;
}> = ({ gradient, onBack, onShare, shareDisabled }) => (
	<div
		className="relative -mx-5 h-[160px] overflow-hidden"
		style={{
			background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
		}}
	>
		<div
			aria-hidden
			className="absolute inset-0"
			style={{
				background:
					"radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 35%, transparent 70%)",
			}}
		/>
		<div
			aria-hidden
			className="absolute inset-x-0 bottom-0 h-24"
			style={{
				background:
					"linear-gradient(to bottom, transparent 0%, rgba(6,5,18,0.55) 70%, rgba(6,5,18,0.95) 100%)",
			}}
		/>
		<IridescentArc className="absolute inset-x-0 -bottom-[1px]" />
		<div className="absolute top-4 left-4 right-4 flex items-center justify-between">
			<IconButton
				aria-label="Back"
				icon={<ArrowLeft size={20} />}
				onClick={onBack}
			/>
			{onShare && (
				<IconButton
					aria-label="Share QR"
					icon={<Share2 size={18} />}
					onClick={onShare}
					disabled={shareDisabled}
				/>
			)}
		</div>
	</div>
);

const StatChip: React.FC<{ value: string; label: string }> = ({
	value,
	label,
}) => (
	<div
		className="flex-1 rounded-xl px-2.5 py-2 text-center"
		style={{
			background: "rgba(255,255,255,0.03)",
			border: "1px solid rgba(255,255,255,0.06)",
		}}
	>
		<p className="font-display text-white text-[15px] font-bold leading-tight num truncate">
			{value}
		</p>
		<p className="text-pt-text-3 text-[9px] uppercase tracking-[0.16em] font-display mt-0.5">
			{label}
		</p>
	</div>
);

const handleFromName = (
	first: string,
	last: string,
	emailFallback?: string | null,
): string | null => {
	const f = first.trim().toLowerCase();
	const l = last.trim().toLowerCase();
	if (f || l) return `@${[f, l].filter(Boolean).join(".")}`;
	if (emailFallback) {
		const prefix = emailFallback.split("@")[0];
		if (prefix) return `@${prefix.toLowerCase()}`;
	}
	return null;
};

// ─── Frame layout shared by both views ────────────────────────────────────────
const ProfileFrame: React.FC<{ children: ReactNode }> = ({ children }) => (
	<div className="min-h-screen relative" style={{ background: "var(--c-bg-deep)" }}>
		<BgGlow />
		<div
			className="fixed inset-y-0 left-0 z-[9] pointer-events-none"
			style={{
				width: "calc((100vw - 430px) / 2)",
				background: "rgba(4,3,12,0.92)",
			}}
		/>
		<div
			className="fixed inset-y-0 right-0 z-[9] pointer-events-none"
			style={{
				width: "calc((100vw - 430px) / 2)",
				background: "rgba(4,3,12,0.92)",
			}}
		/>
		<div
			className="relative z-10 xl:max-w-[430px] mx-auto px-5 pt-0 pb-32 min-h-screen"
			style={{
				background: "rgba(6,5,18,0.72)",
				borderLeft: "1px solid rgba(255,255,255,0.08)",
				borderRight: "1px solid rgba(255,255,255,0.08)",
			}}
		>
			{children}
		</div>
		<BottomNav />
	</div>
);

// ─── Public view ──────────────────────────────────────────────────────────────
const PublicProfileView: React.FC<{ founderUserId: string }> = ({
	founderUserId,
}) => {
	const navigate = useNavigate();
	const { user } = useAuth();
	const [profile, setProfile] = useState<ProfileData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [showScanner, setShowScanner] = useState(false);

	const [showDM, setShowDM] = useState(false);
	const [currentUserDisplayName, setCurrentUserDisplayName] = useState("");

	const profileUrl = `${window.location.origin}/profile/${founderUserId}`;
	const isOwnProfile = user?.id === founderUserId;

	useEffect(() => {
		supabase
			.from("users")
			.select(
				"id, first_name, last_name, bio, profile_picture_url, linkedin_url, twitter_url, role, profile_color",
			)
			.eq("auth_user_id", founderUserId)
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
						looking_to_connect: "",
						profile_color: (data.profile_color as GradientPresetKey | null) ?? null,
					});
				}
				setIsLoading(false);
			});
	}, [founderUserId]);

	useEffect(() => {
		if (!user) return;
		supabase
			.from("users")
			.select("first_name, last_name")
			.eq("auth_user_id", user.id)
			.maybeSingle()
			.then(({ data }) => {
				const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ");
				setCurrentUserDisplayName(name || user.email?.split("@")[0] || "Me");
			});
	}, [user]);

	if (isLoading) {
		return (
			<div
				className="min-h-screen flex items-center justify-center"
				style={{ background: "var(--c-bg-deep)" }}
			>
				<div className="w-8 h-8 rounded-full border-2 border-pt-purple border-t-transparent animate-spin" />
			</div>
		);
	}

	if (!profile) {
		return (
			<ProfileFrame>
				<CoverBanner
					gradient={gradientForUser(null, founderUserId)}
					onBack={() => navigate(-1)}
				/>
				<GlassCard tone="frame" size="lg" className="text-center mt-10">
					<p className="font-display text-pt-text-1 font-semibold text-[15px] mb-1">
						No profile yet
					</p>
					<p className="text-pt-text-2 text-sm">
						This user hasn't set up their profile.
					</p>
				</GlassCard>
			</ProfileFrame>
		);
	}

	const fullName =
		`${profile.first_name} ${profile.last_name}`.trim() || "Anonymous";
	const gradient = gradientForUser(profile.profile_color, founderUserId);
	const handle = handleFromName(profile.first_name, profile.last_name);
	const hasSocials = !!(profile.linkedin_url || profile.twitter_url);

	return (
		<>
			<ProfileFrame>
				<CoverBanner
					gradient={gradient}
					onBack={() => navigate(-1)}
					onShare={() => setShowScanner(true)}
				/>

				{/* Avatar overlapping cover + action button */}
				<div className="flex items-end justify-between -mt-12 mb-3 relative z-10">
					<div
						className="rounded-full p-1"
						style={{
							background: "rgba(6,5,18,0.95)",
						}}
					>
						<Avatar
							size="xl"
							photo={profile.profile_picture_url || null}
							name={fullName}
							gradient={gradient}
							className="w-[104px] h-[104px]"
						/>
					</div>
					{user && !isOwnProfile && (
						<button
							onClick={() => setShowDM(true)}
							className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold transition-all active:scale-95 mb-1"
							style={{
								background:
									"linear-gradient(140deg, rgba(34,211,238,0.18), rgba(99,102,241,0.22))",
								border: "1px solid rgba(140,180,255,0.4)",
								color: "#dbe6ff",
								boxShadow:
									"inset 0 1px 0 rgba(255,255,255,0.1), 0 0 14px rgba(99,102,241,0.25)",
							}}
						>
							<MessageCircle size={14} strokeWidth={2.2} />
							Message
						</button>
					)}
				</div>

				{/* Name + handle + role */}
				<div className="mb-4">
					<h1 className="font-display font-bold text-[26px] leading-tight text-white">
						{fullName}
					</h1>
					<div className="flex items-center gap-2 mt-1.5 flex-wrap">
						{handle && (
							<span className="text-pt-text-3 text-[13px] font-medium">
								{handle}
							</span>
						)}
						{handle && profile.role && (
							<span className="text-pt-text-3 text-[10px]">·</span>
						)}
						{profile.role && (
							<Pill
								tone="role"
								icon={<Briefcase size={11} strokeWidth={2.4} />}
							>
								{ROLE_LABELS[profile.role] ?? profile.role}
							</Pill>
						)}
					</div>
				</div>

				{/* Bio */}
				<p className="text-pt-text-2 text-[14px] leading-relaxed mb-4">
					{profile.bio || (
						<span className="text-pt-text-3 italic">No bio yet.</span>
					)}
				</p>

				{/* Social links — inline social-media-style row */}
				{hasSocials && (
					<div className="flex items-center gap-2 mb-5">
						{profile.linkedin_url && (
							<SocialCard
								icon={<LinkedinIcon />}
								label="LinkedIn"
								href={profile.linkedin_url}
							/>
						)}
						{profile.twitter_url && (
							<SocialCard
								icon={<XIcon />}
								label="X"
								href={profile.twitter_url}
							/>
						)}
					</div>
				)}
			</ProfileFrame>
			<ScannerModal
				isOpen={showScanner}
				onClose={() => setShowScanner(false)}
				profileUrl={profileUrl}
				profileName={
					profile
						? `${profile.first_name} ${profile.last_name}`.trim() || undefined
						: undefined
				}
				profileAvatarUrl={profile?.profile_picture_url || undefined}
			/>
			{user && !isOwnProfile && (
				<DMPanel
					isOpen={showDM}
					onClose={() => setShowDM(false)}
					onBack={() => setShowDM(false)}
					userId={user.id}
					displayName={currentUserDisplayName}
					peerId={founderUserId}
					peerName={`${profile.first_name} ${profile.last_name}`.trim() || "User"}
				/>
			)}
		</>
	);
};

// ─── Own profile page ─────────────────────────────────────────────────────────
const ProfilePage: React.FC = () => {
	const navigate = useNavigate();
	const { user, isLoading: authLoading } = useAuth();
	const [searchParams] = useSearchParams();
	const { profileId: profileIdParam } = useParams<{ profileId: string }>();
	const claimId = searchParams.get("id");

	const isLikelyProfileId =
		!!profileIdParam || (!!claimId && /^[0-9a-f-]{36}$/i.test(claimId));
	const resolvedProfileId =
		profileIdParam ?? (isLikelyProfileId ? claimId : null);

	const [isEditing, setIsEditing] = useState(false);
	const [showScanner, setShowScanner] = useState(false);
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
		role: "member",
		looking_to_connect: "",
		profile_color: null,
	});
	const [draft, setDraft] = useState<ProfileData>(profile);
	const [isSaving, setIsSaving] = useState(false);
	const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(
		null,
	);
	const [isLoadingProfile, setIsLoadingProfile] = useState(true);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [avatarError, setAvatarError] = useState<string | null>(null);

	// Load own profile
	useEffect(() => {
		if (!user) return;
		supabase
			.from("users")
			.select(
				"id, first_name, last_name, bio, profile_picture_url, linkedin_url, twitter_url, role, looking_to_connect, profile_color",
			)
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
						looking_to_connect: data.looking_to_connect ?? "",
						profile_color:
							(data.profile_color as GradientPresetKey | null) ?? null,
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
				.select("*, event:events(name)")
				.eq("claim_token", claimId)
				.maybeSingle();

			if (appError || !app) {
				setClaimError("This profile link is invalid or has already been used.");
				setIsProcessingClaim(false);
				return;
			}

			const { data: userRow } = await supabase
				.from("users")
				.select("id")
				.eq("auth_user_id", user.id)
				.maybeSingle();

			const { error: updateError } = await supabase
				.from("applications")
				.update({ claimed_by_user_id: userRow?.id ?? null })
				.eq("claim_token", claimId);

			if (updateError) {
				setClaimError("Failed to link your profile. Please try again.");
				setIsProcessingClaim(false);
				return;
			}

			setApplication(app);
			setClaimed(true);

			if (userRow) {
				await supabase
					.from("pitches")
					.update({ profile_user_id: userRow.id })
					.eq("application_id", app.id)
					.is("profile_user_id", null);
			}

			const questions: {
				id: string;
				question_text: string;
				question_type: string;
			}[] = app.questions ?? [];
			const answers: Record<string, string> = app.answers ?? {};

			const findAnswer = (keywords: string[]) => {
				const q = questions.find((q) =>
					keywords.some((kw) => q.question_text.toLowerCase().includes(kw)),
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
		(async () => {
			const { data: userRow } = await supabase
				.from("users")
				.select("id")
				.eq("auth_user_id", user.id)
				.maybeSingle();
			if (!userRow) return;
			const { data } = await supabase
				.from("applications")
				.select("*, event:events(name, registration_questions)")
				.eq("claimed_by_user_id", userRow.id)
				.order("submitted_at", { ascending: false })
				.limit(1)
				.maybeSingle();
			if (data) setApplication(data);
		})();
	}, [user, claimId, application]);

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !user) return;
		setAvatarError(null);
		if (!file.type.startsWith("image/")) {
			setAvatarError("Please select an image file.");
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			setAvatarError("Image must be under 5 MB.");
			return;
		}
		setIsUploadingAvatar(true);
		const ext = file.name.split(".").pop();
		const path = `${user.id}/avatar.${ext}`;
		const { error: uploadError } = await supabase.storage
			.from("avatars")
			.upload(path, file, { upsert: true });
		if (uploadError) {
			setAvatarError("Upload failed. Please try again.");
			setIsUploadingAvatar(false);
			return;
		}
		const { data } = supabase.storage.from("avatars").getPublicUrl(path);
		const url = `${data.publicUrl}?t=${Date.now()}`;
		setDraft((d) => ({ ...d, profile_picture_url: url }));
		setIsUploadingAvatar(false);
	};

	const handleSave = async () => {
		if (!user) return;
		setIsSaving(true);
		setSaveMsg(null);

		const { data: upsertedUser, error } = await supabase
			.from("users")
			.upsert(
				{
					auth_user_id: user.id,
					email: user.email ?? "",
					first_name: draft.first_name,
					last_name: draft.last_name,
					bio: draft.bio || null,
					profile_picture_url: draft.profile_picture_url || null,
					linkedin_url: draft.linkedin_url || null,
					twitter_url: draft.twitter_url || null,
					role: draft.role || "member",
					looking_to_connect: draft.looking_to_connect || null,
					profile_color: draft.profile_color || null,
				},
				{ onConflict: "auth_user_id" },
			)
			.select("id")
			.maybeSingle();

		if (error) {
			setSaveMsg({ ok: false, text: "Failed to save. Please try again." });
		} else {
			const fullName = `${draft.first_name} ${draft.last_name}`.trim();
			const userId = upsertedUser?.id ?? profile.id;
			if (fullName && userId) {
				await supabase
					.from("investors")
					.update({ name: fullName })
					.eq("profile_user_id", userId);
			}
			setProfile(draft);
			setSaveMsg({ ok: true, text: "Profile saved!" });
			setTimeout(() => {
				setSaveMsg(null);
				setIsEditing(false);
			}, 1200);
		}
		setIsSaving(false);
	};

	const profileUrl = user
		? `${window.location.origin}/profile/${user.id}`
		: null;

	if (authLoading) {
		return (
			<div
				className="min-h-screen flex items-center justify-center"
				style={{ background: "var(--c-bg-deep)" }}
			>
				<div className="w-8 h-8 rounded-full border-2 border-pt-purple border-t-transparent animate-spin" />
			</div>
		);
	}

	if (isLikelyProfileId && resolvedProfileId) {
		return <PublicProfileView founderUserId={resolvedProfileId} />;
	}

	if (!user) {
		return (
			<Navigate to={claimId ? `/login?id=${claimId}` : "/login"} replace />
		);
	}

	const value = isEditing ? draft : profile;
	const fullName =
		`${value.first_name} ${value.last_name}`.trim() || "Your Name";
	const gradient = gradientForUser(value.profile_color, user.id);

	const statusToneClass: Record<string, string> = {
		pending:
			"text-yellow-300 border-yellow-700/60 bg-yellow-500/10",
		approved: "text-green-300 border-green-700/60 bg-green-500/10",
		rejected: "text-red-300 border-red-700/60 bg-red-500/10",
	};

	const handle = handleFromName(value.first_name, value.last_name, user.email);
	const appliedCount = application ? 1 : 0;

	return (
		<>
			<ProfileFrame>
				<CoverBanner
					gradient={gradient}
					onBack={() => navigate(-1)}
					onShare={() => setShowScanner(true)}
					shareDisabled={!profileUrl}
				/>

				{/* Avatar overlap + edit-action button */}
				<div className="flex items-end justify-between -mt-12 mb-3 relative z-10">
					{isEditing ? (
						<label className="cursor-pointer rounded-full p-1 block" style={{ background: "rgba(6,5,18,0.95)" }}>
							<input
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handleAvatarUpload}
								disabled={isUploadingAvatar}
							/>
							<div className="relative">
								<Avatar
									size="xl"
									photo={
										isUploadingAvatar
											? null
											: draft.profile_picture_url || null
									}
									name={fullName}
									gradient={gradient}
									className="w-[104px] h-[104px]"
								/>
								<span
									className="absolute inset-0 rounded-full flex items-center justify-center text-[9px] uppercase tracking-[0.18em] font-display text-white text-center px-2"
									style={{ background: "rgba(0,0,0,0.45)" }}
								>
									{isUploadingAvatar ? "Uploading…" : "Tap to change"}
								</span>
							</div>
						</label>
					) : (
						<div className="rounded-full p-1" style={{ background: "rgba(6,5,18,0.95)" }}>
							<Avatar
								size="xl"
								photo={profile.profile_picture_url || null}
								name={fullName}
								gradient={gradient}
								className="w-[104px] h-[104px]"
							/>
						</div>
					)}

					<div className="flex items-center gap-2 mb-1">
						{!isEditing ? (
							<button
								onClick={() => {
									setDraft(profile);
									setIsEditing(true);
								}}
								className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold transition-all active:scale-95"
								style={{
									background:
										"linear-gradient(140deg, rgba(34,211,238,0.18), rgba(99,102,241,0.22))",
									border: "1px solid rgba(140,180,255,0.4)",
									color: "#dbe6ff",
									boxShadow:
										"inset 0 1px 0 rgba(255,255,255,0.1), 0 0 14px rgba(99,102,241,0.25)",
								}}
							>
								<Pencil size={14} strokeWidth={2.2} />
								Edit profile
							</button>
						) : (
							<button
								onClick={() => {
									setDraft(profile);
									setIsEditing(false);
									setAvatarError(null);
								}}
								disabled={isSaving}
								className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold transition-all active:scale-95 disabled:opacity-50"
								style={{
									background: "rgba(255,255,255,0.04)",
									border: "1px solid rgba(255,255,255,0.12)",
									color: "rgba(255,255,255,0.75)",
								}}
							>
								<XIconLucide size={14} strokeWidth={2.2} />
								Cancel
							</button>
						)}
					</div>
				</div>

				{avatarError && (
					<p className="text-red-400 text-xs mt-1 mb-2">{avatarError}</p>
				)}

				{/* Banners */}
				{claimed && (
					<div
						className="mb-3 rounded-2xl px-4 py-3 text-sm text-green-300"
						style={{
							background: "rgba(34,197,94,0.08)",
							border: "1px solid rgba(34,197,94,0.25)",
						}}
					>
						Profile linked! Application answers have been pre-filled where
						possible.
					</div>
				)}
				{claimError && (
					<div
						className="mb-3 rounded-2xl px-4 py-3 text-sm text-red-300"
						style={{
							background: "rgba(239,68,68,0.08)",
							border: "1px solid rgba(239,68,68,0.25)",
						}}
					>
						{claimError}
					</div>
				)}

				{isLoadingProfile ? (
					<div className="flex items-center justify-center py-20">
						<div className="w-8 h-8 rounded-full border-2 border-pt-purple border-t-transparent animate-spin" />
					</div>
				) : (
					<>
						{/* Name + handle + role */}
						<div className="mb-3">
							{isEditing ? (
								<div className="grid grid-cols-2 gap-2 mb-2">
									<input
										value={draft.first_name}
										placeholder="First name"
										onChange={(e) =>
											setDraft((d) => ({ ...d, first_name: e.target.value }))
										}
										className="bg-transparent font-display font-bold text-[22px] leading-tight text-white outline-none border-b border-white/20 pb-1 placeholder-white/20"
									/>
									<input
										value={draft.last_name}
										placeholder="Last name"
										onChange={(e) =>
											setDraft((d) => ({ ...d, last_name: e.target.value }))
										}
										className="bg-transparent font-display font-bold text-[22px] leading-tight text-white outline-none border-b border-white/20 pb-1 placeholder-white/20"
									/>
								</div>
							) : (
								<h1 className="font-display font-bold text-[26px] leading-tight text-white">
									{fullName}
								</h1>
							)}

							<div className="flex items-center gap-2 mt-1.5 flex-wrap">
								{handle && (
									<span className="text-pt-text-3 text-[13px] font-medium">
										{handle}
									</span>
								)}
								{!isEditing && handle && value.role && (
									<span className="text-pt-text-3 text-[10px]">·</span>
								)}
								{!isEditing && value.role && (
									<Pill
										tone="role"
										icon={<Briefcase size={11} strokeWidth={2.4} />}
									>
										{ROLE_LABELS[value.role] ?? value.role}
									</Pill>
								)}
							</div>

							{isEditing && (
								<div className="flex gap-2 mt-3 flex-wrap">
									{(["member", "pitcher", "sponsor", "judge"] as const).map(
										(r) => (
											<button
												key={r}
												type="button"
												onClick={() => setDraft((d) => ({ ...d, role: r }))}
												className={`px-3 py-[5px] text-[10px] font-display font-medium uppercase tracking-[0.16em] rounded-full transition-all ${
													draft.role === r
														? "bg-gradient-to-r from-pt-purple/30 to-pt-orange/25 text-white shadow-[inset_0_0_0_1px_rgba(220,200,255,0.45)]"
														: "bg-white/[0.02] text-pt-text-3 shadow-[inset_0_0_0_1px_rgba(184,212,255,0.18)]"
												}`}
											>
												{ROLE_LABELS[r]}
											</button>
										),
									)}
								</div>
							)}
						</div>

						{/* Profile color picker — edit-only */}
						{isEditing && (
							<div className="mb-4">
								<p className="text-[10px] uppercase tracking-[0.16em] font-display text-pt-text-3 mb-2">
									Profile color
								</p>
								<div className="flex items-center gap-2 flex-wrap">
									<button
										type="button"
										aria-label="Default color"
										title="Default"
										onClick={() =>
											setDraft((d) => ({ ...d, profile_color: null }))
										}
										className={`w-7 h-7 rounded-full transition-all flex items-center justify-center ${
											draft.profile_color === null
												? "ring-2 ring-white/80 ring-offset-2 ring-offset-[#0a0820]"
												: "ring-1 ring-white/20 hover:ring-white/40"
										}`}
										style={{
											background:
												`linear-gradient(135deg, ${DEFAULT_USER_GRADIENT[0]} 0%, ${DEFAULT_USER_GRADIENT[1]} 100%)`,
										}}
									>
										{draft.profile_color === null && (
											<Check
												size={12}
												strokeWidth={3}
												className="text-white drop-shadow"
											/>
										)}
									</button>
									{GRADIENT_PRESET_KEYS.map((key) => {
										const [from, to] = GRADIENT_PRESETS[key];
										const selected = draft.profile_color === key;
										return (
											<button
												key={key}
												type="button"
												aria-label={key}
												title={key}
												onClick={() =>
													setDraft((d) => ({ ...d, profile_color: key }))
												}
												className={`w-7 h-7 rounded-full transition-all flex items-center justify-center ${
													selected
														? "ring-2 ring-white/80 ring-offset-2 ring-offset-[#0a0820]"
														: "ring-1 ring-white/20 hover:ring-white/40"
												}`}
												style={{
													background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
												}}
											>
												{selected && (
													<Check
														size={12}
														strokeWidth={3}
														className="text-white drop-shadow"
													/>
												)}
											</button>
										);
									})}
								</div>
							</div>
						)}

						{/* Bio */}
						{isEditing ? (
							<textarea
								value={draft.bio}
								onChange={(e) =>
									setDraft((d) => ({ ...d, bio: e.target.value }))
								}
								rows={3}
								placeholder="Tell people about yourself..."
								className="w-full bg-transparent text-pt-text-2 text-[14px] leading-relaxed outline-none border border-white/10 rounded-xl p-3 mb-4 resize-none placeholder-white/20"
							/>
						) : (
							<p className="text-pt-text-2 text-[14px] leading-relaxed mb-4">
								{profile.bio || (
									<span className="text-pt-text-3 italic">No bio yet.</span>
								)}
							</p>
						)}

						{/* Stats strip */}
						{!isEditing && (
							<div className="flex items-stretch gap-2 mb-4">
								<StatChip
									value={String(appliedCount)}
									label={appliedCount === 1 ? "Application" : "Applications"}
								/>
								<StatChip
									value={value.role ? ROLE_LABELS[value.role] ?? "Member" : "Member"}
									label="Role"
								/>
								<StatChip
									value={
										hasSocialLinks(profile) ? "Linked" : "—"
									}
									label="Socials"
								/>
							</div>
						)}

						{/* Socials — view: inline icons; edit: input list */}
						{isEditing ? (
							<div className="flex flex-col gap-2.5 mb-4">
								<SocialInput
									label="LinkedIn"
									type="url"
									placeholder="https://linkedin.com/in/..."
									value={draft.linkedin_url}
									onChange={(v) =>
										setDraft((d) => ({ ...d, linkedin_url: v }))
									}
								/>
								<SocialInput
									label="X"
									type="url"
									placeholder="https://x.com/..."
									value={draft.twitter_url}
									onChange={(v) =>
										setDraft((d) => ({ ...d, twitter_url: v }))
									}
								/>
								<SocialInput
									label="Email"
									type="email"
									value={user.email ?? ""}
									readOnly
								/>
							</div>
						) : (
							(profile.linkedin_url || profile.twitter_url || user.email) && (
								<div className="flex items-center gap-2 mb-4">
									{profile.linkedin_url && (
										<SocialCard
											icon={<LinkedinIcon />}
											label="LinkedIn"
											href={profile.linkedin_url}
										/>
									)}
									{profile.twitter_url && (
										<SocialCard
											icon={<XIcon />}
											label="X"
											href={profile.twitter_url}
										/>
									)}
									{user.email && (
										<SocialCard
											icon={
												<Mail
													size={22}
													strokeWidth={1.8}
													className="text-pt-orange"
												/>
											}
											label="Email"
											href={`mailto:${user.email}`}
										/>
									)}
								</div>
							)
						)}

						{/* "Looking to connect" — edit-only */}
						{isEditing && (
							<GlassCard tone="frame" size="md" className="mb-4">
								<SectionHeading>Looking to connect with</SectionHeading>
								<p className="text-pt-text-3 text-[11px] mt-2 mb-2">
									Private — only used to recommend relevant people.
								</p>
								<textarea
									value={draft.looking_to_connect}
									onChange={(e) =>
										setDraft((d) => ({
											...d,
											looking_to_connect: e.target.value,
										}))
									}
									rows={3}
									placeholder="e.g. investors interested in B2B SaaS, other founders working on climate tech..."
									className="w-full bg-transparent text-pt-text-2 text-[14px] leading-relaxed outline-none border border-white/10 rounded-xl p-3 resize-none placeholder-white/20"
								/>
							</GlassCard>
						)}

						{/* Save status */}
						{saveMsg && (
							<p
								className={`text-sm font-medium mb-3 text-center ${saveMsg.ok ? "text-green-400" : "text-red-400"}`}
							>
								{saveMsg.text}
							</p>
						)}

						{/* Primary actions */}
						{isEditing ? (
							<PtButton
								variant="primary"
								size="lg"
								className="w-full"
								onClick={handleSave}
								disabled={isSaving}
								loading={isSaving}
								loadingText={
									<>
										<Check size={16} strokeWidth={2} />
										Saving…
									</>
								}
							>
								<Check size={16} strokeWidth={2} />
								Save profile
							</PtButton>
						) : (
							<PtButton
								variant="primary"
								size="lg"
								className="w-full"
								onClick={() => setShowScanner(true)}
								disabled={!profileUrl}
							>
								<Share2 size={16} strokeWidth={1.8} />
								Share QR Code
							</PtButton>
						)}

						{/* Application card */}
						{!isEditing && application && (
							<div className="mt-4">
								<GlassCard tone="frame" size="md">
									<div className="flex items-center justify-between mb-3">
										<div>
											<p className="font-display text-[10px] uppercase tracking-[0.18em] text-pt-text-3 mb-0.5">
												Application
											</p>
											{application.event?.name && (
												<p className="text-white text-sm font-semibold">
													{application.event.name}
												</p>
											)}
										</div>
										<span
											className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusToneClass[application.status] ?? "text-white/40 border-white/10 bg-white/5"}`}
										>
											{application.status.charAt(0).toUpperCase() +
												application.status.slice(1)}
										</span>
									</div>
									<div className="space-y-3">
										{(application.questions ?? []).map((q) => {
											const answer = application.answers[q.id];
											if (!answer) return null;
											return (
												<div key={q.id}>
													<p className="text-pt-text-3 text-[10px] font-display uppercase tracking-[0.16em] mb-1">
														{q.question_text}
													</p>
													{q.question_type === "image" ? (
														<img
															src={answer}
															alt={q.question_text}
															className="max-h-40 rounded-xl border border-white/10 object-contain"
														/>
													) : q.question_type === "url" ||
													  q.question_type === "website_url" ? (
														<a
															href={answer}
															target="_blank"
															rel="noopener noreferrer"
															className="text-pt-cyan hover:underline text-sm break-all"
														>
															{answer}
														</a>
													) : (
														<p className="text-pt-text-2 text-sm leading-relaxed">
															{answer}
														</p>
													)}
												</div>
											);
										})}
										{(application.questions ?? []).length === 0 && (
											<p className="text-pt-text-3 text-sm">
												Application answers not available.
											</p>
										)}
									</div>
								</GlassCard>
							</div>
						)}

						{/* Empty-state hint when no profile data set */}
						{!isEditing &&
							!profile.first_name &&
							!profile.last_name &&
							!profile.bio && (
								<div className="mt-4 text-center py-6">
									<Sparkles
										size={20}
										className="mx-auto mb-2 text-pt-purple"
									/>
									<p className="text-pt-text-3 text-sm">
										Your profile is empty. Tap{" "}
										<span className="text-white font-semibold">
											Edit profile
										</span>{" "}
										to set it up.
									</p>
								</div>
							)}
					</>
				)}
			</ProfileFrame>
			<ScannerModal
				isOpen={showScanner}
				onClose={() => setShowScanner(false)}
				profileUrl={profileUrl ?? ""}
				profileName={
					profile.first_name || profile.last_name
						? `${profile.first_name} ${profile.last_name}`.trim()
						: undefined
				}
				profileAvatarUrl={profile.profile_picture_url || undefined}
			/>
		</>
	);
};

export default ProfilePage;
