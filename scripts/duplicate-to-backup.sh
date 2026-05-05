#!/usr/bin/env bash
# Duplicate the PitchTank Supabase project (us-east-1) to a backup project (ca-central-1).
#
# No postgres connection strings needed — uses the Supabase CLI and Management API only.
#
# Prerequisites:
#   - Node.js 18+ (for npx and the auth user migration script)
#   - @supabase/supabase-js in node_modules (already in package.json)
#
# Required env vars (already in your .env except where noted):
#
#   MGMT_ACCESS_TOKEN            — your Supabase personal access token (sbp_...)
#   SUPABASE_PRIMARY_REF         — primary project ref (ccwwdkpafpxfxyuzgmjs)
#   SUPABASE_SERVICE_ROLE_KEY    — primary service role key
#   SUPABASE_BACKUP_REF          — backup project ref
#   SUPABASE_BACKUP_URL          — backup project URL
#   SUPABASE_BACKUP_SERVICE_ROLE_KEY
#   SUPABASE_BACKUP_ANON_KEY
#   OPENAI_API_KEY
#   RESEND_API_KEY
#   FIRECRAWL_API_KEY
#
# Usage:
#   source .env && bash scripts/duplicate-to-backup.sh

set -euo pipefail

# ── Validate required vars ────────────────────────────────────────────────────
: "${MGMT_ACCESS_TOKEN:?MGMT_ACCESS_TOKEN is required}"
: "${SUPABASE_PRIMARY_REF:?SUPABASE_PRIMARY_REF is required (e.g. ccwwdkpafpxfxyuzgmjs)}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"
: "${SUPABASE_BACKUP_REF:?SUPABASE_BACKUP_REF is required}"
: "${SUPABASE_BACKUP_URL:?SUPABASE_BACKUP_URL is required}"
: "${SUPABASE_BACKUP_SERVICE_ROLE_KEY:?SUPABASE_BACKUP_SERVICE_ROLE_KEY is required}"
: "${SUPABASE_BACKUP_ANON_KEY:?SUPABASE_BACKUP_ANON_KEY is required}"
: "${OPENAI_API_KEY:?OPENAI_API_KEY is required}"
: "${RESEND_API_KEY:?RESEND_API_KEY is required}"
: "${FIRECRAWL_API_KEY:?FIRECRAWL_API_KEY is required}"

SCHEMA_DUMP=/tmp/pt_schema.sql
DATA_DUMP=/tmp/pt_data.sql
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MGMT_BASE="https://api.supabase.com/v1/projects"

# Helper: run SQL on backup via Management API (no DB URL needed)
run_sql_on_backup() {
  local sql="$1"
  local http_code
  http_code=$(curl -s -o /tmp/sql_result.json -w "%{http_code}" \
    -X POST "${MGMT_BASE}/${SUPABASE_BACKUP_REF}/database/query" \
    -H "Authorization: Bearer ${MGMT_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$sql" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}")
  if [ "$http_code" != "200" ]; then
    echo "    SQL error (HTTP $http_code):"
    cat /tmp/sql_result.json
    echo ""
    return 1
  fi
}

echo "========================================================"
echo "  PitchTank → Backup Duplication"
echo "  Primary:  $SUPABASE_PRIMARY_REF (us-east-1)"
echo "  Backup:   $SUPABASE_BACKUP_REF (ca-central-1)"
echo "========================================================"
echo ""

# ── Step 1: Dump schema from primary ─────────────────────────────────────────
echo "==> [1/7] Dumping schema from primary..."
SUPABASE_ACCESS_TOKEN="$MGMT_ACCESS_TOKEN" \
npx supabase@latest db dump \
  --project-ref "$SUPABASE_PRIMARY_REF" \
  --schema public \
  -f "$SCHEMA_DUMP"
echo "    Saved to $SCHEMA_DUMP"

# ── Step 2: Dump data from primary ───────────────────────────────────────────
echo ""
echo "==> [2/7] Dumping data from primary..."
SUPABASE_ACCESS_TOKEN="$MGMT_ACCESS_TOKEN" \
npx supabase@latest db dump \
  --project-ref "$SUPABASE_PRIMARY_REF" \
  --schema public \
  --data-only \
  -f "$DATA_DUMP"
echo "    Saved to $DATA_DUMP"

