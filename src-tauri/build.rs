fn main() {
    // Track which keys were already emitted (from .env file)
    let mut found = std::collections::HashSet::new();

    // 1. Local dev: read .env file from project root (gitignored)
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let env_path = root.join(".env");
    if env_path.exists() {
        for line in std::fs::read_to_string(&env_path).unwrap_or_default().lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') { continue; }
            if let Some((key, val)) = line.split_once('=') {
                let key = key.trim();
                let val = val.trim().trim_matches('"').trim_matches('\'');
                if matches!(key, "DATABASE_URL" | "AUTH_TOKEN") {
                    println!("cargo:rustc-env={key}={val}");
                    println!("cargo:rerun-if-changed={}", env_path.display());
                    found.insert(key.to_string());
                }
            }
        }
    }

    // 2. CI/CD (GitHub Actions): secrets are injected as real environment variables.
    //    Only emit if not already provided by .env so local dev always wins.
    for key in ["DATABASE_URL", "AUTH_TOKEN"] {
        if !found.contains(key) {
            if let Ok(val) = std::env::var(key) {
                println!("cargo:rustc-env={key}={val}");
            }
        }
        // Tell cargo to re-run if these env vars change
        println!("cargo:rerun-if-env-changed={key}");
    }

    tauri_build::build()
}
