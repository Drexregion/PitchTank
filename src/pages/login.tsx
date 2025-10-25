import React, { useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../hooks/useAuth";

const LoginPage: React.FC = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { signIn, user } = useAuth();
	const location = useLocation();
	const [searchParams] = useSearchParams();

	// Get redirect path from query params, location state, or default to home
	const redirectPath =
		searchParams.get("redirect") || location.state?.from || "/";

	// If already logged in, redirect to intended destination
	if (user) {
		return <Navigate to={redirectPath} replace />;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsSubmitting(true);

		try {
			if (!email || !password) {
				throw new Error("Please enter both email and password");
			}

			await signIn(email, password);
		} catch (err: any) {
			setError(err.message || "Failed to sign in");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen relative overflow-hidden">
			{/* Fancy dark background */}
			<div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
				<div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-600/30 rounded-full blur-3xl animate-pulse" />
				<div className="absolute bottom-0 left-1/4 w-96 h-96 bg-accent-cyan/20 rounded-full blur-3xl animate-pulse delay-1000" />
				<div className="absolute inset-0 bg-[linear-gradient(rgba(0,82,179,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,82,179,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />
			</div>

			<div className="relative z-10">
				<Navbar />

				<div className="container mx-auto px-4 py-16 flex justify-center">
					<div className="card-dark w-full max-w-md p-8 border border-primary-500/30 shadow-glow">
						<h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-accent-cyan to-primary-400 bg-clip-text text-transparent">
							Log In
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

						<form onSubmit={handleSubmit}>
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

							<div className="mb-6">
								<div className="flex justify-between mb-2">
									<label
										htmlFor="password"
										className="block text-white font-medium"
									>
										Password
									</label>
									<Link
										to="/forgot-password"
										className="text-sm text-primary-400 hover:text-accent-cyan transition-colors"
									>
										Forgot Password?
									</Link>
								</div>
								<input
									type="password"
									id="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
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
								{isSubmitting ? "Signing in..." : "Sign In"}
							</button>
						</form>

						<div className="mt-6 text-center space-y-2">
							<p className="text-dark-300">
								Don't have an account?{" "}
								<Link
									to={`/signup${
										searchParams.get("redirect")
											? `?redirect=${searchParams.get("redirect")}`
											: ""
									}`}
									className="text-accent-cyan hover:text-primary-400 font-medium transition-colors"
								>
									Sign Up
								</Link>
							</p>
						</div>
            <p className="text-sm text-gray-500">
              Are you a founder?{' '}
              <Link
                to="/founder-login"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Founder Login
              </Link>
            </p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default LoginPage;
