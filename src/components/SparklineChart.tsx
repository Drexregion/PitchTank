import React from "react";
import { useEventData } from "../contexts/EventDataContext";

interface SparklineProps {
  founderId: string;
  width?: number;
  height?: number;
}

function buildPath(prices: number[], width: number, height: number) {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const coords = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * w;
    const y = pad + h - ((p - min) / range) * h;
    return `${x},${y}`;
  });
  return `M ${coords.join(" L ")}`;
}

/** Sparkline only — use SparklineWithButton when you also need the trade button */
export const SparklineChart: React.FC<SparklineProps> = ({ founderId, width = 80, height = 32 }) => {
  const { priceHistoryMap } = useEventData();
  const points = (priceHistoryMap.get(founderId) ?? []).slice(-30);
  if (points.length < 2) return <div style={{ width, height }} />;
  const prices = points.map((p) => p.price);
  const isUp = prices[prices.length - 1] >= prices[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <path d={buildPath(prices, width, height)} stroke={isUp ? "#22d3ee" : "#f87171"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

interface SparklineWithButtonProps extends SparklineProps {
  price: number;
  canTrade: boolean;
  onTrade: () => void;
  formatCurrency: (v: number) => string;
}

/** Renders sparkline + colored trade button together, sharing one price history fetch */
export const SparklineWithButton: React.FC<SparklineWithButtonProps> = ({
  founderId, width = 72, height = 28, price, canTrade, onTrade, formatCurrency,
}) => {
  const { priceHistoryMap } = useEventData();
  const points = (priceHistoryMap.get(founderId) ?? []).slice(-30);

  const isUp = points.length >= 2
    ? points[points.length - 1].price >= points[0].price
    : true;

  const prices = points.length >= 2 ? points.map((p) => p.price) : null;

  const upStyle = {
    background: "linear-gradient(135deg, rgba(34,211,238,0.18), rgba(34,211,238,0.08))",
    border: "1px solid rgba(34,211,238,0.4)",
  };
  const downStyle = {
    background: "linear-gradient(135deg, rgba(248,113,113,0.18), rgba(248,113,113,0.08))",
    border: "1px solid rgba(248,113,113,0.4)",
  };
  const disabledStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  };

  return (
    <div className="flex items-center gap-2.5">
      {/* Sparkline */}
      {prices ? (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
          <path d={buildPath(prices, width, height)} stroke={isUp ? "#22d3ee" : "#f87171"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <div style={{ width, height }} />
      )}

      {/* Trade button */}
      <button
        onClick={(e) => { e.stopPropagation(); onTrade(); }}
        disabled={!canTrade}
        className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center justify-center leading-tight ${!canTrade ? "cursor-not-allowed opacity-30" : ""}`}
        style={canTrade ? (isUp ? upStyle : downStyle) : disabledStyle}
      >
        <span
          className="font-black text-sm tabular-nums"
          style={{ color: canTrade ? (isUp ? "#67e8f9" : "#fca5a5") : "rgba(255,255,255,0.3)" }}
        >
          {formatCurrency(price)}
        </span>
      </button>
    </div>
  );
};
