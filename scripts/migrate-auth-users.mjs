/**
 * Migrate auth users from primary Supabase project to backup project.
 *
 * Preserves UUIDs so all FK references (users.auth_user_id etc.) remain valid.
 * Passwords CANNOT be transferred — users must use "Forgot Password" on first backup login.
 *
 * Usage:
 *   PRIMARY_SERVICE_KEY=... BACKUP_URL=... BACKUP_SERVICE_KEY=... node scripts/migrate-auth-users.mjs
 *
 * Or set in .env and load with: node --env-file=.env scripts/migrate-auth-users.mjs (Node 20+)
 */

import { createClient } from "@supabase/supabase-js";

const PRIMARY_URL         = process.env.SUPABASE_URL         ?? "https://ccwwdkpafpxfxyuzgmjs.supabase.co";
const PRIMARY_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BACKUP_URL          = process.env.SUPABASE_BACKUP_URL;
const BACKUP_SERVICE_KEY  = process.env.SUPABASE_BACKUP_SERVICE_ROLE_KEY;

if (!PRIMARY_SERVICE_KEY || !BACKUP_URL || !BACKUP_SERVICE_KEY) {
  console.error("Missing required env vars: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BACKUP_URL, SUPABASE_BACKUP_SERVICE_ROLE_KEY");
  process.exit(1);
}

const primaryAdmin = createClient(PRIMARY_URL, PRIMARY_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const backupAdmin = createClient(BACKUP_URL, BACKUP_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fetchAllUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await primaryAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Failed to list users (page ${page}): ${error.message}`);
    if (!data.users.length) break;
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  return users;
}

async function importUser(user) {
  const { error } = await backupAdmin.auth.admin.createUser({
    user_id: user.id,
    email: user.email,
    email_confirm: true,
    phone: user.phone ?? undefined,
    phone_confirm: !!user.phone,
    user_metadata: user.user_metadata ?? {},
    app_metadata: user.app_metadata ?? {},
  });

  if (!error) return "created";
  if (error.message?.toLowerCase().includes("already exists") ||
      error.message?.toLowerCase().includes("duplicate")) return "skipped";
  throw error;
}

async function main() {
  console.log("Fetching users from primary project...");
  const users = await fetchAllUsers();
  console.log(`  Found ${users.length} users\n`);
  console.log("⚠  Passwords cannot be transferred via the Admin API.");
  console.log("   Users will need to use 'Forgot Password' on their first backup login.\n");

  let created = 0, skipped = 0, failed = 0;
  for (const user of users) {
    try {
      const result = await importUser(user);
      if (result === "skipped") {
        skipped++;
        console.log(`  SKIP  ${user.email} (already exists)`);
      } else {
        created++;
        console.log(`  OK    ${user.email}`);
      }
    } catch (e) {
      failed++;
      console.error(`  FAIL  ${user.email}: ${e.message}`);
    }
  }

  console.log(`\nDone. Created: ${created}  Skipped: ${skipped}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
