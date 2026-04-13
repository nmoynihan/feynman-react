#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ensure_dependencies() {
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    echo "Installing dependencies..."
    (cd "$ROOT_DIR" && npm install)
  fi
}

print_help() {
  cat <<'EOF'
Usage: ./run.sh [command]

Commands:
  dev       Start the demo app in Vite dev mode (default)
  build     Build the core package, React wrapper, and demo app
  preview   Build and preview the demo app locally
  install   Install workspace dependencies
  help      Show this help message
EOF
}

command_name="${1:-dev}"

case "$command_name" in
  dev)
    ensure_dependencies
    cd "$ROOT_DIR"
    npm run dev
    ;;
  build)
    ensure_dependencies
    cd "$ROOT_DIR"
    npm run build
    ;;
  preview)
    ensure_dependencies
    cd "$ROOT_DIR"
    npm run build
    npm run preview -w @feynman/demo
    ;;
  install)
    cd "$ROOT_DIR"
    npm install
    ;;
  help|-h|--help)
    print_help
    ;;
  *)
    echo "Unknown command: $command_name" >&2
    echo >&2
    print_help
    exit 1
    ;;
esac