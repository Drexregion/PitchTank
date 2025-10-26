import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useFounderAuth } from "../hooks/useFounderAuth";
import { CreateFounderUserRequest } from "../types/FounderUser";

export const FounderSignupForm: React.FC = () => {
	const { token } = useParams<{ token: string }>();
	const navigate = useNavigate();
	const {
		validateInvitation,
		createFounderAccount,
		markInvitationUsed,
		invitation,
		isValidInvitation,
		isLoading: authLoading,
		error: authError,
	} = useFounderAuth();

	const [formData, setFormData] = useState({
		email: "",
		password: "",
		confirmPassword: "",
		firstName: "",
		lastName: "",
	});
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	// Validate invitation token on component mount
	useEffect(() => {
		if (token) {
			validateInvitation(token);
		}
	}, [token, validateInvitation]);

	// Pre-fill email from invitation
	useEffect(() => {
		if (invitation && invitation.email) {
			setFormData((prev) => ({
				...prev,
				email: invitation.email,
			}));
		}
	}, [invitation]);

	const handleInputChange =
		(field: keyof typeof formData) =>
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setFormData((prev) => ({
				...prev,
				[field]: e.target.value,
			}));
		};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Validation
		if (
			!formData.email.trim() ||
			!formData.password ||
			!formData.firstName.trim() ||
			!formData.lastName.trim()
		) {
			setError("All fields are required");
			return;
		}

		if (formData.password !== formData.confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		if (formData.password.length < 6) {
			setError("Password must be at least 6 characters");
			return;
		}

		if (!invitation || invitation.email !== formData.email) {
			setError("Email does not match invitation");
			return;
		}

		try {
			setIsLoading(true);
			setError(null);

			console.log("Starting signup process for:", formData.email);

			// First, check if founder user already exists
			const { data: existingFounder, error: founderCheckError } = await supabase
				.from("founder_users")
				.select("*")
				.eq("email", formData.email)
				.maybeSingle();

			if (existingFounder || founderCheckError) {
				let errorMessage: string | null = null;
				if (existingFounder) {
					errorMessage =
						"This email is already registered as a founder. Please sign in instead.";
				} else if (founderCheckError) {
					errorMessage = founderCheckError.message;
				}
				setError(errorMessage);
				return;
			}

			console.log("No existing founder user found, proceeding with signup...");

			// Create Supabase auth user
			const { data: authData, error: authError } = await supabase.auth.signUp({
				email: formData.email,
				password: formData.password,
				options: {
					data: {
						first_name: formData.firstName,
						last_name: formData.lastName,
					},
				},
			});

			if (authError) {
				console.error("Auth signup error:", authError);
				throw authError;
			}

			if (!authData.user) {
				throw new Error("Failed to create user account");
			}

			console.log("Auth user created successfully:", authData.user.id);

			// Create founder user record
			const founderData: CreateFounderUserRequest = {
				auth_user_id: authData.user.id,
				email: formData.email,
				first_name: formData.firstName,
				last_name: formData.lastName,
			};

			const result = await createFounderAccount(founderData);

			if (!result.success) {
				throw new Error(result.error || "Failed to create founder account");
			}

			// Mark invitation as used
			if (token) {
				await markInvitationUsed(token);
			}

			// Redirect to founder dashboard
			navigate("/founder-dashboard");
		} catch (err: any) {
			console.error("Signup error:", err);
			setError(err.message || "Failed to create account");
		} finally {
			setIsLoading(false);
		}
	};

	// Show loading state while validating invitation
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
						<p className="text-white text-lg">Validating invitation...</p>
					</div>
				</div>
			</div>
		);
	}

	// Show error if invitation is invalid
	if (!isValidInvitation || authError) {
		return (
			<div className="min-h-screen relative overflow-hidden">
				<div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
					<div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/30 rounded-full blur-3xl animate-pulse" />
					<div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-cyan/20 rounded-full blur-3xl animate-pulse delay-1000" />
					<div className="absolute inset-0 bg-[linear-gradient(rgba(0,82,179,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,82,179,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />
				</div>
				<div className="relative z-10 flex items-center justify-center min-h-screen px-4">
					<div className="max-w-md w-full bg-dark-900/95 backdrop-blur-sm border border-red-500/30 rounded-2xl shadow-glow p-8">
						<div className="text-center">
							<div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-500/20 border border-red-500/50 mb-4">
								<svg
									className="h-8 w-8 text-red-400"
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
							</div>
							<h2 className="text-2xl font-bold text-white mb-3">
								Invalid Invitation
							</h2>
							<p className="text-dark-300 mb-6">
								{authError || "This invitation link is invalid or has expired."}
							</p>
							<button
								onClick={() => navigate("/")}
								className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white py-3 px-4 rounded-lg font-semibold transition-all shadow-lg hover:shadow-primary-500/50"
							>
								Return to Home
							</button>
						</div>
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
			<div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
				<div className="max-w-md w-full">
					{/* Header */}
					<div className="text-center mb-8">
						<h2 className="text-4xl font-bold text-white mb-3">
							Complete Your Founder Account
						</h2>
						<p className="text-dark-300 text-lg">
							You've been invited to join as a founder. Complete your account
							setup below.
						</p>
					</div>

					{/* Form Card */}
					<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow p-8">
						<form className="space-y-6" onSubmit={handleSubmit}>
							<div className="space-y-5">
								{/* Email (Read-only) */}
								<div>
									<label className="block text-sm font-medium text-white mb-2">
										Email Address
									</label>
									<input
										type="email"
										value={formData.email}
										disabled
										className="w-full p-3 bg-dark-700 border border-dark-600 rounded-lg text-dark-300 cursor-not-allowed"
									/>
									<p className="text-xs text-dark-400 mt-2">
										This email was used for your invitation
									</p>
								</div>

								{/* Name Fields */}
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium text-white mb-2">
											First Name *
										</label>
										<input
											type="text"
											value={formData.firstName}
											onChange={handleInputChange("firstName")}
											required
											className="w-full p-3 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder-dark-400"
											placeholder="John"
										/>
									</div>

									<div>
										<label className="block text-sm font-medium text-white mb-2">
											Last Name *
										</label>
										<input
											type="text"
											value={formData.lastName}
											onChange={handleInputChange("lastName")}
											required
											className="w-full p-3 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder-dark-400"
											placeholder="Doe"
										/>
									</div>
								</div>

								{/* Password */}
								<div>
									<label className="block text-sm font-medium text-white mb-2">
										Password *
									</label>
									<input
										type="password"
										value={formData.password}
										onChange={handleInputChange("password")}
										required
										minLength={6}
										className="w-full p-3 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder-dark-400"
										placeholder="At least 6 characters"
									/>
								</div>

								{/* Confirm Password */}
								<div>
									<label className="block text-sm font-medium text-white mb-2">
										Confirm Password *
									</label>
									<input
										type="password"
										value={formData.confirmPassword}
										onChange={handleInputChange("confirmPassword")}
										required
										minLength={6}
										className="w-full p-3 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder-dark-400"
										placeholder="Re-enter your password"
									/>
								</div>
							</div>

							{/* Error Message */}
							{error && (
								<div className="p-4 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg text-sm">
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

							{/* Submit Button */}
							<div>
								<button
									type="submit"
									disabled={isLoading}
									className={`w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${
										isLoading
											? "bg-dark-600 text-dark-400 cursor-not-allowed"
											: "bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-[1.02] active:scale-95"
									}`}
								>
									{isLoading ? (
										<>
											<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
											<span>Creating Account...</span>
										</>
									) : (
										<>
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
													d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
												/>
											</svg>
											<span>Create Founder Account</span>
										</>
									)}
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
};