# ── Step 3: Apply schema + data + app_config to backup via Management API ─────
echo ""
echo "==> [3/7] Applying schema to backup..."
run_sql_on_backup "$(cat "$SCHEMA_DUMP")"
echo "    Schema applied."

echo ""
echo "==> [3b/7] Applying data to backup..."
# Disable FK checks for bulk insert ordering safety, then re-enable
FULL_DATA="SET session_replication_role = 'replica'; $(cat "$DATA_DUMP") SET session_replication_role = 'origin';"
run_sql_on_backup "$FULL_DATA"
echo "    Data applied."

echo ""
echo "==> [3c/7] Creating app_config table on backup..."
run_sql_on_backup "$(cat "$PROJECT_ROOT/supabase/migrations/20260504999999_add_app_config.sql")"
echo "    app_config ready (failover_enabled = false)."

# ── Step 4: Migrate auth users ────────────────────────────────────────────────
echo ""
echo "==> [4/7] Migrating auth users (preserving UUIDs)..."
echo "    ⚠  Passwords cannot be transferred. Users must use 'Forgot Password' on first backup login."
echo ""
cd "$PROJECT_ROOT"
SUPABASE_URL="https://${SUPABASE_PRIMARY_REF}.supabase.co" \
node scripts/migrate-auth-users.mjs
echo ""
echo "    Auth user migration complete."

# ── Step 5: Deploy edge functions to backup ───────────────────────────────────
echo ""
echo "==> [5/7] Deploying edge functions to backup..."
cd "$PROJECT_ROOT"
for fn in get-project-health executeTrade recommend-connections scrape-website \
          send-application-accepted send-application-received toggle-failover; do
  echo "    deploying $fn..."
  SUPABASE_ACCESS_TOKEN="$MGMT_ACCESS_TOKEN" \
  npx supabase@latest functions deploy "$fn" --project-ref "$SUPABASE_BACKUP_REF"
done
echo "    All 7 functions deployed."

# ── Step 6: Set secrets on backup ─────────────────────────────────────────────
echo ""
echo "==> [6/7] Setting secrets on backup..."
SUPABASE_ACCESS_TOKEN="$MGMT_ACCESS_TOKEN" \
npx supabase@latest secrets set \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  RESEND_API_KEY="$RESEND_API_KEY" \
  FIRECRAWL_API_KEY="$FIRECRAWL_API_KEY" \
  SUPABASE_ACCESS_TOKEN="$MGMT_ACCESS_TOKEN" \
  --project-ref "$SUPABASE_BACKUP_REF"
echo "    Secrets set."

# ── Step 7: Apply app_config migration to PRIMARY too ─────────────────────────
# Primary needs this so the Admin Service Monitor can read failover status
# and so the table exists if primary is ever promoted as a new backup.
echo ""
echo "==> [7/7] Applying app_config to primary..."
PRIMARY_SQL="$(cat "$PROJECT_ROOT/supabase/migrations/20260504999999_add_app_config.sql")"
PRIMARY_CODE=$(curl -s -o /tmp/primary_sql.json -w "%{http_code}" \
  -X POST "${MGMT_BASE}/${SUPABASE_PRIMARY_REF}/database/query" \
  -H "Authorization: Bearer ${MGMT_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$PRIMARY_SQL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}")
if [ "$PRIMARY_CODE" = "200" ]; then
  echo "    app_config ready on primary."
else
  echo "    ⚠  Could not apply to primary (HTTP $PRIMARY_CODE) — apply manually via SQL editor if needed."
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "========================================================"
echo "  Duplication complete!"
echo "========================================================"
echo ""
echo "Add to your .env and deployment environment:"
echo "  VITE_SUPABASE_BACKUP_URL=$SUPABASE_BACKUP_URL"
echo "  VITE_SUPABASE_BACKUP_ANON_KEY=$SUPABASE_BACKUP_ANON_KEY"
echo ""
echo "Then verify with:"
echo "  BACKUP_TEST_EMAIL=<email> BACKUP_TEST_PASSWORD=<reset-password> node scripts/test-backup.mjs"
echo ""
echo "  ⚠  Passwords NOT transferred — users must use 'Forgot Password' on first backup login."
echo "  ⚠  failover_enabled = false — use Admin Service Monitor to flip when needed."
