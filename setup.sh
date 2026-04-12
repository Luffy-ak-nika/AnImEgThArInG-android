#!/bin/bash
set -e

echo "╔════════════════════════════════════════════╗"
echo "║        🎌 AniHub Setup Script              ║"
echo "║   Anime Streaming Launcher for Linux       ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 found: $(command -v "$1")"
        return 0
    else
        echo -e "${RED}✗${NC} $1 not found"
        return 1
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Installing system dependencies..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

sudo apt update
sudo apt install -y \
    build-essential \
    curl \
    wget \
    file \
    libwebkit2gtk-4.1-dev \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    patchelf \
    libxdo-dev \
    pkg-config

echo ""
echo -e "${GREEN}✓ System dependencies installed${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Installing Rust..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if check_command rustc; then
    echo "Rust is already installed. Updating..."
    rustup update stable 2>/dev/null || true
else
    echo "Installing Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

echo ""
echo -e "${GREEN}✓ Rust ready: $(rustc --version 2>/dev/null || echo 'source ~/.cargo/env first')${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Installing Node.js..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if check_command node; then
    echo "Node.js is already installed."
else
    echo "Installing nvm and Node.js LTS..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install --lts
fi

echo ""
echo -e "${GREEN}✓ Node.js ready: $(node --version 2>/dev/null || echo 'restart terminal')${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Installing npm dependencies..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ensure we're in the project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

npm install

echo ""
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo "╔════════════════════════════════════════════╗"
echo "║           🎉 Setup Complete!               ║"
echo "╠════════════════════════════════════════════╣"
echo "║                                            ║"
echo "║  To start AniHub:                          ║"
echo "║                                            ║"
echo "║    npm run tauri dev                       ║"
echo "║                                            ║"
echo "║  To build for production:                  ║"
echo "║                                            ║"
echo "║    npm run tauri build                     ║"
echo "║                                            ║"
echo "║  First run takes 2-5 min (Rust compile).   ║"
echo "║                                            ║"
echo "╚════════════════════════════════════════════╝"
