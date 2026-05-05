import { useEffect, useState } from "react";
import { cn, formatTimer } from "./utils";

export interface TimerProps {
  seconds: number;
  countdown?: boolean;
  onExpire?: () => void;
  className?: string;
}

export function Timer({
  seconds: initialSeconds,
  countdown = false,
  onExpire,
  className,
}: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!countdown) return;
    if (seconds <= 0) {
      onExpire?.();
      return;
    }
    const id = setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [countdown, seconds, onExpire]);

  return <span className={cn("num", className)}>{formatTimer(seconds)}</span>;
}
