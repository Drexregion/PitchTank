import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { Session, User } from "@supabase/supabase-js";
import { FounderUser } from "../types/FounderUser";

type UserWithRoles = {
	id: string;
	email?: string;
	roles: {
		role: string;
		event_id: string;
	}[];
	founderUser?: FounderUser | null;
};

type AuthHookReturn = {
	session: Session | null;
	user: UserWithRoles | null;
	isLoading: boolean;
	isAdmin: boolean;
	isInvestor: boolean;
	isFounder: boolean;
	founderUser: FounderUser | null;
	error: string | null;
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (
		email: string,
		password: string,
		name: string
	) => Promise<{ user: User | null; error: Error | null }>;
	signOut: () => Promise<void>;
};

/**
 * Hook to manage authentication and user roles
 */
export function useAuth(): AuthHookReturn {
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<UserWithRoles | null>(null);
	const [founderUser, setFounderUser] = useState<FounderUser | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	// Helper function to fetch founder user data
	const fetchFounderUser = async (
		authUserId: string
	): Promise<FounderUser | null> => {
		try {
			const { data, error: founderError } = await supabase
				.from("founder_users")
				.select("*")
				.eq("auth_user_id", authUserId)
				.maybeSingle();

			if (founderError) {
				console.error("Error fetching founder user:", founderError);
				return null;
			}

			return data;
		} catch (err: any) {
			console.error("Error fetching founder user:", err);
			return null;
		}
	};

	useEffect(() => {
		// Get initial session
		setIsLoading(true);

		const fetchSession = async () => {
			try {
				const {
					data: { session: currentSession },
					error: sessionError,
				} = await supabase.auth.getSession();

				if (sessionError) {
					setError(sessionError.message);
					setIsLoading(false);
					return;
				}

				setSession(currentSession);

				if (currentSession?.user) {
					// Fetch founder user data if it exists
					try {
						const founderUserData = await fetchFounderUser(
							currentSession.user.id
						);
						setFounderUser(founderUserData);

						setUser({
							id: currentSession.user.id,
							email: currentSession.user.email,
							roles: [], // Can be populated on-demand when needed
							founderUser: founderUserData,
						});
					} catch (founderErr) {
						// If founder user fetch fails, still set up the user
						console.warn("Failed to fetch founder user data:", founderErr);
						setFounderUser(null);

						setUser({
							id: currentSession.user.id,
							email: currentSession.user.email,
							roles: [],
							founderUser: null,
						});
					}
				} else {
					setUser(null);
					setFounderUser(null);
				}

				setIsLoading(false);
			} catch (err: any) {
				setError(err.message || "Auth error");
				setIsLoading(false);
			}
		};

		fetchSession();

		// Add timeout to prevent infinite loading
		const timeout = setTimeout(() => {
			setIsLoading(false);
		}, 10000); // 10 second timeout

		return () => clearTimeout(timeout);

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (_event, newSession) => {
			setSession(newSession);

			if (newSession?.user) {
				// Fetch founder user data if it exists
				try {
					const founderUserData = await fetchFounderUser(newSession.user.id);
					setFounderUser(founderUserData);

					setUser({
						id: newSession.user.id,
						email: newSession.user.email,
						roles: [],
						founderUser: founderUserData,
					});
				} catch (founderErr) {
					// If founder user fetch fails, still set up the user
					console.warn("Failed to fetch founder user data:", founderErr);
					setFounderUser(null);

					setUser({
						id: newSession.user.id,
						email: newSession.user.email,
						roles: [],
						founderUser: null,
					});
				}

				console.log(`User authenticated: ${newSession.user.id}`);
			} else {
				setUser(null);
				setFounderUser(null);
				console.log("User logged out");
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	// Helper to fetch user roles
	// const fetchUserRoles = async (authUser: User) => {
	//   try {
	//     const { data: roles, error: rolesError } = await supabase
	//       .from('user_roles')
	//       .select('role, event_id')
	//       .eq('user_id', authUser.id);

	//     if (rolesError) {
	//       throw rolesError;
	//     }

	//     setUser({
	//       id: authUser.id,
	//       email: authUser.email,
	//       roles: roles || []
	//     });
	//   } catch (err: any) {
	//     setError(err.message || 'Failed to fetch user roles');
	//   }
	// };

	// Sign in with email and password
	const signIn = async (email: string, password: string) => {
		try {
			setError(null);
			setIsLoading(true);

			const {
				data: { session: newSession },
				error: signInError,
			} = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (signInError) {
				throw signInError;
			}

			setSession(newSession);

			if (newSession?.user) {
				// Fetch founder user data if it exists
				try {
					const founderUserData = await fetchFounderUser(newSession.user.id);
					setFounderUser(founderUserData);

					setUser({
						id: newSession.user.id,
						email: newSession.user.email,
						roles: [],
						founderUser: founderUserData,
					});
				} catch (founderErr) {
					// If founder user fetch fails, still set up the user
					console.warn("Failed to fetch founder user data:", founderErr);
					setFounderUser(null);

					setUser({
						id: newSession.user.id,
						email: newSession.user.email,
						roles: [],
						founderUser: null,
					});
				}
			}
		} catch (err: any) {
			setError(err.message || "Failed to sign in");
		} finally {
			setIsLoading(false);
		}
	};

	// Sign up with email and password
	const signUp = async (email: string, password: string, name: string) => {
		try {
			setError(null);
			setIsLoading(true);

			const {
				data: { session: newSession, user: newUser },
				error: signUpError,
			} = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: {
						name,
					},
				},
			});

			if (signUpError) {
				throw signUpError;
			}

			setSession(newSession);
			if (newUser) {
				// For new users, founder user data will be null initially
				setUser({
					id: newUser.id,
					email: newUser.email,
					roles: [],
					founderUser: null,
				});
				setFounderUser(null);
			}

			return { user: newUser, error: null };
		} catch (err: any) {
			setError(err.message || "Failed to sign up");
			return { user: null, error: err };
		} finally {
			setIsLoading(false);
		}
	};

	// Sign out
	const signOut = async () => {
		try {
			setError(null);
			await supabase.auth.signOut();
		} catch (err: any) {
			setError(err.message || "Failed to sign out");
		}
	};

	// Check user roles
	// Simple admin detection - you can modify this logic as needed
	// For now, we'll use email-based admin detection
	const adminEmails = ["admin@pitchtank.ca", "rahel.gunaratne1@gmail.com"];
	const isAdmin = user?.email
		? adminEmails.includes(user.email.toLowerCase())
		: false;
	// const isInvestor = user?.roles.some(r => r.role === 'investor') || false;
	const isInvestor = true;
	// const isFounder = user?.roles.some(r => r.role === 'founder') || false;
	const isFounder = founderUser !== null;

	return {
		session,
		user,
		isLoading,
		isAdmin,
		isInvestor,
		isFounder,
		founderUser,
		error,
		signIn,
		signUp,
		signOut,
	};
}
