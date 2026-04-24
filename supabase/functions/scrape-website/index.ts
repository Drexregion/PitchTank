import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Question {
  id: string;
  question_text: string;
  question_type: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }),
        { status: 503, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { url, questions } = (await req.json()) as {
      url: string;
      questions: Question[];
    };

    if (!url) {
      return new Response(
        JSON.stringify({ error: "url is required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Build a schema from text/textarea questions so Firecrawl extracts them precisely
    const textQuestions = questions.filter(
      (q) => q.question_type === "text" || q.question_type === "textarea"
    );

    // Each text/textarea question becomes a schema property named by its id
    const schemaProperties: Record<string, { type: string; description: string }> = {};
    for (const q of textQuestions) {
      schemaProperties[q.id] = {
        type: "string",
        description: q.question_text,
      };
    }

    const hasLogoQuestion = questions.some(
      (q) =>
        (q.question_type === "image" || q.question_type === "url") &&
        q.question_text.toLowerCase().includes("logo")
    );

    const scrapeBody: Record<string, unknown> = {
      url,
      formats: ["markdown"],
    };

    // Only include json extraction if there are text questions to fill
    if (textQuestions.length > 0) {
      scrapeBody.formats = ["markdown", "extract"];
      scrapeBody.extract = {
        schema: {
          type: "object",
          properties: schemaProperties,
        },
      };
    }

    const firecrawlRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(scrapeBody),
    });

    if (!firecrawlRes.ok) {
      const errText = await firecrawlRes.text();
      return new Response(
        JSON.stringify({ error: `Firecrawl error: ${errText}` }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const data = await firecrawlRes.json();

    // Extract text answers from the AI extraction result
    const extracted: Record<string, string> = {};

    const extractionData = data.data?.extract ?? data.extract ?? {};
    for (const q of textQuestions) {
      const val = extractionData[q.id];
      if (val && typeof val === "string" && val.trim()) {
        extracted[q.id] = val.trim();
      }
    }

    // Extract logo from metadata if needed
    let logoUrl: string | null = null;
    if (hasLogoQuestion) {
      const metadata = data.data?.metadata ?? data.metadata ?? {};
      if (metadata.favicon) {
        logoUrl = metadata.favicon;
      } else if (metadata["apple-touch-icon"]) {
        logoUrl = metadata["apple-touch-icon"];
      } else if (metadata.ogImage || metadata["og:image"]) {
        logoUrl = metadata.ogImage ?? metadata["og:image"];
      } else {
        try {
          const base = new URL(url);
          logoUrl = `${base.protocol}//${base.host}/favicon.ico`;
        } catch {
          // ignore
        }
      }
    }

    // Find the logo question id (if present) and include it
    if (logoUrl) {
      const logoQuestion = questions.find(
        (q) =>
          (q.question_type === "image" || q.question_type === "url") &&
          q.question_text.toLowerCase().includes("logo")
      );
      if (logoQuestion) {
        extracted[logoQuestion.id] = logoUrl;
      }
    }

    return new Response(JSON.stringify({ answers: extracted }), {
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
