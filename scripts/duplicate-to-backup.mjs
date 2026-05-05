/**
 * Duplicate PitchTank primary Supabase project (us-east-1) to backup (ca-central-1).
 *
 * No pg_dump, no DB passwords, no Docker needed.
 * Uses: Management API (schema via pg_catalog), REST API (data export), Supabase Admin API (auth users).
 *
 * Required env vars (all already in your .env):
 *   MGMT_ACCESS_TOKEN, SUPABASE_PRIMARY_REF, SUPABASE_SERVICE_ROLE_KEY,
 *   SUPABASE_BACKUP_REF, SUPABASE_BACKUP_URL, SUPABASE_BACKUP_SERVICE_ROLE_KEY,
 *   SUPABASE_BACKUP_ANON_KEY, OPENAI_API_KEY, RESEND_API_KEY, FIRECRAWL_API_KEY
 *
 * Usage:
 *   node --env-file=.env scripts/duplicate-to-backup.mjs
 *   -- or (Node < 20) --
 *   source .env && node scripts/duplicate-to-backup.mjs
 */

import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const {
  MGMT_ACCESS_TOKEN,
  SUPABASE_PRIMARY_REF,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BACKUP_REF,
  SUPABASE_BACKUP_URL,
  SUPABASE_BACKUP_SERVICE_ROLE_KEY,
  SUPABASE_BACKUP_ANON_KEY,
  OPENAI_API_KEY,
  RESEND_API_KEY,
  FIRECRAWL_API_KEY,
} = process.env;

const required = {
  MGMT_ACCESS_TOKEN, SUPABASE_PRIMARY_REF, SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BACKUP_REF, SUPABASE_BACKUP_URL, SUPABASE_BACKUP_SERVICE_ROLE_KEY,
  SUPABASE_BACKUP_ANON_KEY, OPENAI_API_KEY, RESEND_API_KEY, FIRECRAWL_API_KEY,
};
for (const [k, v] of Object.entries(required)) {
  if (!v) { console.error(`Missing required env var: ${k}`); process.exit(1); }
}

const PRIMARY_URL  = `https://${SUPABASE_PRIMARY_REF}.supabase.co`;
const MGMT_BASE    = "https://api.supabase.com/v1";

const mgmtHeaders  = { Authorization: `Bearer ${MGMT_ACCESS_TOKEN}`, "Content-Type": "application/json" };
const primarySRHeaders = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function step(n, total, msg) { console.log(`\n==> [${n}/${total}] ${msg}`); }
function ok(msg)   { console.log(`    ✓  ${msg}`); }
function warn(msg) { console.log(`    ⚠  ${msg}`); }
function info(msg) { console.log(`    ${msg}`); }

