#!/usr/bin/env bash
#
# configure-sabitostore-production.sh
#
# Update Nexpro env files on the Contabo VPS for sabitostore.com production.
# Safe to re-run: backs up Backend/.env, merges CORS origins, updates or appends
# keys without removing unrelated variables.
#
# Usage:
#   ./scripts/configure-sabitostore-production.sh [options]
#
# Options:
#   --env-only              Update env files only (no restart, no build)
#   --build                 Also npm install, migrate, and build Frontend + storefront
#   --restart               Restart backend after env update (default unless --env-only)
#   --no-health-check       Skip curl /health smoke test
#   --storefront-url=URL    Default: https://sabitostore.com
#   --frontend-url=URL      Default: https://myapp.africanbusinesssuite.com
#   --api-url=URL           Default: https://api.africanbusinesssuite.com
#   --dashboard-url=URL     Default: same as --frontend-url
#   --google-client-id=ID   Google OAuth Web client ID (ABS + Sabito Store)
#   --google-client-secret=SECRET
#                           Optional; stored in Backend/.env if provided
#   --repo-root=PATH        Nexpro repo root (auto-detected if omitted)
#   -h, --help              Show this help
#
# Environment overrides (same as flags):
#   STOREFRONT_URL, FRONTEND_URL, API_URL, DASHBOARD_URL, NEXPRO_REPO_ROOT
#   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
#
# Examples:
#   # Typical VPS run after git pull — update env and restart API:
#   ~/nexpro/scripts/configure-sabitostore-production.sh
#
#   # Env files only (inspect diff first):
#   ~/nexpro/scripts/configure-sabitostore-production.sh --env-only
#
#   # Full deploy: env, migrate, build apps, restart API:
#   ~/nexpro/scripts/configure-sabitostore-production.sh --build --restart
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Defaults (override via flags or env)
STOREFRONT_URL="${STOREFRONT_URL:-https://sabitostore.com}"
FRONTEND_URL="${FRONTEND_URL:-https://myapp.africanbusinesssuite.com}"
API_URL="${API_URL:-https://api.africanbusinesssuite.com}"
DASHBOARD_URL="${DASHBOARD_URL:-}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-532158696081-k7ce89vt724ac270ks7hqog97dhvebeu.apps.googleusercontent.com}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-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}"

ENV_ONLY=false
DO_BUILD=false
DO_RESTART=true
DO_HEALTH_CHECK=true
REPO_ROOT="${NEXPRO_REPO_ROOT:-}"

# CORS origins to ensure are present (merged into existing CORS_ORIGIN)
REQUIRED_CORS_ORIGINS=(
  "https://sabitostore.com"
  "https://www.sabitostore.com"
  "https://myapp.africanbusinesssuite.com"
  "https://africanbusinesssuite.com"
  "https://www.africanbusinesssuite.com"
  "https://absghana.com"
  "https://www.absghana.com"
  "https://myapp.absghana.com"
)

usage() {
  sed -n '3,36p' "$0" | sed 's/^# \{0,1\}//'
}

log() { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env-only)
        ENV_ONLY=true
        DO_RESTART=false
        shift
        ;;
      --build)
        DO_BUILD=true
        shift
        ;;
      --restart)
        DO_RESTART=true
        shift
        ;;
      --no-health-check)
        DO_HEALTH_CHECK=false
        shift
        ;;
      --storefront-url=*)
        STOREFRONT_URL="${1#*=}"
        shift
        ;;
      --frontend-url=*)
        FRONTEND_URL="${1#*=}"
        shift
        ;;
      --api-url=*)
        API_URL="${1#*=}"
        shift
        ;;
      --dashboard-url=*)
        DASHBOARD_URL="${1#*=}"
        shift
        ;;
      --repo-root=*)
        REPO_ROOT="${1#*=}"
        shift
        ;;
      --google-client-id=*)
        GOOGLE_CLIENT_ID="${1#*=}"
        shift
        ;;
      --google-client-secret=*)
        GOOGLE_CLIENT_SECRET="${1#*=}"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown option: $1 (use --help)"
        ;;
    esac
  done
}

