#!/usr/bin/env bash
#
# Production smoke test for GameFeatures. Runs the main flows through the web app's origin
# (the /api/v1 rewrite), exactly as a browser would.
#
#   scripts/smoke-test.sh https://gamefeatures.vercel.app      (or: pnpm smoke <url>)
#
# Needs bash, curl and jq. Leaves the demo data as it found it (the vote is undone).
# Login, register and refresh are limited to 10 requests per minute per IP, and one run uses
# three of them, so back-to-back runs can hit 429: wait a minute between them.
#
# Optional environment variables:
#   SMOKE_EMAIL / SMOKE_PASSWORD   account to sign in with (default: the demo_gamer account)
#   SMOKE_USERNAME                 expected username for that account (default: demo_gamer)
#   SMOKE_GAME_SLUG                game whose requests are listed and voted on (default: portal-2)
#   SMOKE_WAKE_TIMEOUT             seconds to wait for a sleeping server (default: 90)

set -euo pipefail

if [[ $# -ne 1 || -z "$1" ]]; then
  echo "Usage: $0 <web-url>   e.g. $0 https://gamefeatures.vercel.app" >&2
  exit 2
fi
for tool in curl jq; do
  command -v "$tool" >/dev/null || { echo "✗ $tool is required" >&2; exit 2; }
done

WEB_URL="${1%/}"
API="$WEB_URL/api/v1"
EMAIL="${SMOKE_EMAIL:-demo_gamer@demo.gamefeatures.dev}"
PASSWORD="${SMOKE_PASSWORD:-try-the-demo}"
USERNAME="${SMOKE_USERNAME:-demo_gamer}"
GAME_SLUG="${SMOKE_GAME_SLUG:-portal-2}"
WAKE_TIMEOUT="${SMOKE_WAKE_TIMEOUT:-90}"

WORKDIR="$(mktemp -d)"
JAR="$WORKDIR/cookies.txt"
BODY="$WORKDIR/body.json"
trap 'rm -rf "$WORKDIR"' EXIT

STEP=0
step() { STEP=$((STEP + 1)); printf '%d. %s ... ' "$STEP" "$1"; }
ok() { echo "ok${1:+ ($1)}"; }
fail() {
  echo "FAILED"
  echo "✗ $1" >&2
  if [[ -s "$BODY" ]]; then echo "  response: $(head -c 500 "$BODY")" >&2; fi
  exit 1
}

# call METHOD PATH [TOKEN] [JSON_BODY] -> prints the HTTP status; the body goes to $BODY.
# The cookie jar is read and written on every call, like a browser.
call() {
  local method="$1" path="$2" token="${3:-}" data="${4:-}"
  local args=(-sS -o "$BODY" -w '%{http_code}' -X "$method" -b "$JAR" -c "$JAR" -m 20)
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$data" ]] && args+=(-H 'Content-Type: application/json' --data "$data")
  curl "${args[@]}" "$API$path" || echo "000"
}

expect_status() { # expect_status WANTED GOT WHAT
  [[ "$2" == "$1" ]] || fail "$3: expected HTTP $1, got $2"
}

echo "Smoke test against $WEB_URL"

# 1. The free API server may be asleep: give it up to WAKE_TIMEOUT seconds.
step "API health (waiting up to ${WAKE_TIMEOUT}s for a cold start)"
deadline=$((SECONDS + WAKE_TIMEOUT))
while :; do
  status="$(call GET /health)"
  [[ "$status" == "200" ]] && break
  ((SECONDS >= deadline)) && fail "health never returned 200 (last status: $status)"
  sleep 5
done
[[ "$(jq -r '.db + "/" + .redis' "$BODY")" == "up/up" ]] || fail "health reports a dependency down"
ok "db and redis up"

# 2. Public game list.
step "GET /games?limit=5"
expect_status 200 "$(call GET '/games?limit=5')" "game list"
games="$(jq '.data | length' "$BODY")"
((games > 0)) || fail "game list is empty (was the database seeded?)"
ok "$games games"

# 3. A game's requests, newest first (served from the Redis ranking index).
step "GET /games/$GAME_SLUG/requests?sort=new"
expect_status 200 "$(call GET "/games/$GAME_SLUG/requests?sort=new&page=1&limit=10")" "request list"
count="$(jq '.data | length' "$BODY")"
((count > 0)) || fail "no requests listed for $GAME_SLUG"
REQUEST_ID="$(jq -r '.data[0].id' "$BODY")"
ok "$count requests"

# 4. Sign in (sets the HTTP-only refresh cookie in the jar).
step "Log in as $EMAIL"
login_body="$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" '{email: $e, password: $p}')"
status="$(call POST /auth/login "" "$login_body")"
[[ "$status" == "429" ]] && fail "login rate-limited (429): wait a minute and run again"
expect_status 200 "$status" "login"
TOKEN="$(jq -r '.accessToken // empty' "$BODY")"
[[ -n "$TOKEN" ]] || fail "login returned no access token"
grep -q refreshToken "$JAR" || fail "login set no refreshToken cookie"
ok

# 5. Who am I?
step "GET /auth/me"
expect_status 200 "$(call GET /auth/me "$TOKEN")" "/auth/me"
me="$(jq -r '.username' "$BODY")"
[[ "$me" == "$USERNAME" ]] || fail "/auth/me returned '$me', expected '$USERNAME'"
ok "$me"

# 6. Vote and unvote (in whichever order restores the original state).
step "Vote and unvote on $REQUEST_ID"
expect_status 200 "$(call GET "/requests/$REQUEST_ID" "$TOKEN")" "request detail"
before="$(jq -r '.voteCount' "$BODY")"
voted="$(jq -r '.hasVoted' "$BODY")"
if [[ "$voted" == "true" ]]; then order=(DELETE PUT); deltas=(-1 0); else order=(PUT DELETE); deltas=(1 0); fi
for i in 0 1; do
  method="${order[$i]}"
  expect_status 200 "$(call "$method" "/requests/$REQUEST_ID/vote" "$TOKEN")" "$method vote"
  got="$(jq -r '.voteCount' "$BODY")"
  want=$((before + deltas[i]))
  [[ "$got" == "$want" ]] || fail "$method vote: voteCount $got, expected $want"
done
ok "count $before → $((before + deltas[0])) → $before"

# 7. Refresh with the cookie (through the same origin, as the browser does).
step "POST /auth/refresh with the cookie"
status="$(call POST /auth/refresh)"
[[ "$status" == "429" ]] && fail "refresh rate-limited (429): wait a minute and run again"
expect_status 200 "$status" "refresh"
TOKEN="$(jq -r '.accessToken // empty' "$BODY")"
[[ -n "$TOKEN" ]] || fail "refresh returned no access token"
ok "token rotated"

# 8. Log out; the refresh cookie must stop working.
step "Log out"
expect_status 200 "$(call POST /auth/logout "$TOKEN")" "logout"
status="$(call POST /auth/refresh)"
[[ "$status" == "401" ]] || fail "refresh after logout: expected HTTP 401, got $status"
ok "refresh now 401"

echo "✓ Smoke test passed ($STEP steps)"
