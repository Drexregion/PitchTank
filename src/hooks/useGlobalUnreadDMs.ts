import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export function useGlobalUnreadDMs(userId: string | null): number {
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (!userId) { setCount(0); return; }

		const fetchCount = () => {
			supabase
				.from("direct_messages")
				.select("id", { count: "exact", head: true })
				.eq("recipient_id", userId)
				.eq("is_read", false)
				.then(({ count: c }) => setCount(c ?? 0));
		};

		fetchCount();

		const channel = supabase
			.channel(`dm_unread_global_${userId}`)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "direct_messages" },
				fetchCount,
			)
			.subscribe();

		return () => { supabase.removeChannel(channel); };
	}, [userId]);

	return count;
}
