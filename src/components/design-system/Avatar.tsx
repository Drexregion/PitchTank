import {
  forwardRef,
  useEffect,
  useState,
  type HTMLAttributes,
} from "react";
import { cn } from "./utils";

const SIZES = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
  xl: "w-20 h-20 text-lg",
} as const;

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof SIZES;
  /** Real portrait URL. Falls back to initial+gradient on load failure. */
  photo?: string | null;
  /** Display name; first character used as initial. */
  name?: string;
  /** Gradient hex stops for the ring + glow + initial background. */
  gradient?: [string, string];
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = "md", photo, name, gradient, ...props }, ref) => {
    const [broken, setBroken] = useState(false);

    useEffect(() => {
      setBroken(false);
    }, [photo]);

    const initial = (name?.[0] ?? "?").toUpperCase();
    const bgGradient = gradient
      ? `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`
      : "linear-gradient(135deg, var(--c-blue), var(--c-purple))";
    const showPhoto = !!photo && !broken;

    return (
      <div
        ref={ref}
        className={cn("relative inline-block", SIZES[size], className)}
        {...props}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-[3px] rounded-full opacity-55 blur-md"
          style={{ background: bgGradient }}
        />
        <span
          className={cn(
            "relative flex h-full w-full items-center justify-center overflow-hidden rounded-full font-display font-medium text-white",
            showPhoto && "p-[2px]",
          )}
          style={{ background: bgGradient }}
        >
          {showPhoto ? (
            <img
              src={photo as string}
              alt={name ?? ""}
              loading="lazy"
              decoding="async"
              className="h-full w-full rounded-full object-cover"
              onError={() => setBroken(true)}
            />
          ) : (
            initial
          )}
        </span>
      </div>
    );
  },
);

Avatar.displayName = "Avatar";
