import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface NavbarProps {
	className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ className = "" }) => {
	const { user, isAdmin, signOut } = useAuth();
	const location = useLocation();
	const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

	// Check if the current route matches
	const isActive = (path: string) => {
		return location.pathname === path;
	};

	return (
		<nav
			className={`bg-gradient-to-r from-dark-900 to-dark-800 border-b border-dark-700 shadow-lg ${className}`}
		>
			<div className="container mx-auto px-4">
				<div className="flex justify-between h-16">
					<div className="flex items-center">
						<Link to="/" className="flex items-center">
							<span className="text-xl font-bold bg-gradient-to-r from-accent-cyan to-primary-400 bg-clip-text text-transparent">
								Pitch Tank
							</span>
						</Link>
					</div>

					{/* Desktop menu */}
					<div className="hidden md:flex items-center space-x-4">
						<Link
							to="/"
							className={`px-3 py-2 rounded-md text-sm font-medium ${
								isActive("/")
									? "bg-primary-600 text-white shadow-glow"
									: "text-dark-100 hover:bg-dark-700"
							}`}
						>
							Events
						</Link>

						{/* {user && (
							<Link
								to="/dashboard"
								className={`px-3 py-2 rounded-md text-sm font-medium ${
									isActive("/dashboard")
										? "bg-primary-600 text-white shadow-glow"
										: "text-dark-100 hover:bg-dark-700"
								}`}
							>
								Dashboard
							</Link>
						)} */}

						{isAdmin && (
							<Link
								to="/admin"
								className={`px-3 py-2 rounded-md text-sm font-medium ${
									isActive("/admin")
										? "bg-primary-600 text-white shadow-glow"
										: "text-dark-100 hover:bg-dark-700"
								}`}
							>
								Admin
							</Link>
						)}

						{user ? (
							<div className="relative">
								<button
									onClick={() => setIsMenuOpen(!isMenuOpen)}
									className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-dark-100 hover:bg-dark-700"
								>
									<span className="mr-2">{user.email}</span>
									<svg
										className="w-4 h-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M19 9l-7 7-7-7"
										/>
									</svg>
								</button>

								{isMenuOpen && (
									<div className="absolute right-0 mt-2 w-48 bg-dark-800 border border-dark-700 rounded-md shadow-lg z-10">
										<div className="py-1">
											<Link
												to="/profile"
												className="block px-4 py-2 text-sm text-dark-100 hover:bg-dark-700"
												onClick={() => setIsMenuOpen(false)}
											>
												Profile
											</Link>
											<button
												onClick={() => {
													signOut();
													setIsMenuOpen(false);
												}}
												className="block w-full text-left px-4 py-2 text-sm text-dark-100 hover:bg-dark-700"
											>
												Sign Out
											</button>
										</div>
									</div>
								)}
							</div>
						) : (
							<>
								<Link
									to="/login"
									className={`px-3 py-2 rounded-md text-sm font-medium ${
										isActive("/login")
											? "bg-primary-600 text-white shadow-glow"
											: "text-dark-100 hover:bg-dark-700"
									}`}
								>
									Login
								</Link>
								<Link to="/signup" className="btn-primary">
									Sign Up
								</Link>
							</>
						)}
					</div>

					{/* Mobile menu button */}
					<div className="flex md:hidden items-center">
						<button
							onClick={() => setIsMenuOpen(!isMenuOpen)}
							className="inline-flex items-center justify-center p-2 rounded-md text-dark-100 hover:text-primary-400 hover:bg-dark-700"
						>
							<svg
								className="h-6 w-6"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								{isMenuOpen ? (
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								) : (
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4 6h16M4 12h16M4 18h16"
									/>
								)}
							</svg>
						</button>
					</div>
				</div>
			</div>

			{/* Mobile menu */}
			{isMenuOpen && (
				<div className="md:hidden border-t border-dark-700 bg-dark-900">
					<div className="px-2 pt-2 pb-3 space-y-1">
						<Link
							to="/"
							className={`block px-3 py-2 rounded-md text-base font-medium ${
								isActive("/")
									? "bg-primary-600 text-white shadow-glow"
									: "text-dark-100 hover:bg-dark-700"
							}`}
							onClick={() => setIsMenuOpen(false)}
						>
							Events
						</Link>

						{/* {user && (
							<Link
								to="/dashboard"
								className={`block px-3 py-2 rounded-md text-base font-medium ${
									isActive("/dashboard")
										? "bg-primary-600 text-white shadow-glow"
										: "text-dark-100 hover:bg-dark-700"
								}`}
								onClick={() => setIsMenuOpen(false)}
							>
								Dashboard
							</Link>
						)} */}

						{isAdmin && (
							<Link
								to="/admin"
								className={`block px-3 py-2 rounded-md text-base font-medium ${
									isActive("/admin")
										? "bg-primary-600 text-white shadow-glow"
										: "text-dark-100 hover:bg-dark-700"
								}`}
								onClick={() => setIsMenuOpen(false)}
							>
								Admin
							</Link>
						)}

						{user ? (
							<>
								<Link
									to="/profile"
									className={`block px-3 py-2 rounded-md text-base font-medium ${
										isActive("/profile")
											? "bg-primary-600 text-white shadow-glow"
											: "text-dark-100 hover:bg-dark-700"
									}`}
									onClick={() => setIsMenuOpen(false)}
								>
									Profile
								</Link>
								<button
									onClick={() => {
										signOut();
										setIsMenuOpen(false);
									}}
									className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-dark-100 hover:bg-dark-700"
								>
									Sign Out
								</button>
							</>
						) : (
							<>
								<Link
									to="/login"
									className={`block px-3 py-2 rounded-md text-base font-medium ${
										isActive("/login")
											? "bg-primary-600 text-white shadow-glow"
											: "text-dark-100 hover:bg-dark-700"
									}`}
									onClick={() => setIsMenuOpen(false)}
								>
									Login
								</Link>
								<Link
									to="/signup"
									className="block px-3 py-2 rounded-md text-base font-medium btn-primary"
									onClick={() => setIsMenuOpen(false)}
								>
									Sign Up
								</Link>
							</>
						)}
					</div>
				</div>
			)}
		</nav>
	);
};
