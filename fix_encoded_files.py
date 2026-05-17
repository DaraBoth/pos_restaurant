import base64
import os

def fix_file(path):
    if not os.path.exists(path):
        print(f"SKIP: {path} not found")
        return
    with open(path, 'rb') as f:
        data = f.read().strip()
    try:
        # Check if it looks like base64
        decoded = base64.b64decode(data)
        # If it decoded successfully and has suspicious content (untrusted comment), overwrite
        if b'untrusted comment' in decoded:
            with open(path, 'wb') as f:
                f.write(decoded)
            print(f"FIXED: {path}")
        else:
            print(f"NOT BASE64 (no comment): {path}")
    except Exception as e:
        print(f"FAIL: {path} - {e}")

fix_file('src-tauri/signing.key.pub')
fix_file('src-tauri/signing.key')
