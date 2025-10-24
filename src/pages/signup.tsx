import React, { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";

const SignupPage: React.FC = () => {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const { signUp, user } = useAuth();
	const [searchParams] = useSearchParams();

	// Get redirect path and extract eventId if it's an event path
	const redirectPath = searchParams.get("redirect");
	const eventIdMatch = redirectPath?.match(/\/event\/([^\/]+)/);
	const eventId = eventIdMatch
		? eventIdMatch[1]
		: "4df0c0f1-307f-42fb-b319-a99de3b26aeb"; // Default event ID

	// If already logged in, redirect to intended destination
	if (user) {
		if (redirectPath) {
			return <Navigate to={redirectPath} replace />;
		}
		return <Navigate to={`/dashboard/${eventId}`} replace />;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccess(null);
		setIsSubmitting(true);

		try {
			// Validate inputs
			if (!name || !email || !password || !confirmPassword) {
				throw new Error("Please fill in all fields");
			}
			if (password !== confirmPassword) {
				throw new Error("Passwords do not match");
			}
			if (password.length < 8) {
				throw new Error("Password must be at least 8 characters long");
			}

			// Submit sign-up to create auth account
			const { user: newUser, error: signUpError } = await signUp(
				email,
				password,
				name
			);
			if (signUpError) throw signUpError;

			// If we have a specific event ID and the user was created successfully
			if (eventId && newUser?.id) {
				try {
					// Create investor record for this event
					const { data: investor, error: investorError } = await supabase
						.from("investors")
						.insert({
							event_id: eventId,
							name: name || email.split("@")[0],
							email: email,
							user_id: newUser.id,
							initial_balance: 1000000,
							current_balance: 1000000,
						})
						.select()
						.single();

					if (investorError) {
						console.error("Failed to create investor record:", investorError);
						// Don't throw here - the auth account was created successfully
					} else {
						// Create investor role
						await supabase.from("user_roles").insert({
							user_id: newUser.id,
							role: "investor",
							event_id: eventId,
						});
					}
				} catch (err) {
					console.error("Error creating investor record:", err);
					// Don't throw - the auth account was created successfully
				}
			}

			// Show success message
			setSuccess("Your account has been created successfully!");

			// Clear form
			setName("");
			setEmail("");
			setPassword("");
			setConfirmPassword("");
		} catch (err: any) {
			setError(err.message || "Failed to create account");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen relative overflow-hidden">
			{/* Fancy dark background */}
			<div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
				<div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/30 rounded-full blur-3xl animate-pulse" />
				<div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-cyan/20 rounded-full blur-3xl animate-pulse delay-1000" />
				<div className="absolute inset-0 bg-[linear-gradient(rgba(0,82,179,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,82,179,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />
			</div>

			<div className="relative z-10">
				<Navbar />

				<div className="container mx-auto px-4 py-16 flex justify-center">
					<div className="card-dark w-full max-w-md p-8 border border-primary-500/30 shadow-glow">
						<h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-accent-cyan to-primary-400 bg-clip-text text-transparent">
							Create an Account
						</h1>

						{error && (
							<div className="bg-red-500/20 border border-red-500/50 p-4 mb-6 rounded-lg">
								<div className="flex">
									<div className="flex-shrink-0">
										<svg
											className="h-5 w-5 text-red-400"
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fillRule="evenodd"
												d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
												clipRule="evenodd"
											/>
										</svg>
									</div>
									<div className="ml-3">
										<p className="text-sm text-red-400">{error}</p>
									</div>
								</div>
							</div>
						)}

						{success && (
							<div className="bg-green-500/20 border border-green-500/50 p-4 mb-6 rounded-lg">
								<div className="flex">
									<div className="flex-shrink-0">
										<svg
											className="h-5 w-5 text-green-400"
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											/>
										</svg>
									</div>
									<div className="ml-3">
										<p className="text-sm text-green-400">{success}</p>
									</div>
								</div>
							</div>
						)}

						<form onSubmit={handleSubmit}>
							<div className="mb-4">
								<label
									htmlFor="name"
									className="block text-white font-medium mb-2"
								>
									Full Name
								</label>
								<input
									type="text"
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="input-dark w-full"
									placeholder="John Doe"
									required
								/>
							</div>

							<div className="mb-4">
								<label
									htmlFor="email"
									className="block text-white font-medium mb-2"
								>
									Email Address
								</label>
								<input
									type="email"
									id="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="input-dark w-full"
									placeholder="your@email.com"
									required
								/>
							</div>

							<div className="mb-4">
								<label
									htmlFor="password"
									className="block text-white font-medium mb-2"
								>
									Password
								</label>
								<input
									type="password"
									id="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="input-dark w-full"
									placeholder="••••••••"
									minLength={8}
									required
								/>
								<p className="mt-1 text-sm text-dark-400">
									Password must be at least 8 characters long
								</p>
							</div>

							<div className="mb-6">
								<label
									htmlFor="confirmPassword"
									className="block text-white font-medium mb-2"
								>
									Confirm Password
								</label>
								<input
									type="password"
									id="confirmPassword"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									className="input-dark w-full"
									placeholder="••••••••"
									required
								/>
							</div>

							<button
								type="submit"
								disabled={isSubmitting}
								className={`w-full py-3 px-4 bg-gradient-to-r from-accent-cyan to-primary-500 hover:from-accent-cyan/90 hover:to-primary-600 text-white font-medium rounded-lg transition-all shadow-lg ${
									isSubmitting
										? "opacity-70 cursor-not-allowed"
										: "hover:shadow-accent-cyan/50"
								}`}
							>
								{isSubmitting ? "Creating Account..." : "Create Account"}
							</button>
						</form>

						<div className="mt-6 text-center">
							<p className="text-dark-300">
								Already have an account?{" "}
								<Link
									to={`/login${
										searchParams.get("redirect")
											? `?redirect=${searchParams.get("redirect")}`
											: ""
									}`}
									className="text-accent-cyan hover:text-primary-400 font-medium transition-colors"
								>
									Log In
								</Link>
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default SignupPage;
