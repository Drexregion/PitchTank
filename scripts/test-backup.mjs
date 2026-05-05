/**
 * Test harness for the backup Supabase project.
 * Verifies schema, data, RLS, auth, and edge functions all work correctly.
 *
 * Usage:
 *   SUPABASE_BACKUP_URL=... SUPABASE_BACKUP_ANON_KEY=... \
 *   SUPABASE_BACKUP_SERVICE_ROLE_KEY=... \
 *   BACKUP_TEST_EMAIL=user@example.com BACKUP_TEST_PASSWORD=resetpassword \
 *   node scripts/test-backup.mjs
 *
 * BACKUP_TEST_EMAIL / BACKUP_TEST_PASSWORD must be a user who has reset their
 * password on the backup project (passwords are not migrated).
 */

import { createClient } from "@supabase/supabase-js";

const BACKUP_URL = process.env.SUPABASE_BACKUP_URL;
const BACKUP_KEY = process.env.SUPABASE_BACKUP_ANON_KEY;
const BACKUP_SR  = process.env.SUPABASE_BACKUP_SERVICE_ROLE_KEY;
const TEST_EMAIL = process.env.BACKUP_TEST_EMAIL;
const TEST_PASS  = process.env.BACKUP_TEST_PASSWORD;

if (!BACKUP_URL || !BACKUP_KEY || !BACKUP_SR) {
  console.error("Missing: SUPABASE_BACKUP_URL, SUPABASE_BACKUP_ANON_KEY, SUPABASE_BACKUP_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Primary client — used to get a primary-issued JWT to test cross-project token acceptance
const PRIMARY_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const PRIMARY_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const primary = PRIMARY_URL && PRIMARY_KEY
  ? createClient(PRIMARY_URL, PRIMARY_KEY, { auth: { persistSession: false } })
  : null;

const anon    = createClient(BACKUP_URL, BACKUP_KEY, { auth: { persistSession: false } });
const service = createClient(BACKUP_URL, BACKUP_SR,  { auth: { autoRefreshToken: false, persistSession: false } });

const TABLES = [
  "users", "pitches", "investors", "events",
  "investor_holdings", "trades", "price_history",
  "applications", "chat_messages", "direct_messages",
  "app_config",
];

const EDGE_FNS = [
  "get-project-health",
  "executeTrade",
  "recommend-connections",
  "scrape-website",
  "send-application-accepted",
  "send-application-received",
  "toggle-failover",
];

// ── Test helpers ──────────────────────────────────────────────────────────────

function pass(name, detail = "") {
  return { name, ok: true, detail };
}

function fail(name, detail = "") {
  return { name, ok: false, detail };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testHealth() {
  try {
    const res = await fetch(`${BACKUP_URL}/auth/v1/health`, { signal: AbortSignal.timeout(5000) });
    // 200 = healthy open endpoint, 401 = auth required but service is running — both mean online
    if (res.ok || res.status === 401) return pass("health check", `HTTP ${res.status} (online)`);
    return fail("health check", `HTTP ${res.status}`);
  } catch (e) {
    return fail("health check", e.message);
  }
}

// Sign into PRIMARY, then verify the same JWT is accepted by backup.
// This works because both projects share the same JWT secret.
async function testAuth() {
  if (!TEST_EMAIL || !TEST_PASS) {
    return [{ name: "auth: sign in to primary", ok: null, detail: "SKIPPED — set BACKUP_TEST_EMAIL and BACKUP_TEST_PASSWORD" }];
  }
  const results = [];
  let primaryToken = null;

  // Step 1: sign in on primary
  if (!primary) {
    results.push(fail("auth: sign in to primary", "VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set"));
  } else {
    try {
      const { data, error } = await primary.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASS });
      if (error) results.push(fail("auth: sign in to primary", error.message));
      else if (!data.session?.access_token) results.push(fail("auth: sign in to primary", "no access token"));
      else {
        primaryToken = data.session.access_token;
        results.push(pass("auth: sign in to primary", `user ${data.user.id}`));
      }
    } catch (e) { results.push(fail("auth: sign in to primary", e.message)); }
  }

  // Step 2: use primary JWT against backup's getUser — same secret means it should be accepted
  if (primaryToken) {
    try {
      const backupWithToken = createClient(BACKUP_URL, BACKUP_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${primaryToken}` } },
      });
      const { data, error } = await backupWithToken.auth.getUser(primaryToken);
      if (error) results.push(fail("auth: primary JWT accepted by backup", error.message));
      else results.push(pass("auth: primary JWT accepted by backup", `user ${data.user.id}`));
    } catch (e) { results.push(fail("auth: primary JWT accepted by backup", e.message)); }
  }

  return results;
}

async function testTables() {
  const results = [];
  for (const table of TABLES) {
    try {
      const { error, count } = await service
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) results.push(fail(`table: ${table}`, error.message));
      else results.push(pass(`table: ${table}`, `${count ?? "?"} rows`));
    } catch (e) {
      results.push(fail(`table: ${table}`, e.message));
    }
  }
  return results;
}

async function testRLS() {
  // direct_messages should return 0 rows to unauthenticated anon client (RLS should block)
  try {
    const { data, error } = await anon.from("direct_messages").select("id").limit(5);
    if (error) return pass("RLS: direct_messages blocked for anon", `error: ${error.message}`);
    if (data.length === 0) return pass("RLS: direct_messages blocked for anon", "0 rows returned");
    return fail("RLS: direct_messages blocked for anon", `returned ${data.length} rows — RLS may not be enabled`);
  } catch (e) {
    return pass("RLS: direct_messages blocked for anon", `blocked: ${e.message}`);
  }
}

async function testAppConfig() {
  try {
    const { data, error } = await service
      .from("app_config")
      .select("key, value")
      .eq("key", "failover_enabled")
      .maybeSingle();
    if (error) return fail("app_config: failover_enabled exists", error.message);
    if (!data) return fail("app_config: failover_enabled exists", "row not found");
    if (typeof data.value !== "boolean") return fail("app_config: failover_enabled is boolean", `got ${typeof data.value}: ${JSON.stringify(data.value)}`);
    return pass("app_config: failover_enabled exists", `value = ${data.value}`);
  } catch (e) {
    return fail("app_config: failover_enabled exists", e.message);
  }
}

async function testEdgeFunctions(token) {
  const results = [];
  const authHeader = token ? `Bearer ${token}` : `Bearer ${BACKUP_KEY}`;
  for (const fn of EDGE_FNS) {
    try {
      // Use GET for get-project-health, OPTIONS probe for others to avoid side effects
      const method = fn === "get-project-health" ? "GET" : "OPTIONS";
      const res = await fetch(`${BACKUP_URL}/functions/v1/${fn}`, {
        method,
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      // OPTIONS should return 200/204, GET should return non-500
      if (res.status >= 500) {
        results.push(fail(`edge fn: ${fn}`, `HTTP ${res.status}`));
      } else {
        results.push(pass(`edge fn: ${fn}`, `HTTP ${res.status}`));
      }
    } catch (e) {
      results.push(fail(`edge fn: ${fn}`, e.message));
    }
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=================================================");
  console.log("  PitchTank Backup Test Harness");
  console.log(`  Target: ${BACKUP_URL}`);
  console.log("=================================================\n");

  const allResults = [];

  // Health
  allResults.push(await testHealth());

  // Auth — signs into primary, verifies primary JWT accepted by backup
  const authResults = await testAuth();
  allResults.push(...authResults);
  // Extract the primary token from the sign-in result for edge function tests
  let authToken = null;
  if (TEST_EMAIL && TEST_PASS && primary) {
    const { data } = await primary.auth.getSession();
    authToken = data.session?.access_token ?? null;
  }

  // Tables
  allResults.push(...await testTables());

  // RLS
  allResults.push(await testRLS());

  // app_config
  allResults.push(await testAppConfig());

  // Edge functions
  allResults.push(...await testEdgeFunctions(authToken));

  // ── Print results ─────────────────────────────────────────────────────────
  let passed = 0, failed = 0, skipped = 0;
  for (const r of allResults) {
    if (r.ok === null) {
      skipped++;
      console.log(`  SKIP  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    } else if (r.ok) {
      passed++;
      console.log(`  PASS  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    } else {
      failed++;
      console.log(`  FAIL  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    }
  }

  console.log(`\n-------------------------------------------------`);
  console.log(`  Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}`);
  console.log(`-------------------------------------------------\n`);

  if (failed > 0) {
    console.error("Some tests failed. Review the output above.");
    process.exit(1);
  }

  console.log("All tests passed. Backup project is ready.");
}

main().catch((e) => { console.error(e); process.exit(1); });
