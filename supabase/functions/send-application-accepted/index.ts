import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HTML = `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG /><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<!--[if mso]><style type="text/css">body,table,td{font-family:Arial,sans-serif!important}a{color:#ffffff!important}</style><![endif]-->
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>You're in — Pitch Tank</title>
<style>
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&family=Space+Grotesk:wght@400;600;700&display=swap");
body{margin:0;padding:0;background-color:#050508;font-family:"Inter",Arial,sans-serif;color:#e2e8f0}
img{border:0;display:block}
@media only screen and (max-width:480px){table[width="640"]{width:100%!important}}
</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#050508">
<tr><td align="center" bgcolor="#050508">
<table width="640" cellpadding="0" cellspacing="0" border="0" bgcolor="#050508" style="max-width:640px;width:100%">

<!-- HERO -->
<tr>
<td align="center" bgcolor="#04100a" style="background-color:#04100a;padding:56px 40px 52px;border-bottom:1px solid rgba(52,211,153,0.3);">
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px auto;">
<tr><td align="center" style="font-family:'Space Grotesk',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#34d399;border:1px solid rgba(52,211,153,0.4);border-radius:50px;padding:5px 16px;">Pitch Tank &bull; Application Accepted</td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px auto;">
<tr><td align="center" valign="middle" style="width:72px;height:72px;border-radius:50%;background-color:#0d2b1e;border:1px solid rgba(52,211,153,0.4);font-size:30px;line-height:72px;color:#34d399;font-family:Arial,sans-serif;text-align:center;">&#10003;</td></tr>
</table>
<h1 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:42px;font-weight:700;line-height:1.1;margin:0 0 16px 0;text-align:center;">
<span style="color:#f1f5f9">You're</span><br /><span style="color:#34d399">in.</span>
</h1>
<p style="font-size:16px;color:#94a3b8;line-height:1.7;margin:0 auto;max-width:420px;text-align:center;">
Your application has been accepted. Welcome to Pitch Tank — 200 investors are about to trade your shares in real-time.
</p>
</td>
</tr>

<!-- WHAT THIS MEANS -->
<tr>
<td bgcolor="#07080f" style="background:#07080f;padding:52px 40px">
<p style="font-family:'Space Grotesk',Arial,sans-serif;font-size:24px;font-weight:700;color:#f1f5f9;line-height:1.3;margin:0 0 20px 0;border-left:3px solid #34d399;padding-left:20px;">Here's what happens now.</p>
<p style="font-size:15px;line-height:1.85;color:#94a3b8;margin:0 0 20px 0;">
You'll be listed as a <strong style="color:#6ee7b7">pitching founder</strong> on the Pitch Tank platform. On the night, every person in the room becomes an investor — buying and selling your shares as you pitch, live, in front of the crowd.
</p>
<p style="font-size:15px;line-height:1.85;color:#94a3b8;margin:0;">
The founder with the highest market cap when trading closes <strong style="color:#6ee7b7">wins</strong>. No judges. Just the market.
</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:36px 0">
<tr><td height="1" bgcolor="#1a4030" style="height:1px;font-size:1px;line-height:1px;">&nbsp;</td></tr>
</table>
<!-- Step 1 -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
<tr>
<td width="58" valign="top" style="padding-right:18px">
<table cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" style="width:40px;height:40px;border-radius:50%;background-color:#0d1f17;border:1px solid #1a4030;font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:16px;color:#34d399;text-align:center;line-height:40px;">1</td></tr></table>
</td>
<td valign="top">
<p style="font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:16px;color:#e2e8f0;margin:0 0 4px 0;">Prepare your pitch</p>
<p style="font-size:14px;color:#94a3b8;line-height:1.6;margin:0;">You have a live audience and a live market reacting to every word. Keep it sharp, keep it real.</p>
</td>
</tr>
</table>
<!-- Step 2 -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="58" valign="top" style="padding-right:18px">
<table cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" style="width:40px;height:40px;border-radius:50%;background-color:#0d1f17;border:1px solid #1a4030;font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:16px;color:#a78bfa;text-align:center;line-height:40px;">2</td></tr></table>
</td>
<td valign="top">
<p style="font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:16px;color:#e2e8f0;margin:0 0 4px 0;">Show up and take the stage</p>
<p style="font-size:14px;color:#94a3b8;line-height:1.6;margin:0;">The market opens the moment you start talking. Make it count.</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- QUOTE BLOCK -->
<tr>
<td bgcolor="#070810" style="background-color:#070810;padding:48px 40px;border-top:1px solid #1a1a3a;border-bottom:1px solid #1a1a3a;">
<p style="font-family:'Space Grotesk',Arial,sans-serif;font-size:22px;font-weight:700;color:#f1f5f9;line-height:1.4;margin:0 0 20px 0;border-left:3px solid #7c3aed;padding-left:20px;">&ldquo;This isn&rsquo;t a pitch competition.<br />It&rsquo;s a live market.&rdquo;</p>
<p style="font-size:15px;line-height:1.85;color:#94a3b8;margin:0;">
200 attendees. Every single one an investor. Prices move with every slide, every pause, every moment of conviction or doubt.
<strong style="color:#c4b5fd">The crowd is the judge. The market is the verdict.</strong>
</p>
</td>
</tr>

<!-- CTA -->
<tr>
<td bgcolor="#07080f" style="background:#07080f;padding:52px 40px 56px;text-align:center;border-top:1px solid #1a2e1e;">
<p style="font-family:'Space Grotesk',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#34d399;margin:0 0 16px 0;">You're a Pitch Tank founder now.</p>
<p style="font-family:'Space Grotesk',Arial,sans-serif;font-size:26px;font-weight:700;color:#f1f5f9;line-height:1.25;margin:0 0 10px 0;">See you on the floor.</p>
<p style="font-size:14px;color:#94a3b8;margin:0 0 32px 0">Learn more about Pitch Tank at pitchtank.ca.</p>
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://pitchtank.ca" target="_blank" rel="noopener" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="50%" strokecolor="#34d399" fillcolor="#34d399"><w:anchorlock/><center style="color:#030305;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1px;">VISIT PITCHTANK.CA &rarr;</center></v:roundrect><![endif]--><!--[if !mso]><!-->
<a href="https://pitchtank.ca" target="_blank" rel="noopener" style="display:inline-block;background-color:#34d399;color:#030305;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:1px;padding:14px 36px;border-radius:50px;font-family:Arial,sans-serif;">VISIT PITCHTANK.CA &rarr;</a>
<!--<![endif]-->
</td>
</tr>

<!-- FOOTER -->
<tr>
<td bgcolor="#030305" style="background:#030305;border-top:1px solid #1a2e1e;padding:28px 40px;text-align:center;">
<p style="font-size:12px;color:#475569;line-height:1.7;margin:0;">
Pitch Tank &bull; <a href="https://pitchtank.ca" style="color:#6366f1;text-decoration:none">pitchtank.ca</a><br />
You're receiving this because your Pitch Tank application was accepted.
</p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 503, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { to, eventName } = (await req.json()) as {
      to: string;
      eventName?: string;
    };
    if (!to) {
      return new Response(JSON.stringify({ error: "to is required" }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Pitch Tank <info@pitchtank.ca>",
        to: [to],
        subject: eventName ? `You're in — ${eventName}` : "You're in — Pitch Tank",
        html: HTML,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `Resend error: ${errText}` }), {
        status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
