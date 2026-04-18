#!/bin/sh
set -e

INSTALL_DIR="/usr/local/bin"
CLI_NAME="create-shipfast"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing $CLI_NAME to $INSTALL_DIR..."

ln -sf "$REPO_DIR/src/cli.js" "$INSTALL_DIR/$CLI_NAME"
chmod +x "$REPO_DIR/src/cli.js"

echo "Done. Run: $CLI_NAME"
