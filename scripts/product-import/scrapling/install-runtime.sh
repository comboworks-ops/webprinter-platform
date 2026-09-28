#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"
RUNTIME_DIR="$CODEX_ROOT/tools/webprinter-scrapling/0.4.8"
VENV_DIR="$RUNTIME_DIR/venv"
LOCK_FILE="$SCRIPT_DIR/requirements.lock.txt"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install it from https://docs.astral.sh/uv/ and rerun." >&2
  exit 2
fi

mkdir -p "$RUNTIME_DIR"
uv python install 3.12

if [ ! -x "$VENV_DIR/bin/python" ]; then
  uv venv --python 3.12 "$VENV_DIR"
fi

uv pip sync --python "$VENV_DIR/bin/python" "$LOCK_FILE"
"$VENV_DIR/bin/python" -c 'from importlib.metadata import version; print("Scrapling runtime ready:", version("scrapling"))'

echo "Runtime installed at: $RUNTIME_DIR"
