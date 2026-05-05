import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./utils";

const TONE_CLASS = {
  frame: "tone-frame",
  purple: "tone-purple",
  featured: "tone-featured",
  neutral: "tone-neutral",
} as const;

const SIZE_CLASS = {
  sm: "size-sm",
  md: "size-md",
  lg: "size-lg",
} as const;

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: keyof typeof TONE_CLASS;
  size?: keyof typeof SIZE_CLASS;
  /** Brightens the border. Currently meaningful only for `tone="neutral"`. */
  active?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, tone = "neutral", size = "md", active, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "glass-card",
        TONE_CLASS[tone],
        SIZE_CLASS[size],
        active && "active",
        className,
      )}
      {...props}
    />
  ),
);

GlassCard.displayName = "GlassCard";
