import React, { useState, useEffect } from "react";

export type FontSize = "sm" | "md" | "lg";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
  onSignIn: () => void;
  onEditProfile: () => void;
  isSignedIn: boolean;
  isAdmin: boolean;
  onOpenAdminAnalytics: () => void;
}

const FONT_SIZE_LABELS: Record<FontSize, string> = { sm: "Small", md: "Medium", lg: "Large" };

const LS_FONT = "pt_font_size";
const LS_THEME = "pt_theme";

type Theme = "dark" | "midnight" | "space";

function applyFont(size: FontSize) {
  const map: Record<FontSize, string> = { sm: "14px", md: "16px", lg: "18px" };
  document.documentElement.style.setProperty("--app-font-size", map[size]);
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
}

export function useAppSettings() {
  const [fontSize, setFontSizeState] = useState<FontSize>(
    () => (localStorage.getItem(LS_FONT) as FontSize) ?? "md"
  );
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(LS_THEME) as Theme) ?? "midnight"
  );

  // Sync to DOM on mount (covers case where panel hasn't opened yet)
  useEffect(() => {
    applyFont(fontSize);
    applyTheme(theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFontSize = (s: FontSize) => {
    setFontSizeState(s);
    localStorage.setItem(LS_FONT, s);
    applyFont(s);
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(LS_THEME, t);
    applyTheme(t);
  };

  return { fontSize, setFontSize, theme, setTheme };
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  onSignOut,
  onSignIn,
  onEditProfile,
  isSignedIn,
  isAdmin,
  onOpenAdminAnalytics,
}) => {
  const [visible, setVisible] = useState(false);
  const { fontSize, setFontSize } = useAppSettings();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => setVisible(true));
    else { setVisible(false); setConfirmSignOut(false); }
  }, [isOpen]);

  if (!isOpen) return null;

  const THEMES: { id: "dark" | "midnight" | "space"; label: string; bg: string }[] = [
    { id: "dark" as Theme, label: "Dark", bg: "linear-gradient(135deg, #0e1220, #12162a)" },
    { id: "midnight" as Theme, label: "Midnight", bg: "linear-gradient(135deg, #080a14, #0d0b22)" },
    { id: "space" as Theme, label: "Space", bg: "linear-gradient(135deg, #03040a, #07090f)" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s" }}
      />
      <div
        className="relative w-full xl:max-w-[430px] rounded-t-3xl overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(180deg, #13102e 0%, #0d0b22 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
          maxHeight: "88vh",
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
        <div className="px-6 pt-2 pb-4 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-0.5">
              App
            </p>
            <h2 className="text-xl font-black text-white">Settings</h2>
          </div>
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

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-10 space-y-5">

          {/* Account */}
          {isSignedIn && (
            <section>
              <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-2">
                Account
              </p>
              <button
                onClick={() => { onEditProfile(); onClose(); }}
                className="w-full rounded-2xl px-4 py-3.5 flex items-center justify-between transition-all hover:opacity-80"
                style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(124,58,237,0.15)" }}
                  >
                    <svg className="w-4 h-4 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-violet-200 font-bold text-sm">Edit Profile</span>
                </div>
                <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </section>
          )}

          {/* Font size */}
          <section>
            <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-2">
              Text size
            </p>
            <div
              className="rounded-2xl p-1 flex gap-1"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {(["sm", "md", "lg"] as FontSize[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={
                    fontSize === s
                      ? { background: "rgba(124,58,237,0.3)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.5)" }
                      : { color: "rgba(255,255,255,0.35)", border: "1px solid transparent" }
                  }
                >
                  {FONT_SIZE_LABELS[s]}
                </button>
              ))}
            </div>
          </section>

          {/* Theme */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider">
                Theme
              </p>
              <span className="text-white/20 text-[10px] font-medium">Coming soon</span>
            </div>
            <div className="grid grid-cols-3 gap-2 opacity-40 pointer-events-none select-none">
              {THEMES.map(({ id, label, bg }) => (
                <div
                  key={id}
                  className="rounded-2xl overflow-hidden"
                  style={{ border: "2px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="h-14 w-full" style={{ background: bg }} />
                  <div
                    className="px-2 py-1.5 text-center"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <p className="text-xs font-bold text-white/40">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Display preferences */}
          <section
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div>
                <p className="text-white font-semibold text-sm">Reduce motion</p>
                <p className="text-white/35 text-xs">Simplify animations</p>
              </div>
              <span className="text-white/20 text-xs font-medium">Coming soon</span>
            </div>
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div>
                <p className="text-white font-semibold text-sm">Haptic feedback</p>
                <p className="text-white/35 text-xs">Vibrate on interactions</p>
              </div>
              <span className="text-white/20 text-xs font-medium">Coming soon</span>
            </div>
          </section>

          {/* Admin section */}
          {isAdmin && (
            <section>
              <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wider mb-2">
                Admin
              </p>
              <button
                onClick={() => { onOpenAdminAnalytics(); onClose(); }}
                className="w-full rounded-2xl px-4 py-3.5 flex items-center justify-between transition-all hover:opacity-80"
                style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(34,211,238,0.15)" }}
                  >
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-cyan-400 font-bold text-sm">Analytics Dashboard</span>
                </div>
                <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </section>
          )}

          {/* About */}
          <section
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="text-white font-semibold text-sm">Version</p>
              <p className="text-white/35 text-xs font-mono">1.0.0</p>
            </div>
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <p className="text-white font-semibold text-sm">PitchTank</p>
              <p className="text-white/35 text-xs">© 2026</p>
            </div>
          </section>

          {/* Sign in / Sign out */}
          <section>
            {!isSignedIn ? (
              <button
                onClick={onSignIn}
                className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
                  boxShadow: "0 0 18px rgba(34,211,238,0.25)",
                }}
              >
                Sign In
              </button>
            ) : !confirmSignOut ? (
              <button
                onClick={() => setConfirmSignOut(true)}
                className="w-full py-4 rounded-2xl font-bold text-red-400 text-sm border border-red-500/20 transition-all hover:bg-red-500/10"
                style={{ background: "rgba(239,68,68,0.05)" }}
              >
                Sign Out
              </button>
            ) : (
              <div
                className="rounded-2xl p-4 space-y-3"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
              >
                <p className="text-white font-semibold text-sm text-center">Are you sure you want to sign out?</p>
                <div className="flex gap-3">
                  <button
                    onClick={onSignOut}
                    className="flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all"
                    style={{ background: "rgba(239,68,68,0.6)", border: "1px solid rgba(239,68,68,0.5)" }}
                  >
                    Sign Out
                  </button>
                  <button
                    onClick={() => setConfirmSignOut(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-white/50 text-sm transition-all hover:text-white/80"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
