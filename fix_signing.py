import json
import os

with open('src-tauri/signing.key.pub', 'r') as f:
    pub_lines = f.read().splitlines()
    pub = pub_lines[1]

with open('src-tauri/signing.key', 'r') as f:
    priv = f.read()

with open('src-tauri/tauri.conf.json', 'r') as f:
    config = json.load(f)

config['plugins']['updater']['pubkey'] = pub

with open('src-tauri/tauri.conf.json', 'w') as f:
    json.dump(config, f, indent=4)

# Update .env
env_path = '.env'
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        lines = f.readlines()
    
    found = False
    new_lines = []
    escaped_priv = priv.replace('\n', '\\n')
    
    for line in lines:
        if line.startswith('TAURI_SIGNING_PRIVATE_KEY='):
            new_lines.append(f'TAURI_SIGNING_PRIVATE_KEY=\"{escaped_priv}\"\n')
            found = True
        else:
            new_lines.append(line)
    
    if not found:
        new_lines.append(f'\nTAURI_SIGNING_PRIVATE_KEY=\"{escaped_priv}\"\n')
        new_lines.append('TAURI_SIGNING_PRIVATE_KEY_PASSWORD=\"\"\n')
        
    with open(env_path, 'w') as f:
        f.writelines(new_lines)

print(f"DONE: pubkey is now {pub}")
