import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { Session, User } from "@supabase/supabase-js";

type UserWithRoles = {
	id: string;
	email?: string;
	roles: { role: string; event_id: string }[];
};

type AuthHookReturn = {
	session: Session | null;
	user: UserWithRoles | null;
	isLoading: boolean;
	isAdmin: boolean;
	isInvestor: boolean;
	error: string | null;
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (email: string, password: string, name: string) => Promise<{ user: User | null; error: Error | null }>;
	signOut: () => Promise<void>;
};

export function useAuth(): AuthHookReturn {
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<UserWithRoles | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	const makeUser = (u: { id: string; email?: string }): UserWithRoles => ({
		id: u.id,
		email: u.email,
		roles: [],
	});

	useEffect(() => {
		setIsLoading(true);

		const fetchSession = async () => {
			try {
				const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
				if (sessionError) { setError(sessionError.message); setIsLoading(false); return; }
				setSession(currentSession);
				setUser(currentSession?.user ? makeUser(currentSession.user) : null);
			} catch (err: any) {
				setError(err.message || "Auth error");
			} finally {
				setIsLoading(false);
			}
		};

		fetchSession();

		const timeout = setTimeout(() => setIsLoading(false), 10000);

		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
			setSession(newSession);
			setUser(newSession?.user ? makeUser(newSession.user) : null);
		});

		return () => {
			clearTimeout(timeout);
			subscription.unsubscribe();
		};
	}, []);

	const signIn = async (email: string, password: string) => {
		try {
			setError(null);
			setIsLoading(true);
			const { data: { session: newSession }, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
			if (signInError) throw signInError;
			setSession(newSession);
			setUser(newSession?.user ? makeUser(newSession.user) : null);
		} catch (err: any) {
			setError(err.message || "Failed to sign in");
		} finally {
			setIsLoading(false);
		}
	};

	const signUp = async (email: string, password: string, name: string) => {
		try {
			setError(null);
			setIsLoading(true);
			const { data: { session: newSession, user: newUser }, error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
			if (signUpError) throw signUpError;
			setSession(newSession);
			if (newUser) setUser(makeUser(newUser));
			return { user: newUser, error: null };
		} catch (err: any) {
			setError(err.message || "Failed to sign up");
			return { user: null, error: err };
		} finally {
			setIsLoading(false);
		}
	};

	const signOut = async () => {
		try {
			setError(null);
			await supabase.auth.signOut();
		} catch (err: any) {
			setError(err.message || "Failed to sign out");
		}
	};

	const adminEmails = ["admin@pitchtank.ca", "rahel.gunaratne1@gmail.com"];
	const isAdmin = user?.email ? adminEmails.includes(user.email.toLowerCase()) : false;
	const isInvestor = true;

	return { session, user, isLoading, isAdmin, isInvestor, error, signIn, signUp, signOut };
}
