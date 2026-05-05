import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useOnboardingStatus } from "../hooks/useOnboardingStatus";

/**
 * Paths that bypass the onboarding gate entirely. Anything that's part
 * of the auth flow (login, signup, forgot-password, welcome), the
 * onboarding flow itself, or destinations that explicitly opt out.
 */
const EXEMPT_PATH_PREFIXES = [
	"/login",
	"/signup",
	"/forgot-password",
	"/welcome",
	"/onboarding",
];

function isExemptPath(pathname: string): boolean {
	return EXEMPT_PATH_PREFIXES.some(
		(p) => pathname === p || pathname.startsWith(p + "/"),
	);
}

/**
 * Global gate wrapping the app's <Routes>. Logged-in users who haven't
 * finished onboarding get redirected to /onboarding regardless of which
 * page they tried to load. Logged-out users and exempt paths fall
 * through untouched (per-route auth handling stays in charge).
 */
export const OnboardingGate: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const location = useLocation();
	const { user, isLoading: authLoading } = useAuth();
	const status = useOnboardingStatus(user?.id ?? null);

	// Exempt paths render through unconditionally — never block /login etc.
	if (isExemptPath(location.pathname)) {
		return <>{children}</>;
	}

	// While we're still resolving auth or onboarding state, render a
	// minimal spinner instead of the page so the user doesn't see a
	// flash of (e.g.) the events list before being redirected.
	if (authLoading || status.isLoading) {
		return (
			<div
				className="min-h-screen flex items-center justify-center"
				style={{ background: "#080a14" }}
			>
				<div className="w-8 h-8 rounded-full border-2 border-pt-purple border-t-transparent animate-spin" />
			</div>
		);
	}

	// Logged-out users — let the route's own auth handling kick in.
	if (!user) {
		return <>{children}</>;
	}

	// Logged-in but hasn't finished onboarding → onboarding takes priority.
	// Two escape hatches that both override needsOnboarding:
	//
	//   1. `justOnboarded: true` in location.state — set on the immediate
	//      navigation right after finishing the flow.
	//
	//   2. A sessionStorage marker `pt_onboarded:<userId>=1`, also set in
	//      finish(). This survives subsequent navigations within the same
	//      tab so the gate doesn't loop the user back when realtime
	//      delivery for the user's row is delayed (which we've observed
	//      for brand-new accounts whose `users` row was just inserted).
	const justOnboarded =
		(location.state as { justOnboarded?: boolean } | null)?.justOnboarded ===
		true;
	let sessionMarked = false;
	if (user?.id && typeof window !== "undefined") {
		try {
			sessionMarked =
				sessionStorage.getItem(`pt_onboarded:${user.id}`) === "1";
		} catch {
			/* sessionStorage unavailable */
		}
	}
	if (status.needsOnboarding && !justOnboarded && !sessionMarked) {
		return <Navigate to="/onboarding" replace />;
	}

	return <>{children}</>;
};
