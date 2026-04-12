#!/usr/bin/env python3
"""Patch Tauri's generated AndroidManifest.xml to use adjustResize soft input mode.
This makes the WebView shrink when the keyboard appears so CSS dvh units and
form layouts correctly adapt — preventing the keyboard from covering inputs.
"""
import sys, re

path = sys.argv[1]
with open(path) as f:
    content = f.read()

# Replace existing windowSoftInputMode value with adjustResize
updated = re.sub(
    r'android:windowSoftInputMode="[^"]*"',
    'android:windowSoftInputMode="adjustResize"',
    content
)

# Fallback: attribute missing entirely — inject it on the MainActivity tag
if 'adjustResize' not in updated:
    updated = updated.replace(
        'android:name=".MainActivity"',
        'android:name=".MainActivity" android:windowSoftInputMode="adjustResize"'
    )

open(path, 'w').write(updated)
print('Patched AndroidManifest.xml: keyboard adjustResize mode enabled')
