#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.run"
APP_NAME="$(basename "$ROOT_DIR")"
APP_NAME_SAFE="$(printf '%s' "$APP_NAME" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-')"
PID_FILE="$PID_DIR/${APP_NAME_SAFE}.pid"
LOG_FILE="$PID_DIR/${APP_NAME_SAFE}.log"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-6005}"
DEPS_STAMP_FILE="$ROOT_DIR/node_modules/.deps-stamp"
BUILD_STAMP_FILE="$ROOT_DIR/dist/.build-stamp"

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

compute_build_stamp() {
  local hasher_command
  if command -v sha256sum >/dev/null 2>&1; then
    hasher_command="sha256sum"
  elif command -v shasum >/dev/null 2>&1; then
    hasher_command="shasum -a 256"
  else
    node -e "const fs=require('fs');const path=require('path');const crypto=require('crypto');const root=process.argv[1];const hash=crypto.createHash('sha256');const include=new Set(['.js','.jsx','.ts','.tsx','.css','.html','.json']);const roots=['src','server'];const files=[];for(const rel of roots){const abs=path.join(root,rel);if(!fs.existsSync(abs)) continue;const stack=[abs];while(stack.length){const current=stack.pop();for(const entry of fs.readdirSync(current,{withFileTypes:true})){const next=path.join(current,entry.name);if(entry.isDirectory()){stack.push(next);continue;}if(include.has(path.extname(entry.name))){files.push(path.relative(root,next));}}}}for(const rel of ['index.html','package.json','package-lock.json','tsconfig.json','tsconfig.app.json','tsconfig.node.json','vite.config.ts']){if(fs.existsSync(path.join(root,rel))){files.push(rel);}}files.sort();for(const rel of files){hash.update(rel);hash.update(fs.readFileSync(path.join(root,rel)));}process.stdout.write(hash.digest('hex'));" "$ROOT_DIR"
    return
  fi

  (
    cd "$ROOT_DIR"
    {
      find src server -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.css" -o -name "*.html" -o -name "*.json" \) 2>/dev/null
      for file in index.html package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts; do
        if [[ -f "$file" ]]; then
          printf '%s\n' "$file"
        fi
      done
    } | LC_ALL=C sort | while IFS= read -r file; do
      [[ -n "$file" ]] || continue
      $hasher_command "$file"
    done | $hasher_command | awk '{print $1}'
  )
}

mkdir -p "$PID_DIR"

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  echo "[ERROR] node_modules not found"
  echo "Run ./one-shot-setup.sh first."
  exit 1
fi

CURRENT_DEPS_STAMP="$(compute_deps_stamp)"
INSTALLED_DEPS_STAMP="$(cat "$DEPS_STAMP_FILE" 2>/dev/null || true)"
CURRENT_BUILD_STAMP="$(compute_build_stamp)"
INSTALLED_BUILD_STAMP="$(cat "$BUILD_STAMP_FILE" 2>/dev/null || true)"

if [[ "$CURRENT_DEPS_STAMP" != "$INSTALLED_DEPS_STAMP" ]]; then
  echo "[INFO] dependency manifest changed. installing updated dependencies..."
  (
    cd "$ROOT_DIR"
    npm install
  )
  mkdir -p "$ROOT_DIR/node_modules"
  printf '%s\n' "$CURRENT_DEPS_STAMP" > "$DEPS_STAMP_FILE"
fi

if [[ ! -f "$ROOT_DIR/dist/index.html" || "$CURRENT_BUILD_STAMP" != "$INSTALLED_BUILD_STAMP" ]]; then
  echo "[INFO] build inputs changed or dist not found. building production bundle..."
  (
    cd "$ROOT_DIR"
    npm run build
  )
  mkdir -p "$ROOT_DIR/dist"
  printf '%s\n' "$CURRENT_BUILD_STAMP" > "$BUILD_STAMP_FILE"
fi

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" || true)"
  if [[ -n "${OLD_PID:-}" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[INFO] already running (pid=$OLD_PID)"
    echo "URL: http://$HOST:$PORT"
    echo "LOG: $LOG_FILE"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[ERROR] port $PORT is already in use"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN || true
  exit 1
fi

(
  cd "$ROOT_DIR"
  nohup env PORT="$PORT" HOST="$HOST" NODE_ENV=production node server/index.js >"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
)

sleep 2
PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  echo "[OK] started (pid=$PID)"
  echo "URL: http://$HOST:$PORT"
  echo "LOG: $LOG_FILE"
else
  echo "[ERROR] failed to start. check log: $LOG_FILE"
  rm -f "$PID_FILE"
  exit 1
fi
