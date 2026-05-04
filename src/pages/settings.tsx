import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";

const BgGlow: React.FC = () => (
	<div className="fixed inset-0 pointer-events-none overflow-hidden">
		<div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[60vh] rounded-full opacity-60"
			style={{ background: "radial-gradient(ellipse at center, #2d1b69 0%, #1a0e4a 35%, transparent 70%)" }} />
		<div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-20"
			style={{ background: "radial-gradient(circle, #4f46e5 0%, transparent 70%)", filter: "blur(40px)" }} />
		<div className="absolute top-1/3 -right-20 w-72 h-72 rounded-full opacity-15"
			style={{ background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)", filter: "blur(50px)" }} />
	</div>
);

type Sheet = "email" | "password" | "delete" | null;
type Msg = { ok: boolean; text: string };

const inputClass = "w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none transition-colors";
const inputStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" };

// ── Bottom sheet wrapper ──────────────────────────────────────────────────────
const Sheet: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ open, onClose, title, children }) => {
	const [visible, setVisible] = useState(false);
	React.useEffect(() => {
		if (open) requestAnimationFrame(() => setVisible(true));
		else setVisible(false);
	}, [open]);
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
			<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" style={{ opacity: visible ? 1 : 0, transition: "opacity 0.25s" }} />
			<div
				className="relative w-full xl:max-w-[430px] rounded-t-3xl overflow-hidden"
				style={{
					background: "linear-gradient(180deg, #13102e 0%, #0d0b22 100%)",
					border: "1px solid rgba(255,255,255,0.08)",
					borderBottom: "none",
					transform: visible ? "translateY(0)" : "translateY(100%)",
					transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex justify-center pt-3 pb-1">
					<div className="w-10 h-1 rounded-full bg-white/15" />
				</div>
				<div className="px-5 pt-2 pb-4 flex items-center justify-between">
					<h2 className="text-lg font-black text-white">{title}</h2>
					<button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
						<svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div className="px-5 pb-10">{children}</div>
			</div>
		</div>
	);
};

// ── Row component ─────────────────────────────────────────────────────────────
const Row: React.FC<{
	icon: React.ReactNode;
	iconBg: string;
	label: string;
	value?: string;
	chevron?: boolean;
	destructive?: boolean;
	onClick?: () => void;
}> = ({ icon, iconBg, label, value, chevron = true, destructive, onClick }) => (
	<button
		onClick={onClick}
		className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] active:bg-white/[0.06] text-left"
	>
		<div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
			{icon}
		</div>
		<div className="flex-1 min-w-0">
			<p className={`text-sm font-semibold ${destructive ? "text-red-400" : "text-white"}`}>{label}</p>
			{value && <p className="text-xs text-white/35 mt-0.5 truncate">{value}</p>}
		</div>
		{chevron && (
			<svg className="w-4 h-4 text-white/20 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
			</svg>
		)}
	</button>
);

const Divider = () => <div className="mx-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} />;

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2 px-1">{children}</p>
);

