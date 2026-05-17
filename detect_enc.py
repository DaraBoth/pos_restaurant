# import chardet

import os

with open('src-tauri/signing.key.pub', 'rb') as f:
    raw = f.read()
    print(f"RAW BYTES LENGTH: {len(raw)}")
    print(f"RAW BYTES START: {raw[:10]}")

try:
    content = raw.decode('utf-8')
    print("UTF-8 DECODE SUCCESS")
    print(f"LINES: {len(content.splitlines())}")
except Exception as e:
    print(f"UTF-8 DECODE FAIL: {e}")

try:
    content = raw.decode('utf-16')
    print("UTF-16 DECODE SUCCESS")
    print(f"LINES: {len(content.splitlines())}")
except Exception as e:
    print(f"UTF-16 DECODE FAIL: {e}")
