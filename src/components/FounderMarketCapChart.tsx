import React from "react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
	CartesianGrid,
	ReferenceLine,
} from "recharts";
import { usePriceHistory } from "../hooks/usePriceHistory";

interface FounderMarketCapChartProps {
	founderId: string;
	founderName: string;
	height?: number | string;
	maxPoints?: number;
	initialShares?: number;
}

const INITIAL_SHARES = 100000;

function formatMarketCap(value: number): string {
	if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
	if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
	return `$${value.toFixed(0)}`;
}

export const FounderMarketCapChart: React.FC<FounderMarketCapChartProps> = ({
	founderId,
	founderName,
	height = 280,
	maxPoints = 500,
	initialShares = INITIAL_SHARES,
}) => {
	const { points, isLoading, error } = usePriceHistory({
		founderId,
		maxPoints,
	});

	if (isLoading) {
		return (
			<div
				className="flex items-center justify-center bg-dark-800/30 rounded-lg"
				style={{ height }}
			>
				<span className="text-sm text-dark-400">Loading chart…</span>
			</div>
		);
	}

	if (error) {
		return (
			<div
				className="flex items-center justify-center bg-dark-800/30 rounded-lg"
				style={{ height }}
			>
				<span className="text-sm text-red-400">Error: {error}</span>
			</div>
		);
	}

	if (!points.length) {
		return (
			<div
				className="flex items-center justify-center bg-dark-800/30 rounded-lg"
				style={{ height }}
			>
				<span className="text-sm text-dark-400">
					No market cap data yet for {founderName}
				</span>
			</div>
		);
	}

	const chartData = points.map((p) => ({
		time: new Date(p.recorded_at).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		}),
		marketCap: p.price * (initialShares - Number(p.shares_in_pool)),
	}));

	const marketCaps = chartData.map((d) => d.marketCap);
	const peakMarketCap = Math.max(...marketCaps);
	const minCap = Math.max(0, Math.min(...marketCaps) * 0.85);
	const maxCap = peakMarketCap * 1.1;

	const isUptrend =
		chartData.length >= 2 &&
		chartData[chartData.length - 1].marketCap > chartData[0].marketCap;
	const lineColor = isUptrend ? "#16a34a" : "#dc2626";

	return (
		<div>
			{/* Peak stat */}
			<div className="flex items-center gap-4 mb-3">
				<div className="bg-dark-700 rounded-lg px-4 py-2 border border-dark-600">
					<p className="text-xs text-dark-400 mb-0.5">Peak Market Cap</p>
					<p className="text-lg font-bold text-accent-cyan">
						{formatMarketCap(peakMarketCap)}
					</p>
				</div>
				<div className="bg-dark-700 rounded-lg px-4 py-2 border border-dark-600">
					<p className="text-xs text-dark-400 mb-0.5">Current Market Cap</p>
					<p className="text-lg font-bold text-white">
						{formatMarketCap(chartData[chartData.length - 1].marketCap)}
					</p>
				</div>
			</div>

			<div style={{ height }}>
				<ResponsiveContainer width="100%" height="100%">
					<LineChart
						data={chartData}
						margin={{ top: 4, right: 16, bottom: 4, left: 10 }}
					>
						<CartesianGrid strokeDasharray="3 3" stroke="#2a2f3e" />
						<XAxis
							dataKey="time"
							minTickGap={30}
							tick={{ fontSize: 11, fill: "#6b7280" }}
						/>
						<YAxis
							domain={[minCap, maxCap]}
							tick={{ fontSize: 11, fill: "#6b7280" }}
							tickFormatter={formatMarketCap}
							width={70}
						/>
						<Tooltip
							formatter={(value: number) => [
								formatMarketCap(value),
								"Market Cap",
							]}
							labelFormatter={(label) => `Time: ${label}`}
							contentStyle={{
								backgroundColor: "#1a1f2e",
								border: "1px solid #374151",
								borderRadius: "8px",
								color: "#fff",
							}}
						/>
						{/* Reference line at peak */}
						<ReferenceLine
							y={peakMarketCap}
							stroke="#06b6d4"
							strokeDasharray="4 4"
							strokeWidth={1}
							label={{
								value: `Peak: ${formatMarketCap(peakMarketCap)}`,
								fill: "#06b6d4",
								fontSize: 10,
								position: "insideTopRight",
							}}
						/>
						<Line
							type="monotone"
							dataKey="marketCap"
							stroke={lineColor}
							strokeWidth={2}
							dot={false}
							activeDot={{ r: 4, stroke: lineColor, strokeWidth: 1 }}
							isAnimationActive={false}
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
};
