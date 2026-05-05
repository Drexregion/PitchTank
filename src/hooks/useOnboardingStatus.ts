import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export interface OnboardingStatus {
	isLoading: boolean;
	/** True until we've confirmed the user has finished onboarding. */
	needsOnboarding: boolean;
}

/**
 * Reads `users.onboarded_at` for the current auth user.
 *
 * Behaviour:
 *  - row exists with `onboarded_at` set  →  needsOnboarding = false
 *  - row exists with `onboarded_at` null →  needsOnboarding = true
 *  - row missing (signup trigger pending) →  needsOnboarding = true
 *  - query error                           →  needsOnboarding = false (fail open
 *    so a transient network error doesn't trap the user in onboarding)
 *  - no auth user                          →  needsOnboarding = false
 */
export function useOnboardingStatus(
	authUserId: string | null | undefined,
): OnboardingStatus {
	const [state, setState] = useState<OnboardingStatus>({
		isLoading: true,
		needsOnboarding: false,
	});

	useEffect(() => {
		if (!authUserId) {
			setState({ isLoading: false, needsOnboarding: false });
			return;
		}

		let cancelled = false;
		setState({ isLoading: true, needsOnboarding: false });

		const apply = (onboardedAt: unknown) => {
			if (cancelled) return;
			const onboarded = !!onboardedAt;
			setState({ isLoading: false, needsOnboarding: !onboarded });
		};

		supabase
			.from("users")
			.select("onboarded_at")
			.eq("auth_user_id", authUserId)
			.maybeSingle()
			.then(({ data, error }) => {
				if (cancelled) return;
				if (error) {
					setState({ isLoading: false, needsOnboarding: false });
					return;
				}
				apply(data?.onboarded_at);
			});

		// Realtime: refresh the moment onboarded_at lands. Solves the race
		// where the user finishes onboarding, navigates away, and the gate
		// would otherwise read a stale "needsOnboarding=true" state. We
		// listen for both UPDATE (existing user marks complete) and INSERT
		// (a new account whose `users` row didn't exist until upsert).
		const channel = supabase
			.channel(`onboarding_${authUserId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "users",
					filter: `auth_user_id=eq.${authUserId}`,
				},
				(payload) => {
					apply((payload.new as { onboarded_at?: unknown })?.onboarded_at);
				},
			)
			.subscribe();

		return () => {
			cancelled = true;
			supabase.removeChannel(channel);
		};
	}, [authUserId]);

	return state;
}
