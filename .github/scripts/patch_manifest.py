#!/usr/bin/env python3
"""Patch Tauri's generated AndroidManifest.xml:
1. windowSoftInputMode = adjustResize  (keyboard shrinks WebView, not covers it)
2. configChanges = orientation|screenSize|keyboardHidden  (routes rotation to
   onConfigurationChanged instead of restarting the Activity)
"""
import sys, re

path = sys.argv[1]
with open(path) as f:
    content = f.read()

# ── 1. windowSoftInputMode → adjustResize ────────────────────────────────────
updated = re.sub(
    r'android:windowSoftInputMode="[^"]*"',
    'android:windowSoftInputMode="adjustResize"',
    content
)
if 'adjustResize' not in updated:
    updated = updated.replace(
        'android:name=".MainActivity"',
        'android:name=".MainActivity" android:windowSoftInputMode="adjustResize"'
    )

# ── 2. configChanges — needed for onConfigurationChanged to fire ─────────────
CONFIG = 'orientation|screenSize|keyboardHidden|screenLayout|smallestScreenSize'

if 'android:configChanges' in updated:
    # Already there — make sure our values are included
    def merge_config(m):
        existing = m.group(1)
        existing_parts = set(existing.split('|'))
        for part in CONFIG.split('|'):
            existing_parts.add(part)
        return f'android:configChanges="{"|".join(sorted(existing_parts))}"'
    updated = re.sub(r'android:configChanges="([^"]*)"', merge_config, updated)
else:
    updated = updated.replace(
        'android:name=".MainActivity"',
        f'android:name=".MainActivity" android:configChanges="{CONFIG}"'
    )

open(path, 'w').write(updated)
print('Patched AndroidManifest.xml: keyboard adjustResize + configChanges for orientation')