normalize_url() {
  local url="${1:-}"
  url="$(printf '%s' "$url" | sed 's/[[:space:]]//g' | sed 's:/*$::')"
  printf '%s' "$url"
}

detect_repo_root() {
  if [[ -n "$REPO_ROOT" ]]; then
    REPO_ROOT="$(cd "$REPO_ROOT" && pwd)"
    return
  fi

  if [[ -d "$HOME/nexpro/Backend" ]]; then
    REPO_ROOT="$(cd "$HOME/nexpro" && pwd)"
    return
  fi

  if [[ -d "$SCRIPT_DIR/../Backend" ]]; then
    REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    return
  fi

  die "Could not detect Nexpro repo root. Set --repo-root=PATH or NEXPRO_REPO_ROOT."
}

strip_trailing_slash() {
  normalize_url "$1"
}

# Update or append KEY=VALUE in a dotenv file. Preserves comments and unrelated keys.
set_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  tmp="$(mktemp)"

  touch "$file"

  if grep -q "^${key}=" "$file" 2>/dev/null; then
    awk -v key="$key" -v val="$value" '
      BEGIN { replaced = 0 }
      $0 ~ "^" key "=" {
        print key "=" val
        replaced = 1
        next
      }
      { print }
      END {
        if (!replaced) print key "=" val
      }
    ' "$file" > "$tmp"
  else
    cp "$file" "$tmp"
    printf '\n%s=%s\n' "$key" "$value" >> "$tmp"
  fi

  mv "$tmp" "$file"
}

# Read KEY value from dotenv (first match only).
get_env_var() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 0
  grep -m1 "^${key}=" "$file" 2>/dev/null | cut -d= -f2- || true
}

# Merge comma-separated origins; dedupe while preserving order.
merge_cors_origins() {
  local existing="${1:-}"
  shift
  local -a merged=()
  local origin item

  IFS=',' read -r -a existing_parts <<< "${existing// /}"
  for item in "${existing_parts[@]}"; do
    item="$(strip_trailing_slash "$item")"
    [[ -n "$item" ]] && merged+=("$item")
  done

  for origin in "$@"; do
    origin="$(strip_trailing_slash "$origin")"
    [[ -z "$origin" ]] && continue
    local found=false
    for item in "${merged[@]}"; do
      if [[ "$item" == "$origin" ]]; then
        found=true
        break
      fi
    done
    [[ "$found" == false ]] && merged+=("$origin")
  done

  local IFS=,
  printf '%s' "${merged[*]}"
}

backup_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local stamp
  stamp="$(date +%Y%m%d-%H%M%S)"
  cp -a "$file" "${file}.bak.${stamp}"
  log "Backed up $(basename "$file") -> $(basename "$file").bak.${stamp}"
}

write_production_env() {
  local file="$1"
  shift
  local -a pairs=("$@")
  local pair key value

  touch "$file"
  for pair in "${pairs[@]}"; do
    key="${pair%%=*}"
    value="${pair#*=}"
    set_env_var "$file" "$key" "$value"
  done
}

restart_backend() {
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl list-unit-files 2>/dev/null | grep -q '^nexpro-backend\.service'; then
      log "Restarting nexpro-backend via systemctl..."
      sudo systemctl restart nexpro-backend
      sudo systemctl --no-pager --full status nexpro-backend || true
      return 0
    fi
    if systemctl is-active --quiet nexpro-backend 2>/dev/null; then
      log "Restarting nexpro-backend via systemctl..."
      sudo systemctl restart nexpro-backend
      return 0
    fi
  fi

  if command -v pm2 >/dev/null 2>&1; then
    if pm2 describe nexpro-backend >/dev/null 2>&1; then
      log "Restarting nexpro-backend via pm2..."
      pm2 restart nexpro-backend
      return 0
    fi
    if pm2 describe backend >/dev/null 2>&1; then
      log "Restarting backend via pm2..."
      pm2 restart backend
      return 0
    fi
  fi

  warn "No nexpro-backend systemd unit or pm2 process found; skipped restart."
  return 0
}

smoke_test_health() {
  local health_url="${API_URL%/}/health"
  log "Smoke test: curl -fsS ${health_url}"
  if curl -fsS --max-time 15 "$health_url"; then
    printf '\n'
    log "Health check OK."
  else
    warn "Health check failed for ${health_url}"
    return 1
  fi
}

