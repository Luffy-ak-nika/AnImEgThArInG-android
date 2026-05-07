# 🎌 AnImEgThArInG — Android

> **Your personal anime streaming hub for Android.**
> Open any anime streaming website directly inside the app, save your library, track watch progress, and never lose your place again.

---

## 📲 Install the APK

1. Go to the **[Releases](../../releases)** page → download the latest `.apk` file
2. On your Android phone → **Settings → Install unknown apps** → allow your browser/file manager
3. Tap the downloaded APK and install
4. Open **AnImEgThArInG** 🎌

> **Minimum Android version:** Android 8.0 (API 26)

---

## ⚠️ IMPORTANT — Please Read Before Using

> [!CAUTION]
> **I'm sorry, but after searching the app and adding anime to your library, tapping or selecting it will take you to the selected website — but it does NOT automatically open the specific anime you searched for. Please copy the anime name, go to the website from the Browse tab, and paste the name into that website's own search bar to find it.**
>
> **Also, some domains may stop working as streaming sites frequently change their domain names. If a domain doesn't work, simply search for the updated domain online and add it yourself in the Browse tab → Edit.**
>
> **I'm sorry for the inconvenience — I will try to fix this in a future update.**

---

## 🗺️ App Overview — 3 Tabs

The app has **3 main tabs** at the bottom of the screen:

| Tab | Icon | What it does |
|-----|------|-------------|
| **Library** | ♥ Heart | Your saved anime collection |
| **Browse** | 🌐 Globe | All streaming websites |
| **Search** | 🔍 Search | Search anime by name |

---

## ♥ Library Tab — Your Anime Collection

This is your personal anime list. Every anime you save appears here as a card.

### What each card shows
- **Big thumbnail image** (cover art)
- **Coloured dot** in top-left corner = your watch status
- **Episode badge** in bottom-right corner (e.g. `8/24` = watched 8 out of 24)
- **Progress bar** at the bottom of the thumbnail
- **Status chip** (e.g. "Watching", "Completed")
- **Last watched** episode label

### Watch Statuses & their colours
| Status | Colour |
|--------|--------|
| 🟢 Watching | Green |
| 🟣 Completed | Purple |
| 🟡 On Hold | Yellow/Amber |
| 🔴 Dropped | Red |
| ⚪ Plan to Watch | Grey |

### Filter chips (top of Library)
Tap any chip to filter your list:
> **All · Watching · Completed · On Hold · Dropped · Plan to Watch**

The chip also shows a count — e.g. "Watching · 5"

---

### ✏️ Updating Progress (Progress Sheet)

Tap **✏️ Progress** on any anime card to open the progress editor:

1. **Watch Status** — tap one of the 5 coloured status pills
2. **Watched / Total** — enter how many episodes you have watched and the total (e.g. `8 / 24`)
3. **Last Watched** — type the last episode you saw (e.g. "Episode 8")
4. **Notes** — optional personal notes (e.g. "Pick up at Season 2 Episode 3")
5. Tap **💾 Save Progress** — the button is always pinned at the bottom, never hidden

> **Tip:** The progress sheet scrolls — swipe up inside it to see all fields.

---

### 🗑️ Removing from Library

Tap the **🗑️ button** on any anime card → the anime is removed from your library.

---

## 📦 Backup & Restore

Tap the **Backup & Restore** button (floating button at the bottom of Library tab).

### ⬆️ Import / Restore (Import tab)

Tap **Browse & Select File** → your Android file picker opens.

**Supported file formats:**
| Format | What it is |
|--------|-----------|
| `.anihub` ✅ | AnImEgThArInG own backup (recommended) |
| `.tachibk` | Tachiyomi backup |
| `.proto.gz` | Aniyomi binary backup |
| `.json` | Aniyomi JSON backup |

> **📱 Android tip:** The file picker shows ALL files. Navigate to your Downloads folder and tap your backup file.

After import the app shows: **"X new · Y updated"** — existing entries are updated, not duplicated.

---

### ⬇️ Create Backup (Create Backup tab)

Tap **Save Backup File** → choose where to save on your phone.

The backup saves:
- All your **favorites** (with episode progress, status, notes)
- All your **custom streaming sites**

The file is named like: `AnImEgThArInG-backup-2026-05-07.anihub`

> Keep this file safe — you can restore it on any device running AnImEgThArInG (Android or PC).

---

## 🌐 Browse Tab — Streaming Sites

All your streaming websites are shown as cards in a 2-column grid.

### Pre-loaded sites (10 sites)

