#!/usr/bin/env bash
set -euo pipefail

# Kill processes listening on local development ports.
# Usage:
#   ./scripts/kill-dev-ports.sh
#   ./scripts/kill-dev-ports.sh 3000 5001 5173

DEFAULT_PORTS=(3000 3001 5000 5001 5173 5174 8080 8081)
PORTS=("$@")

if [ "${#PORTS[@]}" -eq 0 ]; then
  PORTS=("${DEFAULT_PORTS[@]}")
fi

for port in "${PORTS[@]}"; do
  if ! [[ "$port" =~ ^[0-9]+$ ]]; then
    echo "Skipping invalid port: $port"
    continue
  fi

  pids="$(lsof -ti "tcp:${port}" || true)"
  if [ -z "$pids" ]; then
    echo "Port ${port}: no process found"
    continue
  fi

  echo "Port ${port}: killing PID(s) ${pids//$'\n'/, }"
  kill $pids 2>/dev/null || true
done

sleep 1

for port in "${PORTS[@]}"; do
  if ! [[ "$port" =~ ^[0-9]+$ ]]; then
    continue
  fi

  pids="$(lsof -ti "tcp:${port}" || true)"
  if [ -n "$pids" ]; then
    echo "Port ${port}: force killing PID(s) ${pids//$'\n'/, }"
    kill -9 $pids 2>/dev/null || true
  fi
done

echo "Done."
