#!/usr/bin/env bash
# Local SQLite replay of both Admin migrations and durable security invariants.
set -euo pipefail
python3 scripts/admin-schema-smoke.py
