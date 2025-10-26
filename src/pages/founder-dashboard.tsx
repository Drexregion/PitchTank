import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Navbar } from "../components/Navbar";
import { FounderProfilePage } from "../components/FounderProfilePage";
import { FounderProjectManager } from "../components/FounderProjectManager";
import { FounderAnalytics } from "../components/FounderAnalytics";
import { useAuth } from "../hooks/useAuth";
import { useFounderUser } from "../hooks/useFounderUser";
import { Event } from "../types/Event";
import { Founder } from "../types/Founder";

const FounderDashboardPage: React.FC = () => {
	const { user, isFounder, founderUser, isLoading: authLoading } = useAuth();
	const [events, setEvents] = useState<Event[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<
		"profile" | "projects" | "analytics"
	>("profile");
	const [selectedProject, setSelectedProject] = useState<Founder | null>(null);

	// Get founder user data and projects
	const {
		founderUser: founderUserData,
		founderProjects,
		isLoading: founderLoading,
		error: founderError,
		updateProfile,
		refreshData,
	} = useFounderUser({ founderUserId: founderUser?.id });

	// Fetch events for project creation
	useEffect(() => {
		const fetchEvents = async () => {
			try {
				setIsLoading(true);
				setError(null);

				const { data, error: fetchError } = await supabase
					.from("events")
					.select("*")
					.eq("status", "active")
					.order("created_at", { ascending: false });

				if (fetchError) {
					throw fetchError;
				}

				setEvents(data || []);
			} catch (err: any) {
				setError(err.message || "Failed to fetch events");
			} finally {
				setIsLoading(false);
			}
		};

		fetchEvents();
	}, []);

	// Redirect if not authenticated or not a founder
	if (authLoading) {
		return (
			<div className="min-h-screen relative overflow-hidden">
				<div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
					<div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/30 rounded-full blur-3xl animate-pulse" />
					<div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-cyan/20 rounded-full blur-3xl animate-pulse delay-1000" />
				</div>
				<div className="relative z-10 flex items-center justify-center min-h-screen">
					<div className="text-center">
						<div className="animate-spin rounded-full h-16 w-16 border-b-4 border-accent-cyan mx-auto mb-4"></div>
						<p className="text-white text-lg">Loading...</p>
					</div>
				</div>
			</div>
		);
	}

	if (!user || !isFounder || !founderUser) {
		return <Navigate to="/founder-login" replace />;
	}

	if (founderLoading || isLoading) {
		return (
			<div className="min-h-screen relative overflow-hidden">
				<div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
					<div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/30 rounded-full blur-3xl animate-pulse" />
					<div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-cyan/20 rounded-full blur-3xl animate-pulse delay-1000" />
				</div>
				<div className="relative z-10 flex items-center justify-center min-h-screen">
					<div className="text-center">
						<div className="animate-spin rounded-full h-16 w-16 border-b-4 border-accent-cyan mx-auto mb-4"></div>
						<p className="text-white text-lg">Loading founder data...</p>
					</div>
				</div>
			</div>
		);
	}

	if (founderError) {
		return (
			<div className="min-h-screen relative overflow-hidden">
				<div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
					<div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/30 rounded-full blur-3xl animate-pulse" />
					<div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-cyan/20 rounded-full blur-3xl animate-pulse delay-1000" />
				</div>
				<div className="relative z-10 flex items-center justify-center min-h-screen">
					<div className="text-center">
						<div className="p-4 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg mb-4">
							Error: {founderError}
						</div>
						<button
							onClick={() => window.location.reload()}
							className="bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg"
						>
							Retry
						</button>
					</div>
				</div>
			</div>
		);
	}

	if (!founderUserData) {
		return (
			<div className="min-h-screen relative overflow-hidden">
				<div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
					<div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/30 rounded-full blur-3xl animate-pulse" />
					<div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-cyan/20 rounded-full blur-3xl animate-pulse delay-1000" />
				</div>
				<div className="relative z-10 flex items-center justify-center min-h-screen">
					<div className="text-center">
						<div className="text-dark-300 mb-4 text-lg">
							Founder profile not found
						</div>
						<button
							onClick={() => window.location.reload()}
							className="bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg"
						>
							Retry
						</button>
					</div>
				</div>
			</div>
		);
	}

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
				<Navbar />

				<div className="container mx-auto px-4 py-8">
					{/* Header */}
					<div className="mb-8">
						<h1 className="text-4xl font-bold text-white mb-3">
							Welcome, {founderUserData.first_name}!
						</h1>
						<p className="text-dark-300 text-lg">
							Manage your profile and projects
						</p>
					</div>

					{/* Tab Navigation */}
					<div className="mb-6">
						<nav className="flex flex-wrap gap-3">
							<button
								onClick={() => setActiveTab("profile")}
								className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
									activeTab === "profile"
										? "bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30"
										: "bg-dark-800/50 text-dark-300 hover:text-white hover:bg-dark-800 border border-dark-700"
								}`}
							>
								<div className="flex items-center gap-2">
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
											d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
										/>
									</svg>
									<span>Profile Settings</span>
								</div>
							</button>
							<button
								onClick={() => setActiveTab("projects")}
								className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
									activeTab === "projects"
										? "bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30"
										: "bg-dark-800/50 text-dark-300 hover:text-white hover:bg-dark-800 border border-dark-700"
								}`}
							>
								<div className="flex items-center gap-2">
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
											d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
										/>
									</svg>
									<span>My Projects ({founderProjects.length})</span>
								</div>
							</button>
							{founderProjects.length > 0 && (
								<button
									onClick={() => {
										setActiveTab("analytics");
										if (founderProjects.length === 1) {
											setSelectedProject(founderProjects[0]);
										}
									}}
									className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
										activeTab === "analytics"
											? "bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30"
											: "bg-dark-800/50 text-dark-300 hover:text-white hover:bg-dark-800 border border-dark-700"
									}`}
								>
									<div className="flex items-center gap-2">
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
												d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
											/>
										</svg>
										<span>Analytics & Notes</span>
									</div>
								</button>
							)}
						</nav>
					</div>

					{/* Tab Content */}
					<div
						className={activeTab === "analytics" ? "max-w-6xl" : "max-w-4xl"}
					>
						{activeTab === "profile" && (
							<FounderProfilePage
								founderUser={founderUserData}
								founderProjects={founderProjects}
								isLoading={founderLoading}
								error={founderError}
								onUpdateProfile={updateProfile}
							/>
						)}

						{activeTab === "projects" && (
							<div className="space-y-6">
								<FounderProjectManager
									founderUserId={founderUserData.id}
									events={events}
									existingProjects={founderProjects}
									onProjectCreated={refreshData}
									onProjectUpdated={refreshData}
								/>
							</div>
						)}

						{activeTab === "analytics" && (
							<div className="space-y-6">
								{/* Project Selector */}
								{founderProjects.length > 1 && (
									<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow p-6">
										<label className="block text-white font-semibold mb-3">
											Select a project to view analytics:
										</label>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
											{founderProjects.map((project) => {
												const projectEvent = events.find(
													(e) => e.id === project.event_id
												);
												const isEventCompleted =
													projectEvent &&
													(projectEvent.status === "completed" ||
														(projectEvent.status === "active" &&
															new Date() > new Date(projectEvent.end_time)));

												return (
													<button
														key={project.id}
														onClick={() => setSelectedProject(project)}
														className={`p-4 rounded-lg border-2 transition-all text-left ${
															selectedProject?.id === project.id
																? "border-accent-cyan bg-dark-700"
																: "border-dark-700 bg-dark-800 hover:border-dark-600 hover:bg-dark-700"
														}`}
													>
														<div className="flex items-start justify-between">
															<div className="flex-1">
																<h3 className="text-white font-semibold mb-1">
																	{project.name}
																</h3>
																<p className="text-sm text-dark-400">
																	{projectEvent?.name || "Unknown Event"}
																</p>
																{isEventCompleted && (
																	<span className="inline-flex items-center gap-1 mt-2 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
																		<svg
																			className="w-3 h-3"
																			fill="currentColor"
																			viewBox="0 0 20 20"
																		>
																			<path
																				fillRule="evenodd"
																				d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
																				clipRule="evenodd"
																			/>
																		</svg>
																		Event Completed
																	</span>
																)}
															</div>
															{selectedProject?.id === project.id && (
																<svg
																	className="w-6 h-6 text-accent-cyan"
																	fill="currentColor"
																	viewBox="0 0 20 20"
																>
																	<path
																		fillRule="evenodd"
																		d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
																		clipRule="evenodd"
																	/>
																</svg>
															)}
														</div>
													</button>
												);
											})}
										</div>
									</div>
								)}

								{/* Analytics Display */}
								{selectedProject ? (
									<FounderAnalytics founder={selectedProject} />
								) : founderProjects.length === 1 ? (
									<FounderAnalytics founder={founderProjects[0]} />
								) : (
									<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow p-12 text-center">
										<svg
											className="w-16 h-16 text-dark-600 mx-auto mb-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
											/>
										</svg>
										<h3 className="text-xl font-semibold text-white mb-2">
											Select a Project
										</h3>
										<p className="text-dark-400">
											Choose a project above to view its trading analytics and
											investor notes
										</p>
									</div>
								)}
							</div>
						)}
					</div>

					{/* Error Display */}
					{error && (
						<div className="mt-6 p-4 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg">
							<div className="flex items-start gap-3">
								<svg
									className="w-5 h-5 flex-shrink-0 mt-0.5"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path
										fillRule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
										clipRule="evenodd"
									/>
								</svg>
								<span>{error}</span>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default FounderDashboardPage;
