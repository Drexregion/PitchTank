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
	const [isAdmin, setIsAdmin] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	const makeUser = (u: { id: string; email?: string }): UserWithRoles => ({
		id: u.id,
		email: u.email,
		roles: [],
	});

	const fetchAdminStatus = async (authUserId: string) => {
		const { data } = await supabase
			.from("users")
			.select("is_admin")
			.eq("auth_user_id", authUserId)
			.maybeSingle();
		setIsAdmin(data?.is_admin ?? false);
	};

	useEffect(() => {
		setIsLoading(true);

		const fetchSession = async () => {
			try {
				const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
				if (sessionError) { setError(sessionError.message); setIsLoading(false); return; }
				setSession(currentSession);
				const u = currentSession?.user ? makeUser(currentSession.user) : null;
				setUser(u);
				if (u) await fetchAdminStatus(u.id);
			} catch (err: any) {
				setError(err.message || "Auth error");
			} finally {
				setIsLoading(false);
			}
		};

		fetchSession();

		const timeout = setTimeout(() => setIsLoading(false), 10000);

		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
			setSession(newSession);
			const u = newSession?.user ? makeUser(newSession.user) : null;
			setUser(u);
			if (u) {
				await fetchAdminStatus(u.id);
			} else {
				setIsAdmin(false);
			}
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
			const u = newSession?.user ? makeUser(newSession.user) : null;
			setUser(u);
			if (u) await fetchAdminStatus(u.id);
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
			setIsAdmin(false);
		} catch (err: any) {
			setError(err.message || "Failed to sign out");
		}
	};

	return { session, user, isLoading, isAdmin, isInvestor: true, error, signIn, signUp, signOut };
}
