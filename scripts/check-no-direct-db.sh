#!/usr/bin/env bash
# Guard: the web app must not talk to the database (PostgREST/RPC/service role).
# All data access goes web -> FastAPI. See docs/PLAN_FRONTEND_DB_DECOUPLING.md.
#
# Files with legacy violations are listed in web/.direct-db-allowlist.txt. The list
# may only SHRINK: a new offender fails, and an entry that no longer violates fails
# too (remove it) so the baseline ratchets down to empty.
set -euo pipefail
cd "$(dirname "$0")/.."

ALLOW=web/.direct-db-allowlist.txt
PATTERN="supabaseAdmin|supabasePublic|\.from\(['\"][a-z_]+['\"]\)|\.rpc\(['\"][a-z_]+['\"]|\.storage\.from|auth\.admin\.|rest/v1/"

offenders=$(grep -rIlE "$PATTERN" web/src --include=*.ts --include=*.tsx \
  | grep -vE '/__tests__/|\.test\.(ts|tsx)$' | sort -u || true)
allowed=$(grep -vE '^\s*(#|$)' "$ALLOW" 2>/dev/null | sort -u || true)

if [ "${1:-}" = "--fix" ]; then   # prune entries that no longer violate (never adds)
  { grep -E '^\s*(#|$)' "$ALLOW" || true; comm -12 <(echo "$offenders") <(echo "$allowed"); } > "$ALLOW.tmp"
  mv "$ALLOW.tmp" "$ALLOW"; allowed=$(grep -vE '^\s*(#|$)' "$ALLOW" | sort -u)
fi

new=$(comm -23 <(echo "$offenders") <(echo "$allowed") | sed '/^$/d')
stale=$(comm -13 <(echo "$offenders") <(echo "$allowed") | sed '/^$/d')
rc=0
if [ -n "$new" ]; then
  echo "ERROR: direct database access in files not on the allow-list (use lib/api -> FastAPI):"
  echo "$new" | sed 's/^/  /'; rc=1
fi
if [ -n "$stale" ]; then
  echo "ERROR: clean files still on $ALLOW — remove them:"
  echo "$stale" | sed 's/^/  /'; rc=1
fi
[ $rc -eq 0 ] && echo "direct-db guard OK ($(echo "$allowed" | sed '/^$/d' | wc -l) legacy files remaining)"
exit $rc
