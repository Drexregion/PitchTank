import React, { useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../lib/supabaseClient";

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

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  userEmail: string | null;
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

export const ProfilePanel: React.FC<ProfilePanelProps> = ({
  isOpen,
  onClose,
  userId,
  userEmail,
}) => {
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<"view" | "edit" | "qr">("view");

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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => setVisible(true));
    else setVisible(false);
  }, [isOpen]);

  // Fetch profile on open
  useEffect(() => {
    if (!isOpen || !userId) return;
    setIsLoading(true);
    supabase
      .from("founder_users")
      .select("id, first_name, last_name, bio, profile_picture_url, linkedin_url, twitter_url, role")
      .eq("auth_user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const p: ProfileData = {
          id: data?.id ?? "",
          first_name: data?.first_name ?? "",
          last_name: data?.last_name ?? "",
          bio: data?.bio ?? "",
          profile_picture_url: data?.profile_picture_url ?? "",
          linkedin_url: data?.linkedin_url ?? "",
          twitter_url: data?.twitter_url ?? "",
          role: (data?.role as ProfileData["role"]) ?? "",
        };
        setProfile(p);
        setDraft(p);
        setIsLoading(false);
      });
  }, [isOpen, userId]);

  const profileUrl = profile.id
    ? `${window.location.origin}/profile?id=${profile.id}`
    : `${window.location.origin}/profile`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setIsSaving(true);
    setSaveMsg(null);

    const { error } = await supabase.from("founder_users").upsert(
      {
        auth_user_id: userId,
        email: userEmail ?? "",
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

  const initials =
    profile.first_name || profile.last_name
      ? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase()
      : (userEmail ?? "?").charAt(0).toUpperCase();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s" }}
      />
      <div
        className="relative w-full max-w-lg rounded-t-3xl overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(180deg, #13102e 0%, #0d0b22 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
          maxHeight: "92vh",
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
        <div className="px-6 pt-2 pb-3 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-0.5">
              Account
            </p>
            <h2 className="text-xl font-black text-white">My Profile</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Share / QR button */}
            <button
              onClick={() => setTab("qr")}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: tab === "qr" ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.06)",
                border: tab === "qr" ? "1px solid rgba(34,211,238,0.5)" : "1px solid rgba(255,255,255,0.1)",
              }}
              title="Share QR"
            >
              <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            {/* Close */}
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
        </div>

        {/* Tab bar */}
        <div className="px-6 pb-3 flex gap-2 flex-shrink-0">
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

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-10">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              {/* VIEW TAB */}
              {tab === "view" && (
                <div className="space-y-5">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-4 pt-1">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/15 flex-shrink-0 shadow-lg shadow-violet-500/20">
                      {profile.profile_picture_url ? (
                        <img
                          src={profile.profile_picture_url}
                          alt={profile.first_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white font-black text-2xl">
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-black text-xl leading-tight">
                        {profile.first_name || profile.last_name
                          ? `${profile.first_name} ${profile.last_name}`.trim()
                          : "Your Name"}
                      </h3>
                      <p className="text-white/40 text-sm mt-0.5 truncate">{userEmail}</p>
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
                          {/* LinkedIn icon */}
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
                          {/* X/Twitter icon */}
                          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
                          </svg>
                          <span className="truncate">{profile.twitter_url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Edit CTA when nothing is filled */}
                  {!profile.first_name && !profile.last_name && !profile.bio && (
                    <div className="text-center py-6">
                      <p className="text-white/30 text-sm mb-3">Your profile is empty.</p>
                      <button
                        onClick={() => setTab("edit")}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all"
                        style={{ background: "linear-gradient(135deg, #22d3ee, #6366f1)", boxShadow: "0 0 16px rgba(34,211,238,0.25)" }}
                      >
                        Set up profile
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* EDIT TAB */}
              {tab === "edit" && (
                <form onSubmit={handleSave} className="space-y-4 pt-1">
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
                        className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
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
                          className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none"
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
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
                    <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                      Bio
                    </label>
                    <textarea
                      value={draft.bio}
                      onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                      rows={3}
                      placeholder="Tell people about yourself..."
                      className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none resize-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
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
                      className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                    />
                  </div>

                  {/* X / Twitter */}
                  <div>
                    <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                      X (Twitter) URL
                    </label>
                    <input
                      type="url"
                      value={draft.twitter_url}
                      onChange={(e) => setDraft((d) => ({ ...d, twitter_url: e.target.value }))}
                      placeholder="https://x.com/..."
                      className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
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

              {/* QR TAB */}
              {tab === "qr" && (
                <div className="flex flex-col items-center gap-5 pt-2 pb-6">
                  {/* Profile preview strip */}
                  <div className="w-full flex items-center gap-3 rounded-2xl px-4 py-3"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
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
                      <p className="text-white/40 text-xs">{userEmail}</p>
                    </div>
                  </div>

                  {/* QR */}
                  <div className="rounded-2xl p-4"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="rounded-xl overflow-hidden bg-white p-3">
                      <QRCodeCanvas id="profile-qr-canvas" value={profileUrl} size={200} level="H" includeMargin={false} />
                    </div>
                    <p className="text-white/30 text-[10px] text-center mt-2 font-medium">Scan to view profile</p>
                  </div>

                  {/* URL copy row */}
                  <div className="w-full flex items-center gap-2 rounded-2xl px-4 py-3"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="flex-1 text-white/50 text-xs truncate">{profileUrl}</p>
                    <button
                      onClick={handleCopy}
                      className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                      style={copied
                        ? { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#86efac" }
                        : { background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)", color: "#67e8f9" }}
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
    </div>
  );
};
