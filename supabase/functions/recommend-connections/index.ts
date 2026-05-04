import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "npm:openai";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AttendeeProfile {
  investor_id: string;
  name: string;
  bio: string | null;
  role: string | null;
  profile_picture_url: string | null;
}

interface Recommendation {
  investor_id: string;
  name: string;
  reason: string;
  bio: string | null;
  profile_picture_url: string | null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 503,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Use the user's JWT to identify them
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { eventId } = await req.json() as { eventId: string };
    if (!eventId) {
      return new Response(JSON.stringify({ error: "eventId is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch current user's profile
    const { data: currentUser } = await serviceClient
      .from("users")
      .select("first_name, last_name, bio, role, looking_to_connect")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!currentUser?.looking_to_connect && !currentUser?.bio) {
      return new Response(
        JSON.stringify({ recommendations: [], reason: "incomplete_profile" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // Fetch all event attendees (excluding current user)
    const { data: attendees } = await serviceClient
      .from("investors")
      .select(
        "id, name, profile_user_id, users!investors_profile_user_id_fkey(bio, role, profile_picture_url)",
      )
      .eq("event_id", eventId)
      .neq("profile_user_id", user.id)
      .order("name", { ascending: true })
      .limit(200);

    if (!attendees || attendees.length === 0) {
      return new Response(
        JSON.stringify({ recommendations: [] }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const attendeeProfiles: AttendeeProfile[] = attendees.map((a: any) => ({
      investor_id: a.id,
      name: a.name,
      bio: a.users?.bio ?? null,
      role: a.users?.role ?? null,
      profile_picture_url: a.users?.profile_picture_url ?? null,
    }));

    const currentUserName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") || "the user";

    const prompt = `You are helping ${currentUserName} find meaningful connections at a startup event.

Current user profile:
- Name: ${currentUserName}
- Role: ${currentUser.role ?? "not specified"}
- Bio: ${currentUser.bio ?? "not provided"}
- Looking to connect with: ${currentUser.looking_to_connect ?? "not specified"}

Event attendees (${attendeeProfiles.length} total):
${attendeeProfiles.map((a, i) => `${i + 1}. ${a.name} (${a.role ?? "no role"}) — ${a.bio ?? "no bio"}`).join("\n")}

Based on the current user's goals and profile, recommend up to 5 attendees they should connect with. For each recommendation, give a specific 1-2 sentence reason why this connection would be valuable.

Respond ONLY with a JSON array, no other text:
[{"investor_id": "<id>", "name": "<name>", "reason": "<reason>"}, ...]

Use the exact investor_id values: ${attendeeProfiles.map((a) => `"${a.investor_id}" = ${a.name}`).join(", ")}`;

    const openai = new OpenAI({ apiKey: openaiKey });

    const message = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No text response from OpenAI");
    }

    let recommendations: Recommendation[] = [];
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed: { investor_id: string; name: string; reason: string; }[] = JSON.parse(jsonMatch[0]);
        const profileMap = new Map(attendeeProfiles.map((a) => [a.investor_id, a]));
        recommendations = parsed.map((r) => {
          const profile = profileMap.get(r.investor_id);
          return {
            investor_id: r.investor_id,
            name: r.name,
            reason: r.reason,
            bio: profile?.bio ?? null,
            profile_picture_url: profile?.profile_picture_url ?? null,
          };
        });
      }
    } catch {
      // If parsing fails, return empty list
    }

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
