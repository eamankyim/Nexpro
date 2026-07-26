#!/usr/bin/env bash
#
# configure-online-store-production.sh
#
# Upsert ABS Online Store env keys on the Contabo production Backend/.env:
#   ONLINE_STORE_URL=https://store.absghana.com
#   STOREFRONT_CNAME_TARGET=store.absghana.com
# Also merges https://store.absghana.com into CORS_ORIGIN (does not wipe others).
# Safe to re-run: backs up Backend/.env first.
#
# Usage (from your laptop, with SSH access):
#   ./scripts/configure-online-store-production.sh
#   CONTABO_HOST=root@62.169.22.3 ./scripts/configure-online-store-production.sh
#   CONTABO_HOST=contabo ./scripts/configure-online-store-production.sh --env-only
#
# Usage (already on the Contabo VPS):
#   ./scripts/configure-online-store-production.sh --local
#   ~/nexpro/scripts/configure-online-store-production.sh --local --restart
#
# Options:
#   --local                 Run on this machine (no SSH). Default when ~/nexpro/Backend exists.
#   --remote                Force SSH to CONTABO_HOST (default when not on the VPS).
#   --env-only              Update .env only (no restart, no health check)
#   --restart               Restart backend after env update (default unless --env-only)
#   --no-health-check       Skip curl /health smoke test
#   --online-store-url=URL  Default: https://store.absghana.com
#   --cname-target=HOST     Default: store.absghana.com (host only, no scheme)
#   --api-url=URL           Health-check base (default: https://api.africanbusinesssuite.com)
#   --repo-root=PATH        Remote or local Nexpro root (default: ~/nexpro on VPS)
#   -h, --help              Show this help
#
# Environment:
#   CONTABO_HOST            SSH target, e.g. root@62.169.22.3 or an ~/.ssh/config Host alias
#                           Default: root@62.169.22.3 (same host used by Backend/scripts docs)
#   CONTABO_SSH_OPTS        Extra ssh options (optional)
#   NEXPRO_REPO_ROOT        Override repo root on the target
#   ONLINE_STORE_URL, STOREFRONT_CNAME_TARGET, API_URL
#
set -euo pipefail

# When piped over SSH (`bash -s`), BASH_SOURCE may be /dev/stdin — don't fail.
SCRIPT_DIR=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

ONLINE_STORE_URL="${ONLINE_STORE_URL:-https://store.absghana.com}"
STOREFRONT_CNAME_TARGET="${STOREFRONT_CNAME_TARGET:-store.absghana.com}"
API_URL="${API_URL:-https://api.africanbusinesssuite.com}"
CONTABO_HOST="${CONTABO_HOST:-root@62.169.22.3}"
CONTABO_SSH_OPTS="${CONTABO_SSH_OPTS:-}"
REPO_ROOT="${NEXPRO_REPO_ROOT:-}"

FORCE_LOCAL=false
FORCE_REMOTE=false
ENV_ONLY=false
DO_RESTART=true
DO_HEALTH_CHECK=true

REQUIRED_CORS_ORIGINS=(
  "https://store.absghana.com"
)

usage() {
  sed -n '3,38p' "$0" | sed 's/^# \{0,1\}//'
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
      --local)
        FORCE_LOCAL=true
        shift
        ;;
      --remote)
        FORCE_REMOTE=true
        shift
        ;;
      --env-only)
        ENV_ONLY=true
        DO_RESTART=false
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
      --online-store-url=*)
        ONLINE_STORE_URL="${1#*=}"
        shift
        ;;
      --cname-target=*)
        STOREFRONT_CNAME_TARGET="${1#*=}"
        shift
        ;;
      --api-url=*)
        API_URL="${1#*=}"
        shift
        ;;
      --repo-root=*)
        REPO_ROOT="${1#*=}"
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

# Host-only CNAME target (strip scheme/path/trailing slash).
normalize_cname_host() {
  local host="${1:-}"
  host="$(printf '%s' "$host" | sed 's/[[:space:]]//g')"
  host="$(printf '%s' "$host" | sed -E 's#^https?://##I')"
  host="$(printf '%s' "$host" | sed 's:/.*$::' | sed 's:/*$::')"
  printf '%s' "$host"
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

  if [[ -n "$SCRIPT_DIR" && -d "$SCRIPT_DIR/../Backend" ]]; then
    REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    return
  fi

  die "Could not detect Nexpro repo root. Set --repo-root=PATH or NEXPRO_REPO_ROOT."
}

on_vps_layout() {
  [[ -d "$HOME/nexpro/Backend" ]]
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

get_env_var() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 0
  grep -m1 "^${key}=" "$file" 2>/dev/null | cut -d= -f2- || true
}

