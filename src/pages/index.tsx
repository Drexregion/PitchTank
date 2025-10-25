import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Navbar } from "../components/Navbar";
import { Event } from "../types/Event";
import { useAuth } from "../hooks/useAuth";

const HomePage: React.FC = () => {
	const [events, setEvents] = useState<Event[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	// const { user, isAdmin } = useAuth();
	const { isAdmin } = useAuth();

	// Fetch events
	useEffect(() => {
		const fetchEvents = async () => {
			try {
				setIsLoading(true);
				setError(null);

				// Query events, order by start_time (newest first)
				console.log("Fetching events...");
				const { data, error: fetchError } = await supabase
					.from("events")
					.select("*")
					.order("start_time", { ascending: false });
				console.log("Events fetched successfully");

				if (fetchError) throw fetchError;

				setEvents(data || []);
			} catch (err: any) {
				setError(err.message || "Failed to fetch events");
			} finally {
				setIsLoading(false);
			}
		};

		fetchEvents();

		// // Subscribe to realtime updates for events
		// const eventsSubscription = supabase
		//   .channel('events_changes')
		//   .on('postgres_changes', {
		//     event: '*',
		//     schema: 'public',
		//     table: 'events'
		//   }, () => {
		//     fetchEvents();
		//   })
		//   .subscribe();

		// return () => {
		//   supabase.removeChannel(eventsSubscription);
		// };
	}, []);

	// Get event status badge
	const getEventStatusBadge = (status: string) => {
		const statusClasses = {
			active: "bg-green-500/20 text-green-300 border border-green-500/50",
			completed: "bg-blue-500/20 text-blue-300 border border-blue-500/50",
			draft: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50",
			cancelled: "bg-red-500/20 text-red-300 border border-red-500/50",
		};

		return (
			<span
				className={`px-2 py-1 rounded-full text-xs font-medium ${
					statusClasses[status as keyof typeof statusClasses] ||
					"bg-dark-700 text-dark-300 border border-dark-600"
				}`}
			>
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</span>
		);
	};

	// Format date for display
	const formatEventDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<div className="min-h-screen">
			<Navbar />

			<div className="container mx-auto px-4 py-8">
				<div className="flex justify-between items-center mb-8">
					<h1 className="text-3xl font-bold bg-gradient-to-r from-accent-cyan to-primary-400 bg-clip-text text-transparent">
						Pitch Tank Events
					</h1>
					{isAdmin && (
						<Link to="/admin/events/new" className="btn-primary">
							Create Event
						</Link>
					)}
				</div>

				{isLoading ? (
					<div className="flex justify-center py-12">
						<div className="text-lg text-dark-200">Loading events...</div>
					</div>
				) : error ? (
					<div className="bg-red-500/20 border border-red-500/50 text-red-400 p-4 rounded-lg">
						{error}
					</div>
				) : events.length === 0 ? (
					<div className="card-dark p-8 text-center">
						<h2 className="text-xl font-semibold mb-2 text-white">
							No Events Available
						</h2>
						<p className="text-dark-300">
							{isAdmin
								? 'Click the "Create Event" button to get started.'
								: "Check back later for upcoming events."}
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{events.map((event) => (
							<div
								key={event.id}
								className="card-dark overflow-hidden hover:shadow-glow-lg transition-all duration-300"
							>
								<div className="p-6">
									<div className="flex justify-between items-start">
										<h2 className="text-xl font-bold mb-2 text-white">
											{event.name}
										</h2>
										{getEventStatusBadge(event.status)}
									</div>

									{event.description && (
										<p className="text-dark-300 mb-4 line-clamp-2">
											{event.description}
										</p>
									)}

									<div className="text-sm text-dark-400 mb-4">
										<div>
											<span className="font-medium text-dark-200">Starts:</span>{" "}
											{formatEventDate(event.start_time)}
										</div>
										<div>
											<span className="font-medium text-dark-200">Ends:</span>{" "}
											{formatEventDate(event.end_time)}
										</div>
									</div>

									<Link
										to={`/events/${event.id}`}
										className="inline-block btn-primary"
									>
										View Event
									</Link>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default HomePage;