| Emoji | Site |
|-------|------|
| 🌊 | AniWave |
| 🦊 | GogoAnime |
| 🔥 | AnimePahe |
| 🌸 | AllAnime |
| 👁️ | AniWatch |
| 😇 | AnimeHeaven |
| 💀 | KickassAnime |
| 🎭 | AnimeSuge |
| ⚡ | AnimeKai |
| 🎬 | Animension |

### Opening a site
**Tap the card** → the site opens inside the app as a full-screen webview.

Inside the webview:
- Use **Android's back gesture** (swipe from edge) to go back inside the website
- Rotate to **landscape** → the status bar and navigation bar **auto-hide** for full-screen video
- Rotate back to **portrait** → bars reappear

### Mirror Domains (Switch button)
Each site has multiple backup domains in case one is blocked.

Tap **Mirror** on a site card → a bottom sheet appears listing all mirrors.
- Active mirror has a **purple dot ●**
- Tap any domain to switch to it instantly

### Edit Domains (Edit button)
Tap **Edit** to add, remove, or reorder domains for any site.

### ➕ Add Custom Site
Tap the **"+ Add Custom Site"** card at the end of the grid.

Fill in:
- **Site name** (e.g. "My Site")
- **Emoji icon** (e.g. 🌟)
- **URL** (e.g. `https://mysite.com`)
- Add more mirror domains if needed

Tap **Add Website** → it appears in your grid.

To **delete** a custom site: tap the red **🗑️ button** on its card → confirm in the popup.

---

## 🔍 Search Tab — Find Anime

Type any anime name in the search box and tap Search.

Results come from the **Jikan API** (MyAnimeList data) and show:
- Anime poster/thumbnail
- Title
- Year & episode count
- Score / rating
- Genres

Tap any result → you can open it or save it to your library.

> **Note:** If you see a "504 Gateway" error, the Jikan API server is temporarily busy. Wait a moment and try again — this is a server-side issue, not the app.

---

## 🔝 Top Bar

The top bar at the top of the app has:

| Button | What it does |
|--------|-------------|
| 🎌 **AnImEgThArInG** (logo) | — |
| 🛡️ **VPN / No VPN** | Opens Proxy Settings |
| ⚙️ **Settings gear** | Opens Proxy Settings |
| **"N open"** badge | Tap to see currently open website tabs (MobileDrawer) |

---

## 🛡️ Proxy / VPN Settings

Tap the **VPN** or **No VPN** button in the top bar.

1. Toggle **Enable Proxy** ON
2. Choose type: **HTTP** or **SOCKS5**
3. Enter **Host / IP** and **Port**
4. Or tap **Auto-fetch** to grab a free public proxy automatically
5. Quick presets: **Cloudflare WARP** or **Tor** (requires those apps installed)

> **Android note:** Proxy settings apply to the app's domain-reachability checks. For full tunneling of the webview traffic, use a system-wide VPN app (Cloudflare WARP, ProtonVPN, etc.).

---

## 🔄 Landscape / Full-Screen Video

When you rotate your phone to landscape inside any streaming site:
- ✅ Status bar (top) **auto-hides**
- ✅ Navigation bar (bottom) **auto-hides**
- ✅ You get full-screen video playback

Swipe from any edge to temporarily show the bars, then they auto-hide again.

---

## 🔙 Back Button Behaviour

- Inside a streaming site → **back gesture goes back one page** (like a browser back button)
- When you're at the homepage of the site → back gesture **exits the webview** and returns to the app

---

## 💡 Tips & Tricks

| Tip | Detail |
|-----|--------|
| 📌 Save quickly | While browsing a site, use the ♥ button to save anime |
| 🔄 No duplicates | Restoring a backup updates existing entries, never creates doubles |
| 📋 Multiple backups | You can keep older `.anihub` files as history |
| 🌐 Site blocked? | Use Mirror → switch to a different domain |
| 📵 Offline? | Previously loaded pages may be cached by the webview |

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|---------|
| `.anihub` file not showing in picker | The picker shows ALL files — scroll to Downloads folder |
| Backup says "0 entries" | The file may be empty or from a different app |
| Site won't load | Try switching Mirror domain (Browse tab → Mirror button) |
| Jikan 504 error in Search | Jikan server is busy — wait and retry |
| Video freezes in landscape | Swipe edge to show bars → tap fullscreen button again |
| App crashes on first open | Uninstall, re-download APK, reinstall |

---

## 🛠️ Build from Source (GitHub Actions)

The APK is built automatically on every push to `main` via **GitHub Actions**.

1. Fork this repo
2. Push any change to `main`
3. Go to **Actions** tab → wait ~25 minutes
4. Download APK from **Artifacts** section

---

## 📄 License

MIT — Free to use, modify, and distribute.

---

*Made with ♥ for anime fans.*
