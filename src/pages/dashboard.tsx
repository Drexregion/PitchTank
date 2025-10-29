import React, { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Navbar } from "../components/Navbar";
import { Dashboard as DashboardComponent } from "../components/Dashboard";
// import { useAuth } from '../hooks/useAuth'; // Commented out for direct Supabase testing
import { Event } from "../types/Event";
import { Investor } from "../types/Investor";
import { User } from "@supabase/supabase-js";

const DashboardPage: React.FC = () => {
	const { eventId } = useParams<{ eventId: string }>();
	const [event, setEvent] = useState<Event | null>(null);
	const [investor, setInvestor] = useState<Investor | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [user, setUser] = useState<User | null>(null);

	console.log("in dashboard");
	console.log(eventId);

	// Get user directly from Supabase
	useEffect(() => {
		async function getSession() {
			setIsLoading(true);
			const { data, error } = await supabase.auth.getSession();

			if (error) {
				console.error("Error getting session:", error);
				setError(error.message);
				setIsLoading(false);
				return;
			}

			console.log("Session data:", data);

			if (data && data.session) {
				setUser(data.session.user);
			} else {
				console.log("No active session found");
			}

			setIsLoading(false);
		}

		getSession();
	}, []);

	useEffect(() => {
		if (!eventId || !user) {
			console.log("No eventId or user, skipping data fetch");
			return;
		}

		const fetchData = async () => {
			try {
				setIsLoading(true);
				setError(null);

				// Fetch event details
				const { data: eventData, error: eventError } = await supabase
					.from("events")
					.select("*")
					.eq("id", eventId)
					.single();

				if (eventError) throw eventError;
				setEvent(eventData);

				// Fetch investor linked to current user for this event using user_id
				let { data: investorData, error: investorError } = await supabase
					.from("investors")
					.select("*")
					.eq("event_id", eventId)
					.eq("user_id", user.id)
					.maybeSingle();

				// If no investor record exists and the event is active, create one
				if (!investorData && eventData.status === "active") {
					const { data: newInvestor, error: createError } = await supabase
						.from("investors")
						.insert({
							event_id: eventId,
							name: user.email?.split("@")[0] || "Investor",
							email: user.email,
							user_id: user.id,
							initial_balance: 1000000,
							current_balance: 1000000,
						})
						.select()
						.single();

					if (createError) {
						// Check if error is due to unique constraint - another request might have created it
						if (createError.code === "23505") {
							// Unique violation
							// Try fetching again
							const { data: refetchedInvestor } = await supabase
								.from("investors")
								.select("*")
								.eq("event_id", eventId)
								.eq("user_id", user.id)
								.single();

							investorData = refetchedInvestor;
						} else {
							throw createError;
						}
					} else {
						investorData = newInvestor;

						// Create investor role in user_roles table
						await supabase.from("user_roles").insert({
							user_id: user.id,
							role: "investor",
							event_id: eventId,
						});
					}
				} else if (investorError && investorError.code !== "PGRST116") {
					// PGRST116 means no rows returned, which is fine if user is not an investor
					throw investorError;
				}

				setInvestor(investorData);
			} catch (err: any) {
				setError(err.message || "Failed to load dashboard data");
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [eventId, user]);

	// If not authenticated and not loading, redirect to login
	if (!user && !isLoading) {
		console.log("No user found, redirecting to login");
		return (
			<Navigate to="/login" replace state={{ from: `/events/${eventId}` }} />
		);
	}

	// Add debugging information at top of component
	const debugAuthInfo = () => {
		return (
			<div className="bg-yellow-50 p-4 mb-4 rounded border border-yellow-300">
				<h3 className="font-bold mb-2">Debug Auth Info</h3>
				<div className="text-sm">
					<div>
						<strong>Loading:</strong> {isLoading ? "true" : "false"}
					</div>
					<div>
						<strong>User:</strong>{" "}
						{user ? `${user.id} (${user.email})` : "null"}
					</div>
					<div>
						<strong>Event ID:</strong> {eventId || "null"}
					</div>
					<div>
						<strong>Investor:</strong>{" "}
						{investor ? `${investor.id} (${investor.name})` : "null"}
					</div>
					<div>
						<strong>Error:</strong> {error || "none"}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="min-h-screen bg-gray-50">
			<Navbar />

			<div className="container mx-auto px-4 py-8">
				{debugAuthInfo()}
				{isLoading ? (
					<div className="flex justify-center py-12">
						<div className="text-lg text-gray-600">Loading dashboard...</div>
					</div>
				) : error ? (
					<div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
						{error}
					</div>
				) : !event ? (
					<div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg mb-4">
						Event not found.
					</div>
				) : (
					<>
						{!investor && (
							<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
								<div className="flex">
									<div className="flex-shrink-0">
										<svg
											className="h-5 w-5 text-yellow-400"
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fillRule="evenodd"
												d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
												clipRule="evenodd"
											/>
										</svg>
									</div>
									<div className="ml-3">
										<p className="text-sm text-yellow-700">
											You are viewing this event in read-only mode. Contact an
											administrator to become an investor.
										</p>
									</div>
								</div>
							</div>
						)}

						<DashboardComponent
							eventId={eventId || ""}
							investorId={investor?.id}
						/>
					</>
				)}
			</div>
		</div>
	);
};

export default DashboardPage;