merge_cors_origins() {
  local existing="${1:-}"
  shift
  local -a merged=()
  local origin item

  IFS=',' read -r -a existing_parts <<< "${existing// /}"
  for item in "${existing_parts[@]}"; do
    item="$(normalize_url "$item")"
    [[ -n "$item" ]] && merged+=("$item")
  done

  for origin in "$@"; do
    origin="$(normalize_url "$origin")"
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

run_local() {
  ONLINE_STORE_URL="$(normalize_url "$ONLINE_STORE_URL")"
  STOREFRONT_CNAME_TARGET="$(normalize_cname_host "$STOREFRONT_CNAME_TARGET")"
  API_URL="$(normalize_url "$API_URL")"

  [[ -n "$STOREFRONT_CNAME_TARGET" ]] || die "STOREFRONT_CNAME_TARGET is empty."
  [[ -n "$ONLINE_STORE_URL" ]] || die "ONLINE_STORE_URL is empty."

  detect_repo_root

  local backend_env="$REPO_ROOT/Backend/.env"

  log "Mode:            local (on target)"
  log "Nexpro repo root: $REPO_ROOT"
  log "ONLINE_STORE_URL: $ONLINE_STORE_URL"
  log "STOREFRONT_CNAME_TARGET: $STOREFRONT_CNAME_TARGET"

  [[ -f "$backend_env" ]] || die "Missing $backend_env — create it on the server before running this script."

  backup_file "$backend_env"

  local existing_cors merged_cors
  existing_cors="$(get_env_var "$backend_env" "CORS_ORIGIN")"
  merged_cors="$(merge_cors_origins "$existing_cors" "${REQUIRED_CORS_ORIGINS[@]}" "$ONLINE_STORE_URL")"

  set_env_var "$backend_env" "ONLINE_STORE_URL" "$ONLINE_STORE_URL"
  set_env_var "$backend_env" "STOREFRONT_CNAME_TARGET" "$STOREFRONT_CNAME_TARGET"
  set_env_var "$backend_env" "CORS_ORIGIN" "$merged_cors"

  log ""
  log "=== Summary ==="
  log "Backend ($backend_env):"
  log "  ONLINE_STORE_URL=$ONLINE_STORE_URL"
  log "  STOREFRONT_CNAME_TARGET=$STOREFRONT_CNAME_TARGET"
  log "  CORS_ORIGIN=$merged_cors"

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

run_remote() {
  local ssh_cmd=(ssh)
  # shellcheck disable=SC2206
  [[ -n "$CONTABO_SSH_OPTS" ]] && ssh_cmd+=($CONTABO_SSH_OPTS)
  ssh_cmd+=("$CONTABO_HOST")

  local -a remote_args=(--local)
  [[ "$ENV_ONLY" == true ]] && remote_args+=(--env-only)
  [[ "$DO_RESTART" == true && "$ENV_ONLY" != true ]] && remote_args+=(--restart)
  [[ "$DO_HEALTH_CHECK" == false ]] && remote_args+=(--no-health-check)
  remote_args+=(--online-store-url="$ONLINE_STORE_URL")
  remote_args+=(--cname-target="$STOREFRONT_CNAME_TARGET")
  remote_args+=(--api-url="$API_URL")
  # Only pin repo root when the caller set it; otherwise remote auto-detects ~/nexpro.
  [[ -n "$REPO_ROOT" ]] && remote_args+=(--repo-root="$REPO_ROOT")

  log "Mode:   remote via SSH"
  log "Host:   $CONTABO_HOST"
  log "Remote: ${REPO_ROOT:-~/nexpro (auto)}"
  log "Keys:   ONLINE_STORE_URL=$ONLINE_STORE_URL"
  log "        STOREFRONT_CNAME_TARGET=$STOREFRONT_CNAME_TARGET"
  log ""

  # Pipe this script to remote bash with --local so helpers stay in one file.
  [[ -n "$SCRIPT_DIR" ]] || die "Cannot locate script path for remote pipe."
  "${ssh_cmd[@]}" bash -s -- "${remote_args[@]}" \
    < "$SCRIPT_DIR/configure-online-store-production.sh"
}

main() {
  parse_args "$@"

  if [[ "$FORCE_LOCAL" == true && "$FORCE_REMOTE" == true ]]; then
    die "Use either --local or --remote, not both."
  fi

  local use_remote=true
  if [[ "$FORCE_LOCAL" == true ]]; then
    use_remote=false
  elif [[ "$FORCE_REMOTE" == true ]]; then
    use_remote=true
  elif on_vps_layout; then
    use_remote=false
  fi

  if [[ "$use_remote" == true ]]; then
    [[ -n "$CONTABO_HOST" ]] || die "CONTABO_HOST is empty. Export CONTABO_HOST=user@host or an SSH alias."
    run_remote
  else
    run_local
  fi
}

main "$@"
