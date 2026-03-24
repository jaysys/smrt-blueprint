#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.run"
NODE_MODULES_DIR="$ROOT_DIR/node_modules"
DEPS_STAMP_FILE="$NODE_MODULES_DIR/.deps-stamp"
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
mkdir -p "$ROOT_DIR/dist"
printf '%s\n' "$(compute_build_stamp)" > "$BUILD_STAMP_FILE"

chmod +x "$ROOT_DIR/one-shot-startup.sh" "$ROOT_DIR/one-shot-stop.sh"

echo "[OK] setup complete"
echo "Next:"
echo "  1) ./one-shot-startup.sh"
echo "  2) open http://127.0.0.1:6005"
echo "  3) ./one-shot-stop.sh"
