/**
 * Lightweight class-name joiner. Filters out falsy values and joins
 * with spaces. We intentionally avoid pulling in clsx / tailwind-merge
 * to keep the design-system port dependency-free.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ");
}

/** Format money with thousand separators. */
export function formatMoney(
  value: number,
  decimals = 2,
  withSymbol = false,
): string {
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return withSymbol ? `$${formatted}` : formatted;
}

/** Format countdown seconds → "m:ss" + "s" suffix. */
export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}s`;
}

/** Map a "ring" gradient name → a pair of hex stops. */
const RING_TO_GRADIENT: Record<string, [string, string]> = {
  "from-cyan-400 via-blue-500 to-violet-500": ["#22d3ee", "#8b5cf6"],
  "from-violet-400 to-fuchsia-500": ["#a78bfa", "#d946ef"],
  "from-emerald-400 to-cyan-500": ["#34d399", "#06b6d4"],
  "from-amber-400 to-orange-500": ["#fbbf24", "#f97316"],
  "from-pink-400 to-violet-500": ["#f472b6", "#8b5cf6"],
  "from-sky-400 to-blue-500": ["#38bdf8", "#3b82f6"],
  "from-fuchsia-400 to-rose-500": ["#e879f9", "#fb7185"],
};

export function ringGradient(ring: string): [string, string] {
  return RING_TO_GRADIENT[ring] ?? ["#4F7CFF", "#A259FF"];
}

/** Deterministically pick a gradient pair for a given id (stable across renders). */
const GRADIENT_PALETTE: [string, string][] = [
  ["#22d3ee", "#8b5cf6"],
  ["#a78bfa", "#d946ef"],
  ["#34d399", "#06b6d4"],
  ["#fbbf24", "#f97316"],
  ["#f472b6", "#8b5cf6"],
  ["#38bdf8", "#3b82f6"],
  ["#e879f9", "#fb7185"],
];

export function gradientForId(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % GRADIENT_PALETTE.length;
  return GRADIENT_PALETTE[idx];
}
