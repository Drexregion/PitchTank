import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const FounderLoginPage: React.FC = () => {
	const [email, setEmail] = useState<string>("");
	const [password, setPassword] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!email.trim() || !password) {
			setError("Please enter both email and password");
			return;
		}

		try {
			setIsLoading(true);
			setError(null);

			const { data, error: signInError } =
				await supabase.auth.signInWithPassword({
					email: email.trim(),
					password,
				});

			if (signInError) {
				throw signInError;
			}

			// Check if user is a founder
			if (data.user) {
				console.log("Checking if user is a founder:", data.user.email);

				const { data: founderUser, error: founderError } = await supabase
					.from("founder_users")
					.select("*")
					.eq("auth_user_id", data.user.id)
					.maybeSingle();

				console.log("Founder user check result:", {
					founderUser,
					founderError,
				});

				if (founderError) {
					console.error("Founder user check error:", founderError);
					throw founderError;
				}

				if (founderUser) {
					console.log("User is a founder, redirecting to founder dashboard");
					// User is a founder, redirect to founder dashboard
					navigate("/founder-dashboard");
				} else {
					console.log(
						"User is not a founder, redirecting to regular dashboard"
					);
					// User is not a founder, redirect to regular dashboard
					navigate("/");
				}
			}
		} catch (err: any) {
			setError(err.message || "Failed to sign in");
		} finally {
			setIsLoading(false);
		}
	};

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
							Founder Login
						</h2>
						<p className="text-dark-300 text-lg">
							Sign in to your founder account
						</p>
					</div>

					{/* Form Card */}
					<div className="bg-dark-900/95 backdrop-blur-sm border border-primary-500/20 rounded-2xl shadow-glow p-8">
						<form className="space-y-6" onSubmit={handleSubmit}>
							<div className="space-y-5">
								<div>
									<label className="block text-sm font-medium text-white mb-2">
										Email Address
									</label>
									<input
										type="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										required
										className="w-full p-3 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder-dark-400"
										placeholder="founder@example.com"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-white mb-2">
										Password
									</label>
									<input
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
										className="w-full p-3 bg-dark-800 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder-dark-400"
										placeholder="Enter your password"
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
											<span>Signing In...</span>
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
													d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
												/>
											</svg>
											<span>Sign In</span>
										</>
									)}
								</button>
							</div>

							{/* Links */}
							<div className="text-center space-y-3 pt-4 border-t border-dark-700">
								<p className="text-sm text-dark-300">
									Don't have a founder account?{" "}
									<Link
										to="/"
										className="text-accent-cyan hover:text-primary-400 font-medium transition-colors"
									>
										Return to Home
									</Link>
								</p>
								<p className="text-sm text-dark-300">
									<Link
										to="/login"
										className="text-accent-cyan hover:text-primary-400 font-medium transition-colors"
									>
										Regular User Login
									</Link>
								</p>
							</div>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
};

export default FounderLoginPage;
