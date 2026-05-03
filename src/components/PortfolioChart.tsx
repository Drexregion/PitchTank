import React, { useMemo } from "react";
import { PortfolioHistoryPoint } from "../hooks/usePortfolioHistory";

interface PortfolioChartProps {
  points: PortfolioHistoryPoint[];
  height?: number;
  initialBalance?: number;
}

export const PortfolioChart: React.FC<PortfolioChartProps> = ({
  points,
  height = 200,
  initialBalance,
}) => {
  const { pathD, areaD, isUp, change, changePct, dotX, dotY } = useMemo(() => {
    if (points.length < 2) return { pathD: "", areaD: "", isUp: true, change: 0, changePct: 0, dotX: 0, dotY: 0 };

    const values = points.map((p) => p.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const W = 400;
    const H = height - 32; // leave bottom room for time labels
    const padY = 12;

    const toX = (i: number) => (i / (points.length - 1)) * W;
    const toY = (v: number) => padY + H - padY * 2 - ((v - minVal) / range) * (H - padY * 2);

    const coords = points.map((p, i) => [toX(i), toY(p.value)] as [number, number]);
    const pathD = `M ${coords.map(([x, y]) => `${x},${y}`).join(" L ")}`;
    const areaD = `${pathD} L ${W},${H} L 0,${H} Z`;

    const startVal = initialBalance ?? values[0];
    const change = values[values.length - 1] - startVal;
    const changePct = startVal > 0 ? (change / startVal) * 100 : 0;
    const isUp = change >= 0;

    const [dotX, dotY] = coords[coords.length - 1];

    return { pathD, areaD, isUp, change, changePct, dotX, dotY };
  }, [points, height, initialBalance]);

  if (!pathD) return <div style={{ height }} />;

  const color = isUp ? "#f59e0b" : "#ef4444";
  const gradId = `pg_${isUp ? "up" : "dn"}`;
  const W = 400;
  const H = height - 32;

  const formatVal = (v: number) =>
    v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(2)}M`
      : `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <div style={{ width: "100%", height }}>
      {/* Header stats */}
      <div className="flex items-end justify-between px-4 mb-2">
        <span className={`text-xs font-semibold flex items-center gap-1 ${isUp ? "text-amber-400" : "text-red-400"}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isUp
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7 7 7M12 3v18" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7-7-7M12 21V3" />}
          </svg>
          {isUp ? "+" : ""}{formatVal(change)} ({isUp ? "+" : ""}{changePct.toFixed(2)}%)
        </span>
        <span className="text-white/25 text-[10px]">since start</span>
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: H, display: "block" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="70%" stopColor={color} stopOpacity="0.05" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Area fill */}
        <path d={areaD} fill={`url(#${gradId})`} />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />

        {/* End dot */}
        <circle cx={dotX} cy={dotY} r="5" fill={color} opacity="0.9" />
        <circle cx={dotX} cy={dotY} r="9" fill={color} opacity="0.2" />
      </svg>
    </div>
  );
};
