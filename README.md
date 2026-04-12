# AnImEgThArInG — Android

This is the **Android version** of AnImEgThArInG. The PC version in `../AnImEgThArInG/` is completely untouched.

## Features (all working on Android)

| Feature | Status |
|---|---|
| Sites library + domain switcher | ✅ |
| Favorites (SQLite) | ✅ |
| Aniyomi backup import | ✅ |
| Anime search | ✅ |
| In-app browser (Brave-style chrome) | ✅ |
| Ad/popup blocking (JS layer) | ✅ |
| HLS.js buffer enhancement | ✅ |
| Proxy settings (domain checks) | ✅ (VPN app recommended for full tunneling) |
| Multi-window browsing | ✅ (via Tauri WebviewWindow) |
| Mobile bottom tab navigation | ✅ |
| Mobile bottom-sheet open-browsers drawer | ✅ |

## Building the APK

### Prerequisites

```bash
# 1. Rust Android targets
rustup target add aarch64-linux-android armv7-linux-androideabi \
  i686-linux-android x86_64-linux-android

# 2. Java 17
sudo apt install openjdk-17-jdk

# 3. Android Studio / SDK
# Download from: https://developer.android.com/studio
# Or via CLI: sdkmanager --install "platforms;android-34" "ndk;26.3.11579264"

# 4. Set environment variables (add to ~/.bashrc)
export ANDROID_HOME=$HOME/Android/Sdk
export NDK_HOME=$ANDROID_HOME/ndk/26.3.11579264
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools

# 5. Install Tauri CLI
cargo install tauri-cli --version "^2"
```

### Initialize Android Project (once)

```bash
cd anihub
npm install
cargo tauri android init
```

### Run on Device / Emulator

```bash
cargo tauri android dev
```

### Build APK

```bash
cargo tauri android build
# APK will be in: src-tauri/gen/android/app/build/outputs/apk/
```

## What's Different from the PC Version

- **Browser chrome**: Brave-style injected chrome (top bar + bottom nav) instead of a simple floating bar
- **Navigation**: Bottom tab bar (Favorites / Browse / Search) instead of desktop top nav
- **Open browsers**: Bottom-sheet drawer instead of collapsible sidebar
- **Proxy**: Settings retained but WebView tunneling uses system VPN; proxy still used for smart domain routing checks
- **User agent**: Android Chrome UA so sites serve mobile-optimized pages
- **No Linux `.deb`**: Android-only bundle config
