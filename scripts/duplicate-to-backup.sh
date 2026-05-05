#!/usr/bin/env bash
# Duplicate the PitchTank Supabase project (us-east-1) to a backup project (ca-central-1).
#
# Prerequisites:
#   - pg_dump / psql (PostgreSQL client tools) installed
#   - supabase CLI installed and logged in
#   - Node.js 18+ installed
#   - @supabase/supabase-js in node_modules (already in package.json)
#
# Required env vars (set in .env or pass inline):
#   PRIMARY_DB_URL               — direct postgres connection to primary
#                                  (from Supabase dashboard → Settings → Database → Connection string → URI, port 5432)
#   BACKUP_DB_URL                — direct postgres connection to backup project
#   SUPABASE_BACKUP_REF          — backup project ref (e.g. abcdefghijklmn)
#   SUPABASE_SERVICE_ROLE_KEY    — primary service role key
#   SUPABASE_BACKUP_SERVICE_ROLE_KEY — backup service role key
#   SUPABASE_BACKUP_URL          — backup project URL (https://<ref>.supabase.co)
#   OPENAI_API_KEY               — forwarded to backup edge functions
#   RESEND_API_KEY               — forwarded to backup edge functions
#   FIRECRAWL_API_KEY            — forwarded to backup edge functions
#   MGMT_ACCESS_TOKEN            — forwarded to backup get-project-health function
#   PRIMARY_JWT_SECRET           — primary project's Legacy HS256 JWT secret
#                                  (from Supabase dashboard → Settings → Auth → JWT Keys → Legacy HS256 → reveal secret)
#
# Usage:
#   chmod +x scripts/duplicate-to-backup.sh
#   source .env && ./scripts/duplicate-to-backup.sh
#   -- or --
#   PRIMARY_DB_URL="..." BACKUP_DB_URL="..." ... ./scripts/duplicate-to-backup.sh

set -euo pipefail

# ── Validate required vars ────────────────────────────────────────────────────
: "${PRIMARY_DB_URL:?PRIMARY_DB_URL is required}"
: "${BACKUP_DB_URL:?BACKUP_DB_URL is required}"
: "${SUPABASE_BACKUP_REF:?SUPABASE_BACKUP_REF is required}"
: "${SUPABASE_BACKUP_URL:?SUPABASE_BACKUP_URL is required}"
: "${SUPABASE_BACKUP_SERVICE_ROLE_KEY:?SUPABASE_BACKUP_SERVICE_ROLE_KEY is required}"
: "${OPENAI_API_KEY:?OPENAI_API_KEY is required}"
: "${RESEND_API_KEY:?RESEND_API_KEY is required}"
: "${FIRECRAWL_API_KEY:?FIRECRAWL_API_KEY is required}"
: "${MGMT_ACCESS_TOKEN:?MGMT_ACCESS_TOKEN is required}"
: "${PRIMARY_JWT_SECRET:?PRIMARY_JWT_SECRET is required (primary project Legacy HS256 secret)}"

SCHEMA_DUMP=/tmp/pt_schema.sql
DATA_DUMP=/tmp/pt_data.sql
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================================"
echo "  PitchTank → Backup Duplication Script"
echo "  Backup project: $SUPABASE_BACKUP_REF"
echo "========================================================"
echo ""

# ── Step 1: Dump schema from primary (public schema only) ─────────────────────
echo "==> [1/8] Dumping schema from primary..."
pg_dump "$PRIMARY_DB_URL" \
  --schema-only \
  --no-owner \
  --no-acl \
  --schema=public \
  -f "$SCHEMA_DUMP"
echo "    Schema saved to $SCHEMA_DUMP"

# ── Step 2: Dump data from primary (public schema only) ───────────────────────
echo ""
echo "==> [2/8] Dumping data from primary..."
pg_dump "$PRIMARY_DB_URL" \
  --data-only \
  --no-owner \
  --no-acl \
  --schema=public \
  -f "$DATA_DUMP"
echo "    Data saved to $DATA_DUMP"

# ── Step 3: Apply schema to backup ────────────────────────────────────────────
echo ""
echo "==> [3/8] Applying schema to backup..."
psql "$BACKUP_DB_URL" -f "$SCHEMA_DUMP"
echo "    Schema applied."

