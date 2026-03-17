use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};
use std::path::PathBuf;

pub async fn init_db(db_path: PathBuf, key: &str) -> anyhow::Result<SqlitePool> {
    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Enable WAL mode for better concurrency
    sqlx::query("PRAGMA journal_mode=WAL;").execute(&pool).await?;
    // Encrypt with key (SQLite SEE / SQLCipher compatible pragma)
    if !key.is_empty() {
        let pragma = format!("PRAGMA key = '{}';", key.replace('\'', "''"));
        sqlx::query(&pragma).execute(&pool).await?;
    }
    // Enable foreign key constraints
    sqlx::query("PRAGMA foreign_keys = ON;").execute(&pool).await?;

    // Run embedded migrations
    run_migrations(&pool).await?;

    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> anyhow::Result<()> {
    let migrations = [
        include_str!("migrations/001_initial_schema.sql"),
        include_str!("migrations/002_add_features.sql"),
    ];

    for migration_sql in migrations {
        // Split on semicolons and execute each statement
        for stmt in migration_sql.split(';') {
            let trimmed = stmt.trim();
            if !trimmed.is_empty() {
                // Ignore errors for things like adding columns that already exist
                let _ = sqlx::query(trimmed).execute(pool).await;
            }
        }
    }

    // Ensure default admin user exists
    ensure_default_admin(pool).await?;

    Ok(())
}

async fn ensure_default_admin(pool: &SqlitePool) -> anyhow::Result<()> {
    use argon2::{Argon2, PasswordHasher};
    use argon2::password_hash::{SaltString, rand_core::OsRng};

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE username = 'admin'")
        .fetch_one(pool)
        .await?;

    if count.0 == 0 {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(b"admin123", &salt)
            .map_err(|e| anyhow::anyhow!("Argon2 error: {}", e))?
            .to_string();

        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT OR IGNORE INTO users (id, restaurant_id, username, password_hash, role, full_name, khmer_name)
             VALUES (?, 'rest-00000000-0000-0000-0000-000000000001', 'admin', ?, 'admin', 'Administrator', 'អ្នកគ្រប់គ្រង')"
        )
        .bind(&id)
        .bind(&password_hash)
        .execute(pool)
        .await?;
    }

    Ok(())
}
