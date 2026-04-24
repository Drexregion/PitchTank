import React, { useState, useEffect } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";
import { Navbar } from "../components/Navbar";

interface ApplicationData {
	id: string;
	event_id: string;
	applicant_email: string;
	status: "pending" | "approved" | "rejected";
	answers: Record<string, string>;
	submitted_at: string;
	claim_token: string;
	event?: { name: string };
	questions?: { id: string; question_text: string; question_type: string }[];
}

interface ProfileData {
	first_name: string;
	last_name: string;
	bio: string;
	profile_picture_url: string;
}

const ProfilePage: React.FC = () => {
	const { user, isLoading: authLoading } = useAuth();
	const [searchParams] = useSearchParams();
	const claimId = searchParams.get("id");

	const [application, setApplication] = useState<ApplicationData | null>(null);
	const [claimed, setClaimed] = useState(false);
	const [claimError, setClaimError] = useState<string | null>(null);
	const [isProcessingClaim, setIsProcessingClaim] = useState(false);

	const [profile, setProfile] = useState<ProfileData>({
		first_name: "",
		last_name: "",
		bio: "",
		profile_picture_url: "",
	});
	const [isEditingProfile, setIsEditingProfile] = useState(false);
	const [editDraft, setEditDraft] = useState<ProfileData>(profile);
	const [isSaving, setIsSaving] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isLoadingProfile, setIsLoadingProfile] = useState(true);

	// Load the current user's profile from founder_users
	useEffect(() => {
		if (!user) return;
		supabase
			.from("founder_users")
			.select("first_name, last_name, bio, profile_picture_url")
			.eq("auth_user_id", user.id)
			.maybeSingle()
			.then(({ data }) => {
				if (data) {
					const p: ProfileData = {
						first_name: data.first_name ?? "",
						last_name: data.last_name ?? "",
						bio: data.bio ?? "",
						profile_picture_url: data.profile_picture_url ?? "",
					};
					setProfile(p);
					setEditDraft(p);
				}
				setIsLoadingProfile(false);
			});
	}, [user]);

	// Process claim token: link application to this user, pre-fill profile from answers
	useEffect(() => {
		if (!claimId || !user || isProcessingClaim) return;
		setIsProcessingClaim(true);

		(async () => {
			// Fetch the application by claim token
			const { data: app, error: appError } = await supabase
				.from("applications")
				.select("*, event:events(name), questions:event_questions(id, question_text, question_type)")
				.eq("claim_token", claimId)
				.maybeSingle();

			if (appError || !app) {
				setClaimError("This profile link is invalid or has already been used.");
				setIsProcessingClaim(false);
				return;
			}

			// Link it to this user (idempotent — update every time they visit with the token)
			const { error: updateError } = await supabase
				.from("applications")
				.update({ claimed_by_auth_user_id: user.id })
				.eq("claim_token", claimId);

			if (updateError) {
				setClaimError("Failed to link your profile. Please try again.");
				setIsProcessingClaim(false);
				return;
			}

			setApplication(app);
			setClaimed(true);

			// Try to pre-fill profile fields from the application answers
			// Look for question_text patterns that suggest name / bio / photo
			const questions: { id: string; question_text: string; question_type: string }[] =
				app.questions ?? [];
			const answers: Record<string, string> = app.answers ?? {};

			const findAnswer = (keywords: string[]) => {
				const q = questions.find((q) =>
					keywords.some((kw) => q.question_text.toLowerCase().includes(kw))
				);
				return q ? (answers[q.id] ?? "") : "";
			};

			const firstName = findAnswer(["first name", "first_name"]);
			const lastName = findAnswer(["last name", "last_name"]);
			const bio = findAnswer(["bio", "about", "description", "yourself"]);
			const photo = findAnswer(["photo", "headshot", "portrait", "picture"]);
			const logoUrl = findAnswer(["logo"]);

			setProfile((prev) => {
				const updated: ProfileData = {
					first_name: firstName || prev.first_name,
					last_name: lastName || prev.last_name,
					bio: bio || prev.bio,
					profile_picture_url: photo || logoUrl || prev.profile_picture_url,
				};
				setEditDraft(updated);
				return updated;
			});

			setIsProcessingClaim(false);
		})();
	}, [claimId, user, isProcessingClaim]);

	// Also load existing application linked to this user (even without a token)
	useEffect(() => {
		if (!user || claimId || application) return;
		supabase
			.from("applications")
			.select("*, event:events(name), questions:event_questions(id, question_text, question_type)")
			.eq("claimed_by_auth_user_id", user.id)
			.order("submitted_at", { ascending: false })
			.limit(1)
			.maybeSingle()
			.then(({ data }) => {
				if (data) setApplication(data);
			});
	}, [user, claimId, application]);

	const handleSaveProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;
		setIsSaving(true);
		setSaveError(null);
		setSaveSuccess(null);

		// Upsert founder_users row
		const { error } = await supabase.from("founder_users").upsert(
			{
				auth_user_id: user.id,
				email: user.email ?? "",
				first_name: editDraft.first_name,
				last_name: editDraft.last_name,
				bio: editDraft.bio,
				profile_picture_url: editDraft.profile_picture_url || null,
			},
			{ onConflict: "auth_user_id" }
		);

		if (error) {
			setSaveError("Failed to save profile. Please try again.");
		} else {
			setProfile(editDraft);
			setIsEditingProfile(false);
			setSaveSuccess("Profile saved!");
			setTimeout(() => setSaveSuccess(null), 3000);
		}
		setIsSaving(false);
	};

	if (authLoading) {
		return (
			<div className="min-h-screen bg-gray-950 flex items-center justify-center">
				<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
			</div>
		);
	}

	if (!user) {
		// Preserve the claim token through the login redirect
		return (
			<Navigate
				to={claimId ? `/login?id=${claimId}` : "/login"}
				replace
			/>
		);
	}

	const initials =
		profile.first_name || profile.last_name
			? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase()
			: (user.email ?? "?").charAt(0).toUpperCase();

	const statusColors: Record<string, string> = {
		pending: "bg-yellow-900/40 text-yellow-400 border-yellow-700",
		approved: "bg-green-900/40 text-green-400 border-green-700",
		rejected: "bg-red-900/40 text-red-400 border-red-700",
	};

	return (
		<div className="min-h-screen bg-gray-950">
			<Navbar />

			<div className="max-w-3xl mx-auto px-4 py-10">
				{/* Claim banner */}
				{claimed && (
					<div className="mb-6 bg-green-900/30 border border-green-700 text-green-300 rounded-xl px-5 py-4 text-sm">
						Profile linked! Your application answers have been pre-filled below where possible.
					</div>
				)}
				{claimError && (
					<div className="mb-6 bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-5 py-4 text-sm">
						{claimError}
					</div>
				)}

				{/* Profile card */}
				<div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
					<div className="flex items-start gap-5 mb-6">
						{/* Avatar */}
						<div className="flex-shrink-0">
							{profile.profile_picture_url ? (
								<img
									src={profile.profile_picture_url}
									alt="Profile"
									className="w-20 h-20 rounded-full object-cover border-2 border-gray-700"
								/>
							) : (
								<div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-2 border-gray-700">
									{initials}
								</div>
							)}
						</div>

						<div className="flex-1 min-w-0">
							<h1 className="text-2xl font-bold text-white">
								{profile.first_name || profile.last_name
									? `${profile.first_name} ${profile.last_name}`.trim()
									: "Your Profile"}
							</h1>
							<p className="text-gray-500 text-sm mt-0.5">{user.email}</p>
							{profile.bio && (
								<p className="text-gray-400 text-sm mt-2 leading-relaxed">{profile.bio}</p>
							)}
						</div>

						{!isEditingProfile && (
							<button
								type="button"
								onClick={() => { setIsEditingProfile(true); setEditDraft(profile); }}
								className="flex-shrink-0 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
							>
								Edit
							</button>
						)}
					</div>

					{/* Edit form */}
					{isEditingProfile && (
						<form onSubmit={handleSaveProfile} className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-medium text-gray-400 mb-1.5">First Name</label>
									<input
										type="text"
										value={editDraft.first_name}
										onChange={(e) => setEditDraft((d) => ({ ...d, first_name: e.target.value }))}
										className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
									/>
								</div>
								<div>
									<label className="block text-xs font-medium text-gray-400 mb-1.5">Last Name</label>
									<input
										type="text"
										value={editDraft.last_name}
										onChange={(e) => setEditDraft((d) => ({ ...d, last_name: e.target.value }))}
										className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
									/>
								</div>
							</div>
							<div>
								<label className="block text-xs font-medium text-gray-400 mb-1.5">Bio</label>
								<textarea
									value={editDraft.bio}
									onChange={(e) => setEditDraft((d) => ({ ...d, bio: e.target.value }))}
									rows={3}
									className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
									placeholder="Tell us about yourself..."
								/>
							</div>
							<div>
								<label className="block text-xs font-medium text-gray-400 mb-1.5">Profile picture URL</label>
								<input
									type="url"
									value={editDraft.profile_picture_url}
									onChange={(e) => setEditDraft((d) => ({ ...d, profile_picture_url: e.target.value }))}
									className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
									placeholder="https://"
								/>
							</div>
							{saveError && <p className="text-red-400 text-sm">{saveError}</p>}
							<div className="flex gap-3 pt-1">
								<button
									type="submit"
									disabled={isSaving}
									className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm font-medium transition-colors"
								>
									{isSaving ? "Saving..." : "Save"}
								</button>
								<button
									type="button"
									onClick={() => setIsEditingProfile(false)}
									className="px-5 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors"
								>
									Cancel
								</button>
							</div>
						</form>
					)}

					{saveSuccess && !isEditingProfile && (
						<p className="text-green-400 text-sm">{saveSuccess}</p>
					)}

					{!isEditingProfile && !profile.first_name && !profile.last_name && (
						<p className="text-gray-600 text-sm">
							Click Edit to complete your profile.
						</p>
					)}
				</div>

				{/* Application card */}
				{application && (
					<div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
						<div className="flex items-center justify-between mb-6">
							<div>
								<h2 className="text-lg font-bold text-white">Your Application</h2>
								{application.event?.name && (
									<p className="text-gray-500 text-sm mt-0.5">{application.event.name}</p>
								)}
							</div>
							<span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusColors[application.status] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>
								{application.status.charAt(0).toUpperCase() + application.status.slice(1)}
							</span>
						</div>

						{isLoadingProfile ? null : (
							<div className="space-y-4">
								{(application.questions ?? []).map((q) => {
									const answer = application.answers[q.id];
									if (!answer) return null;
									return (
										<div key={q.id}>
											<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{q.question_text}</p>
											{q.question_type === "image" ? (
												<img
													src={answer}
													alt={q.question_text}
													className="max-h-40 rounded-lg border border-gray-700 object-contain"
												/>
											) : q.question_type === "url" || q.question_type === "website_url" ? (
												<a
													href={answer}
													target="_blank"
													rel="noopener noreferrer"
													className="text-blue-400 hover:underline text-sm break-all"
												>
													{answer}
												</a>
											) : (
												<p className="text-gray-300 text-sm leading-relaxed">{answer}</p>
											)}
										</div>
									);
								})}
								{(application.questions ?? []).length === 0 && (
									<p className="text-gray-600 text-sm">Application answers not available.</p>
								)}
							</div>
						)}
					</div>
				)}

				{!application && !isProcessingClaim && (
					<div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
						<p className="text-gray-600 text-sm">
							No application linked yet. Use the link from your application confirmation email to connect your profile.
						</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default ProfilePage;
