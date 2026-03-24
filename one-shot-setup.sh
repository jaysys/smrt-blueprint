#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.run"
NODE_MODULES_DIR="$ROOT_DIR/node_modules"
DEPS_STAMP_FILE="$NODE_MODULES_DIR/.deps-stamp"

compute_deps_stamp() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$ROOT_DIR/package.json" "$ROOT_DIR/package-lock.json" | sha256sum | awk '{print $1}'
    return
  fi

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$ROOT_DIR/package.json" "$ROOT_DIR/package-lock.json" | shasum -a 256 | awk '{print $1}'
    return
  fi

  node -e "const fs=require('fs');const crypto=require('crypto');const hash=crypto.createHash('sha256');hash.update(fs.readFileSync(process.argv[1]));hash.update(fs.readFileSync(process.argv[2]));process.stdout.write(hash.digest('hex'));" "$ROOT_DIR/package.json" "$ROOT_DIR/package-lock.json"
}

echo "[INFO] project root: $ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] node is not installed"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm is not installed"
  exit 1
fi

echo "[INFO] node: $(node -v)"
echo "[INFO] npm: $(npm -v)"

mkdir -p "$PID_DIR"

CURRENT_DEPS_STAMP="$(compute_deps_stamp)"
INSTALLED_DEPS_STAMP="$(cat "$DEPS_STAMP_FILE" 2>/dev/null || true)"

if [[ ! -d "$NODE_MODULES_DIR" ]]; then
  echo "[INFO] node_modules not found. installing dependencies..."
  (
    cd "$ROOT_DIR"
    npm install
  )
elif [[ "$CURRENT_DEPS_STAMP" != "$INSTALLED_DEPS_STAMP" ]]; then
  echo "[INFO] dependency manifest changed. reinstalling dependencies..."
  (
    cd "$ROOT_DIR"
    npm install
  )
else
  echo "[INFO] reusing existing node_modules"
fi

mkdir -p "$NODE_MODULES_DIR"
printf '%s\n' "$CURRENT_DEPS_STAMP" > "$DEPS_STAMP_FILE"

echo "[INFO] building production bundle"
(
  cd "$ROOT_DIR"
  npm run build
)

chmod +x "$ROOT_DIR/one-shot-startup.sh" "$ROOT_DIR/one-shot-stop.sh"

echo "[OK] setup complete"
echo "Next:"
echo "  1) ./one-shot-startup.sh"
echo "  2) open http://127.0.0.1:6005"
echo "  3) ./one-shot-stop.sh"
