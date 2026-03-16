import React, { useState, useEffect, useRef } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Navbar } from "../components/Navbar";
import { EventSetupForm } from "../components/EventSetupForm";
import { FounderInvitationManager } from "../components/FounderInvitationManager";
import { DatabaseTest } from "../components/DatabaseTest";
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
	const [activeView, setActiveView] = useState<"list" | "new" | "invitations">(
		"list"
	);
	const { user, isAdmin, isLoading } = useAuth();
	const location = useLocation();
	const [closingMinutes, setClosingMinutes] = useState<Record<string, number>>({});
	const adminTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

		const fetchEvents = async () => {
			try {
				console.log("Fetching events...");
				setIsLoadingEvents(true);
				setError(null);

				// Query events
				const { data, error: fetchError } = await supabase
					.from("events")
					.select("*")
					.order("created_at", { ascending: false });

				console.log("Events query result:", { data, error: fetchError });

				if (fetchError) {
					console.error("Events fetch error:", fetchError);
					throw fetchError;
				}

				console.log("Events loaded successfully:", data);
				setEvents(data || []);
			} catch (err: any) {
				console.error("Events fetch exception:", err);
				setError(err.message || "Failed to fetch events");
			} finally {
				console.log("Events fetch complete");
				setIsLoadingEvents(false);
			}
		};

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
	}, [user, isAdmin]);

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

	// Handle status update (kept as emergency override)
	const handleStatusUpdate = async (eventId: string, newStatus: string) => {
		try {
			const { error: updateError } = await supabase
				.from("events")
				.update({ status: newStatus })
				.eq("id", eventId);

			if (updateError) throw updateError;
		} catch (err: any) {
			setError(err.message || "Failed to update event status");
		}
	};

	const handleStartTrading = async (eventId: string) => {
		const { error: updateError } = await supabase
			.from("events")
			.update({ status: "active" })
			.eq("id", eventId);
		if (updateError) setError(updateError.message);
	};

	const handleEndTradingCountdown = async (eventId: string, minutes: number) => {
		const closingAt = new Date(Date.now() + minutes * 60_000).toISOString();
		const { error: updateError } = await supabase
			.from("events")
			.update({ closing_at: closingAt })
			.eq("id", eventId);
		if (updateError) { setError(updateError.message); return; }
		// Admin browser drives the final status update when timer fires
		adminTimersRef.current[eventId] = setTimeout(async () => {
			await supabase
				.from("events")
				.update({ status: "completed", closing_at: null })
				.eq("id", eventId);
			delete adminTimersRef.current[eventId];
		}, minutes * 60_000);
	};

	const handleCancelClosingCountdown = async (eventId: string) => {
		clearTimeout(adminTimersRef.current[eventId]);
		delete adminTimersRef.current[eventId];
		const { error: updateError } = await supabase
			.from("events")
			.update({ closing_at: null })
			.eq("id", eventId);
		if (updateError) setError(updateError.message);
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
						{activeView === "new" && (
							<button
								onClick={() => setActiveView("list")}
								className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
							>
								Back to Events
							</button>
						)}
						{activeView === "invitations" && (
							<button
								onClick={() => setActiveView("list")}
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
						<button
							onClick={() => setActiveView("invitations")}
							className={`py-2 px-1 border-b-2 font-medium text-sm ${
								activeView === "invitations"
									? "border-blue-500 text-blue-600"
									: "border-transparent text-gray-500 hover:text-gray-700"
							}`}
						>
							Founder Invitations
						</button>
					</nav>
				</div>

				{/* Tab Content */}
				{activeView === "new" ? (
					<EventSetupForm onEventCreated={handleEventCreated} />
				) : activeView === "invitations" ? (
					<div className="space-y-6">
						<div className="flex justify-between items-center">
							<h2 className="text-xl font-semibold">
								Send Founder Invitations
							</h2>
						</div>

						{/* Database Test Component - Remove this after debugging */}
						<DatabaseTest />

						<FounderInvitationManager
							events={events}
							onInvitationsSent={() => {
								// Could add refresh logic here if needed
							}}
						/>
					</div>
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
							<div className="bg-white rounded-lg shadow overflow-hidden">
								<table className="min-w-full divide-y divide-gray-200">
									<thead className="bg-gray-50">
										<tr>
											<th
												scope="col"
												className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>
												Event
											</th>
											<th
												scope="col"
												className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>
												Status
											</th>
											<th
												scope="col"
												className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>
												Date
											</th>
											<th
												scope="col"
												className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>
												Created
											</th>
											<th scope="col" className="relative px-6 py-3">
												<span className="sr-only">Actions</span>
											</th>
										</tr>
									</thead>
									<tbody className="bg-white divide-y divide-gray-200">
										{events.map((event) => (
											<tr key={event.id} className="hover:bg-gray-50">
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="text-sm font-medium text-gray-900">
														{event.name}
													</div>
												</td>
												<td className="px-6 py-4">
													{/* Status badge */}
													<span className={`text-xs font-medium px-2 py-1 rounded-full ${
														event.status === "active"
															? "bg-green-100 text-green-800"
															: event.status === "completed"
															? "bg-blue-100 text-blue-800"
															: event.status === "draft"
															? "bg-yellow-100 text-yellow-800"
															: "bg-red-100 text-red-800"
													}`}>
														{event.status}
													</span>

													{/* Closing countdown (when running) */}
													{event.closing_at && new Date(event.closing_at) > new Date() && (
														<div className="mt-2 flex items-center gap-2">
															<p className="text-xs text-yellow-700">
																Closes in <CountdownDisplay target={event.closing_at} />
															</p>
															<button
																onClick={() => handleCancelClosingCountdown(event.id)}
																className="text-xs text-red-500 hover:underline"
															>
																Cancel
															</button>
														</div>
													)}

													{/* Start Trading (draft only) */}
													{event.status === "draft" && (
														<button
															onClick={() => handleStartTrading(event.id)}
															className="mt-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200 font-medium"
														>
															Start Trading
														</button>
													)}

													{/* End Trading (active only, no countdown running) */}
													{event.status === "active" && !event.closing_at && (
														<div className="flex items-center gap-1 mt-2">
															<select
																value={closingMinutes[event.id] ?? 1}
																onChange={(e) =>
																	setClosingMinutes(p => ({ ...p, [event.id]: Number(e.target.value) }))
																}
																className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
															>
																<option value={1}>1 min</option>
																<option value={3}>3 min</option>
																<option value={5}>5 min</option>
															</select>
															<button
																onClick={() => handleEndTradingCountdown(event.id, closingMinutes[event.id] ?? 1)}
																className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200 font-medium"
															>
																End Trading
															</button>
														</div>
													)}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{formatDate(event.start_time)}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{formatDate(event.created_at)}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
													<Link
														to={`/events/${event.id}`}
														className="text-green-600 hover:text-green-900"
													>
														View
													</Link>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
};

export default AdminPage;
