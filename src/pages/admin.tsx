import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Navbar } from "../components/Navbar";
import { EventSetupForm } from "../components/EventSetupForm";
import { useAuth } from "../hooks/useAuth";
import { Event } from "../types/Event";

const CountdownDisplay: React.FC<{ target: string }> = ({ target }) => {
	const [secs, setSecs] = useState(() =>
		Math.max(0, Math.round((new Date(target).getTime() - Date.now()) / 1000))
	);
	useEffect(() => {
		if (secs <= 0) return;
		const t = setTimeout(() => setSecs(s => Math.max(0, s - 1)), 1000);
		return () => clearTimeout(t);
	}, [secs]);
	return (
		<span className="tabular-nums font-bold">
			{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
		</span>
	);
};

const AdminPage: React.FC = () => {
	const [events, setEvents] = useState<Event[]>([]);
	const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [activeView, setActiveView] = useState<"list" | "new" | "edit">("list");
	const [editingEventId, setEditingEventId] = useState<string | null>(null);
	const { user, isAdmin, isLoading } = useAuth();
	const location = useLocation();
	const [closingMinutes, setClosingMinutes] = useState<Record<string, number>>({});
	const adminTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
	const [resetCountdown, setResetCountdown] = useState<Record<string, number | null>>({});
	const resetIntervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

	const fetchEvents = useCallback(async () => {
		try {
			setIsLoadingEvents(true);
			setError(null);

			const { data, error: fetchError } = await supabase
				.from("events")
				.select("*")
				.order("created_at", { ascending: false });

			if (fetchError) throw fetchError;
			setEvents(data || []);
		} catch (err: any) {
			setError(err.message || "Failed to fetch events");
		} finally {
			setIsLoadingEvents(false);
		}
	}, []);

	// Sync active view with deep links like /admin/events/new
	useEffect(() => {
		if (location.pathname.endsWith("/admin/events/new")) {
			setActiveView("new");
			return;
		}
		// Default to list on plain /admin
		if (location.pathname === "/admin") {
			setActiveView("list");
		}
	}, [location.pathname]);

	// Fetch events managed by this admin
	useEffect(() => {
		if (!user || !isAdmin) {
			setIsLoadingEvents(false);
			return;
		}

		fetchEvents();

		// Subscribe to realtime updates
		const eventsSubscription = supabase
			.channel("admin_events_changes")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "events",
				},
				() => {
					fetchEvents();
				}
			)
			.subscribe();

		// Add timeout to prevent infinite loading
		const timeout = setTimeout(() => {
			console.log("Events fetch timeout reached");
			setIsLoadingEvents(false);
		}, 10000); // 10 second timeout

		return () => {
			clearTimeout(timeout);
			supabase.removeChannel(eventsSubscription);
		};
	}, [user, isAdmin, fetchEvents]);

	// Show loading while auth is being checked
	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="text-gray-600">Checking admin access...</p>
				</div>
			</div>
		);
	}

	// If not admin, redirect to home
	if (!isAdmin) {
		return <Navigate to="/" replace />;
	}

	// Format date
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	// Handle event creation
	const handleEventCreated = (newEvent: Event) => {
		setEvents([newEvent, ...events]);
		setActiveView("list");
	};

	const handleEventUpdated = () => {
		fetchEvents();
		setActiveView("list");
		setEditingEventId(null);
	};

	const handleSetStatus = async (eventId: string, status: Event["status"]) => {
		const { error: updateError } = await supabase
			.from("events")
			.update({ status })
			.eq("id", eventId);
		if (updateError) setError(updateError.message);
		else fetchEvents();
	};

	const handleStartCountdown = async (eventId: string, minutes: number) => {
		const closingAt = new Date(Date.now() + minutes * 60_000).toISOString();
		const { error: updateError } = await supabase
			.from("events")
			.update({ closing_at: closingAt })
			.eq("id", eventId);
		if (updateError) { setError(updateError.message); return; }
		fetchEvents();
		// Admin browser drives the final status update when timer fires
		adminTimersRef.current[eventId] = setTimeout(async () => {
			await supabase
				.from("events")
				.update({ status: "completed", closing_at: null })
				.eq("id", eventId);
			delete adminTimersRef.current[eventId];
			fetchEvents();
		}, minutes * 60_000);
	};

	const handleResetTradingArm = (eventId: string) => {
		setResetCountdown(p => ({ ...p, [eventId]: 5 }));
		const interval = setInterval(() => {
			setResetCountdown(p => {
				const cur = p[eventId];
				if (cur == null || cur <= 1) {
					clearInterval(resetIntervalsRef.current[eventId]);
					delete resetIntervalsRef.current[eventId];
					return { ...p, [eventId]: null };
				}
				return { ...p, [eventId]: cur - 1 };
			});
		}, 1000);
		resetIntervalsRef.current[eventId] = interval;
	};

	const handleResetTradingCancel = (eventId: string) => {
		clearInterval(resetIntervalsRef.current[eventId]);
		delete resetIntervalsRef.current[eventId];
		setResetCountdown(p => ({ ...p, [eventId]: null }));
	};

	const handleResetTradingConfirm = async (eventId: string) => {
		clearInterval(resetIntervalsRef.current[eventId]);
		delete resetIntervalsRef.current[eventId];
		setResetCountdown(p => ({ ...p, [eventId]: null }));

		const { error: tradesError } = await supabase
			.from("trades")
			.delete()
			.eq("event_id", eventId);
		if (tradesError) { setError(tradesError.message); return; }

		const { data: founders, error: foundersError } = await supabase
			.from("founders")
			.select("id, k_constant")
			.eq("event_id", eventId);
		if (foundersError) { setError(foundersError.message); return; }

		const founderIds = (founders || []).map((f: { id: string; k_constant: number }) => f.id);
		if (founderIds.length > 0) {
			const { error: priceError } = await supabase
				.from("price_history")
				.delete()
				.in("founder_id", founderIds);
			if (priceError) { setError(priceError.message); return; }

			const { error: holdingsError } = await supabase
				.from("investor_holdings")
				.delete()
				.in("founder_id", founderIds);
			if (holdingsError) { setError(holdingsError.message); return; }

			for (const f of founders || []) {
				const initialShares = 100000;
				const initialCash = Number(f.k_constant) / initialShares;
				const { error: founderResetError } = await supabase
					.from("founders")
					.update({
						shares_in_pool: initialShares,
						cash_in_pool: initialCash,
						k_constant: f.k_constant,
					})
					.eq("id", f.id);
				if (founderResetError) { setError(founderResetError.message); return; }
			}
		}

		// Reset investor balances and re-issue initial phantom holdings
		const STARTING_CASH = 500000;
		const INITIAL_PRICE_PER_SHARE = 10;
		const SHARES_POOL_BUDGET = 500000;
		const sharesPerFounder = founders && founders.length > 0
			? Math.floor(SHARES_POOL_BUDGET / founders.length / INITIAL_PRICE_PER_SHARE)
			: 0;

		const { data: investors, error: investorsError } = await supabase
			.from("investors")
			.select("id")
			.eq("event_id", eventId);
		if (investorsError) { setError(investorsError.message); return; }

		for (const investor of investors || []) {
			const { error: balanceError } = await supabase
				.from("investors")
				.update({ current_balance: STARTING_CASH })
				.eq("id", investor.id);
			if (balanceError) { setError(balanceError.message); return; }

			if (sharesPerFounder > 0) {
				const holdingsToInsert = (founders || []).map((f: { id: string; k_constant: number }) => ({
					investor_id: investor.id,
					founder_id: f.id,
					shares: sharesPerFounder,
					cost_basis: INITIAL_PRICE_PER_SHARE,
				}));
				const { error: holdingsInsertError } = await supabase
					.from("investor_holdings")
					.insert(holdingsToInsert);
				if (holdingsInsertError) { setError(holdingsInsertError.message); return; }
			}
		}

		fetchEvents();
	};

	const handleCancelCountdown = async (eventId: string) => {
		clearTimeout(adminTimersRef.current[eventId]);
		delete adminTimersRef.current[eventId];
		const { error: updateError } = await supabase
			.from("events")
			.update({ closing_at: null })
			.eq("id", eventId);
		if (updateError) setError(updateError.message);
		else fetchEvents();
	};

	return (
		<div className="min-h-screen bg-gray-50 text-black">
			<Navbar />

			<div className="container mx-auto px-4 py-8">
				<div className="flex justify-between items-center mb-8">
					<h1 className="text-3xl font-bold">Admin Dashboard</h1>
					<div className="flex space-x-4">
						{activeView === "list" && (
							<button
								onClick={() => setActiveView("new")}
								className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
							>
								Create New Event
							</button>
						)}
						{(activeView === "new" || activeView === "edit") && (
							<button
								onClick={() => { setActiveView("list"); setEditingEventId(null); }}
								className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
							>
								Back to Events
							</button>
						)}
					</div>
				</div>

				{/* Navigation Tabs */}
				<div className="mb-6">
					<nav className="flex space-x-8">
						<button
							onClick={() => setActiveView("list")}
							className={`py-2 px-1 border-b-2 font-medium text-sm ${
								activeView === "list"
									? "border-blue-500 text-blue-600"
									: "border-transparent text-gray-500 hover:text-gray-700"
							}`}
						>
							Events
						</button>
					</nav>
				</div>

				{/* Tab Content */}
				{activeView === "new" ? (
					<EventSetupForm onEventCreated={handleEventCreated} />
				) : activeView === "edit" && editingEventId ? (
					<EventSetupForm
						eventId={editingEventId}
						onEventUpdated={handleEventUpdated}
					/>
				) : (
					<>
						{isLoadingEvents ? (
							<div className="flex justify-center py-12">
								<div className="text-lg text-gray-600">Loading events...</div>
							</div>
						) : error ? (
							<div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
								{error}
							</div>
						) : events.length === 0 ? (
							<div className="bg-white rounded-lg shadow-md p-8 text-center">
								<h2 className="text-xl font-semibold mb-2">
									No Events Created
								</h2>
								<p className="text-gray-600 mb-4">
									Create your first event to get started.
								</p>
								<button
									onClick={() => setActiveView("new")}
									className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
								>
									Create Event
								</button>
							</div>
						) : (
							<div className="space-y-4">
								{events.map((event) => {
									const countdownActive = !!event.closing_at && new Date(event.closing_at) > new Date();
									const statusStyles: Record<string, string> = {
										active: "bg-green-100 text-green-800 border-green-200",
										draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
										completed: "bg-blue-100 text-blue-800 border-blue-200",
										cancelled: "bg-red-100 text-red-800 border-red-200",
									};
									return (
										<div key={event.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
											{/* Header row */}
											<div className="flex items-start justify-between gap-4 mb-4">
												<div>
													<h3 className="text-base font-semibold text-gray-900">{event.name}</h3>
													<p className="text-xs text-gray-400 mt-0.5">
														{formatDate(event.start_time)} &mdash; created {formatDate(event.created_at)}
													</p>
												</div>
												<div className="flex items-center gap-2 flex-shrink-0">
													<span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusStyles[event.status] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
														{event.status}
													</span>
													<Link
														to={`/events/${event.id}`}
														className="text-xs text-blue-600 hover:underline font-medium"
													>
														View →
													</Link>
													<button
														onClick={() => { setEditingEventId(event.id); setActiveView("edit"); }}
														className="text-xs text-gray-500 hover:underline font-medium"
													>
														Edit →
													</button>
													<Link
														to={`/admin/events/${event.id}/applications`}
														className="text-xs text-purple-600 hover:underline font-medium"
													>
														Applications →
													</Link>
												</div>
											</div>

											{/* Controls */}
											<div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4 border-t border-gray-100">
												{/* Status switcher */}
												<div className="flex-1">
													<p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Set Status</p>
													<div className="flex flex-wrap gap-1.5">
														{(["draft", "active", "completed", "cancelled"] as const).map((s) => (
															<button
																key={s}
																onClick={() => handleSetStatus(event.id, s)}
																disabled={event.status === s}
																className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
																	event.status === s
																		? `${statusStyles[s]} cursor-default`
																		: "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700"
																}`}
															>
																{s.charAt(0).toUpperCase() + s.slice(1)}
															</button>
														))}
													</div>
												</div>

												{/* Reset trading data */}
												<div className="flex-shrink-0">
													<p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Reset Data</p>
													{resetCountdown[event.id] != null ? (
														<div className="flex items-center gap-1.5">
															<button
																onClick={() => handleResetTradingConfirm(event.id)}
																className="px-3 py-1 rounded-lg text-xs font-medium bg-red-600 text-white border border-red-700 hover:bg-red-700 transition-all"
															>
																Confirm Reset ({resetCountdown[event.id]}s)
															</button>
															<button
																onClick={() => handleResetTradingCancel(event.id)}
																className="px-3 py-1 rounded-lg text-xs font-medium bg-white text-gray-500 border border-gray-200 hover:border-gray-400 transition-all"
															>
																Cancel
															</button>
														</div>
													) : (
														<button
															onClick={() => handleResetTradingArm(event.id)}
															className="px-3 py-1 rounded-lg text-xs font-medium bg-white text-red-500 border border-red-200 hover:bg-red-50 hover:border-red-400 transition-all"
														>
															Reset Trading Data
														</button>
													)}
												</div>

												{/* Countdown controls — only relevant when active */}
												{event.status === "active" && (
													<div className="flex-shrink-0">
														<p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Close Countdown</p>
														{countdownActive ? (
															<div className="flex items-center gap-2">
																<span className="text-sm font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1 rounded-lg">
																	⏱ Closes in <CountdownDisplay target={event.closing_at!} />
																</span>
																<button
																	onClick={() => handleCancelCountdown(event.id)}
																	className="px-3 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all"
																>
																	Cancel
																</button>
															</div>
														) : (
															<div className="flex items-center gap-1.5">
																<select
																	value={closingMinutes[event.id] ?? 5}
																	onChange={(e) =>
																		setClosingMinutes(p => ({ ...p, [event.id]: Number(e.target.value) }))
																	}
																	className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white"
																>
																	<option value={1}>1 min</option>
																	<option value={2}>2 min</option>
																	<option value={3}>3 min</option>
																	<option value={5}>5 min</option>
																	<option value={10}>10 min</option>
																	<option value={15}>15 min</option>
																	<option value={30}>30 min</option>
																</select>
																<button
																	onClick={() => handleStartCountdown(event.id, closingMinutes[event.id] ?? 5)}
																	className="px-3 py-1 rounded-lg text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition-all"
																>
																	Start Countdown
																</button>
															</div>
														)}
													</div>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
};

export default AdminPage;
