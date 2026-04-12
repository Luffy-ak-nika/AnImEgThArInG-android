#!/usr/bin/env python3
"""Patch Tauri's generated MainActivity.kt to handle Android back button correctly.
The patched code finds the WebView recursively and calls goBack() when history exists,
only falling back to super.onBackPressed() (exit) when there's nothing to go back to.
"""
import sys

path = sys.argv[1]
with open(path) as f:
    content = f.read()

if 'onBackPressed' in content:
    print('Already patched — skipping')
    sys.exit(0)

patch = '''
    // Recursively search the view hierarchy for the Tauri WebView
    private fun findWebView(v: android.view.View): android.webkit.WebView? {
        if (v is android.webkit.WebView) return v
        val g = v as? android.view.ViewGroup ?: return null
        for (i in 0 until g.childCount) {
            val r = findWebView(g.getChildAt(i))
            if (r != null) return r
        }
        return null
    }

    // Android back gesture: navigate WebView history OR exit if at root
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
print('Patched MainActivity.kt: back button navigates WebView history')
