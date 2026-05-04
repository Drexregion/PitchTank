import React, { createContext, useContext, useState, useEffect } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type AuthUser = { id: string; email?: string };

type AuthContextValue = {
	session: Session | null;
	user: AuthUser | null;
	isLoading: boolean;
	isAdmin: boolean;
	error: string | null;
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (email: string, password: string, name: string) => Promise<{ user: User | null; error: Error | null }>;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const makeUser = (u: { id: string; email?: string }): AuthUser => ({ id: u.id, email: u.email });

	const fetchAdminStatus = async (authUserId: string) => {
		const { data } = await supabase
			.from("users")
			.select("is_admin")
			.eq("auth_user_id", authUserId)
			.maybeSingle();
		setIsAdmin(data?.is_admin ?? false);
	};

	// Synchronous auth state listener — never await DB calls inside onAuthStateChange
	// (doing so can deadlock the Supabase auth internals waiting for a JWT that is
	// locked while the event callback is still executing).
	useEffect(() => {
		let mounted = true;

		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
			if (!mounted) return;
			setSession(newSession);
			const u = newSession?.user ? makeUser(newSession.user) : null;
			setUser(u);
			if (!u) {
				setIsAdmin(false);
				setIsLoading(false);
			}
		});

		return () => {
			mounted = false;
			subscription.unsubscribe();
		};
	}, []);

	// Fetch admin status after user identity is known — runs outside the auth
	// callback so it can safely query the DB without risking a deadlock.
	useEffect(() => {
		if (!user) return;

		let mounted = true;
		fetchAdminStatus(user.id)
			.catch(() => setIsAdmin(false))
			.finally(() => { if (mounted) setIsLoading(false); });

		return () => { mounted = false; };
	}, [user?.id]);

	const signIn = async (email: string, password: string) => {
		try {
			setError(null);
			const { data: { session: s }, error: e } = await supabase.auth.signInWithPassword({ email, password });
			if (e) throw e;
			setSession(s);
			const u = s?.user ? makeUser(s.user) : null;
			setUser(u);
			if (u) await fetchAdminStatus(u.id);
		} catch (err: any) {
			setError(err.message || "Failed to sign in");
			throw err;
		}
	};

	const signUp = async (email: string, password: string, name: string) => {
		try {
			setError(null);
			const { data: { session: s, user: newUser }, error: e } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
			if (e) throw e;
			setSession(s);
			if (newUser) setUser(makeUser(newUser));
			return { user: newUser, error: null };
		} catch (err: any) {
			setError(err.message || "Failed to sign up");
			return { user: null, error: err };
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

	return (
		<AuthContext.Provider value={{ session, user, isLoading, isAdmin, error, signIn, signUp, signOut }}>
			{children}
		</AuthContext.Provider>
	);
};

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
	return ctx;
}
