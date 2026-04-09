CREATE TABLE IF NOT EXISTS app_releases (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    release_notes TEXT,
    windows_file TEXT,
    windows_signature TEXT,
    mac_file TEXT,
    mac_signature TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO app_releases (id, version, release_notes, windows_file, windows_signature, mac_file, mac_signature, created_at)
VALUES (
    'initial-release-id-000000000001',
    '1.0.7',
    'Critical fix: restored broken database foreign keys that caused order placement errors.',
    'https://github.com/DaraBoth/pos_restaurant/releases/download/v1.0.2/DineOS_1.0.7_x64_en-US.msi',
    'dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVTQkJjdUdxTTU3aE43dFlVTkdiYmNUMnE0UFFteVRya1ZMRGZTakFzMXROcGNBOGFjdm5mZ1REL0RrZGtWSm9RN05IdnQraVJIVGZIOG1IQUhCanRpcm45MUZ1YWQwWWdFPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzc0NDUzNjkwCWZpbGU6RGluZU9TXzAuMS4xX3g2NF9lbi1VUy5tc2kKYkswaUcxLzE4czFQYjBqQ2Vod1Q5bjBSM2orK2IvQm1VMzdSTUtLOUhNTjVLTjJwbmxZWi96eXlvS2VrQ2RNK3Z1VVZuUzVCakYwaU5ZQXV4TTZMQ3c9PQo=',
    'https://github.com/DaraBoth/pos_restaurant/releases/download/v1.0.2/DineOS_1.0.7_aarch64.dmg',
    '',
    '2026-03-27T10:45:00'
);