# ── Step 4: Apply data to backup ──────────────────────────────────────────────
# session_replication_role=replica bypasses FK checks during bulk insert to avoid
# ordering issues. Equivalent to pg_restore --disable-triggers on managed Supabase.
echo ""
echo "==> [4/8] Applying data to backup..."
psql "$BACKUP_DB_URL" \
  -c "SET session_replication_role = 'replica';" \
  -f "$DATA_DUMP" \
  -c "SET session_replication_role = 'origin';"
echo "    Data applied."

# ── Step 5: Migrate auth users ────────────────────────────────────────────────
echo ""
echo "==> [5/8] Migrating auth users (preserving UUIDs)..."
echo "    ⚠  Passwords cannot be transferred. Users must use 'Forgot Password' on first backup login."
echo ""
cd "$PROJECT_ROOT"
SUPABASE_URL="https://ccwwdkpafpxfxyuzgmjs.supabase.co" \
node scripts/migrate-auth-users.mjs
echo ""
echo "    Auth user migration complete."

# ── Step 6: Apply app_config migration to backup ──────────────────────────────
echo ""
echo "==> [6/8] Applying app_config migration to backup..."
psql "$BACKUP_DB_URL" -f "$PROJECT_ROOT/supabase/migrations/20260504999999_add_app_config.sql"
echo "    app_config table created on backup (failover_enabled = false)."

# ── Step 7: Deploy edge functions to backup ───────────────────────────────────
echo ""
echo "==> [7/8] Deploying edge functions to backup project ($SUPABASE_BACKUP_REF)..."
cd "$PROJECT_ROOT"
for fn in get-project-health executeTrade recommend-connections scrape-website \
          send-application-accepted send-application-received toggle-failover; do
  echo "    deploying $fn..."
  supabase functions deploy "$fn" --project-ref "$SUPABASE_BACKUP_REF" --no-verify-jwt 2>/dev/null || \
  supabase functions deploy "$fn" --project-ref "$SUPABASE_BACKUP_REF"
done
echo "    All functions deployed."

# ── Step 8: Set secrets on backup ─────────────────────────────────────────────
echo ""
echo "==> [8/8] Setting secrets on backup project..."
supabase secrets set \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  RESEND_API_KEY="$RESEND_API_KEY" \
  FIRECRAWL_API_KEY="$FIRECRAWL_API_KEY" \
  MGMT_ACCESS_TOKEN="$MGMT_ACCESS_TOKEN" \
  --project-ref "$SUPABASE_BACKUP_REF"
echo "    Secrets set."

# ── Step 9: Sync JWT secret so primary tokens are accepted by backup ──────────
# The backup uses ECC P-256 keys by default. Setting the primary's HS256 secret
# here makes auth.getUser() on the backup accept primary-issued JWTs, which is
# required for the toggle-failover edge function to verify admin tokens.
echo ""
echo "==> [9/9] Syncing JWT secret to backup..."
JWT_SYNC_RESULT=$(curl -s -o /tmp/jwt_sync_result.txt -w "%{http_code}" \
  -X PATCH "https://api.supabase.com/v1/projects/$SUPABASE_BACKUP_REF/config/auth" \
  -H "Authorization: Bearer $MGMT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"jwt_secret\": \"$PRIMARY_JWT_SECRET\"}")
if [ "$JWT_SYNC_RESULT" = "200" ]; then
  echo "    JWT secret synced. Primary tokens will be accepted by backup."
else
  echo "    ⚠  JWT secret sync failed (HTTP $JWT_SYNC_RESULT). Check MGMT_ACCESS_TOKEN."
  cat /tmp/jwt_sync_result.txt
  echo ""
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "========================================================"
echo "  Duplication complete!"
echo "========================================================"
echo ""
echo "Next steps:"
echo "  1. Add to your .env and deployment environment:"
echo "     VITE_SUPABASE_BACKUP_URL=$SUPABASE_BACKUP_URL"
echo "     VITE_SUPABASE_BACKUP_ANON_KEY=<backup-anon-key from Supabase dashboard>"
echo ""
echo "  2. Run the test harness to verify the backup:"
echo "     BACKUP_TEST_EMAIL=<email> BACKUP_TEST_PASSWORD=<password> node scripts/test-backup.mjs"
echo ""
echo "  ⚠  Auth passwords were NOT transferred."
echo "     Affected users must use 'Forgot Password' on their first backup login."
echo ""
echo "  ⚠  failover_enabled is set to false on backup."
echo "     Use the Admin Service Monitor to flip the switch when needed."
