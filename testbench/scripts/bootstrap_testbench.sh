#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$ROOT_DIR/blog/database/posts"
mkdir -p "$ROOT_DIR/blog/src/components"
mkdir -p "$ROOT_DIR/blog/src/lib"
mkdir -p "$ROOT_DIR/sentinel"
mkdir -p "$ROOT_DIR/scripts"

cat <<'MSG'
Testbench directories are ready.

Core paths:
- testbench/blog/database/posts
- testbench/sentinel
- testbench/scripts
MSG
