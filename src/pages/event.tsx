import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { TradeModal } from "../components/TradeModal";
import { Leaderboard } from "../components/Leaderboard";
import { QRShareModal } from "../components/QRShareModal";
import { useAuth } from "../hooks/useAuth";
import { usePortfolio } from "../hooks/usePortfolio";
import { Event } from "../types/Event";
import { FounderWithPrice } from "../types/Founder";
import { calculateCurrentPrice, calculateMarketCap } from "../lib/ammEngine";

const EventPage: React.FC = () => {
	const { eventId } = useParams<{ eventId: string }>();
	const navigate = useNavigate();
	const [event, setEvent] = useState<Event | null>(null);
	const [founders, setFounders] = useState<FounderWithPrice[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"trade" | "leaderboard">("trade");
	const [showQRModal, setShowQRModal] = useState(false);
	const [showEventInfoModal, setShowEventInfoModal] = useState(false);
	const [showSignInNotification, setShowSignInNotification] = useState(false);
	const [selectedFounder, setSelectedFounder] =
		useState<FounderWithPrice | null>(null);
	const [investorId, setInvestorId] = useState<string | null>(null);
	const [sortBy, setSortBy] = useState<"price" | "alphabetical">("price");
	const [showSortOptions, setShowSortOptions] = useState(false);
	const { user } = useAuth();

	// Get investor portfolio if logged in
	const { investor, holdings, totalValue, roiPercent } = usePortfolio({
		investorId: investorId || undefined,
	});

	useEffect(() => {
		const fetchEventDetails = async () => {
			if (!eventId) {
				setError("No event ID provided");
				setIsLoading(false);
				return;
			}

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

				// If user is logged in, get their investor record
				if (user) {
					const { data: investorData } = await supabase
						.from("investors")
						.select("*")
						.eq("user_id", user.id)
						.eq("event_id", eventId)
						.single();

					if (investorData) {
						setInvestorId(investorData.id);
					}
				}

				// Fetch founders for this event
				const { data: foundersData, error: foundersError } = await supabase
					.from("founders")
					.select("*")
					.eq("event_id", eventId);

				if (foundersError) throw foundersError;

				// Calculate current price and market cap for each founder
				const foundersWithPrice: FounderWithPrice[] = foundersData.map(
					(founder) => ({
						...founder,
						current_price: calculateCurrentPrice(founder),
						market_cap: calculateMarketCap(founder),
					})
				);

				// Sort by market cap (highest first)
				foundersWithPrice.sort((a, b) => b.market_cap - a.market_cap);

				setFounders(foundersWithPrice);
				setIsLoading(false);
			} catch (err: any) {
				setError(err.message || "Failed to load event details");
				setIsLoading(false);
			}
		};

		fetchEventDetails();

		// Set up realtime subscription for founders updates
		if (eventId) {
			const foundersChannel = supabase
				.channel(`founders_event_${eventId}`)
				.on(
					"postgres_changes",
					{
						event: "UPDATE",
						schema: "public",
						table: "founders",
						filter: `event_id=eq.${eventId}`,
					},
					async () => {
						// Refetch founders when there's an update
						const { data: foundersData } = await supabase
							.from("founders")
							.select("*")
							.eq("event_id", eventId);

						if (foundersData) {
							const updated = foundersData.map((founder) => ({
								...founder,
								current_price: calculateCurrentPrice(founder),
								market_cap: calculateMarketCap(founder),
							}));

							// Sort by market cap (highest first)
							updated.sort((a, b) => b.market_cap - a.market_cap);

							setFounders(updated);
						}
					}
				)
				.subscribe();

			return () => {
				supabase.removeChannel(foundersChannel);
			};
		}
	}, [eventId, user]);

	const handleSignIn = () => {
		navigate(`/login?redirect=/event/${eventId}`);
		setShowSignInNotification(false);
	};

	// Format date for display
	const formatEventDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Check if event is currently active
	const isEventActive = (event: Event) => {
		const now = new Date();
		const startTime = new Date(event.start_time);
		const endTime = new Date(event.end_time);
		return now >= startTime && now <= endTime && event.status === "active";
	};

	const handleBuyClick = (founder: FounderWithPrice) => {
		if (!user) {
			setShowSignInNotification(true);
			return;
		}
		setSelectedFounder(founder);
	};

	const handleSellClick = (founder: FounderWithPrice) => {
		if (!user) {
			setShowSignInNotification(true);
			return;
		}
		setSelectedFounder(founder);
	};

	// Get owned shares for a founder
	const getOwnedShares = (founderId: string) => {
		const holding = holdings.find((h) => h.founder_id === founderId);
		return holding ? holding.shares : 0;
	};

	// Format currency
	const formatCurrency = (value: number) => {
		return value.toLocaleString("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		});
	};

	// Sort founders based on selected sort option
	const sortedFounders = [...founders].sort((a, b) => {
		if (sortBy === "alphabetical") {
			return a.name.localeCompare(b.name);
		} else {
			// Sort by price (highest first)
			return b.current_price - a.current_price;
		}
	});

	return (
		<div className="min-h-screen relative overflow-hidden">
			{/* Fancy animated background */}
			<div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
				{/* Animated gradient orbs */}
				<div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/30 rounded-full blur-3xl animate-pulse" />
				<div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-cyan/20 rounded-full blur-3xl animate-pulse delay-1000" />
				<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/10 rounded-full blur-3xl" />

				{/* Grid pattern overlay */}
				<div className="absolute inset-0 bg-[linear-gradient(rgba(0,82,179,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,82,179,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />
			</div>

			{/* Content */}
			<div className="relative z-10">
				{/* Custom Header with Back Button, Event Name, and Status */}
				{!isLoading && event && (
					<div className="bg-dark-900/95 backdrop-blur-sm border-b border-primary-500/20 sticky top-0 z-50">
						<div className="px-4 py-4">
							<div className="flex items-center justify-between gap-4">
								{/* Back Button */}
								<button
									onClick={() => navigate("/")}
									className="p-2 hover:bg-dark-800 rounded-lg transition-colors flex-shrink-0"
								>
									<svg
										className="w-6 h-6 text-white"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M10 19l-7-7m0 0l7-7m-7 7h18"
										/>
									</svg>
								</button>

								{/* Event Name and Status */}
								<div className="flex-1 min-w-0 flex items-center gap-3">
									<h1 className="text-xl md:text-2xl font-bold text-white truncate">
										{event.name}
									</h1>
									<div
										className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
											event.status === "active" && isEventActive(event)
												? "bg-green-500/20 text-green-300 border border-green-500/50"
												: event.status === "completed" ||
												  (event.status === "active" && !isEventActive(event))
												? "bg-red-500/20 text-red-300 border border-red-500/50"
												: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
										}`}
									>
										{event.status === "active" && isEventActive(event)
											? "Active"
											: event.status === "active" && !isEventActive(event)
											? "Ended"
											: event.status === "completed"
											? "Ended"
											: event.status.charAt(0).toUpperCase() +
											  event.status.slice(1)}
									</div>
								</div>

								{/* Info Icon */}
								<button
									onClick={() => setShowEventInfoModal(true)}
									className="p-2 hover:bg-dark-800 rounded-lg transition-colors flex-shrink-0"
								>
									<svg
										className="w-6 h-6 text-primary-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								</button>
							</div>
						</div>

						{/* Tabs - Full Width with Padding */}
						<div className="px-4 pb-2 flex gap-2">
							<button
								onClick={() => setActiveTab("trade")}
								className={`flex-1 py-3 rounded-lg font-medium transition-all ${
									activeTab === "trade"
										? "bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-glow"
										: "bg-dark-800 text-dark-400 hover:text-white border border-dark-700"
								}`}
							>
								Trade
							</button>
							<button
								onClick={() => setActiveTab("leaderboard")}
								className={`flex-1 py-3 rounded-lg font-medium transition-all ${
									activeTab === "leaderboard"
										? "bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-glow"
										: "bg-dark-800 text-dark-400 hover:text-white border border-dark-700"
								}`}
							>
								Leaderboard
							</button>
						</div>
					</div>
				)}

				<div className="px-1 py-6 max-w-7xl mx-auto">
					{isLoading ? (
						<div className="flex justify-center py-12">
							<div className="text-lg text-white">Loading event details...</div>
						</div>
					) : error ? (
						<div className="bg-red-500/20 border border-red-500/50 text-red-400 p-4 rounded-lg mb-4">
							{error}
						</div>
					) : !event ? (
						<div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 p-4 rounded-lg mb-4">
							Event not found.
						</div>
					) : (
						<>
							{/* Tab Content */}
							{activeTab === "trade" ? (
								<>
									{/* Compact Portfolio Display - Mobile */}
									{user && investor && (
										<div className="mb-4 md:mb-6">
											{/* Mobile: Compact horizontal layout */}
											<div className="card-dark border border-accent-cyan/30 md:hidden">
												<div className="flex items-center justify-between gap-2 text-center">
													<div className="flex-1 border-r border-dark-700">
														<p className="text-xs text-dark-400 mb-1">Liquid</p>
														<p className="text-sm font-bold text-accent-cyan">
															{formatCurrency(investor.current_balance)}
														</p>
													</div>
													<div className="flex-1 border-r border-dark-700">
														<p className="text-xs text-dark-400 mb-1">
															Net Worth
														</p>
														<p className="text-sm font-bold text-white">
															{formatCurrency(totalValue)}
														</p>
													</div>
													<div className="flex-1">
														<p className="text-xs text-dark-400 mb-1">ROI</p>
														<p
															className={`text-sm font-bold ${
																roiPercent >= 0
																	? "text-green-400"
																	: "text-red-400"
															}`}
														>
															{roiPercent >= 0 ? "+" : ""}
															{roiPercent.toFixed(1)}%
														</p>
													</div>
												</div>
											</div>

											{/* Desktop: Full layout */}
											<div className="card-dark border border-accent-cyan/30 shadow-glow hidden md:block">
												<div className="flex items-center justify-between gap-6">
													<div className="flex items-center gap-3">
														<div className="w-12 h-12 bg-gradient-to-br from-accent-cyan to-primary-500 rounded-full flex items-center justify-center">
															<svg
																className="w-6 h-6 text-white"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
																/>
															</svg>
														</div>
														<div>
															<p className="text-sm text-dark-400">
																Liquid Capital
															</p>
															<p className="text-2xl font-bold text-accent-cyan">
																{formatCurrency(investor.current_balance)}
															</p>
														</div>
													</div>
													<div className="text-right">
														<p className="text-sm text-dark-400">Net Worth</p>
														<p className="text-2xl font-bold text-white">
															{formatCurrency(totalValue)}
														</p>
													</div>
													<div className="text-right">
														<p className="text-sm text-dark-400">ROI</p>
														<p
															className={`text-2xl font-bold ${
																roiPercent >= 0
																	? "text-green-400"
																	: "text-red-400"
															}`}
														>
															{roiPercent >= 0 ? "+" : ""}
															{roiPercent.toFixed(2)}%
														</p>
													</div>
												</div>
											</div>
										</div>
									)}

									{/* Sort/Filter Options */}
									<div className="mb-4 flex justify-end gap-2">
										{/* Mobile: Dropdown button */}
										<div className="relative md:hidden">
											<button
												onClick={() => setShowSortOptions(!showSortOptions)}
												className="px-4 py-2 bg-dark-800 border border-dark-700 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
											>
												<span>
													{sortBy === "price" ? "Highest Price" : "A-Z"}
												</span>
												<svg
													className="w-4 h-4"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M19 9l-7 7-7-7"
													/>
												</svg>
											</button>
											{showSortOptions && (
												<div className="absolute right-0 mt-2 w-48 bg-dark-800 border border-dark-700 rounded-lg shadow-lg z-10">
													<button
														onClick={() => {
															setSortBy("price");
															setShowSortOptions(false);
														}}
														className={`w-full px-4 py-3 text-left text-sm transition-colors rounded-t-lg ${
															sortBy === "price"
																? "bg-primary-600 text-white"
																: "text-dark-300 hover:bg-dark-700"
														}`}
													>
														Highest Price
													</button>
													<button
														onClick={() => {
															setSortBy("alphabetical");
															setShowSortOptions(false);
														}}
														className={`w-full px-4 py-3 text-left text-sm transition-colors rounded-b-lg ${
															sortBy === "alphabetical"
																? "bg-primary-600 text-white"
																: "text-dark-300 hover:bg-dark-700"
														}`}
													>
														A-Z
													</button>
												</div>
											)}
										</div>

										{/* Desktop: Full buttons */}
										<div className="hidden md:flex gap-2">
											<button
												onClick={() => setSortBy("price")}
												className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
													sortBy === "price"
														? "bg-primary-600 text-white shadow-glow-sm"
														: "bg-dark-800 text-dark-400 hover:text-white border border-dark-700"
												}`}
											>
												Highest Price
											</button>
											<button
												onClick={() => setSortBy("alphabetical")}
												className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
													sortBy === "alphabetical"
														? "bg-primary-600 text-white shadow-glow-sm"
														: "bg-dark-800 text-dark-400 hover:text-white border border-dark-700"
												}`}
											>
												A-Z
											</button>
										</div>
									</div>

									{/* Founders Trading Table - Mobile & Desktop */}
									<div className="card-dark overflow-hidden shadow-glow border border-primary-500/20">
										{sortedFounders.length === 0 ? (
											<div className="p-8 text-center">
												<p className="text-dark-400">
													No founders available for this event.
												</p>
											</div>
										) : (
											<>
												{/* Mobile View */}
												<div className="overflow-x-auto md:hidden">
													<table className="w-full">
														<tbody className="divide-y divide-dark-700">
															{sortedFounders.map((founder, index) => (
																<React.Fragment key={founder.id}>
																	{/* Founder Name Row - Full Width */}
																	<tr className="bg-dark-800/30">
																		<td colSpan={4} className="py-2 px-4">
																			<div className="flex items-center justify-between">
																				<h3 className="text-base font-bold text-white">
																					{founder.name}
																				</h3>
																				<span className="text-xs text-dark-400">
																					Cap:{" "}
																					{formatCurrency(founder.market_cap)}
																				</span>
																			</div>
																		</td>
																	</tr>
																	{/* Founder Details Row */}
																	<tr className="hover:bg-dark-800/50 transition-colors">
																		{/* Profile Picture/Rank */}
																		<td className="py-3 px-4 w-1/4">
																			<div className="flex flex-col items-center">
																				<div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-accent-cyan rounded-full flex items-center justify-center text-white font-bold text-lg mb-1">
																					{index + 1}
																				</div>
																				<p className="text-xs text-dark-400">
																					Rank
																				</p>
																			</div>
																		</td>
																		{/* Current Price */}
																		<td className="py-3 px-4 w-1/4">
																			<div className="flex flex-col items-center">
																				<span className="text-lg font-bold text-accent-cyan mb-1">
																					${founder.current_price.toFixed(2)}
																				</span>
																				<p className="text-xs text-dark-400">
																					Price
																				</p>
																			</div>
																		</td>
																		{/* Owned Shares */}
																		<td className="py-3 px-4 w-1/4">
																			<div className="flex flex-col items-center">
																				<span className="text-base font-medium text-white mb-1">
																					{user
																						? getOwnedShares(
																								founder.id
																						  ).toLocaleString()
																						: "-"}
																				</span>
																				<p className="text-xs text-dark-400">
																					Owned
																				</p>
																			</div>
																		</td>
																		{/* Buy/Sell Buttons */}
																		<td className="py-3 px-4 w-1/4">
																			<div className="flex flex-col gap-1.5">
																				<button
																					onClick={() =>
																						handleBuyClick(founder)
																					}
																					className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-all shadow-md hover:shadow-glow-sm w-full"
																				>
																					Buy
																				</button>
																				<button
																					onClick={() =>
																						handleSellClick(founder)
																					}
																					disabled={
																						!user ||
																						getOwnedShares(founder.id) === 0
																					}
																					className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all w-full ${
																						!user ||
																						getOwnedShares(founder.id) === 0
																							? "bg-dark-700 text-dark-500 cursor-not-allowed"
																							: "bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-glow-sm"
																					}`}
																				>
																					Sell
																				</button>
																			</div>
																		</td>
																	</tr>
																</React.Fragment>
															))}
														</tbody>
													</table>
												</div>

												{/* Desktop View */}
												<div className="hidden md:block overflow-x-auto">
													<table className="w-full">
														<thead>
															<tr className="border-b border-dark-700 text-left text-sm text-dark-400">
																<th className="py-3 px-4">Rank</th>
																<th className="py-3 px-4">Founder</th>
																<th className="py-3 px-4 text-right">Price</th>
																<th className="py-3 px-4 text-right">
																	Market Cap
																</th>
																<th className="py-3 px-4 text-right">
																	Shares Owned
																</th>
																<th className="py-3 px-4 text-right">Value</th>
																<th className="py-3 px-4 text-center">
																	Actions
																</th>
															</tr>
														</thead>
														<tbody className="divide-y divide-dark-700">
															{sortedFounders.map((founder, index) => {
																const ownedShares = getOwnedShares(founder.id);
																const ownedValue =
																	ownedShares * founder.current_price;

																return (
																	<tr
																		key={founder.id}
																		className="hover:bg-dark-800/50 transition-colors"
																	>
																		{/* Rank */}
																		<td className="py-4 px-4">
																			<div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-accent-cyan rounded-full flex items-center justify-center text-white font-bold">
																				{index + 1}
																			</div>
																		</td>
																		{/* Founder Name */}
																		<td className="py-4 px-4">
																			<h3 className="text-white font-semibold text-lg">
																				{founder.name}
																			</h3>
																		</td>
																		{/* Price */}
																		<td className="py-4 px-4 text-right">
																			<span className="text-xl font-bold text-accent-cyan">
																				${founder.current_price.toFixed(2)}
																			</span>
																		</td>
																		{/* Market Cap */}
																		<td className="py-4 px-4 text-right">
																			<span className="text-white font-medium">
																				{formatCurrency(founder.market_cap)}
																			</span>
																		</td>
																		{/* Shares Owned */}
																		<td className="py-4 px-4 text-right">
																			<span className="text-white font-medium text-lg">
																				{user
																					? ownedShares.toLocaleString()
																					: "-"}
																			</span>
																		</td>
																		{/* Value of Owned Shares */}
																		<td className="py-4 px-4 text-right">
																			<span className="text-green-400 font-semibold">
																				{user && ownedShares > 0
																					? formatCurrency(ownedValue)
																					: "-"}
																			</span>
																		</td>
																		{/* Actions */}
																		<td className="py-4 px-4">
																			<div className="flex gap-2 justify-center">
																				<button
																					onClick={() =>
																						handleBuyClick(founder)
																					}
																					className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-glow-sm"
																				>
																					Buy
																				</button>
																				<button
																					onClick={() =>
																						handleSellClick(founder)
																					}
																					disabled={!user || ownedShares === 0}
																					className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
																						!user || ownedShares === 0
																							? "bg-dark-700 text-dark-500 cursor-not-allowed"
																							: "bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-glow-sm"
																					}`}
																				>
																					Sell
																				</button>
																			</div>
																		</td>
																	</tr>
																);
															})}
														</tbody>
													</table>
												</div>
											</>
										)}
									</div>
								</>
							) : (
								/* Leaderboard Tab */
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
									<Leaderboard eventId={eventId || ""} />
								</div>
							)}
						</>
					)}
				</div>
			</div>

			{/* Floating notification for non-signed-in users */}
			{!user && !isLoading && event && showSignInNotification && (
				<div
					className="fixed bottom-6 right-6 z-50 animate-bounce"
					onClick={handleSignIn}
				>
					<div className="bg-red-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 max-w-sm">
						<svg
							className="w-6 h-6 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						<p className="font-medium">Please sign in to start trading</p>
					</div>
				</div>
			)}

			{/* Event Info Modal */}
			{showEventInfoModal && event && (
				<div
					className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
					onClick={() => setShowEventInfoModal(false)}
				>
					<div
						className="bg-dark-900 rounded-xl border border-primary-500/30 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Modal Header */}
						<div className="sticky top-0 bg-dark-900 border-b border-dark-700 p-6">
							<div className="flex items-center justify-between">
								<h2 className="text-2xl font-bold text-white">Event Details</h2>
								<button
									onClick={() => setShowEventInfoModal(false)}
									className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
								>
									<svg
										className="w-6 h-6 text-dark-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>
						</div>

						{/* Modal Content */}
						<div className="p-6 space-y-6">
							{/* Event Name */}
							<div>
								<h3 className="text-lg font-bold bg-gradient-to-r from-accent-cyan via-primary-400 to-accent-cyan bg-clip-text text-transparent mb-2">
									{event.name}
								</h3>
								{event.description && (
									<p className="text-dark-300">{event.description}</p>
								)}
							</div>

							{/* Event Status */}
							<div>
								<p className="text-sm text-dark-400 mb-2">Status</p>
								<div
									className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
										event.status === "active" && isEventActive(event)
											? "bg-green-500/20 text-green-300 border border-green-500/50"
											: event.status === "completed" ||
											  (event.status === "active" && !isEventActive(event))
											? "bg-red-500/20 text-red-300 border border-red-500/50"
											: event.status === "draft"
											? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
											: "bg-red-500/20 text-red-300 border border-red-500/50"
									}`}
								>
									{event.status === "active" && isEventActive(event)
										? "Active"
										: event.status === "active" && !isEventActive(event)
										? "Ended"
										: event.status === "completed"
										? "Ended"
										: event.status.charAt(0).toUpperCase() +
										  event.status.slice(1)}
								</div>
							</div>

							{/* Event Times */}
							<div className="space-y-3">
								<div>
									<p className="text-sm text-dark-400 mb-1">Start Time</p>
									<p className="text-white font-medium">
										{formatEventDate(event.start_time)}
									</p>
								</div>
								<div>
									<p className="text-sm text-dark-400 mb-1">End Time</p>
									<p className="text-white font-medium">
										{formatEventDate(event.end_time)}
									</p>
								</div>
							</div>

							{/* Action Buttons */}
							<div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-dark-700">
								<button
									onClick={() => {
										setShowEventInfoModal(false);
										setShowQRModal(true);
									}}
									className="flex-1 px-4 py-3 bg-gradient-to-r from-accent-cyan to-primary-500 hover:from-accent-cyan/90 hover:to-primary-600 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-accent-cyan/50 flex items-center justify-center gap-2"
								>
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
										/>
									</svg>
									Share Event
								</button>
								{user && (
									<button
										onClick={() => {
											setShowEventInfoModal(false);
											navigate(`/dashboard/${eventId}`);
										}}
										className="flex-1 px-4 py-3 bg-dark-700 hover:bg-dark-600 border border-primary-500/30 text-white rounded-lg font-medium transition-all"
									>
										View Dashboard
									</button>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Modals */}
			<QRShareModal
				eventId={eventId || ""}
				eventName={event?.name || ""}
				isOpen={showQRModal}
				onClose={() => setShowQRModal(false)}
			/>

			{selectedFounder && investorId && investor && (
				<TradeModal
					isOpen={true}
					onClose={() => setSelectedFounder(null)}
					founder={selectedFounder}
					investorId={investorId}
					investorBalance={investor.current_balance}
					onTradeComplete={() => {
						// Refetch will happen automatically via realtime subscriptions
						setSelectedFounder(null);
					}}
				/>
			)}
		</div>
	);
};

export default EventPage;
