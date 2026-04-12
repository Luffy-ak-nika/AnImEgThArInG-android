#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  AnImEgThArInG — Smart Launcher
#  Checks & installs missing system deps, starts proxy services,
#  then launches the main application binary.
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

APP_NAME="AnImEgThArInG"
APP_BIN=""

# ─── Locate the application binary ─────────────────────────────────
for candidate in \
    "/usr/bin/AnImEgThArInG" \
    "/usr/local/bin/AnImEgThArInG" \
    "/opt/AnImEgThArInG/AnImEgThArInG" \
    "$(dirname "$(readlink -f "$0")")/AnImEgThArInG"; do
    if [ -x "$candidate" ]; then
        APP_BIN="$candidate"
        break
    fi
done

if [ -z "$APP_BIN" ]; then
    zenity --error \
        --title="$APP_NAME — Launch Error" \
        --text="Could not find the AnImEgThArInG binary.\nPlease reinstall the application." \
        2>/dev/null || \
    notify-send "$APP_NAME" "Binary not found — please reinstall." 2>/dev/null || true
    exit 1
fi

# ─── Required system packages ───────────────────────────────────────
# These are the packages WebKitGTK + GStreamer need for smooth
# anime video streaming (HLS demuxing, hardware decode, subtitles).
REQUIRED_PKGS=(
    "libwebkit2gtk-4.1-0"    # WebKitGTK rendering engine (core)
    "libgtk-3-0"             # GTK3 UI toolkit
    "curl"                   # Network fetching
    "gstreamer1.0-plugins-base"   # GStreamer base codecs
    "gstreamer1.0-plugins-good"   # MATROSKA, AAC, VP8/VP9 etc.
    "gstreamer1.0-plugins-bad"    # HLS demuxer (CRITICAL for Kwik/AnimePahe)
    "gstreamer1.0-plugins-ugly"   # H.264 / AAC
    "gstreamer1.0-libav"          # FFmpeg → H.264, AAC, SRT subtitles
    "gstreamer1.0-vaapi"          # Hardware video acceleration (VA-API)
)

# ─── Check which packages are missing ──────────────────────────────
MISSING=()
for pkg in "${REQUIRED_PKGS[@]}"; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
        MISSING+=("$pkg")
    fi
done

# ─── Install missing packages with a native auth dialog ─────────────
if [ ${#MISSING[@]} -gt 0 ]; then
    echo "[$APP_NAME] Missing packages: ${MISSING[*]}"

    # Show a notification so the user isn't confused
    notify-send \
        "$APP_NAME — Installing Dependencies" \
        "Installing ${#MISSING[@]} required package(s)…\nYou may be asked for your password." \
        --icon=dialog-information 2>/dev/null || true

    INSTALL_CMD="apt-get update -qq && apt-get install -y ${MISSING[*]}"

    if command -v pkexec >/dev/null 2>&1; then
        pkexec bash -c "$INSTALL_CMD" || {
            # pkexec failed (user cancelled or no polkit) — try zenity terminal
            zenity --question \
                --title="$APP_NAME — Missing Dependencies" \
                --text="The following packages are needed:\n\n  ${MISSING[*]}\n\nInstall now? (requires password)" \
                2>/dev/null && \
            x-terminal-emulator -e "bash -c 'sudo $INSTALL_CMD; sleep 3'" 2>/dev/null || true
        }
    elif command -v gksudo >/dev/null 2>&1; then
        gksudo "bash -c '$INSTALL_CMD'" || true
    else
        x-terminal-emulator -e "bash -c 'sudo $INSTALL_CMD; echo Done. Press Enter to continue.; read'" || true
    fi
fi

# ─── Auto-start proxy services ─────────────────────────────────────
# These services give the app its anonymity / ISP bypass.
# We start them in the background before the app so they're ready.

start_warp() {
    if ! command -v warp-cli >/dev/null 2>&1; then return; fi
    # Connect WARP (no-op if already connected)
    warp-cli connect >/dev/null 2>&1 &
    echo "[$APP_NAME] Cloudflare WARP: connecting…"
}

start_tor() {
    if ! command -v tor >/dev/null 2>&1; then return; fi

    # Already running as a systemd service?
    if systemctl is-active --quiet tor 2>/dev/null; then
        echo "[$APP_NAME] Tor: already running (systemd)"
        return
    fi

    # Running as a user-level service?
    if systemctl --user is-active --quiet tor 2>/dev/null; then
        echo "[$APP_NAME] Tor: already running (user systemd)"
        return
    fi

    # Try starting the system service (silent, no sudo prompt)
    if systemctl start tor >/dev/null 2>&1; then
        echo "[$APP_NAME] Tor: started via systemctl"
        return
    fi

    # Fall back: run tor directly as a daemon (writes to ~/.tor)
    mkdir -p "$HOME/.tor"
    tor --DataDirectory "$HOME/.tor" \
        --SocksPort 9050 \
        --Log "warn syslog" \
        --quiet &
    echo "[$APP_NAME] Tor: started as background daemon on :9050"
}

# Start WARP first (fastest), then Tor as fallback
start_warp
start_tor

# Give proxy services 1 second to come up before the app checks them
sleep 1

# ─── Launch the application ─────────────────────────────────────────
echo "[$APP_NAME] Launching $APP_BIN …"
exec "$APP_BIN" "$@"
