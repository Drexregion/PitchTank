import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

	// Verify caller is an authenticated admin
	const authHeader = req.headers.get("Authorization");
	if (!authHeader) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401, headers: { ...CORS, "Content-Type": "application/json" },
		});
	}

	const supabase = createClient(
		Deno.env.get("SUPABASE_URL")!,
		Deno.env.get("SUPABASE_ANON_KEY")!,
		{ global: { headers: { Authorization: authHeader } } }
	);

	const { data: { user }, error: authError } = await supabase.auth.getUser();
	if (authError || !user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401, headers: { ...CORS, "Content-Type": "application/json" },
		});
	}

	// Check is_admin on users table
	const { data: userData } = await supabase
		.from("users")
		.select("is_admin")
		.eq("auth_user_id", user.id)
		.maybeSingle();

	if (!userData?.is_admin) {
		return new Response(JSON.stringify({ error: "Forbidden" }), {
			status: 403, headers: { ...CORS, "Content-Type": "application/json" },
		});
	}

	// Use service role key for management queries
	const serviceClient = createClient(
		Deno.env.get("SUPABASE_URL")!,
		Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
	);

	const projectRef = Deno.env.get("SUPABASE_PROJECT_REF") ??
		Deno.env.get("SUPABASE_URL")!.split("//")[1].split(".")[0];
	const accessToken = Deno.env.get("MGMT_ACCESS_TOKEN");

	const mgmtHeaders = {
		"Authorization": `Bearer ${accessToken}`,
		"Content-Type": "application/json",
	};
	const mgmtBase = `https://api.supabase.com/v1/projects/${projectRef}`;

	// Run all fetches in parallel
	const [healthRes, functionsRes, dbStatsRes] = await Promise.allSettled([
		fetch(`${mgmtBase}/health?services=db,auth,storage,realtime,rest,pooler,pg_bouncer`, {
			headers: mgmtHeaders,
		}),
		fetch(`${mgmtBase}/functions`, {
			headers: mgmtHeaders,
		}),
		serviceClient.rpc("get_project_stats").single(),
	]);

	// Service health
	let services: any[] = [];
	if (healthRes.status === "fulfilled" && healthRes.value.ok) {
		services = await healthRes.value.json();
	}

	// Functions list
	let functions: any[] = [];
	if (functionsRes.status === "fulfilled" && functionsRes.value.ok) {
		const all = await functionsRes.value.json();
		// Only surface the ones that matter for event operation
		functions = all.map((f: any) => ({
			name: f.name,
			status: f.status,
			version: f.version,
		}));
	}

	// DB size + auth stats via direct SQL (management API database/query)
	let dbStats: any = null;
	try {
		const dbRes = await fetch(`${mgmtBase}/database/query`, {
			method: "POST",
			headers: mgmtHeaders,
			body: JSON.stringify({
				query: `
					SELECT
						pg_database_size(current_database()) AS db_size_bytes,
						(SELECT count(*) FROM auth.users) AS total_users,
						(SELECT count(*) FROM auth.users WHERE last_sign_in_at > NOW() - INTERVAL '30 days') AS mau_30d,
						(SELECT count(*) FROM auth.users WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d
				`,
			}),
		});
		if (dbRes.ok) {
			const rows = await dbRes.json();
			if (rows?.[0]) dbStats = rows[0];
		}
	} catch {
		// non-fatal
	}

	return new Response(
		JSON.stringify({ services, functions, dbStats, fetchedAt: new Date().toISOString() }),
		{ status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
	);
});
