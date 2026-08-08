#!/usr/bin/env bash
set -euo pipefail

repository_dir="$(cd "$(dirname "$0")/.." && pwd)"

blocked() {
  echo "Reference integrations release gate BLOCKED: $1 The gate has not passed." >&2
  exit 1
}

if [[ "${REFERENCE_INTEGRATIONS_FORCE_DOCKER_UNAVAILABLE:-}" == "1" ]]; then
  blocked "Docker/PostgreSQL 17 was marked unavailable for this verification run."
fi

if ! command -v docker >/dev/null 2>&1; then
  blocked "Docker is unavailable; both required PostgreSQL 17 suites must run."
fi

if ! docker info >/dev/null 2>&1; then
  blocked "Docker is installed but its daemon is unavailable; both required PostgreSQL 17 suites must run."
fi

echo "Running business-evidence and PostNord PostgreSQL 17 release checks..."
"$repository_dir/scripts/run-business-evidence-hardening-pg17.sh"

echo "Running WMD snapshot-draft PostgreSQL 17 release checks..."
"$repository_dir/scripts/run-wmd-snapshot-draft-pg17.sh"

echo "Reference integrations PostgreSQL 17 release gate passed."
