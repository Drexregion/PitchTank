import { cn, formatMoney } from "./utils";

export interface MoneyProps {
  value: number;
  decimals?: number;
  withSymbol?: boolean;
  className?: string;
}

export function Money({
  value,
  decimals = 2,
  withSymbol = true,
  className,
}: MoneyProps) {
  return (
    <span className={cn("num", className)}>
      {formatMoney(value, decimals, withSymbol)}
    </span>
  );
}
