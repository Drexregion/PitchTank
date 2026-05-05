import { type CSSProperties } from "react";
import { cn } from "./utils";

export interface IridescentArcProps {
  className?: string;
  style?: CSSProperties;
}

export function IridescentArc({ className, style }: IridescentArcProps) {
  return (
    <div
      aria-hidden
      className={cn("relative h-16 pointer-events-none", className)}
      style={style}
    >
      <svg
        className="absolute inset-x-0 top-0 w-full h-full overflow-visible"
        viewBox="0 0 800 80"
        preserveAspectRatio="none"
        style={{
          filter:
            "drop-shadow(0 0 5px rgba(232,242,255,0.65)) " +
            "drop-shadow(0 0 14px rgba(162,89,255,0.75)) " +
            "drop-shadow(0 0 28px rgba(79,124,255,0.50)) " +
            "drop-shadow(0 0 48px rgba(162,89,255,0.32))",
        }}
      >
        <defs>
          <linearGradient id="pt-arc-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#A259FF" stopOpacity="0" />
            <stop offset="12%" stopColor="#A259FF" stopOpacity="0.9" />
            <stop offset="35%" stopColor="#4F7CFF" />
            <stop offset="55%" stopColor="#A259FF" />
            <stop offset="78%" stopColor="#FF8A00" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FF8A00" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pt-arc-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E8F2FF" stopOpacity="0" />
            <stop offset="25%" stopColor="#E8F2FF" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="75%" stopColor="#E8F2FF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#E8F2FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M 0 18 Q 400 78 800 18"
          stroke="url(#pt-arc-grad)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 90 24 Q 400 70 710 24"
          stroke="url(#pt-arc-sheen)"
          strokeWidth="0.9"
          fill="none"
          strokeLinecap="round"
          opacity="0.95"
        />
      </svg>
    </div>
  );
}
