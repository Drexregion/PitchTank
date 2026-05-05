import React, { useState, useCallback, useEffect, useRef } from "react";
import { supabase, supabaseUrl, supabaseAnonKey } from "../lib/supabaseClient";

interface ServiceHealth {
	name: string;
	healthy: boolean;
	status: string;
	info?: Record<string, any>;
}

interface FunctionStatus {
	name: string;
	status: string;
	version: number;
}

interface DbStats {
	db_size_bytes: number;
	total_users: number;
	mau_30d: number;
	new_users_30d: number;
}

interface HealthPayload {
	services: ServiceHealth[];
	functions: FunctionStatus[];
	dbStats: DbStats | null;
	fetchedAt: string;
}

const FREE_LIMITS = {
	db_size_bytes: 500 * 1024 * 1024,
	mau: 50_000,
};

const BACKUP_URL = import.meta.env.VITE_SUPABASE_BACKUP_URL;
const BACKUP_KEY = import.meta.env.VITE_SUPABASE_BACKUP_ANON_KEY;

function fmt(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function UsageBar({ value, limit, label, detail }: {
	value: number;
	limit: number;
	label: string;
	detail: string;
}) {
	const pct = Math.min(100, Math.round((value / limit) * 100));
	const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-400" : "bg-green-500";
	const textColor = pct >= 90 ? "text-red-600" : pct >= 70 ? "text-yellow-600" : "text-green-700";
	return (
		<div>
			<div className="flex items-center justify-between mb-1">
				<span className="text-sm text-gray-600">{label}</span>
				<div className="flex items-center gap-2">
					<span className="text-sm font-semibold tabular-nums text-gray-900">{detail}</span>
					<span className={`text-xs font-bold tabular-nums ${textColor}`}>{pct}%</span>
				</div>
			</div>
			<div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
				<div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
			</div>
		</div>
	);
}

function ServiceRow({ svc }: { svc: ServiceHealth }) {
	const healthy = svc.healthy;
	const dotColor = healthy ? "bg-green-500" : "bg-red-500";
	const textColor = healthy ? "text-green-700" : "text-red-700";
	const extra = svc.info?.connected_cluster != null
		? ` · ${svc.info.connected_cluster} connected`
		: svc.info?.version
		? ` · ${svc.info.version}`
		: "";
	return (
		<div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-3">
			<div className="flex items-center gap-2">
				<span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
				<span className="text-sm font-medium text-gray-800 capitalize">{svc.name.replace(/_/g, " ")}</span>
			</div>
			<span className={`text-xs font-medium ${textColor}`}>
				{svc.status.replace(/_/g, " ").toLowerCase()}{extra}
			</span>
		</div>
	);
}

function FnRow({ fn }: { fn: FunctionStatus }) {
	const active = fn.status === "ACTIVE";
	return (
		<div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-3">
			<div className="flex items-center gap-2">
				<span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${active ? "bg-green-500" : "bg-red-500"}`} />
				<span className="text-sm font-medium text-gray-800 font-mono">{fn.name}</span>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-xs text-gray-400">v{fn.version}</span>
				<span className={`text-xs font-medium ${active ? "text-green-700" : "text-red-700"}`}>
					{fn.status.toLowerCase()}
				</span>
			</div>
		</div>
	);
}

export const AdminServiceMonitor: React.FC = () => {
	const [data, setData] = useState<HealthPayload | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [nextRefreshIn, setNextRefreshIn] = useState(30);
	const lastFetchedRef = useRef<Date | null>(null);

	const [selectedProject, setSelectedProject] = useState<"primary" | "backup">("primary");
	const [failoverEnabled, setFailoverEnabled] = useState<boolean | null>(null);
	const [failoverLoading, setFailoverLoading] = useState(false);
	const [failoverError, setFailoverError] = useState<string | null>(null);

	const activeUrl = selectedProject === "primary" ? supabaseUrl : BACKUP_URL;
	const activeKey = selectedProject === "primary" ? supabaseAnonKey : BACKUP_KEY;
	const projectRef = activeUrl?.split("//")[1]?.split(".")[0] ?? "";

	const runChecks = useCallback(async () => {
		setIsRefreshing(true);
		setError(null);
		try {
			const { data: { session } } = await supabase.auth.getSession();
			const token = session?.access_token ?? activeKey;
			const res = await fetch(`${activeUrl}/functions/v1/get-project-health`, {
				method: "GET",
				headers: { Authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(15_000),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error ?? `HTTP ${res.status}`);
			}
			const payload: HealthPayload = await res.json();
			setData(payload);
			lastFetchedRef.current = new Date();
		} catch (e: any) {
			setError(e.message ?? "Failed to fetch health data");
		} finally {
			setIsRefreshing(false);
		}
	}, [activeUrl, activeKey]);

	const fetchFailoverStatus = useCallback(async () => {
		if (!BACKUP_URL || !BACKUP_KEY) return;
		try {
			const res = await fetch(
				`${BACKUP_URL}/rest/v1/app_config?key=eq.failover_enabled&select=value`,
				{ headers: { apikey: BACKUP_KEY, Authorization: `Bearer ${BACKUP_KEY}` } }
			);
			if (!res.ok) { setFailoverEnabled(null); return; }
			const rows: Array<{ value: boolean }> = await res.json();
			setFailoverEnabled(rows[0]?.value === true);
		} catch {
			setFailoverEnabled(null);
		}
	}, []);

	const handleToggleFailover = async (enabled: boolean) => {
		if (!BACKUP_URL) return;
		setFailoverLoading(true);
		setFailoverError(null);
		try {
			const { data: { session } } = await supabase.auth.getSession();
			const token = session?.access_token;
			if (!token) throw new Error("Not authenticated");
			const res = await fetch(`${BACKUP_URL}/functions/v1/toggle-failover`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
				body: JSON.stringify({ enabled }),
			});
			const body = await res.json();
			if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
			setFailoverEnabled(enabled);
		} catch (e: any) {
			setFailoverError(e.message);
		} finally {
			setFailoverLoading(false);
		}
	};

	// Re-fetch health data when selected project changes
	useEffect(() => {
		setData(null);
		setError(null);
		runChecks();
		const interval = setInterval(runChecks, 30_000);
		return () => clearInterval(interval);
	}, [runChecks]);

	// Fetch failover status once on mount
	useEffect(() => {
		fetchFailoverStatus();
	}, [fetchFailoverStatus]);

	// Countdown to next refresh
	useEffect(() => {
		setNextRefreshIn(30);
		const tick = setInterval(() => setNextRefreshIn((s) => Math.max(0, s - 1)), 1000);
		return () => clearInterval(tick);
	}, [data]);

	const anyUnhealthy = data?.services.some((s) => !s.healthy) ?? false;

	const overallBg = !data
		? "bg-gray-50 border-gray-200"
		: anyUnhealthy
		? "bg-red-50 border-red-200"
		: "bg-green-50 border-green-200";

	const overallLabel = !data
		? "Loading…"
		: anyUnhealthy
		? "Service issue detected"
		: "All systems operational";

	const overallDot = !data
		? "bg-gray-300 animate-pulse"
		: anyUnhealthy
		? "bg-red-500"
		: "bg-green-500";

	return (
		<div className="space-y-6">
			{/* Project selector */}
			<div className="flex items-center gap-3">
				<span className="text-sm font-medium text-gray-600">Monitoring:</span>
				<select
					value={selectedProject}
					onChange={(e) => setSelectedProject(e.target.value as "primary" | "backup")}
					className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
				>
					<option value="primary">Primary (us-east-1)</option>
					<option value="backup" disabled={!BACKUP_URL}>
						Backup (ca-central-1){!BACKUP_URL ? " — not configured" : ""}
					</option>
				</select>
			</div>

			{/* Overall banner */}
			<div className={`flex items-center justify-between p-4 rounded-xl border ${overallBg}`}>
				<div className="flex items-center gap-3">
					<span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${overallDot}`} />
					<span className="font-semibold text-gray-800">{overallLabel}</span>
				</div>
				<div className="flex items-center gap-4">
					{data && (
						<span className="text-xs text-gray-400 tabular-nums">
							Updated {new Date(data.fetchedAt).toLocaleTimeString()} · next in {nextRefreshIn}s
						</span>
					)}
					<button
						onClick={runChecks}
						disabled={isRefreshing}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:border-gray-400 text-gray-600 transition-all disabled:opacity-50"
					>
						<svg className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
						{isRefreshing ? "Checking…" : "Refresh"}
					</button>
				</div>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
					{error === "Forbidden" || error === "Unauthorized"
						? "Could not load health data — make sure the get-project-health function is deployed and SUPABASE_ACCESS_TOKEN is set as a secret."
						: error}
				</div>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{/* Service health */}
				<div className="bg-white rounded-xl border border-gray-200 p-5">
					<h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Service Health</h3>
					{!data ? (
						<div className="space-y-2">
							{["db", "auth", "storage", "realtime", "rest", "pooler"].map((n) => (
								<div key={n} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-3">
									<div className="flex items-center gap-2">
										<span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-200 animate-pulse" />
										<span className="text-sm text-gray-400 capitalize">{n}</span>
									</div>
									<span className="text-xs text-gray-300">Checking…</span>
								</div>
							))}
						</div>
					) : (
						data.services.map((svc) => <ServiceRow key={svc.name} svc={svc} />)
					)}
				</div>

				{/* Edge functions */}
				<div className="bg-white rounded-xl border border-gray-200 p-5">
					<h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Edge Functions</h3>
					{!data ? (
						<p className="text-sm text-gray-400">Loading…</p>
					) : data.functions.length === 0 ? (
						<p className="text-sm text-gray-400">No functions found</p>
					) : (
						data.functions.map((fn) => <FnRow key={fn.name} fn={fn} />)
					)}
				</div>
			</div>

			{/* Quota / usage */}
			<div className="bg-white rounded-xl border border-gray-200 p-5">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Free Tier Quota</h3>
					<a
						href={`https://supabase.com/dashboard/project/${projectRef}/settings/billing`}
						target="_blank"
						rel="noreferrer"
						className="text-xs text-blue-600 hover:underline"
					>
						Billing →
					</a>
				</div>
				{!data?.dbStats ? (
					<p className="text-sm text-gray-400">{isRefreshing ? "Loading…" : "Unavailable"}</p>
				) : (
					<div className="space-y-4">
						<UsageBar
							label="Database size"
							value={data.dbStats.db_size_bytes}
							limit={FREE_LIMITS.db_size_bytes}
							detail={`${fmt(data.dbStats.db_size_bytes)} / 500 MB`}
						/>
						<UsageBar
							label="Monthly active users (MAU)"
							value={data.dbStats.mau_30d}
							limit={FREE_LIMITS.mau}
							detail={`${data.dbStats.mau_30d.toLocaleString()} / 50,000`}
						/>
					</div>
				)}
			</div>

			{/* Auth & user stats */}
			{data?.dbStats && (
				<div className="bg-white rounded-xl border border-gray-200 p-5">
					<h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Auth Stats</h3>
					<div className="grid grid-cols-3 gap-4">
						{[
							{ label: "Total users", value: data.dbStats.total_users.toLocaleString() },
							{ label: "Active last 30d", value: data.dbStats.mau_30d.toLocaleString() },
							{ label: "New last 30d", value: data.dbStats.new_users_30d.toLocaleString() },
						].map(({ label, value }) => (
							<div key={label} className="bg-gray-50 rounded-lg border border-gray-100 p-3 text-center">
								<p className="text-xs text-gray-500 mb-1">{label}</p>
								<p className="text-xl font-bold tabular-nums text-gray-900">{value}</p>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Failover control — only shown when backup is configured */}
			{BACKUP_URL && (
				<div className="bg-white rounded-xl border border-gray-200 p-5">
					<h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Failover Control</h3>
					<div className="flex items-center gap-2 mb-4">
						<span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
							failoverEnabled === null ? "bg-gray-300 animate-pulse" :
							failoverEnabled ? "bg-yellow-400" : "bg-green-500"
						}`} />
						<span className="text-sm font-medium text-gray-800">
							{failoverEnabled === null ? "Checking…" : failoverEnabled ? "Backup active" : "Primary active"}
						</span>
					</div>
					{failoverError && (
						<p className="text-sm text-red-600 mb-3">{failoverError}</p>
					)}
					<div className="flex items-center gap-3">
						{failoverEnabled === false && (
							<button
								onClick={() => handleToggleFailover(true)}
								disabled={failoverLoading}
								className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
							>
								{failoverLoading ? "Switching…" : "Switch to backup"}
							</button>
						)}
						{failoverEnabled === true && (
							<button
								onClick={() => handleToggleFailover(false)}
								disabled={failoverLoading}
								className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
							>
								{failoverLoading ? "Reverting…" : "Revert to primary"}
							</button>
						)}
					</div>
					<p className="mt-3 text-xs text-gray-400">
						Switching routes all clients to the backup DB on their next page load. Clients already on backup stay there until you revert and they reload.
					</p>
				</div>
			)}

			{/* Quick links */}
			<div className="bg-white rounded-xl border border-gray-200 p-5">
				<h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Dashboard Links</h3>
				<div className="flex flex-wrap gap-3 text-xs">
					{[
						{ label: "Overview", path: "" },
						{ label: "DB logs", path: "logs/postgres-logs" },
						{ label: "Function logs", path: "logs/edge-functions" },
						{ label: "Auth users", path: "auth/users" },
						{ label: "Storage", path: "storage/buckets" },
						{ label: "Billing", path: "settings/billing" },
					].map(({ label, path }) => (
						<a
							key={label}
							href={`https://supabase.com/dashboard/project/${projectRef}/${path}`}
							target="_blank"
							rel="noreferrer"
							className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-all"
						>
							{label} ↗
						</a>
					))}
				</div>
			</div>
		</div>
	);
};
