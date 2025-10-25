import React, { useState, useEffect } from "react";
import { useRealtimePrices } from "../hooks/useRealtimePrices";
import { usePortfolio } from "../hooks/usePortfolio";
import { Leaderboard } from "./Leaderboard";
import { PortfolioCard } from "./PortfolioCard";
import { FounderStockCard } from "./FounderStockCard";
import { supabase } from "../lib/supabaseClient";
import { Event } from "../types/Event";
import { Investor, InvestorWithPortfolio } from "../types/Investor";

interface DashboardProps {
	eventId: string;
	investorId?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({
	eventId,
	investorId,
}) => {
	const [event, setEvent] = useState<Event | null>(null);
	const [investor, setInvestor] = useState<Investor | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	// Get realtime founder prices
	const {
		founders,
		isLoading: foundersLoading,
		error: foundersError,
	} = useRealtimePrices({ eventId });

	// Get investor portfolio if investorId is provided
	const {
		investor: investorWithPortfolio,
		holdings,
		portfolioValue,
		totalValue,
		roiPercent,
	} = usePortfolio({ investorId });

	// Load event details
	useEffect(() => {
		const fetchEventDetails = async () => {
			try {
				setIsLoading(true);
				setError(null);

				// Get event details
				const { data: eventData, error: eventError } = await supabase
					.from("events")
					.select("*")
					.eq("id", eventId)
					.single();

				if (eventError) throw eventError;
				setEvent(eventData);

				// Get investor details if provided
				if (investorId) {
					const { data: investorData, error: investorError } = await supabase
						.from("investors")
						.select("*")
						.eq("id", investorId)
						.single();

					if (investorError) throw investorError;
					setInvestor(investorData);
				}

				setIsLoading(false);
			} catch (err: any) {
				setError(err.message || "Failed to load event details");
				setIsLoading(false);
			}
		};

		fetchEventDetails();
	}, [eventId, investorId]);

	// Prepare portfolio data for the PortfolioCard component
	const portfolioData: InvestorWithPortfolio | null = investorWithPortfolio
		? {
				...investorWithPortfolio,
				holdings,
				portfolio_value: portfolioValue,
				total_value: totalValue,
				roi_percent: roiPercent,
		  }
		: null;

	if (isLoading) {
		return (
			<div className="flex justify-center items-center min-h-screen">
				<div className="text-lg text-dark-100">Loading event data...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex justify-center items-center min-h-screen">
				<div className="text-lg text-red-400">Error: {error}</div>
			</div>
		);
	}

	if (!event) {
		return (
			<div className="flex justify-center items-center min-h-screen">
				<div className="text-lg text-dark-100">Event not found</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8">
			{/* Event Header */}
			<header className="mb-8">
				<h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-accent-cyan to-primary-400 bg-clip-text text-transparent">
					{event.name}
				</h1>
				{event.description && (
					<p className="text-dark-200">{event.description}</p>
				)}
				<div className="flex items-center mt-3">
					<div
						className={`px-3 py-1 rounded-full text-sm font-medium ${
							event.status === "active"
								? "bg-green-500/20 text-green-300 border border-green-500/50"
								: event.status === "completed"
								? "bg-blue-500/20 text-blue-300 border border-blue-500/50"
								: event.status === "draft"
								? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
								: "bg-red-500/20 text-red-300 border border-red-500/50"
						}`}
					>
						{event.status.charAt(0).toUpperCase() + event.status.slice(1)}
					</div>
					<div className="ml-4 text-sm text-dark-300">
						{new Date(event.start_time).toLocaleDateString()} to{" "}
						{new Date(event.end_time).toLocaleDateString()}
					</div>
				</div>
			</header>

			{/* Main Dashboard Content */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Column - Portfolio (if investor is viewing) */}
				{investorId && portfolioData && (
					<div>
						<PortfolioCard investor={portfolioData} className="mb-6" />
					</div>
				)}

				{/* Middle/Main Column - Founders List */}
				<div className={`${investorId ? "lg:col-span-2" : "lg:col-span-2"}`}>
					<h2 className="text-xl font-bold mb-4 text-white">Founders</h2>

					{foundersLoading ? (
						<div className="text-center py-8 text-dark-200">
							Loading founders data...
						</div>
					) : foundersError ? (
						<div className="text-center py-8 text-red-400">
							Error: {foundersError}
						</div>
					) : founders.length === 0 ? (
						<div className="text-center py-8 text-dark-200">
							No founders available for this event
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							{founders.map((founder) => (
								<FounderStockCard
									key={founder.id}
									founder={founder}
									investorId={investorId}
									investorBalance={investor?.current_balance}
									showPriceChart={true}
								/>
							))}
						</div>
					)}
				</div>

				{/* Right Column - Leaderboard */}
				<div className="lg:col-span-1">
					<Leaderboard eventId={eventId} className="mb-6" />
				</div>
			</div>
		</div>
	);
};
