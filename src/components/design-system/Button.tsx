import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./utils";

const VARIANT_CLASS = {
  primary: "pt-btn-primary",
  buy: "pt-btn-buy",
  "buy-solid": "pt-btn-buy-solid",
  sell: "pt-btn-sell",
  "sell-solid": "pt-btn-sell-solid",
  secondary: "pt-btn-secondary",
} as const;

const SIZE_CLASS = {
  lg: "pt-btn-lg",
  md: "pt-btn-md",
  sm: "pt-btn-sm",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASS;
  size?: keyof typeof SIZE_CLASS;
  loading?: boolean;
  loadingText?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      loadingText,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn("pt-btn", VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...props}
    >
      {loading ? (loadingText ?? children) : children}
    </button>
  ),
);

Button.displayName = "Button";