run_build_steps() {
  local backend_dir="$REPO_ROOT/Backend"
  local frontend_dir="$REPO_ROOT/Frontend"
  local storefront_dir="$REPO_ROOT/storefront"

  log "Running Backend npm install..."
  (cd "$backend_dir" && npm install)

  log "Running database migrations..."
  (cd "$backend_dir" && npm run migrate)

  log "Building Frontend..."
  (cd "$frontend_dir" && npm install && npm run build)

  log "Building storefront..."
  (cd "$storefront_dir" && npm install && npm run build)
}

main() {
  parse_args "$@"

  STOREFRONT_URL="$(strip_trailing_slash "$STOREFRONT_URL")"
  FRONTEND_URL="$(strip_trailing_slash "$FRONTEND_URL")"
  API_URL="$(strip_trailing_slash "$API_URL")"
  DASHBOARD_URL="$(strip_trailing_slash "${DASHBOARD_URL:-$FRONTEND_URL}")"

  detect_repo_root

  local backend_env="$REPO_ROOT/Backend/.env"
  local frontend_env="$REPO_ROOT/Frontend/.env.production"
  local storefront_env="$REPO_ROOT/storefront/.env.production"

  log "Nexpro repo root: $REPO_ROOT"
  log "Storefront URL:   $STOREFRONT_URL"
  log "Frontend URL:     $FRONTEND_URL"
  log "API URL:          $API_URL"
  log "Dashboard URL:    $DASHBOARD_URL"

  [[ -f "$backend_env" ]] || die "Missing $backend_env — create it on the server before running this script."

  backup_file "$backend_env"

  local existing_cors
  existing_cors="$(get_env_var "$backend_env" "CORS_ORIGIN")"
  local merged_cors
  merged_cors="$(merge_cors_origins "$existing_cors" "${REQUIRED_CORS_ORIGINS[@]}")"

  set_env_var "$backend_env" "STOREFRONT_URL" "$STOREFRONT_URL"
  set_env_var "$backend_env" "FRONTEND_URL" "$FRONTEND_URL"
  set_env_var "$backend_env" "CORS_ORIGIN" "$merged_cors"
  set_env_var "$backend_env" "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
  if [[ -n "$GOOGLE_CLIENT_SECRET" ]]; then
    set_env_var "$backend_env" "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"
  fi

  write_production_env "$frontend_env" \
    "VITE_API_URL=${API_URL}" \
    "VITE_STOREFRONT_URL=${STOREFRONT_URL}" \
    "VITE_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"

  write_production_env "$storefront_env" \
    "VITE_API_URL=${API_URL}" \
    "VITE_STOREFRONT_URL=${STOREFRONT_URL}" \
    "VITE_DASHBOARD_URL=${DASHBOARD_URL}" \
    "VITE_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"

  log ""
  log "=== Summary ==="
  log "Backend ($backend_env):"
  log "  STOREFRONT_URL=$STOREFRONT_URL"
  log "  FRONTEND_URL=$FRONTEND_URL"
  log "  CORS_ORIGIN=$merged_cors"
  log "  GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID"
  log "  GOOGLE_CLIENT_SECRET=(set)"
  log "Frontend ($frontend_env):"
  log "  VITE_API_URL=$API_URL"
  log "  VITE_STOREFRONT_URL=$STOREFRONT_URL"
  log "  VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID"
  log "Storefront ($storefront_env):"
  log "  VITE_API_URL=$API_URL"
  log "  VITE_STOREFRONT_URL=$STOREFRONT_URL"
  log "  VITE_DASHBOARD_URL=$DASHBOARD_URL"
  log "  VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID"

  if [[ "$DO_BUILD" == true ]]; then
    run_build_steps
  fi

  if [[ "$DO_RESTART" == true ]]; then
    restart_backend
    if [[ "$DO_HEALTH_CHECK" == true ]]; then
      sleep 2
      smoke_test_health || true
    fi
  else
    log ""
    log "Skipped backend restart (--env-only). Restart manually when ready:"
    log "  sudo systemctl restart nexpro-backend"
  fi

  log ""
  log "Done."
}

main "$@"