async function mgmtQuery(ref, sql) {
  const res = await fetch(`${MGMT_BASE}/projects/${ref}/database/query`, {
    method: "POST", headers: mgmtHeaders, body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`DB query failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// Run potentially large SQL in statement-level chunks (Management API has body size limits)
async function runSqlChunked(ref, sql) {
  const MAX = 400_000; // ~400 KB per request
  if (sql.length <= MAX) {
    await mgmtQuery(ref, sql);
    return 1;
  }
  const stmts = sql.split(/(?<=;)\s*\n/).filter(s => s.trim());
  let chunk = "", chunks = 0;
  for (const stmt of stmts) {
    if (chunk.length + stmt.length > MAX && chunk.length > 0) {
      await mgmtQuery(ref, chunk);
      chunks++;
      chunk = stmt + "\n";
    } else {
      chunk += stmt + "\n";
    }
  }
  if (chunk.trim()) { await mgmtQuery(ref, chunk); chunks++; }
  return chunks;
}

// Export a table's rows via REST API using service role (bypasses RLS)
async function fetchTableData(tableName) {
  const rows = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const res = await fetch(
      `${PRIMARY_URL}/rest/v1/${tableName}?select=*&offset=${offset}&limit=${PAGE}`,
      { headers: { ...primarySRHeaders, "Range-Unit": "items", "Range": `${offset}-${offset + PAGE - 1}` } }
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`REST export failed for ${tableName}: ${res.status} ${t.slice(0, 200)}`);
    }
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

// Generate INSERT SQL from rows
function rowsToInsertSql(tableName, rows) {
  if (!rows.length) return "";
  const escape = (v) => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (typeof v === "number") return String(v);
    if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
  };
  const cols = Object.keys(rows[0]).map(c => `"${c}"`).join(", ");
  const valueLines = rows.map(row =>
    "(" + Object.values(row).map(escape).join(", ") + ")"
  );
  // Batch into chunks of 500 rows per INSERT
  const BATCH = 500;
  const sqls = [];
  for (let i = 0; i < valueLines.length; i += BATCH) {
    const batch = valueLines.slice(i, i + BATCH);
    sqls.push(
      `INSERT INTO public."${tableName}" (${cols}) VALUES\n${batch.join(",\n")}\nON CONFLICT DO NOTHING;`
    );
  }
  return sqls.join("\n\n");
}

// ── Schema extraction via pg_catalog (Management API, runs as postgres superuser)
const SCHEMA_EXTRACT_SQL = `
-- Tables and columns
SELECT 'tables' AS kind, json_agg(t ORDER BY t.ordinal) AS data
FROM (
  SELECT
    c.relname AS table_name,
    a.attnum AS ordinal,
    a.attname AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
    CASE WHEN a.attnotnull THEN 'NOT NULL' ELSE '' END AS not_null,
    CASE WHEN a.atthasdef THEN pg_get_expr(d.adbin, d.adrelid) ELSE NULL END AS column_default,
    a.attidentity AS identity
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
  WHERE n.nspname = 'public' AND c.relkind = 'r'
) t

UNION ALL

-- Primary keys and unique constraints
SELECT 'constraints', json_agg(t) FROM (
  SELECT
    tc.table_name, tc.constraint_name, tc.constraint_type,
    string_agg(kc.column_name, ', ' ORDER BY kc.ordinal_position) AS columns
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kc
    ON tc.constraint_name = kc.constraint_name AND tc.table_schema = kc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
  GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
) t

UNION ALL

-- Foreign keys
SELECT 'fkeys', json_agg(t) FROM (
  SELECT
    tc.table_name, tc.constraint_name,
    kc.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column,
    rc.delete_rule, rc.update_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kc
    ON tc.constraint_name = kc.constraint_name AND tc.table_schema = kc.table_schema
  JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name AND tc.constraint_schema = rc.constraint_schema
  JOIN information_schema.constraint_column_usage ccu
    ON rc.unique_constraint_name = ccu.constraint_name
  WHERE tc.table_schema = 'public'
) t

UNION ALL

-- Indexes (non-pk/unique)
SELECT 'indexes', json_agg(t) FROM (
  SELECT tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname NOT IN (
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND constraint_type IN ('PRIMARY KEY','UNIQUE')
    )
) t

UNION ALL

-- RLS policies
SELECT 'policies', json_agg(t) FROM (
  SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
) t

UNION ALL

-- RLS enabled tables
SELECT 'rls_tables', json_agg(t) FROM (
  SELECT relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
) t

UNION ALL

-- Sequences
SELECT 'sequences', json_agg(t) FROM (
  SELECT sequence_name, data_type, start_value, minimum_value, maximum_value, increment, cycle_option
  FROM information_schema.sequences
  WHERE sequence_schema = 'public'
) t

UNION ALL

-- Functions
SELECT 'functions', json_agg(t) FROM (
  SELECT proname AS name, pg_get_functiondef(oid) AS definition
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND prokind IN ('f', 'p')
) t

UNION ALL

-- Triggers
SELECT 'triggers', json_agg(t) FROM (
  SELECT event_object_table AS table_name, trigger_name,
         event_manipulation, action_timing, action_statement
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
) t;
`;

function buildSchemaSql(schemaData) {
  const byKind = {};
  for (const row of schemaData) byKind[row.kind] = row.data ?? [];

  const tables   = byKind.tables       ?? [];
  const constrs  = byKind.constraints  ?? [];
  const fkeys    = byKind.fkeys        ?? [];
  const indexes  = byKind.indexes      ?? [];
  const policies = byKind.policies     ?? [];
  const rlsTbls  = byKind.rls_tables   ?? [];
  const seqs     = byKind.sequences    ?? [];
  const funcs    = byKind.functions    ?? [];
  const triggers = byKind.triggers     ?? [];

  const lines = ["-- Auto-generated schema\n"];

  // Sequences
  for (const s of seqs) {
    lines.push(
      `CREATE SEQUENCE IF NOT EXISTS public."${s.sequence_name}"\n` +
      `  AS ${s.data_type} START ${s.start_value} MINVALUE ${s.minimum_value}` +
      ` MAXVALUE ${s.maximum_value} INCREMENT ${s.increment}${s.cycle_option === 'YES' ? ' CYCLE' : ''};\n`
    );
  }

  // Tables — group columns by table
  const tableMap = {};
  for (const col of tables) {
    (tableMap[col.table_name] ??= []).push(col);
  }
  for (const [tbl, cols] of Object.entries(tableMap)) {
    cols.sort((a, b) => a.ordinal - b.ordinal);
    const colDefs = cols.map(c => {
      let def = `  "${c.column_name}" ${c.data_type}`;
      if (c.column_default && !c.identity) def += ` DEFAULT ${c.column_default}`;
      if (c.not_null) def += ` ${c.not_null}`;
      return def;
    });
    lines.push(`CREATE TABLE IF NOT EXISTS public."${tbl}" (\n${colDefs.join(",\n")}\n);\n`);
  }

  // Primary keys and unique constraints
  for (const c of constrs) {
    const type = c.constraint_type === "PRIMARY KEY" ? "PRIMARY KEY" : "UNIQUE";
    lines.push(
      `ALTER TABLE public."${c.table_name}" ADD CONSTRAINT "${c.constraint_name}" ${type} (${c.columns});\n`
    );
  }

  // Foreign keys (added after all tables exist)
  for (const f of fkeys) {
    const onDel = f.delete_rule !== "NO ACTION" ? ` ON DELETE ${f.delete_rule}` : "";
    const onUpd = f.update_rule !== "NO ACTION" ? ` ON UPDATE ${f.update_rule}` : "";
    lines.push(
      `ALTER TABLE public."${f.table_name}" ADD CONSTRAINT "${f.constraint_name}" ` +
      `FOREIGN KEY ("${f.column_name}") REFERENCES public."${f.ref_table}"("${f.ref_column}")${onDel}${onUpd} NOT VALID;\n`
    );
  }

  // Indexes
  for (const idx of indexes) {
    lines.push(`${idx.indexdef};\n`);
  }

  // Functions BEFORE policies (policies may reference functions)
  for (const f of funcs) {
    lines.push(`${f.definition};\n`);
  }

  // RLS
  for (const t of rlsTbls) {
    lines.push(`ALTER TABLE public."${t.table_name}" ENABLE ROW LEVEL SECURITY;\n`);
  }
  for (const p of policies) {
    const permissive = (p.permissive ?? "PERMISSIVE").toUpperCase();
    const roles = p.roles ? `TO ${p.roles}` : "";
    const cmd = p.cmd ?? "ALL";
    let pol = `CREATE POLICY "${p.policyname}" ON public."${p.tablename}" AS ${permissive} FOR ${cmd} ${roles}`;
    if (p.qual)       pol += ` USING (${p.qual})`;
    if (p.with_check) pol += ` WITH CHECK (${p.with_check})`;
    lines.push(pol + ";\n");
  }

  // Triggers
  for (const t of triggers) {
    lines.push(
      `CREATE TRIGGER "${t.trigger_name}" ${t.action_timing} ${t.event_manipulation} ` +
      `ON public."${t.table_name}" FOR EACH ROW ${t.action_statement};\n`
    );
  }

  return lines.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TOTAL = 8;

console.log("========================================================");
console.log("  PitchTank → Backup Duplication");
console.log(`  Primary:  ${SUPABASE_PRIMARY_REF} (us-east-1)`);
console.log(`  Backup:   ${SUPABASE_BACKUP_REF} (ca-central-1)`);
console.log("========================================================");

// ── Step 1: Extract schema from primary ──────────────────────────────────────
step(1, TOTAL, "Extracting schema from primary via pg_catalog...");
const schemaData = await mgmtQuery(SUPABASE_PRIMARY_REF, SCHEMA_EXTRACT_SQL);
const schemaSql  = buildSchemaSql(schemaData);
ok(`Schema extracted (${(schemaSql.length / 1024).toFixed(0)} KB, ${schemaData.length} catalog rows)`);

// ── Step 2: Export data from primary ─────────────────────────────────────────
step(2, TOTAL, "Exporting data from primary via REST API...");
const TABLES = [
  "users", "pitches", "investors", "events",
  "investor_holdings", "trades", "price_history",
  "applications", "chat_messages", "direct_messages",
];
const allData = {};
let totalRows = 0;
for (const t of TABLES) {
  process.stdout.write(`    ${t}... `);
  const rows = await fetchTableData(t);
  allData[t] = rows;
  totalRows += rows.length;
  console.log(`${rows.length} rows`);
}
ok(`Exported ${totalRows} total rows across ${TABLES.length} tables`);

// ── Step 3: Apply schema to backup (skip if tables already exist) ────────────
step(3, TOTAL, "Applying schema to backup...");
const existingTables = await mgmtQuery(SUPABASE_BACKUP_REF,
  "SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r';"
);
if (existingTables.length > 0) {
  ok(`Schema already applied (${existingTables.length} tables found — skipping)`);
} else {
  const schemaChunks = await runSqlChunked(SUPABASE_BACKUP_REF, schemaSql);
  ok(`Schema applied (${schemaChunks} chunk${schemaChunks > 1 ? "s" : ""})`);
}

// ── Step 4: Apply data to backup ─────────────────────────────────────────────
step(4, TOTAL, "Applying data to backup...");
// Insert in FK-safe order: referenced tables first
const TABLES_ORDERED = [
  "events",          // referenced by pitches, investors, applications
  "users",           // referenced by investors, pitches, chat_messages, direct_messages
  "pitches",         // referenced by investor_holdings, trades, price_history
  "investors",       // referenced by investor_holdings, trades
  "investor_holdings",
  "trades",
  "price_history",
  "applications",
  "chat_messages",
  "direct_messages",
];
let insertedTables = 0;
// Check which tables already have data
const countResults = await Promise.all(
  TABLES_ORDERED.map(t => mgmtQuery(SUPABASE_BACKUP_REF, `SELECT count(*)::int AS n FROM public."${t}";`).then(r => ({ t, n: r[0]?.n ?? 0 })).catch(() => ({ t, n: 0 })))
);
const existingCounts = Object.fromEntries(countResults.map(({ t, n }) => [t, n]));

for (const t of TABLES_ORDERED) {
  const rows = allData[t];
  if (!rows || !rows.length) { info(`${t} — 0 rows, skipped`); continue; }
  if (existingCounts[t] > 0) { info(`${t} — ${existingCounts[t]} rows already present, skipping`); continue; }
  process.stdout.write(`    ${t} (${rows.length} rows)... `);
  // Wrap each table's insert in replica mode so FK checks are bypassed within the same session
  const insertSql = rowsToInsertSql(t, rows);
  const wrappedSql =
    "SET session_replication_role = 'replica';\n" +
    insertSql + "\n" +
    "SET session_replication_role = 'origin';";
  await runSqlChunked(SUPABASE_BACKUP_REF, wrappedSql);
  insertedTables++;
  console.log("✓");
}
ok(`Data applied to ${insertedTables} tables`);

// ── Step 5: app_config + auth users ──────────────────────────────────────────
step(5, TOTAL, "Applying app_config + migrating auth users...");

const appConfigSql = readFileSync(
  join(ROOT, "supabase/migrations/20260504999999_add_app_config.sql"),
  "utf-8"
);
await mgmtQuery(SUPABASE_BACKUP_REF, appConfigSql);
ok("app_config applied to backup (failover_enabled = false)");

try {
  await mgmtQuery(SUPABASE_PRIMARY_REF, appConfigSql);
  ok("app_config applied to primary");
} catch (e) {
  warn(`Could not apply to primary (likely already exists): ${e.message.slice(0, 100)}`);
}

// Auth users
warn("Passwords cannot be transferred — users must use 'Forgot Password' on first backup login.");
const primaryAdmin = createClient(PRIMARY_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const backupAdmin = createClient(SUPABASE_BACKUP_URL, SUPABASE_BACKUP_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let created = 0, skipped = 0, failed = 0;
let page = 1;
while (true) {
  const { data, error } = await primaryAdmin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { warn(`Failed to list users: ${error.message}`); break; }
  if (!data.users.length) break;
  for (const user of data.users) {
    try {
      const { error: ce } = await backupAdmin.auth.admin.createUser({
        user_id: user.id, email: user.email, email_confirm: true,
        phone: user.phone ?? undefined, phone_confirm: !!user.phone,
        user_metadata: user.user_metadata ?? {}, app_metadata: user.app_metadata ?? {},
      });
      if (!ce) created++;
      else if (ce.message?.toLowerCase().includes("already") || ce.message?.toLowerCase().includes("duplicate")) skipped++;
      else throw ce;
    } catch (e) { failed++; info(`FAIL ${user.email}: ${e.message}`); }
  }
  if (data.users.length < 1000) break;
  page++;
}
ok(`Auth users — created: ${created}, skipped: ${skipped}, failed: ${failed}`);

// ── Step 6: Deploy edge functions to backup ───────────────────────────────────
step(6, TOTAL, "Deploying edge functions to backup...");
const FNS = [
  "get-project-health", "executeTrade", "recommend-connections",
  "scrape-website", "send-application-accepted", "send-application-received",
  "toggle-failover",
];
for (const fn of FNS) {
  process.stdout.write(`    ${fn}... `);
  try {
    const out = execSync(
      `npx supabase@latest functions deploy ${fn} --project-ref ${SUPABASE_BACKUP_REF}`,
      { cwd: ROOT, env: { ...process.env, SUPABASE_ACCESS_TOKEN: MGMT_ACCESS_TOKEN }, encoding: "utf-8" }
    );
    // stdout contains success message; stderr has the Docker warning (not an error)
    console.log("✓");
  } catch (e) {
    const out = (e.stdout?.toString() ?? "") + (e.stderr?.toString() ?? "");
    if (out.includes("Deployed Functions")) {
      console.log("✓");  // Docker warning exit code ≠ 0 but deploy succeeded
    } else {
      console.log("FAILED");
      console.error("   ", out.split("\n").filter(l => l.trim()).slice(-4).join("\n    "));
    }
  }
}

// ── Step 7: Set secrets on backup ────────────────────────────────────────────
step(7, TOTAL, "Setting secrets on backup...");
await fetch(`${MGMT_BASE}/projects/${SUPABASE_BACKUP_REF}/secrets`, {
  method: "POST",
  headers: mgmtHeaders,
  body: JSON.stringify([
    { name: "OPENAI_API_KEY",    value: OPENAI_API_KEY },
    { name: "RESEND_API_KEY",    value: RESEND_API_KEY },
    { name: "FIRECRAWL_API_KEY", value: FIRECRAWL_API_KEY },
    { name: "MGMT_ACCESS_TOKEN", value: MGMT_ACCESS_TOKEN },
  ]),
}).then(async r => {
  if (!r.ok) throw new Error(`Secrets API ${r.status}: ${await r.text()}`);
});
ok("Secrets set.");

// ── Step 8: Summary ───────────────────────────────────────────────────────────
step(8, TOTAL, "Done!");
console.log(`
========================================================
  Duplication complete!
========================================================

Add to your .env and deployment environment:
  VITE_SUPABASE_BACKUP_URL=${SUPABASE_BACKUP_URL}
  VITE_SUPABASE_BACKUP_ANON_KEY=${SUPABASE_BACKUP_ANON_KEY}

Then verify with:
  BACKUP_TEST_EMAIL=<email> BACKUP_TEST_PASSWORD=<reset-password> node scripts/test-backup.mjs

  ⚠  Passwords NOT transferred — users must use 'Forgot Password' on first backup login.
  ⚠  failover_enabled = false — use Admin Service Monitor to flip when needed.
`);
