import { cn } from "./utils";

export interface TrendValueProps {
  value: number;
  decimals?: number;
  showSign?: boolean;
  showPercent?: boolean;
  className?: string;
}

export function TrendValue({
  value,
  decimals = 2,
  showSign = true,
  showPercent = true,
  className,
}: TrendValueProps) {
  const isPositive = value >= 0;
  const sign = showSign && isPositive ? "+" : "";
  const suffix = showPercent ? "%" : "";

  return (
    <span
      className={cn(
        "num font-display font-medium",
        isPositive ? "text-pt-cyan" : "text-pt-orange",
        className,
      )}
      style={{
        textShadow: isPositive
          ? "0 0 8px rgba(0,229,255,0.6)"
          : "0 0 8px rgba(255,138,0,0.5)",
      }}
    >
      {sign}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
