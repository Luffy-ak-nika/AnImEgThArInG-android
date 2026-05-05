#!/usr/bin/env python3
"""Patch Tauri's generated MainActivity.kt to handle Android back button correctly
and to hide the system bars (status bar + nav bar) in landscape mode for fullscreen
video playback.

Uses:
  - Recursive WebView finder for reliable back-button navigation
  - WindowInsetsControllerCompat (AndroidX) for modern immersive fullscreen
  - onConfigurationChanged to react to orientation changes
"""
import sys

path = sys.argv[1]
with open(path) as f:
    content = f.read()

if 'onBackPressed' in content and 'onConfigurationChanged' in content:
    print('Already patched — skipping')
    sys.exit(0)

# ── Imports to add at top of file ────────────────────────────────────────────
# Find the package declaration line and insert imports after it
import_block = (
    'import androidx.core.view.WindowCompat\n'
    'import androidx.core.view.WindowInsetsCompat\n'
    'import androidx.core.view.WindowInsetsControllerCompat\n'
)

if 'WindowCompat' not in content:
    # Insert imports before the "class MainActivity" line
    content = content.replace(
        'class MainActivity : TauriActivity() {',
        import_block + '\nclass MainActivity : TauriActivity() {',
        1
    )

# ── Patch to inject inside the class ─────────────────────────────────────────
patch = '''
    // ── System-bar helpers ────────────────────────────────────────────────
    private fun getInsetsController(): WindowInsetsControllerCompat =
        WindowCompat.getInsetsController(window, window.decorView)

    private fun hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val ctrl = getInsetsController()
        ctrl.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        ctrl.hide(WindowInsetsCompat.Type.systemBars())
    }

    private fun showSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val ctrl = getInsetsController()
        ctrl.show(WindowInsetsCompat.Type.systemBars())
    }

    // ── Orientation: fullscreen in landscape (video mode) ─────────────────
    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        if (newConfig.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE) {
            hideSystemBars()
        } else {
            showSystemBars()
        }
    }

    // ── Recursively find the Tauri WebView in view hierarchy ─────────────
    private fun findWebView(v: android.view.View): android.webkit.WebView? {
        if (v is android.webkit.WebView) return v
        val g = v as? android.view.ViewGroup ?: return null
        for (i in 0 until g.childCount) {
            val r = findWebView(g.getChildAt(i))
            if (r != null) return r
        }
        return null
    }

    // ── Back button: navigate WebView history, exit only when at root ─────
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val wv = findWebView(window.decorView)
        if (wv != null && wv.canGoBack()) {
            wv.goBack()
        } else {
            super.onBackPressed()
        }
    }
'''

content = content.replace(
    'class MainActivity : TauriActivity() {',
    'class MainActivity : TauriActivity() {' + patch,
    1
)

open(path, 'w').write(content)
print('Patched MainActivity.kt: back button + landscape fullscreen')