// ── Page ──────────────────────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
	const navigate = useNavigate();
	const { user, signOut, isLoading: authLoading } = useAuth();
	const [sheet, setSheet] = useState<Sheet>(null);
	const close = () => setSheet(null);

	// Email state
	const [newEmail, setNewEmail] = useState("");
	const [emailMsg, setEmailMsg] = useState<Msg | null>(null);
	const [isSavingEmail, setIsSavingEmail] = useState(false);

	// Password state
	const [currentPw, setCurrentPw] = useState("");
	const [newPw, setNewPw] = useState("");
	const [confirmPw, setConfirmPw] = useState("");
	const [passwordMsg, setPasswordMsg] = useState<Msg | null>(null);
	const [isSavingPw, setIsSavingPw] = useState(false);

	// Delete state
	const [deleteText, setDeleteText] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteMsg, setDeleteMsg] = useState<Msg | null>(null);

	if (authLoading) return (
		<div className="min-h-screen flex items-center justify-center" style={{ background: "#080a14" }}>
			<div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
		</div>
	);
	if (!user) return <Navigate to="/login" replace />;

	const handleEmailSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newEmail.trim()) return;
		setIsSavingEmail(true);
		setEmailMsg(null);
		const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
		if (error) {
			setEmailMsg({ ok: false, text: error.message });
		} else {
			setEmailMsg({ ok: true, text: "Confirmation sent to your new address." });
			setNewEmail("");
		}
		setIsSavingEmail(false);
	};

	const handlePasswordSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (newPw !== confirmPw) { setPasswordMsg({ ok: false, text: "Passwords don't match." }); return; }
		if (newPw.length < 8) { setPasswordMsg({ ok: false, text: "Must be at least 8 characters." }); return; }
		setIsSavingPw(true);
		setPasswordMsg(null);
		const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email ?? "", password: currentPw });
		if (signInError) { setPasswordMsg({ ok: false, text: "Current password is incorrect." }); setIsSavingPw(false); return; }
		const { error } = await supabase.auth.updateUser({ password: newPw });
		if (error) {
			setPasswordMsg({ ok: false, text: error.message });
		} else {
			setPasswordMsg({ ok: true, text: "Password updated." });
			setCurrentPw(""); setNewPw(""); setConfirmPw("");
		}
		setIsSavingPw(false);
	};

	const handleDelete = async () => {
		if (deleteText !== "DELETE") return;
		setIsDeleting(true);
		const { error } = await supabase.functions.invoke("delete-account");
		if (error) { setDeleteMsg({ ok: false, text: "Failed. Please contact support." }); setIsDeleting(false); return; }
		await signOut();
		navigate("/login");
	};

	const sectionStyle = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" };

	return (
		<div className="min-h-screen relative" style={{ background: "#080a14" }}>
			<BgGlow />
			<div className="fixed inset-y-0 left-0 z-[9] pointer-events-none" style={{ width: "calc((100vw - 430px) / 2)", background: "rgba(4,3,12,0.92)" }} />
			<div className="fixed inset-y-0 right-0 z-[9] pointer-events-none" style={{ width: "calc((100vw - 430px) / 2)", background: "rgba(4,3,12,0.92)" }} />

			<div className="relative z-10 xl:max-w-[430px] mx-auto px-5 pt-8 pb-24 min-h-screen"
				style={{ background: "rgba(6,5,18,0.72)", borderLeft: "1px solid rgba(255,255,255,0.08)", borderRight: "1px solid rgba(255,255,255,0.08)" }}>

				{/* Header */}
				<div className="flex items-center gap-3 mb-8">
					<button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-white/5"
						style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
						<svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
					</button>
					<div>
						<p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest">Account</p>
						<h1 className="text-xl font-black text-white leading-tight">Settings</h1>
					</div>
				</div>

				{/* Account info pill */}
				<div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 mb-6"
					style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}>
					<div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-white flex-shrink-0"
						style={{ background: "linear-gradient(135deg, #7c3aed 0%, #22d3ee 100%)" }}>
						{(user.email ?? "?").charAt(0).toUpperCase()}
					</div>
					<div className="min-w-0">
						<p className="text-white font-semibold text-sm truncate">{user.email}</p>
						<p className="text-white/35 text-xs">Signed in</p>
					</div>
				</div>

				<div className="space-y-6">
					{/* Login & Security */}
					<div>
						<SectionLabel>Login &amp; Security</SectionLabel>
						<div className="rounded-2xl overflow-hidden" style={sectionStyle}>
							<Row
								icon={<svg className="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
								iconBg="rgba(34,211,238,0.15)"
								label="Email address"
								value={user.email}
								onClick={() => { setEmailMsg(null); setSheet("email"); }}
							/>
							<Divider />
							<Row
								icon={<svg className="w-4 h-4 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
								iconBg="rgba(139,92,246,0.15)"
								label="Password"
								value="Change your password"
								onClick={() => { setPasswordMsg(null); setSheet("password"); }}
							/>
						</div>
					</div>

					{/* Danger zone */}
					<div>
						<SectionLabel>Danger zone</SectionLabel>
						<div className="rounded-2xl overflow-hidden" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}>
							<Row
								icon={<svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
								iconBg="rgba(239,68,68,0.12)"
								label="Delete account"
								value="Permanently remove your account"
								destructive
								onClick={() => { setDeleteMsg(null); setDeleteText(""); setSheet("delete"); }}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* ── Email sheet ── */}
			<Sheet open={sheet === "email"} onClose={close} title="Change email">
				<form onSubmit={handleEmailSave} className="space-y-3">
					<div>
						<label className="block text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">New email address</label>
						<input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
							placeholder="you@example.com" className={inputClass} style={inputStyle} autoFocus />
					</div>
					{emailMsg && <p className={`text-xs font-medium ${emailMsg.ok ? "text-green-400" : "text-red-400"}`}>{emailMsg.text}</p>}
					<button type="submit" disabled={isSavingEmail || !newEmail.trim()}
						className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40 mt-1"
						style={{ background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)" }}>
						{isSavingEmail ? "Sending confirmation..." : "Send confirmation email"}
					</button>
				</form>
			</Sheet>

			{/* ── Password sheet ── */}
			<Sheet open={sheet === "password"} onClose={close} title="Change password">
				<form onSubmit={handlePasswordSave} className="space-y-3">
					{[
						{ label: "Current password", value: currentPw, set: setCurrentPw, placeholder: "••••••••" },
						{ label: "New password", value: newPw, set: setNewPw, placeholder: "At least 8 characters" },
						{ label: "Confirm new password", value: confirmPw, set: setConfirmPw, placeholder: "Repeat new password" },
					].map(({ label, value, set, placeholder }) => (
						<div key={label}>
							<label className="block text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">{label}</label>
							<input type="password" value={value} onChange={(e) => set(e.target.value)}
								placeholder={placeholder} className={inputClass} style={inputStyle} />
						</div>
					))}
					{passwordMsg && <p className={`text-xs font-medium ${passwordMsg.ok ? "text-green-400" : "text-red-400"}`}>{passwordMsg.text}</p>}
					<button type="submit" disabled={isSavingPw || !currentPw || !newPw || !confirmPw}
						className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40 mt-1"
						style={{ background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)" }}>
						{isSavingPw ? "Updating..." : "Update password"}
					</button>
				</form>
			</Sheet>

			{/* ── Delete sheet ── */}
			<Sheet open={sheet === "delete"} onClose={close} title="Delete account">
				<div className="space-y-4">
					<div className="rounded-xl px-4 py-3.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
						<p className="text-red-300 text-sm font-semibold mb-1">This cannot be undone</p>
						<p className="text-white/40 text-xs leading-relaxed">Your account, profile, and all associated data will be permanently deleted.</p>
					</div>
					<div>
						<label className="block text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">
							Type <span className="text-red-400 font-mono">DELETE</span> to confirm
						</label>
						<input type="text" value={deleteText} onChange={(e) => setDeleteText(e.target.value)}
							placeholder="DELETE" className={inputClass}
							style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }} />
					</div>
					{deleteMsg && <p className="text-xs font-medium text-red-400">{deleteMsg.text}</p>}
					<button onClick={handleDelete} disabled={isDeleting || deleteText !== "DELETE"}
						className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40"
						style={{ background: "rgba(239,68,68,0.8)" }}>
						{isDeleting ? "Deleting..." : "Delete my account"}
					</button>
				</div>
			</Sheet>
		</div>
	);
};

export default SettingsPage;
