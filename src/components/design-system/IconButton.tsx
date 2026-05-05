import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "./utils";

const SIZE_CLASS = {
  sm: "pt-icon-btn-sm",
  md: "pt-icon-btn-md",
  lg: "pt-icon-btn-lg",
} as const;

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: keyof typeof SIZE_CLASS;
  icon: ReactNode;
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "md", icon, ...props }, ref) => (
    <button
      ref={ref}
      className={cn("pt-icon-btn", SIZE_CLASS[size], className)}
      {...props}
    >
      {icon}
    </button>
  ),
);

IconButton.displayName = "IconButton";
