/**
 * Admin script: Export all investors for an event to CSV, then verify emails via Verifalia.
 *
 * Outputs two files to internal/admin/output/:
 *   event_users_<eventId>.csv          — all investors (name, email, current_balance)
 *   event_users_<eventId>_verified.csv — only investors with Deliverable emails
 *
 * Usage:
 *   node internal/admin/exportEventUsers.js <event_id>
 *   # or
 *   EVENT_ID=<uuid> node internal/admin/exportEventUsers.js
 *
 * Requires env vars (see internal/admin/.env.template):
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VERIFALIA_USERNAME
 *   VERIFALIA_PASSWORD
 */

import { createClient } from "@supabase/supabase-js";
import { VerifaliaRestClient } from "verifalia";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// ── Environment ────────────────────────────────────────────────────────────────

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const VERIFALIA_USERNAME = process.env.VERIFALIA_USERNAME;
const VERIFALIA_PASSWORD = process.env.VERIFALIA_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
  );
  process.exit(1);
}

if (!VERIFALIA_USERNAME || !VERIFALIA_PASSWORD) {
  console.error(
    "Missing env: VERIFALIA_USERNAME and VERIFALIA_PASSWORD are required."
  );
  process.exit(1);
}

// ── Clients ────────────────────────────────────────────────────────────────────

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const verifalia = new VerifaliaRestClient({
  username: VERIFALIA_USERNAME,
  password: VERIFALIA_PASSWORD,
});

// ── Filename helpers ───────────────────────────────────────────────────────────

/** Convert an event name to a safe, lowercase filename slug. */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ── CSV helpers ────────────────────────────────────────────────────────────────

/** Escape a single field value per RFC 4180. */
function csvField(value) {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSVRow(fields) {
  return fields.map(csvField).join(",");
}

function writeCSV(filePath, investors) {
  const header = toCSVRow(["name", "email", "current_balance"]);
  const rows = investors.map((i) =>
    toCSVRow([i.name, i.email ?? "", i.current_balance])
  );
  fs.writeFileSync(filePath, [header, ...rows].join("\n"), "utf-8");
}

// ── Email verification ─────────────────────────────────────────────────────────

/**
 * Submit a list of email addresses to Verifalia and return a map of
 * email → classification for each address.
 *
 * Valid classifications:
 *   "Deliverable"   — address accepts mail
 *   "Risky"         — technically valid but possibly a trap / catch-all
 *   "Undeliverable" — bounces, invalid domain, etc.
 *   "Unknown"       — could not be determined
 */
async function verifyEmails(emails) {
  console.log(`\nSubmitting ${emails.length} email(s) to Verifalia...`);

  const result = await verifalia.emailValidations.submit(emails);

  if (!result) {
    throw new Error(
      "Verifalia returned no result — the job may still be processing."
    );
  }

  /** @type {Map<string, string>} email (lowercased) → classification */
  const classificationMap = new Map();

  for (const entry of result.entries) {
    classificationMap.set(entry.inputData.toLowerCase(), entry.classification);
  }

  return classificationMap;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function exportEventUsers(eventId) {
  // 1. Verify the event exists
  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    console.error(`Event not found: ${eventId}`);
    process.exit(1);
  }

  console.log(`\nExporting users for event: "${event.name}" (${eventId})`);

  // 2. Fetch all investors for the event
  const { data: investors, error: investorsError } = await admin
    .from("investors")
    .select("id, name, email, current_balance")
    .eq("event_id", eventId)
    .order("name");

  if (investorsError) {
    console.error("Failed to fetch investors:", investorsError.message);
    process.exit(1);
  }

  if (!investors || investors.length === 0) {
    console.log("No investors found for this event.");
    process.exit(0);
  }

  console.log(`Found ${investors.length} investor(s).`);

  // 3. Write the full CSV (all investors, including those without email)
  const outputDir = path.join("internal", "admin", "output");
  fs.mkdirSync(outputDir, { recursive: true });

  const slug = slugify(event.name);
  const fullCsvPath = path.join(outputDir, `event_users_${slug}.csv`);
  writeCSV(fullCsvPath, investors);
  console.log(`\nFull CSV written: ${fullCsvPath}`);

  // 4. Separate out investors that have an email address
  const withEmail = investors.filter((i) => i.email && i.email.trim() !== "");
  const withoutEmail = investors.length - withEmail.length;

  if (withoutEmail > 0) {
    console.log(
      `  ${withoutEmail} investor(s) have no email and will be excluded from verification.`
    );
  }

  if (withEmail.length === 0) {
    console.log("No investors have email addresses — skipping Verifalia step.");
    process.exit(0);
  }

  // 5. Verify all emails via Verifalia
  const emails = withEmail.map((i) => i.email.trim());
  const classificationMap = await verifyEmails(emails);

  // 6. Categorise results
  const deliverable = [];
  const risky = [];
  const undeliverable = [];
  const unknown = [];

  for (const investor of withEmail) {
    const key = investor.email.trim().toLowerCase();
    const classification = classificationMap.get(key) ?? "Unknown";

    switch (classification) {
      case "Deliverable":
        deliverable.push(investor);
        break;
      case "Risky":
        risky.push(investor);
        break;
      case "Undeliverable":
        undeliverable.push(investor);
        break;
      default:
        unknown.push(investor);
    }
  }

  // 7. Write verified CSV (Deliverable only)
  const verifiedCsvPath = path.join(outputDir, `event_users_${slug}_verified.csv`);
  writeCSV(verifiedCsvPath, deliverable);
  console.log(`Verified CSV written:  ${verifiedCsvPath}`);

  // 8. Summary
  console.log("\n── Verifalia summary ─────────────────────────────────────");
  console.log(`  Total investors:        ${investors.length}`);
  console.log(`  With email:             ${withEmail.length}`);
  console.log(`  Without email:          ${withoutEmail}`);
  console.log(`  ✓ Deliverable:          ${deliverable.length}`);
  console.log(`  ⚠ Risky:               ${risky.length}`);
  console.log(`  ✗ Undeliverable:        ${undeliverable.length}`);
  console.log(`  ? Unknown:              ${unknown.length}`);
  console.log("──────────────────────────────────────────────────────────\n");

  if (risky.length > 0) {
    console.log("Risky emails (not included in verified CSV):");
    risky.forEach((i) => console.log(`  ${i.email}  (${i.name})`));
    console.log();
  }

  if (undeliverable.length > 0) {
    console.log("Undeliverable emails:");
    undeliverable.forEach((i) => console.log(`  ${i.email}  (${i.name})`));
    console.log();
  }

  if (unknown.length > 0) {
    console.log("Unknown emails (could not be determined):");
    unknown.forEach((i) => console.log(`  ${i.email}  (${i.name})`));
    console.log();
  }
}

async function run() {
  const eventId = process.argv[2] || process.env.EVENT_ID;

  if (!eventId) {
    console.error(
      "Usage: node internal/admin/exportEventUsers.js <event_id>"
    );
    console.error("   or: EVENT_ID=<uuid> node internal/admin/exportEventUsers.js");
    process.exit(1);
  }

  await exportEventUsers(eventId);
}

run().catch((err) => {
  console.error("\nExport failed:", err?.message || err);
  process.exit(1);
});
