import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { TradeModal } from "../components/TradeModal";
import { Leaderboard } from "../components/Leaderboard";
import { QRShareModal } from "../components/QRShareModal";
import { FounderPriceChart } from "../components/FounderPriceChart";
import { useAuth } from "../hooks/useAuth";
import { usePortfolio } from "../hooks/usePortfolio";
import { Event } from "../types/Event";
import { FounderWithPrice } from "../types/Founder";
import { FounderUser } from "../types/FounderUser";
import { calculateCurrentPrice, calculateMarketCap } from "../lib/ammEngine";

// Extended interface to include founder user details
interface FounderWithPriceAndUser extends FounderWithPrice {
	founder_user: FounderUser | null;
}

const EventPage: React.FC = () => {
	const { eventId } = useParams<{ eventId: string }>();
	const navigate = useNavigate();
	const [event, setEvent] = useState<Event | null>(null);
	const [founders, setFounders] = useState<FounderWithPriceAndUser[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"trade" | "leaderboard">("trade");
	const [showQRModal, setShowQRModal] = useState(false);
	const [showEventInfoModal, setShowEventInfoModal] = useState(false);
	const [showSignInNotification, setShowSignInNotification] = useState(false);
	const [showFounderModal, setShowFounderModal] = useState(false);
	const [selectedFounderForModal, setSelectedFounderForModal] =
		useState<FounderWithPriceAndUser | null>(null);
	const [selectedFounder, setSelectedFounder] =
		useState<FounderWithPriceAndUser | null>(null);
	const [investorId, setInvestorId] = useState<string | null>(null);
	const [sortBy, setSortBy] = useState<"price" | "alphabetical">("price");
	const [showSortOptions, setShowSortOptions] = useState(false);
	const [expandedFounderId, setExpandedFounderId] = useState<string | null>(
		null
	);
	const [showPortfolioDropdown, setShowPortfolioDropdown] = useState(false);
	const portfolioDropdownRef = useRef<HTMLDivElement>(null);
	const { user } = useAuth();

	// Get investor portfolio if logged in
	const { investor, holdings, roiPercent } = usePortfolio({
		investorId: investorId || undefined,
	});

	// Close portfolio dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				portfolioDropdownRef.current &&
				!portfolioDropdownRef.current.contains(event.target as Node)
			) {
				setShowPortfolioDropdown(false);
			}
		};

		if (showPortfolioDropdown) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [showPortfolioDropdown]);

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

					console.log(investorData);

					if (investorData) {
						setInvestorId(investorData.id);
					}
				}

				// Fetch founders for this event with founder_users data
				const { data: foundersData, error: foundersError } = await supabase
					.from("founders")
					.select(
						`
						*,
						founder_users:founder_user_id (
							id,
							auth_user_id,
							email,
							first_name,
							last_name,
							profile_picture_url,
							bio,
							created_at,
							updated_at
						)
					`
					)
					.eq("event_id", eventId);

				if (foundersError) throw foundersError;

				// Calculate current price and market cap for each founder
				const foundersWithPrice: FounderWithPriceAndUser[] = foundersData.map(
					(founder: any) => ({
						...founder,
						founder_user: founder.founder_users || null,
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
							.select(
								`
								*,
								founder_users:founder_user_id (
									id,
									auth_user_id,
									email,
									first_name,
									last_name,
									profile_picture_url,
									bio,
									created_at,
									updated_at
								)
							`
							)
							.eq("event_id", eventId);

						if (foundersData) {
							const updated: FounderWithPriceAndUser[] = foundersData.map(
								(founder: any) => ({
									...founder,
									founder_user: founder.founder_users || null,
									current_price: calculateCurrentPrice(founder),
									market_cap: calculateMarketCap(founder),
								})
							);

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
		navigate(`/login?redirect=/events/${eventId}`);
		setShowSignInNotification(false);
	};

	(async () => {
		const { data: foundersWithUser } = await supabase
			.from("founders")
			.select(
				"id, name, founder_user_id, founder_users:founder_user_id (email)"
			)
			.eq("event_id", eventId);

		console.table(
			(foundersWithUser ?? []).map((f) => ({
				founder: f.name,
				email: (f as any).founder_users?.email ?? "—",
			}))
		);
	})();
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

	// Format date for badge (shorter version)
	const formatEventDateShort = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const eventDate = new Date(
			date.getFullYear(),
			date.getMonth(),
			date.getDate()
		);

		// If today, just show time
		if (eventDate.getTime() === today.getTime()) {
			return `Today ${date.toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
			})}`;
		}

		// If tomorrow
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		if (eventDate.getTime() === tomorrow.getTime()) {
			return `Tomorrow ${date.toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
			})}`;
		}

		// Otherwise show month and day
		return date.toLocaleDateString(undefined, {
			month: "short",
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

	// Check if event hasn't started yet
	const isEventNotStarted = (event: Event) => {
		const now = new Date();
		const startTime = new Date(event.start_time);
		return now < startTime;
	};

	const handleBuyClick = (founder: FounderWithPriceAndUser) => {
		if (!user) {
			setShowSignInNotification(true);
			return;
		}
		setSelectedFounder(founder);
	};

	const handleSellClick = (founder: FounderWithPriceAndUser) => {
		if (!user) {
			setShowSignInNotification(true);
			return;
		}
		setSelectedFounder(founder);
	};

	const handleFounderProfileClick = (
		founder: FounderWithPriceAndUser,
		e: React.MouseEvent
	) => {
		e.stopPropagation();
		setSelectedFounderForModal(founder);
		setShowFounderModal(true);
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
												: isEventNotStarted(event)
												? "bg-blue-500/20 text-blue-300 border border-blue-500/50"
												: event.status === "completed" ||
												  (event.status === "active" && !isEventActive(event))
												? "bg-red-500/20 text-red-300 border border-red-500/50"
												: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
										}`}
									>
										{event.status === "active" && isEventActive(event)
											? "Active"
											: isEventNotStarted(event)
											? `Starts ${formatEventDateShort(event.start_time)}`
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

				<div className=" md:px-8 py-5  max-w-[1600px] mx-auto">
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
										<div
											className="mb-4 md:mb-6 relative"
											ref={portfolioDropdownRef}
										>
											{/* Mobile: Compact horizontal layout */}
											<div
												className="card-dark  border border-accent-cyan/30 md:hidden cursor-pointer hover:bg-dark-800/50 transition-all hover:border-accent-cyan/50 hover:shadow-glow"
												onClick={() =>
													setShowPortfolioDropdown(!showPortfolioDropdown)
												}
												title="Click to view portfolio holdings"
											>
												<div className="flex items-center justify-between gap-2 text-center">
													<div className="flex-1 border-r border-dark-700">
														<p className="text-xs text-dark-400 mb-1">Liquid</p>
														<p className="text-sm font-bold text-accent-cyan">
															{formatCurrency(investor.current_balance)}
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
													<div className="flex-shrink-0 pl-2">
														<svg
															className={`w-4 h-4 text-dark-400 transition-transform ${
																showPortfolioDropdown ? "rotate-180" : ""
															}`}
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
													</div>
												</div>
											</div>

											{/* Desktop: Full layout */}
											<div
												className="card-dark border border-accent-cyan/30 shadow-glow hidden md:block overflow-hidden cursor-pointer hover:bg-dark-800/30 transition-all hover:border-accent-cyan/50 hover:shadow-xl relative group"
												onClick={() =>
													setShowPortfolioDropdown(!showPortfolioDropdown)
												}
												title="Click to view portfolio holdings"
											>
												{/* Click hint that appears on hover */}
												<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
													<div className="bg-accent-cyan/90 text-dark-950 text-xs font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
														<svg
															className={`w-3.5 h-3.5 transition-transform ${
																showPortfolioDropdown ? "rotate-180" : ""
															}`}
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
														{showPortfolioDropdown ? "Hide" : "View"} Holdings
													</div>
												</div>
												<div className="grid grid-cols-2 divide-x divide-dark-700">
													{/* Liquid Capital */}
													<div className="p-6 bg-gradient-to-br from-accent-cyan/5 to-transparent">
														<div className="flex items-start gap-4">
															<div className="w-14 h-14 bg-gradient-to-br from-accent-cyan to-primary-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
																<svg
																	className="w-7 h-7 text-white"
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
															<div className="flex-1 min-w-0">
																<p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">
																	Liquid Capital
																</p>
																<p className="text-3xl font-bold text-accent-cyan truncate">
																	{formatCurrency(investor.current_balance)}
																</p>
															</div>
														</div>
													</div>

													{/* ROI */}
													<div
														className={`p-6 bg-gradient-to-br ${
															roiPercent >= 0
																? "from-green-500/5"
																: "from-red-500/5"
														} to-transparent`}
													>
														<div className="flex items-start gap-4">
															<div
																className={`w-14 h-14 bg-gradient-to-br ${
																	roiPercent >= 0
																		? "from-green-600 to-green-500"
																		: "from-red-600 to-red-500"
																} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}
															>
																<svg
																	className="w-7 h-7 text-white"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={2}
																		d={
																			roiPercent >= 0
																				? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
																				: "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
																		}
																	/>
																</svg>
															</div>
															<div className="flex-1 min-w-0">
																<p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">
																	Return on Investment
																</p>
																<p
																	className={`text-3xl font-bold truncate ${
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
											</div>

											{/* Portfolio Holdings Dropdown */}
											{showPortfolioDropdown && (
												<div className="mt-3 card-dark border border-accent-cyan/30 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
													<div className="p-4 border-b border-dark-700 flex items-center justify-between">
														<h3 className="text-lg font-bold text-white">
															Your Holdings
														</h3>
														<button
															onClick={() => setShowPortfolioDropdown(false)}
															className="p-1 hover:bg-dark-800 rounded transition-colors"
														>
															<svg
																className="w-5 h-5 text-dark-400"
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
													<div className="max-h-96 overflow-y-auto">
														{holdings.length === 0 ? (
															<div className="p-8 text-center">
																<div className="w-16 h-16 bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-3">
																	<svg
																		className="w-8 h-8 text-dark-500"
																		fill="none"
																		stroke="currentColor"
																		viewBox="0 0 24 24"
																	>
																		<path
																			strokeLinecap="round"
																			strokeLinejoin="round"
																			strokeWidth={2}
																			d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
																		/>
																	</svg>
																</div>
																<p className="text-dark-400 text-sm">
																	No holdings yet. Start trading to build your
																	portfolio!
																</p>
															</div>
														) : (
															<div className="divide-y divide-dark-700">
																{holdings.map((holding) => {
																	const founder = founders.find(
																		(f) => f.id === holding.founder_id
																	);
																	if (!founder) return null;

																	const currentValue =
																		holding.shares * founder.current_price;
																	const totalInvested =
																		holding.shares * holding.cost_basis;
																	const profitLoss =
																		currentValue - totalInvested;
																	const profitLossPercent =
																		totalInvested > 0
																			? (profitLoss / totalInvested) * 100
																			: 0;

																	return (
																		<div
																			key={holding.id}
																			className="p-4 hover:bg-dark-800/30 transition-colors"
																		>
																			<div className="flex items-start justify-between gap-4">
																				<div className="flex-1 min-w-0">
																					<div className="flex items-center gap-2 mb-2">
																						<div className="w-8 h-8 bg-gradient-to-br from-accent-cyan/20 to-primary-500/20 rounded-lg flex items-center justify-center border border-accent-cyan/30 flex-shrink-0">
																							<span className="text-sm font-bold text-accent-cyan">
																								{founder.name.charAt(0)}
																							</span>
																						</div>
																						<h4 className="font-semibold text-white truncate">
																							{founder.name}
																						</h4>
																					</div>
																					<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
																						<div>
																							<span className="text-dark-400">
																								Shares:
																							</span>
																							<span className="text-white font-medium ml-1">
																								{holding.shares.toLocaleString()}
																							</span>
																						</div>
																						<div>
																							<span className="text-dark-400">
																								Avg Price:
																							</span>
																							<span className="text-white font-medium ml-1">
																								${holding.cost_basis.toFixed(2)}
																							</span>
																						</div>
																						<div>
																							<span className="text-dark-400">
																								Current:
																							</span>
																							<span className="text-white font-medium ml-1">
																								$
																								{founder.current_price.toFixed(
																									2
																								)}
																							</span>
																						</div>
																						<div>
																							<span className="text-dark-400">
																								Value:
																							</span>
																							<span className="text-accent-cyan font-medium ml-1">
																								{formatCurrency(currentValue)}
																							</span>
																						</div>
																					</div>
																				</div>
																				<div className="text-right flex-shrink-0">
																					<div
																						className={`text-sm font-bold ${
																							profitLoss >= 0
																								? "text-green-400"
																								: "text-red-400"
																						}`}
																					>
																						{profitLoss >= 0 ? "+" : ""}
																						{formatCurrency(profitLoss)}
																					</div>
																					<div
																						className={`text-xs font-medium ${
																							profitLoss >= 0
																								? "text-green-400"
																								: "text-red-400"
																						}`}
																					>
																						{profitLoss >= 0 ? "+" : ""}
																						{profitLossPercent.toFixed(1)}%
																					</div>
																				</div>
																			</div>
																		</div>
																	);
																})}
															</div>
														)}
													</div>
												</div>
											)}
										</div>
									)}

									{/* If not signed in, show CTA instead of portfolio */}
									{!user && (
										<div className="mb-4 md:mb-6">
											<div className="card-dark border border-accent-cyan/30 shadow-glow overflow-hidden">
												<div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
													<div className="flex items-start gap-3">
														<div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-cyan/30 to-primary-500/30 flex items-center justify-center flex-shrink-0 border border-accent-cyan/40">
															<svg
																className="w-6 h-6 text-accent-cyan"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M12 11c0 1.657-1.79 3-4 3s-4-1.343-4-3 1.79-3 4-3 4 1.343 4 3z"
																/>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
																/>
															</svg>
														</div>
														<div>
															<h3 className="text-white font-semibold">
																Sign in to start trading
															</h3>
															<p className="text-sm text-dark-300 mt-1">
																Create an account or sign in to start trading
																founders in this event.
															</p>
														</div>
													</div>
													<div className="flex gap-3">
														<button
															onClick={() =>
																navigate(`/login?redirect=/events/${eventId}`)
															}
															className="px-5 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-white hover:bg-dark-700 transition-all"
														>
															Sign In
														</button>
														<button
															onClick={() =>
																navigate(`/signup?redirect=/events/${eventId}`)
															}
															className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent-cyan to-primary-500 text-white hover:from-accent-cyan/90 hover:to-primary-600 transition-all shadow-lg"
														>
															Create Account
														</button>
													</div>
												</div>
											</div>
										</div>
									)}

									{/* Sort/Filter Options */}
									<div className="mb-6 flex justify-between items-center">
										<div className="hidden md:block">
											<h2 className="text-2xl font-bold text-white">
												Trading Market
											</h2>
											<p className="text-sm text-dark-400 mt-1">
												Buy and sell founder shares in real-time
											</p>
										</div>

										{/* Mobile: Dropdown button */}
										<div className="relative md:hidden ml-auto">
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
										<div className="hidden md:flex items-center gap-3">
											<span className="text-sm text-dark-400 mr-2">
												Sort by:
											</span>
											<button
												onClick={() => setSortBy("price")}
												className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
													sortBy === "price"
														? "bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30"
														: "bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 border border-dark-700"
												}`}
											>
												<div className="flex items-center gap-2">
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
															d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
														/>
													</svg>
													Highest Price
												</div>
											</button>
											<button
												onClick={() => setSortBy("alphabetical")}
												className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
													sortBy === "alphabetical"
														? "bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30"
														: "bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 border border-dark-700"
												}`}
											>
												<div className="flex items-center gap-2">
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
															d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
														/>
													</svg>
													A-Z
												</div>
											</button>
										</div>
									</div>

									{/* Founders Trading Table - Mobile & Desktop */}
									<div className="card-dark mx-1 overflow-hidden shadow-glow border border-primary-500/20 md:border-2 md:rounded-2xl">
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
															{sortedFounders.map((founder) => (
																<React.Fragment key={founder.id}>
																	{/* Founder Name Row - Full Width */}
																	<tr
																		className="bg-dark-800/30 cursor-pointer hover:bg-dark-800/50 transition-colors"
																		onClick={() =>
																			setExpandedFounderId(
																				expandedFounderId === founder.id
																					? null
																					: founder.id
																			)
																		}
																	>
																		<td colSpan={4} className="py-2 px-4">
																			<div className="flex items-center justify-between">
																				<div className="flex items-center gap-2">
																					<svg
																						className={`w-4 h-4 text-dark-400 transition-transform ${
																							expandedFounderId === founder.id
																								? "rotate-180"
																								: ""
																						}`}
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
																					<h3 className="text-base font-bold text-white">
																						{founder.name}
																					</h3>
																				</div>
																				<span className="text-xs text-dark-400">
																					Cap:{" "}
																					{formatCurrency(founder.market_cap)}
																				</span>
																			</div>
																		</td>
																	</tr>
																	{/* Founder Details Row */}
																	<tr className="hover:bg-dark-800/50 transition-colors">
																		{/* Profile Picture */}
																		<td className="py-3 px-4 w-1/4">
																			<div className="flex flex-col items-center">
																				<button
																					onClick={(e) =>
																						handleFounderProfileClick(
																							founder,
																							e
																						)
																					}
																					className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center border-2 border-accent-cyan/30 hover:border-accent-cyan transition-all mb-1"
																				>
																					{founder.founder_user
																						?.profile_picture_url ? (
																						<img
																							src={
																								founder.founder_user
																									.profile_picture_url
																							}
																							alt={founder.name}
																							className="w-full h-full object-cover"
																						/>
																					) : (
																						<div className="w-full h-full bg-gradient-to-br from-primary-600 to-accent-cyan flex items-center justify-center text-white font-bold text-lg">
																							{founder.name.charAt(0)}
																						</div>
																					)}
																				</button>
																				<p className="text-xs text-dark-400">
																					Profile
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
																	{/* Price Chart Row - Expandable */}
																	{expandedFounderId === founder.id && (
																		<tr>
																			<td
																				colSpan={4}
																				className="py-4 px-4 bg-dark-800/20"
																			>
																				<div className="text-xs text-dark-400 mb-2 font-medium">
																					Price History
																				</div>
																				<FounderPriceChart
																					founderId={founder.id}
																					height={200}
																					maxPoints={50}
																				/>
																			</td>
																		</tr>
																	)}
																</React.Fragment>
															))}
														</tbody>
													</table>
												</div>

												{/* Desktop View */}
												<div className="hidden md:block overflow-x-auto">
													<table className="w-full">
														<thead>
															<tr className="bg-dark-800/50 border-b-2 border-primary-500/30">
																<th className="py-4 px-6 text-left">
																	<span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
																		Profile
																	</span>
																</th>
																<th className="py-4 px-6 text-left">
																	<span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
																		Founder
																	</span>
																</th>
																<th className="py-4 px-6 text-right">
																	<span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
																		Price
																	</span>
																</th>
																<th className="py-4 px-6 text-right">
																	<span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
																		Market Cap
																	</span>
																</th>
																<th className="py-4 px-6 text-right">
																	<span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
																		Your Shares
																	</span>
																</th>
																<th className="py-4 px-6 text-right">
																	<span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
																		Value
																	</span>
																</th>
																<th className="py-4 px-6 text-center">
																	<span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
																		Actions
																	</span>
																</th>
															</tr>
														</thead>
														<tbody className="divide-y divide-dark-700/50">
															{sortedFounders.map((founder) => {
																const ownedShares = getOwnedShares(founder.id);
																const ownedValue =
																	ownedShares * founder.current_price;

																return (
																	<React.Fragment key={founder.id}>
																		<tr
																			className="group hover:bg-gradient-to-r hover:from-dark-800/70 hover:to-dark-800/30 transition-all duration-200 cursor-pointer"
																			onClick={() =>
																				setExpandedFounderId(
																					expandedFounderId === founder.id
																						? null
																						: founder.id
																				)
																			}
																		>
																			{/* Profile Picture */}
																			<td className="py-5 px-6">
																				<button
																					onClick={(e) =>
																						handleFounderProfileClick(
																							founder,
																							e
																						)
																					}
																					className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center border-2 border-accent-cyan/30 hover:border-accent-cyan transition-all shadow-lg group-hover:shadow-primary-500/50"
																				>
																					{founder.founder_user
																						?.profile_picture_url ? (
																						<img
																							src={
																								founder.founder_user
																									.profile_picture_url
																							}
																							alt={founder.name}
																							className="w-full h-full object-cover"
																						/>
																					) : (
																						<div className="w-full h-full bg-gradient-to-br from-primary-600 to-accent-cyan flex items-center justify-center text-white font-bold text-xl">
																							{founder.name.charAt(0)}
																						</div>
																					)}
																				</button>
																			</td>
																			{/* Founder Name */}
																			<td className="py-5 px-6">
																				<div className="flex items-center gap-3">
																					<svg
																						className={`w-5 h-5 text-dark-400 transition-transform flex-shrink-0 ${
																							expandedFounderId === founder.id
																								? "rotate-180"
																								: ""
																						}`}
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
																					<div className="w-10 h-10 bg-gradient-to-br from-accent-cyan/20 to-primary-500/20 rounded-lg flex items-center justify-center border border-accent-cyan/30">
																						<span className="text-lg font-bold text-accent-cyan">
																							{founder.name.charAt(0)}
																						</span>
																					</div>
																					<h3 className="text-white font-semibold text-lg group-hover:text-accent-cyan transition-colors">
																						{founder.name}
																					</h3>
																				</div>
																			</td>
																			{/* Price */}
																			<td className="py-5 px-6 text-right">
																				<div className="inline-flex flex-col items-end">
																					<span className="text-2xl font-bold text-accent-cyan">
																						${founder.current_price.toFixed(2)}
																					</span>
																					<span className="text-xs text-dark-400">
																						per share
																					</span>
																				</div>
																			</td>
																			{/* Market Cap */}
																			<td className="py-5 px-6 text-right">
																				<span className="text-white font-medium text-lg">
																					{formatCurrency(founder.market_cap)}
																				</span>
																			</td>
																			{/* Shares Owned */}
																			<td className="py-5 px-6 text-right">
																				<div className="inline-flex flex-col items-end">
																					<span className="text-xl font-bold text-white">
																						{user
																							? ownedShares.toLocaleString()
																							: "-"}
																					</span>
																					{user && ownedShares > 0 && (
																						<span className="text-xs text-dark-400">
																							shares
																						</span>
																					)}
																				</div>
																			</td>
																			{/* Value of Owned Shares */}
																			<td className="py-5 px-6 text-right">
																				<span
																					className={`text-lg font-bold ${
																						user && ownedShares > 0
																							? "text-green-400"
																							: "text-dark-500"
																					}`}
																				>
																					{user && ownedShares > 0
																						? formatCurrency(ownedValue)
																						: "-"}
																				</span>
																			</td>
																			{/* Actions */}
																			<td className="py-5 px-6">
																				<div className="flex gap-3 justify-center">
																					<button
																						onClick={(e) => {
																							e.stopPropagation();
																							handleBuyClick(founder);
																						}}
																						className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-green-500/50 hover:scale-105 active:scale-95"
																					>
																						Buy
																					</button>
																					<button
																						onClick={(e) => {
																							e.stopPropagation();
																							handleSellClick(founder);
																						}}
																						disabled={
																							!user || ownedShares === 0
																						}
																						className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg ${
																							!user || ownedShares === 0
																								? "bg-dark-700 text-dark-500 cursor-not-allowed opacity-50"
																								: "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white hover:shadow-red-500/50 hover:scale-105 active:scale-95"
																						}`}
																					>
																						Sell
																					</button>
																				</div>
																			</td>
																		</tr>
																		{/* Price Chart Row - Expandable */}
																		{expandedFounderId === founder.id && (
																			<tr>
																				<td
																					colSpan={7}
																					className="py-6 px-6 bg-dark-800/30"
																				>
																					<div className="max-w-4xl mx-auto">
																						<div className="text-sm text-dark-400 mb-3 font-medium">
																							Price History - {founder.name}
																						</div>
																						<FounderPriceChart
																							founderId={founder.id}
																							height={300}
																							maxPoints={100}
																						/>
																					</div>
																				</td>
																			</tr>
																		)}
																	</React.Fragment>
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
								<div className="space-y-6">
									<div className="hidden md:block">
										<h2 className="text-2xl font-bold text-white">
											Event Leaderboard
										</h2>
										<p className="text-sm text-dark-400 mt-1">
											Top performers ranked by portfolio value
										</p>
									</div>
									<div className="w-full max-w-4xl mx-auto">
										<Leaderboard eventId={eventId || ""} className="w-full" />
									</div>
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
											: isEventNotStarted(event)
											? "bg-blue-500/20 text-blue-300 border border-blue-500/50"
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
										: isEventNotStarted(event)
										? `Starts on ${formatEventDate(event.start_time)}`
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
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Founder Details Modal */}
			{showFounderModal && selectedFounderForModal && (
				<div
					className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
					onClick={() => setShowFounderModal(false)}
				>
					<div
						className="bg-dark-900 rounded-xl border border-primary-500/30 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Modal Header */}
						<div className="sticky top-0 bg-dark-900 border-b border-dark-700 p-6">
							<div className="flex items-center justify-between">
								<h2 className="text-2xl font-bold text-white">
									Founder Profile
								</h2>
								<button
									onClick={() => setShowFounderModal(false)}
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
							{/* Profile Picture and Name */}
							<div className="flex items-start gap-6">
								<div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center border-2 border-accent-cyan/30 flex-shrink-0">
									{selectedFounderForModal.founder_user?.profile_picture_url ? (
										<img
											src={
												selectedFounderForModal.founder_user.profile_picture_url
											}
											alt={selectedFounderForModal.name}
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="w-full h-full bg-gradient-to-br from-primary-600 to-accent-cyan flex items-center justify-center text-white font-bold text-3xl">
											{selectedFounderForModal.name.charAt(0)}
										</div>
									)}
								</div>
								<div className="flex-1">
									<h3 className="text-2xl font-bold text-white mb-2">
										{selectedFounderForModal.name}
									</h3>
									{selectedFounderForModal.founder_user && (
										<p className="text-dark-300">
											{selectedFounderForModal.founder_user.first_name}{" "}
											{selectedFounderForModal.founder_user.last_name}
										</p>
									)}
								</div>
							</div>

							{/* Project Logo */}
							{selectedFounderForModal.logo_url && (
								<div>
									<p className="text-sm text-dark-400 mb-2">Project Logo</p>
									<div className="w-32 h-32 rounded-lg overflow-hidden border border-dark-700">
										<img
											src={selectedFounderForModal.logo_url}
											alt={`${selectedFounderForModal.name} logo`}
											className="w-full h-full object-cover"
										/>
									</div>
								</div>
							)}

							{/* Bio */}
							{selectedFounderForModal.founder_user?.bio && (
								<div>
									<p className="text-sm text-dark-400 mb-2">Bio</p>
									<p className="text-white leading-relaxed">
										{selectedFounderForModal.founder_user.bio}
									</p>
								</div>
							)}

							{/* Pitch Summary */}
							{selectedFounderForModal.pitch_summary && (
								<div>
									<p className="text-sm text-dark-400 mb-2">Pitch Summary</p>
									<p className="text-white leading-relaxed">
										{selectedFounderForModal.pitch_summary}
									</p>
								</div>
							)}

							{/* Market Stats */}
							<div className="grid grid-cols-2 gap-4 pt-4 border-t border-dark-700">
								<div className="bg-dark-800/50 p-4 rounded-lg">
									<p className="text-xs text-dark-400 mb-1">Current Price</p>
									<p className="text-xl font-bold text-accent-cyan">
										${selectedFounderForModal.current_price.toFixed(2)}
									</p>
								</div>
								<div className="bg-dark-800/50 p-4 rounded-lg">
									<p className="text-xs text-dark-400 mb-1">Market Cap</p>
									<p className="text-xl font-bold text-white">
										{formatCurrency(selectedFounderForModal.market_cap)}
									</p>
								</div>
							</div>

							{/* Action Buttons */}
							<div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-dark-700">
								<button
									onClick={() => {
										setShowFounderModal(false);
										handleBuyClick(selectedFounderForModal);
									}}
									className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-green-500/50 flex items-center justify-center gap-2"
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
											d="M12 4v16m8-8H4"
										/>
									</svg>
									Buy Shares
								</button>
								{user && getOwnedShares(selectedFounderForModal.id) > 0 && (
									<button
										onClick={() => {
											setShowFounderModal(false);
											handleSellClick(selectedFounderForModal);
										}}
										className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-red-500/50 flex items-center justify-center gap-2"
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
												d="M20 12H4"
											/>
										</svg>
										Sell Shares
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
