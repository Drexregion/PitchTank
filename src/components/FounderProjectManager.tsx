import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
	Founder,
	CreateFounderProjectRequest,
	UpdateFounderProjectRequest,
} from "../types/Founder";
import { Event } from "../types/Event";

interface FounderProjectManagerProps {
	founderUserId: string;
	events: Event[];
	existingProjects?: Founder[];
	onProjectCreated?: () => void;
	onProjectUpdated?: () => void;
	className?: string;
}

export const FounderProjectManager: React.FC<FounderProjectManagerProps> = ({
	founderUserId,
	events,
	existingProjects = [],
	onProjectCreated,
	onProjectUpdated,
	className = "",
}) => {
	const [activeTab, setActiveTab] = useState<"create" | "manage">("create");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	// Create project form state
	const [createForm, setCreateForm] = useState<CreateFounderProjectRequest>({
		event_id: "",
		founder_user_id: founderUserId,
		name: "",
		bio: "",
		logo_url: "",
		pitch_summary: "",
		pitch_url: "",
		shares_in_pool: 100000,
		cash_in_pool: 1000000,
		k_constant: 100000000000,
		min_reserve_shares: 1000,
	});

	// Edit project state
	const [editingProject, setEditingProject] = useState<Founder | null>(null);
	const [editForm, setEditForm] = useState<UpdateFounderProjectRequest>({});

	const handleCreateProject = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!createForm.name.trim()) {
			setError("Project name is required");
			return;
		}

		if (!createForm.event_id) {
			setError("Please select an event");
			return;
		}

		try {
			setIsLoading(true);
			setError(null);
			setSuccessMessage(null);

			// Check if founder already has a project in this event
			const { data: existingProject, error: checkError } = await supabase
				.from("founders")
				.select("id, name")
				.eq("founder_user_id", founderUserId)
				.eq("event_id", createForm.event_id)
				.maybeSingle();

			if (checkError) {
				throw checkError;
			}

			if (existingProject) {
				setError(
					`You already have a project "${existingProject.name}" in this event. Each founder can only create one project per event.`
				);
				return;
			}

			const { error: createError } = await supabase
				.from("founders")
				.insert(createForm);

			if (createError) {
				throw createError;
			}

			setSuccessMessage("Project created successfully");

			// Reset form
			setCreateForm({
				event_id: "",
				founder_user_id: founderUserId,
				name: "",
				bio: "",
				logo_url: "",
				pitch_summary: "",
				pitch_url: "",
				shares_in_pool: 100000,
				cash_in_pool: 1000000,
				k_constant: 100000000000,
				min_reserve_shares: 1000,
			});

			if (onProjectCreated) {
				onProjectCreated();
			}
		} catch (err: any) {
			setError(err.message || "Failed to create project");
		} finally {
			setIsLoading(false);
		}
	};

	const handleUpdateProject = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!editingProject) return;

		try {
			setIsLoading(true);
			setError(null);
			setSuccessMessage(null);

			const { error: updateError } = await supabase
				.from("founders")
				.update(editForm)
				.eq("id", editingProject.id);

			if (updateError) {
				throw updateError;
			}

			setSuccessMessage("Project updated successfully");
			setEditingProject(null);
			setEditForm({});

			if (onProjectUpdated) {
				onProjectUpdated();
			}
		} catch (err: any) {
			setError(err.message || "Failed to update project");
		} finally {
			setIsLoading(false);
		}
	};

	const startEditing = (project: Founder) => {
		setEditingProject(project);
		setEditForm({
			name: project.name,
			bio: project.bio,
			logo_url: project.logo_url,
			pitch_summary: project.pitch_summary,
			pitch_url: project.pitch_url,
		});
		setActiveTab("manage");
	};

	const cancelEditing = () => {
		setEditingProject(null);
		setEditForm({});
	};

	const handleInputChange =
		(field: keyof CreateFounderProjectRequest) =>
		(
			e: React.ChangeEvent<
				HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
			>
		) => {
			setCreateForm((prev) => ({
				...prev,
				[field]: e.target.value,
			}));
		};

	const handleEditInputChange =
		(field: keyof UpdateFounderProjectRequest) =>
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			setEditForm((prev) => ({
				...prev,
				[field]: e.target.value,
			}));
		};

	return (
		<div
			className={`bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow ${className}`}
		>
			{/* Tab Navigation */}
			<div className="border-b border-dark-700">
				<nav className="flex space-x-8 px-6">
					<button
						onClick={() => setActiveTab("create")}
						className={`py-4 px-1 border-b-2 font-medium text-sm ${
							activeTab === "create"
								? "border-primary-500 text-white"
								: "border-transparent text-dark-300 hover:text-white"
						}`}
					>
						Create Project
					</button>
					<button
						onClick={() => setActiveTab("manage")}
						className={`py-4 px-1 border-b-2 font-medium text-sm ${
							activeTab === "manage"
								? "border-primary-500 text-white"
								: "border-transparent text-dark-300 hover:text-white"
						}`}
					>
						Manage Projects ({existingProjects.length})
					</button>
				</nav>
			</div>

			<div className="p-6">
				{/* Error Message */}
				{error && (
					<div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg">
						{error}
					</div>
				)}

				{/* Success Message */}
				{successMessage && (
					<div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 text-green-300 rounded-lg">
						{successMessage}
					</div>
				)}

				{/* Create Project Tab */}
				{activeTab === "create" && (
					<form onSubmit={handleCreateProject} className="space-y-6">
						<h3 className="text-lg font-semibold text-white">
							Create New Project
						</h3>

						{/* Event Selection */}
						<div>
							<label className="block text-sm font-medium text-white mb-2">
								Event *
							</label>
							<select
								value={createForm.event_id}
								onChange={handleInputChange("event_id")}
								required
								className="w-full p-3 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
							>
								<option value="">Select an event...</option>
								{events.map((event) => {
									const hasProject = existingProjects.some(
										(project) => project.event_id === event.id
									);
									return (
										<option
											key={event.id}
											value={event.id}
											disabled={hasProject}
										>
											{event.name} {hasProject ? "(Already have project)" : ""}
										</option>
									);
								})}
							</select>
							{existingProjects.length > 0 && (
								<p className="text-sm text-dark-400 mt-1">
									Events where you already have a project are disabled. Each
									founder can only create one project per event.
								</p>
							)}
						</div>

						{/* Project Name */}
						<div>
							<label className="block text-sm font-medium text-white mb-2">
								Project Name *
							</label>
							<input
								type="text"
								value={createForm.name}
								onChange={handleInputChange("name")}
								required
								placeholder="Enter your startup/project name"
								className="w-full p-3 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
							/>
						</div>

						{/* Project Bio */}
						<div>
							<label className="block text-sm font-medium text-white mb-2">
								Project Description
							</label>
							<textarea
								value={createForm.bio}
								onChange={handleInputChange("bio")}
								placeholder="Describe your project, what it does, and its value proposition..."
								rows={3}
								className="w-full p-3 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
							/>
						</div>

						{/* Logo URL */}
						<div>
							<label className="block text-sm font-medium text-white mb-2">
								Logo URL
							</label>
							<input
								type="url"
								value={createForm.logo_url}
								onChange={handleInputChange("logo_url")}
								placeholder="https://example.com/logo.png"
								className="w-full p-3 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
							/>
						</div>

						{/* Pitch Summary */}
						<div>
							<label className="block text-sm font-medium text-white mb-2">
								Pitch Summary
							</label>
							<textarea
								value={createForm.pitch_summary}
								onChange={handleInputChange("pitch_summary")}
								placeholder="Brief summary of your pitch (2-3 sentences)..."
								rows={2}
								className="w-full p-3 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
							/>
						</div>

						{/* Pitch URL */}
						<div>
							<label className="block text-sm font-medium text-white mb-2">
								Pitch Video/Presentation URL
							</label>
							<input
								type="url"
								value={createForm.pitch_url}
								onChange={handleInputChange("pitch_url")}
								placeholder="https://youtube.com/watch?v=... or https://docs.google.com/presentation/..."
								className="w-full p-3 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
							/>
						</div>

						{/* Submit Button */}
						<button
							type="submit"
							disabled={isLoading}
							className={`w-full py-3 px-4 rounded-lg font-medium ${
								isLoading
									? "bg-dark-700 text-dark-400 cursor-not-allowed"
									: "bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white"
							}`}
						>
							{isLoading ? "Creating Project..." : "Create Project"}
						</button>
					</form>
				)}

				{/* Manage Projects Tab */}
				{activeTab === "manage" && (
					<div className="space-y-6">
						<h3 className="text-lg font-semibold text-white">
							Manage Your Projects
						</h3>

						{existingProjects.length === 0 ? (
							<div className="text-center py-8 text-dark-400">
								<p>You haven't created any projects yet.</p>
								<p className="text-sm mt-1">
									Switch to the "Create Project" tab to get started.
								</p>
							</div>
						) : (
							<div className="space-y-4">
								{existingProjects.map((project) => (
									<div
										key={project.id}
										className="border border-dark-700 rounded-lg p-4 bg-dark-800/50"
									>
										{editingProject?.id === project.id ? (
											// Edit Form
											<form
												onSubmit={handleUpdateProject}
												className="space-y-4"
											>
												<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
													<div>
														<label className="block text-sm font-medium text-white mb-1">
															Project Name
														</label>
														<input
															type="text"
															value={editForm.name || ""}
															onChange={handleEditInputChange("name")}
															className="w-full p-2 bg-dark-800 border border-dark-600 text-white rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
														/>
													</div>
													<div>
														<label className="block text-sm font-medium text-white mb-1">
															Logo URL
														</label>
														<input
															type="url"
															value={editForm.logo_url || ""}
															onChange={handleEditInputChange("logo_url")}
															className="w-full p-2 bg-dark-800 border border-dark-600 text-white rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
														/>
													</div>
												</div>

												<div>
													<label className="block text-sm font-medium text-white mb-1">
														Description
													</label>
													<textarea
														value={editForm.bio || ""}
														onChange={handleEditInputChange("bio")}
														rows={2}
														className="w-full p-2 bg-dark-800 border border-dark-600 text-white rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
													/>
												</div>

												<div>
													<label className="block text-sm font-medium text-white mb-1">
														Pitch Summary
													</label>
													<textarea
														value={editForm.pitch_summary || ""}
														onChange={handleEditInputChange("pitch_summary")}
														rows={2}
														className="w-full p-2 bg-dark-800 border border-dark-600 text-white rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
													/>
												</div>

												<div>
													<label className="block text-sm font-medium text-white mb-1">
														Pitch URL
													</label>
													<input
														type="url"
														value={editForm.pitch_url || ""}
														onChange={handleEditInputChange("pitch_url")}
														className="w-full p-2 bg-dark-800 border border-dark-600 text-white rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
													/>
												</div>

												<div className="flex space-x-2">
													<button
														type="submit"
														disabled={isLoading}
														className="px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white rounded disabled:bg-dark-700"
													>
														{isLoading ? "Saving..." : "Save Changes"}
													</button>
													<button
														type="button"
														onClick={cancelEditing}
														className="px-4 py-2 border border-dark-600 text-dark-300 rounded hover:bg-dark-700"
													>
														Cancel
													</button>
												</div>
											</form>
										) : (
											// Project Display
											<div className="flex justify-between items-start">
												<div className="flex-1">
													<h4 className="font-semibold text-lg text-white">
														{project.name}
													</h4>
													{project.bio && (
														<p className="text-dark-300 mt-1">{project.bio}</p>
													)}
													{project.pitch_summary && (
														<p className="text-sm text-dark-400 mt-2">
															{project.pitch_summary}
														</p>
													)}
													{project.pitch_url && (
														<a
															href={project.pitch_url}
															target="_blank"
															rel="noopener noreferrer"
															className="text-accent-cyan hover:text-primary-400 text-sm mt-2 inline-block"
														>
															View Pitch →
														</a>
													)}
												</div>
												<button
													onClick={() => startEditing(project)}
													className="ml-4 px-3 py-1 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white text-sm rounded"
												>
													Edit
												</button>
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};
