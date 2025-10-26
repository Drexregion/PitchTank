import React, { useState } from "react";
import { FounderUser } from "../types/FounderUser";
import { Founder } from "../types/Founder";
import { calculateCurrentPrice } from "../lib/ammEngine";

interface FounderProfilePageProps {
	founderUser: FounderUser;
	founderProjects: Founder[];
	isLoading: boolean;
	error: string | null;
	onUpdateProfile: (
		updates: any
	) => Promise<{ success: boolean; error?: string }>;
	className?: string;
}

export const FounderProfilePage: React.FC<FounderProfilePageProps> = ({
	founderUser,
	founderProjects,
	isLoading,
	error,
	onUpdateProfile,
	className = "",
}) => {
	const [isEditing, setIsEditing] = useState(false);
	const [editForm, setEditForm] = useState({
		first_name: founderUser.first_name,
		last_name: founderUser.last_name,
		bio: founderUser.bio || "",
		profile_picture_url: founderUser.profile_picture_url || "",
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

	const handleEditToggle = () => {
		setIsEditing(!isEditing);
		if (isEditing) {
			// Reset form when canceling
			setEditForm({
				first_name: founderUser.first_name,
				last_name: founderUser.last_name,
				bio: founderUser.bio || "",
				profile_picture_url: founderUser.profile_picture_url || "",
			});
		}
	};

	const handleInputChange =
		(field: keyof typeof editForm) =>
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			setEditForm((prev) => ({
				...prev,
				[field]: e.target.value,
			}));
		};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setSubmitError(null);
		setSubmitSuccess(null);

		try {
			const result = await onUpdateProfile(editForm);
			if (result.success) {
				setSubmitSuccess("Profile updated successfully!");
				setIsEditing(false);
			} else {
				setSubmitError(result.error || "Failed to update profile");
			}
		} catch (err: any) {
			setSubmitError(err.message || "Failed to update profile");
		} finally {
			setIsSubmitting(false);
		}
	};

	const getInitials = (firstName: string, lastName: string) => {
		return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	const getTotalMarketCap = () => {
		return founderProjects.reduce((total, project) => {
			const currentPrice = calculateCurrentPrice(project);
			const marketCap = currentPrice * (project.shares_in_pool || 0);
			return total + marketCap;
		}, 0);
	};

	const getTotalShares = () => {
		return founderProjects.reduce(
			(total, project) => total + (project.shares_in_pool || 0),
			0
		);
	};

	if (isLoading) {
		return (
			<div className={` ${className}`}>
				<div className="container mx-auto px-4 py-8">
					<div className="animate-pulse">
						<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow p-8">
							<div className="flex items-center space-x-6 mb-8">
								<div className="w-24 h-24 bg-dark-700 rounded-full"></div>
								<div className="space-y-3">
									<div className="h-8 bg-dark-700 rounded w-48"></div>
									<div className="h-4 bg-dark-700 rounded w-32"></div>
								</div>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<div className="h-32 bg-dark-700 rounded-xl"></div>
								<div className="h-32 bg-dark-700 rounded-xl"></div>
								<div className="h-32 bg-dark-700 rounded-xl"></div>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={` ${className}`}>
			<div className="container mx-auto px-4 py-8">
				{/* Header Section */}
				<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow p-8 mb-8">
					<div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
						{/* Profile Picture */}
						<div className="relative">
							{editForm.profile_picture_url ? (
								<img
									src={editForm.profile_picture_url}
									alt="Profile"
									className="w-24 h-24 rounded-full object-cover border-4 border-dark-800 shadow-lg"
								/>
							) : (
								<div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-600 to-accent-cyan flex items-center justify-center text-white text-2xl font-bold border-4 border-dark-800 shadow-lg">
									{getInitials(editForm.first_name, editForm.last_name)}
								</div>
							)}
							{isEditing && (
								<div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-full p-2 cursor-pointer hover:from-primary-700 hover:to-primary-600 transition-colors">
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
											d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
										/>
									</svg>
								</div>
							)}
						</div>

						{/* Profile Info */}
						<div className="flex-1">
							{isEditing ? (
								<form onSubmit={handleSubmit} className="space-y-4">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-white mb-2">
												First Name
											</label>
											<input
												type="text"
												value={editForm.first_name}
												onChange={handleInputChange("first_name")}
												className="w-full px-4 py-2 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
												required
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-white mb-2">
												Last Name
											</label>
											<input
												type="text"
												value={editForm.last_name}
												onChange={handleInputChange("last_name")}
												className="w-full px-4 py-2 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
												required
											/>
										</div>
									</div>
									<div>
										<label className="block text-sm font-medium text-white mb-2">
											Profile Picture URL
										</label>
										<input
											type="url"
											value={editForm.profile_picture_url}
											onChange={handleInputChange("profile_picture_url")}
											className="w-full px-4 py-2 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
											placeholder="https://example.com/image.jpg"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-white mb-2">
											Bio
										</label>
										<textarea
											value={editForm.bio}
											onChange={handleInputChange("bio")}
											rows={3}
											className="w-full px-4 py-2 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
											placeholder="Tell us about yourself..."
										/>
									</div>

									{submitError && (
										<div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg">
											{submitError}
										</div>
									)}

									{submitSuccess && (
										<div className="bg-green-500/20 border border-green-500/50 text-green-300 px-4 py-3 rounded-lg">
											{submitSuccess}
										</div>
									)}

									<div className="flex space-x-3">
										<button
											type="submit"
											disabled={isSubmitting}
											className="bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white px-6 py-2 rounded-lg disabled:opacity-50 transition-colors"
										>
											{isSubmitting ? "Saving..." : "Save Changes"}
										</button>
										<button
											type="button"
											onClick={handleEditToggle}
											className="bg-dark-700 text-dark-300 px-6 py-2 rounded-lg hover:bg-dark-600 transition-colors"
										>
											Cancel
										</button>
									</div>
								</form>
							) : (
								<div>
									<h1 className="text-3xl font-bold text-white mb-2">
										{editForm.first_name} {editForm.last_name}
									</h1>
									<p className="text-dark-300 mb-2">{founderUser.email}</p>
									<p className="text-sm text-dark-400 mb-4">
										Member since {formatDate(founderUser.created_at)}
									</p>
									{editForm.bio && (
										<p className="text-dark-300 leading-relaxed">
											{editForm.bio}
										</p>
									)}
									<button
										onClick={handleEditToggle}
										className="mt-4 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white px-6 py-2 rounded-lg transition-colors"
									>
										Edit Profile
									</button>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
					<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-xl shadow-glow p-6">
						<div className="flex items-center">
							<div className="p-3 bg-primary-600/20 rounded-lg">
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
										d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
									/>
								</svg>
							</div>
							<div className="ml-4">
								<p className="text-sm font-medium text-dark-300">
									Total Projects
								</p>
								<p className="text-2xl font-bold text-white">
									{founderProjects.length}
								</p>
							</div>
						</div>
					</div>

					<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-xl shadow-glow p-6">
						<div className="flex items-center">
							<div className="p-3 bg-green-500/20 rounded-lg">
								<svg
									className="w-6 h-6 text-green-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
									/>
								</svg>
							</div>
							<div className="ml-4">
								<p className="text-sm font-medium text-dark-300">
									Total Market Cap
								</p>
								<p className="text-2xl font-bold text-white">
									${getTotalMarketCap().toLocaleString()}
								</p>
							</div>
						</div>
					</div>

					<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-xl shadow-glow p-6">
						<div className="flex items-center">
							<div className="p-3 bg-accent-cyan/20 rounded-lg">
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
										d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
									/>
								</svg>
							</div>
							<div className="ml-4">
								<p className="text-sm font-medium text-dark-300">
									Total Shares
								</p>
								<p className="text-2xl font-bold text-white">
									{getTotalShares().toLocaleString()}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Projects Section */}
				<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow p-8">
					<div className="flex items-center justify-between mb-6">
						<h2 className="text-2xl font-bold text-white">My Projects</h2>
						<span className="bg-primary-600/20 text-primary-300 px-3 py-1 rounded-full text-sm font-medium">
							{founderProjects.length}{" "}
							{founderProjects.length === 1 ? "Project" : "Projects"}
						</span>
					</div>

					{founderProjects.length === 0 ? (
						<div className="text-center py-12">
							<div className="w-24 h-24 bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-4">
								<svg
									className="w-12 h-12 text-dark-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
									/>
								</svg>
							</div>
							<h3 className="text-lg font-medium text-white mb-2">
								No Projects Yet
							</h3>
							<p className="text-dark-300 mb-4">
								You haven't created any projects yet.
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{founderProjects.map((project) => {
								const currentPrice = calculateCurrentPrice(project);
								const marketCap = currentPrice * (project.shares_in_pool || 0);

								return (
									<div
										key={project.id}
										className="bg-dark-800/50 border border-dark-700 rounded-xl shadow-glow p-6 hover:border-primary-500/40 transition-all"
									>
										<div className="flex items-start justify-between mb-4">
											<div className="flex-1">
												<h3 className="text-lg font-bold text-white mb-2">
													{project.name}
												</h3>
												{project.bio && (
													<p className="text-dark-300 text-sm line-clamp-2">
														{project.bio}
													</p>
												)}
											</div>
											{project.logo_url && (
												<img
													src={project.logo_url}
													alt={`${project.name} logo`}
													className="w-12 h-12 rounded-lg object-cover ml-4"
												/>
											)}
										</div>

										<div className="space-y-3">
											<div className="flex justify-between items-center">
												<span className="text-sm text-dark-300">
													Current Price
												</span>
												<span className="font-bold text-green-400">
													${currentPrice.toFixed(2)}
												</span>
											</div>
											<div className="flex justify-between items-center">
												<span className="text-sm text-dark-300">
													Market Cap
												</span>
												<span className="font-bold text-white">
													${marketCap.toLocaleString()}
												</span>
											</div>
											<div className="flex justify-between items-center">
												<span className="text-sm text-dark-300">
													Shares in Pool
												</span>
												<span className="font-bold text-white">
													{project.shares_in_pool?.toLocaleString()}
												</span>
											</div>
											<div className="flex justify-between items-center">
												<span className="text-sm text-dark-300">Event</span>
												<span className="text-xs bg-primary-600/20 text-primary-300 px-2 py-1 rounded-full">
													Event Project
												</span>
											</div>
										</div>

										{project.pitch_url && (
											<div className="mt-4 pt-4 border-t border-dark-700">
												<a
													href={project.pitch_url}
													target="_blank"
													rel="noopener noreferrer"
													className="inline-flex items-center text-accent-cyan hover:text-primary-400 text-sm font-medium"
												>
													<svg
														className="w-4 h-4 mr-2"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
														/>
													</svg>
													View Pitch Deck
												</a>
											</div>
										)}

										<div className="mt-4 flex space-x-2">
											<button className="flex-1 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium">
												View Details
											</button>
											<button className="bg-dark-700 text-dark-300 py-2 px-4 rounded-lg hover:bg-dark-600 transition-colors text-sm font-medium">
												Edit
											</button>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{error && (
					<div className="mt-8 bg-red-500/20 border border-red-500/50 text-red-300 px-6 py-4 rounded-xl">
						<div className="flex items-center">
							<svg
								className="w-5 h-5 mr-3"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span className="font-medium">Error:</span>
							<span className="ml-2">{error}</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
