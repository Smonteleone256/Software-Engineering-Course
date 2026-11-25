#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR/server"

export PORT=4242
export FRONTEND_ORIGIN="http://localhost:4173"

echo "Starting OneClick backend on http://localhost:${PORT}"
echo "Allowed frontend origin: ${FRONTEND_ORIGIN}"
exec node index.js
