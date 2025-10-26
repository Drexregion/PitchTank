import React, { useState, useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Navbar } from "../components/Navbar";
import { EventSetupForm } from "../components/EventSetupForm";
import { FounderInvitationManager } from "../components/FounderInvitationManager";
import { DatabaseTest } from "../components/DatabaseTest";
import { useAuth } from "../hooks/useAuth";
import { Event } from "../types/Event";

const AdminPage: React.FC = () => {
	const [events, setEvents] = useState<Event[]>([]);
	const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [activeView, setActiveView] = useState<"list" | "new" | "invitations">(
		"list"
	);
	const { user, isAdmin, isLoading } = useAuth();
	const location = useLocation();

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

	// Handle status update
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
												<td className="px-6 py-4 whitespace-nowrap">
													<select
														value={event.status}
														onChange={(e) =>
															handleStatusUpdate(event.id, e.target.value)
														}
														className={`text-sm font-medium px-2 py-1 rounded-full ${
															event.status === "active"
																? "bg-green-100 text-green-800"
																: event.status === "completed"
																? "bg-blue-100 text-blue-800"
																: event.status === "draft"
																? "bg-yellow-100 text-yellow-800"
																: "bg-red-100 text-red-800"
														}`}
													>
														<option value="draft">Draft</option>
														<option value="active">Active</option>
														<option value="completed">Completed</option>
														<option value="cancelled">Cancelled</option>
													</select>
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{formatDate(event.start_time)}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{formatDate(event.created_at)}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
													<Link
														to={`/admin/events/${event.id}`}
														className="text-blue-600 hover:text-blue-900 mr-4"
													>
														Manage
													</Link>
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
