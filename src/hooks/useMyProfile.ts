import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
	gradientForUser,
	type GradientPresetKey,
} from "../components/design-system";

export interface MyProfile {
	id: string | null;
	authUserId: string;
	firstName: string;
	lastName: string;
	displayName: string;
	profilePictureUrl: string | null;
	profileColor: GradientPresetKey | null;
	gradient: [string, string];
	isLoading: boolean;
}

const EMPTY: Omit<MyProfile, "authUserId" | "gradient"> = {
	id: null,
	firstName: "",
	lastName: "",
	displayName: "",
	profilePictureUrl: null,
	profileColor: null,
	isLoading: true,
};

/**
 * Single source of truth for the current user's profile data.
 * Subscribes via Supabase realtime to UPDATEs on the user's own row so
 * changes (color, photo, name) propagate live to every consumer.
 */
export function useMyProfile(authUserId: string | null | undefined): MyProfile {
	const [state, setState] = useState<Omit<MyProfile, "authUserId" | "gradient">>({
		...EMPTY,
	});

	useEffect(() => {
		if (!authUserId) {
			setState({ ...EMPTY, isLoading: false });
			return;
		}

		let cancelled = false;
		const apply = (data: any) => {
			if (cancelled || !data) return;
			const first = data.first_name ?? "";
			const last = data.last_name ?? "";
			const display = [first, last].filter(Boolean).join(" ");
			setState({
				id: data.id ?? null,
				firstName: first,
				lastName: last,
				displayName: display,
				profilePictureUrl: data.profile_picture_url ?? null,
				profileColor:
					(data.profile_color as GradientPresetKey | null) ?? null,
				isLoading: false,
			});
		};

		supabase
			.from("users")
			.select(
				"id, first_name, last_name, profile_picture_url, profile_color",
			)
			.eq("auth_user_id", authUserId)
			.maybeSingle()
			.then(({ data }) => {
				if (cancelled) return;
				if (data) apply(data);
				else setState((s) => ({ ...s, isLoading: false }));
			});

		const channel = supabase
			.channel(`my_profile_${authUserId}`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "users",
					filter: `auth_user_id=eq.${authUserId}`,
				},
				(payload) => apply(payload.new),
			)
			.subscribe();

		return () => {
			cancelled = true;
			supabase.removeChannel(channel);
		};
	}, [authUserId]);

	const fallbackId = authUserId ?? "anon";
	return {
		...state,
		authUserId: fallbackId,
		gradient: gradientForUser(state.profileColor, fallbackId),
	};
}
