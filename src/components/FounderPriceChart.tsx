import React, { useMemo } from "react";
import { useEventData } from "../contexts/EventDataContext";

interface FounderPriceChartProps {
  founderId: string;
  height?: number;
  showGrid?: boolean;
  maxPoints?: number;
  since?: string;
}

export const FounderPriceChart: React.FC<FounderPriceChartProps> = ({
  founderId,
  height = 180,
  maxPoints = 100,
  since,
}) => {
  const { priceHistoryMap } = useEventData();

  const points = useMemo(() => {
    let pts = priceHistoryMap.get(founderId) ?? [];
    if (since) pts = pts.filter((p) => p.recorded_at >= since);
    if (maxPoints && pts.length > maxPoints) pts = pts.slice(-maxPoints);
    return pts;
  }, [priceHistoryMap, founderId, since, maxPoints]);

  const { pathD, areaD, isUp, dotX, dotY, currentPrice, changePct, timeLabels } = useMemo(() => {
    if (points.length < 2) return { pathD: "", areaD: "", isUp: true, dotX: 0, dotY: 0, currentPrice: 0, changePct: 0, timeLabels: [] as { x: number; label: string }[] };

    const prices = points.map((p) => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;

    const W = 400;
    const H = height - 28;
    const padY = 8;

    const toX = (i: number) => (i / (points.length - 1)) * W;
    const toY = (v: number) => padY + (H - padY * 2) - ((v - minPrice) / range) * (H - padY * 2);

    const coords = points.map((p, i) => [toX(i), toY(p.price)] as [number, number]);
    const pathD = `M ${coords.map(([x, y]) => `${x},${y}`).join(" L ")}`;
    const areaD = `${pathD} L ${W},${H} L 0,${H} Z`;

    const currentPrice = prices[prices.length - 1];
    const startPrice = prices[0];
    const diff = currentPrice - startPrice;
    const changePct = startPrice > 0 ? (diff / startPrice) * 100 : 0;
    const isUp = diff >= 0;
    const [dotX, dotY] = coords[coords.length - 1];

    const labelCount = Math.min(4, points.length);
    const step = Math.floor(points.length / labelCount);
    const timeLabels = Array.from({ length: labelCount }, (_, k) => {
      const idx = Math.min(k * step, points.length - 1);
      const d = new Date(points[idx].recorded_at);
      const label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return { x: (idx / (points.length - 1)) * 100, label };
    });

    return { pathD, areaD, isUp, dotX, dotY, currentPrice, changePct, timeLabels };
  }, [points, height]);

  if (!pathD) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-white/20 text-xs">No price history yet</p>
      </div>
    );
  }

  const color = isUp ? "#22d3ee" : "#f87171";
  const gradId = `fpc_${founderId.slice(-6)}`;
  const W = 400;
  const H = height - 28;

  return (
    <div style={{ width: "100%", height }}>
      {/* Stats row */}
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-white font-bold text-sm tabular-nums">${currentPrice.toFixed(2)}</span>
        <span className={`text-xs font-semibold ${isUp ? "text-cyan-400" : "text-red-400"}`}>
          {isUp ? "+" : ""}{changePct.toFixed(2)}%
        </span>
      </div>

      {/* SVG */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: H, display: "block" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={`glow_${gradId}`}>
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow_${gradId})`} />
        <circle cx={dotX} cy={dotY} r="4" fill={color} opacity="0.9" />
        <circle cx={dotX} cy={dotY} r="8" fill={color} opacity="0.15" />
      </svg>

      {/* Time labels */}
      <div className="flex justify-between px-0.5 mt-1">
        {timeLabels.map((l, i) => (
          <span key={i} className="text-white/20 text-[9px] tabular-nums">{l.label}</span>
        ))}
      </div>
    </div>
  );
};
