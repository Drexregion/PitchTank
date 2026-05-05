import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

	if (req.method !== "POST") {
		return new Response(JSON.stringify({ error: "Method not allowed" }), {
			status: 405, headers: { ...CORS, "Content-Type": "application/json" },
		});
	}

	const authHeader = req.headers.get("Authorization");
	if (!authHeader) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401, headers: { ...CORS, "Content-Type": "application/json" },
		});
	}

	// Verify caller identity using their JWT (works because both projects share the same JWT secret)
	const userClient = createClient(
		Deno.env.get("SUPABASE_URL")!,
		Deno.env.get("SUPABASE_ANON_KEY")!,
		{ global: { headers: { Authorization: authHeader } } }
	);

	const { data: { user }, error: authError } = await userClient.auth.getUser();
	if (authError || !user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401, headers: { ...CORS, "Content-Type": "application/json" },
		});
	}

	// Check is_admin on users table
	const { data: userData } = await userClient
		.from("users")
		.select("is_admin")
		.eq("auth_user_id", user.id)
		.maybeSingle();

	if (!userData?.is_admin) {
		return new Response(JSON.stringify({ error: "Forbidden" }), {
			status: 403, headers: { ...CORS, "Content-Type": "application/json" },
		});
	}

	// Parse and validate body
	let enabled: boolean;
	try {
		const body = await req.json();
		if (typeof body.enabled !== "boolean") throw new Error("invalid");
		enabled = body.enabled;
	} catch {
		return new Response(JSON.stringify({ error: "Body must be { enabled: boolean }" }), {
			status: 400, headers: { ...CORS, "Content-Type": "application/json" },
		});
	}

	// Update app_config using service role to bypass RLS
	const serviceClient = createClient(
		Deno.env.get("SUPABASE_URL")!,
		Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
	);

	const { error: updateError } = await serviceClient
		.from("app_config")
		.update({ value: enabled })
		.eq("key", "failover_enabled");

	if (updateError) {
		return new Response(JSON.stringify({ error: updateError.message }), {
			status: 500, headers: { ...CORS, "Content-Type": "application/json" },
		});
	}

	return new Response(
		JSON.stringify({ success: true, failover_enabled: enabled }),
		{ status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
	);
});
