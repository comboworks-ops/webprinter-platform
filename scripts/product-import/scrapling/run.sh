#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"
PYTHON_BIN="${WEBPRINTER_SCRAPLING_PYTHON:-$CODEX_ROOT/tools/webprinter-scrapling/0.4.8/venv/bin/python}"

if [ ! -x "$PYTHON_BIN" ]; then
  echo "The Webprinter Scrapling runtime is not installed." >&2
  echo "Run: $SCRIPT_DIR/install-runtime.sh" >&2
  exit 2
fi

exec "$PYTHON_BIN" "$SCRIPT_DIR/extract.py" "$@"
