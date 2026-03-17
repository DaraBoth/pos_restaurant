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
        include_str!("migrations/003_add_images_and_inventory.sql"),
        include_str!("migrations/004_restaurant_setup_and_minimal_seed.sql"),
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
    trim_legacy_seed_data(pool).await?;

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

async fn trim_legacy_seed_data(pool: &SqlitePool) -> anyhow::Result<()> {
    let order_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM orders")
        .fetch_one(pool)
        .await?;

    if order_count.0 > 0 {
        return Ok(());
    }

    let legacy_product_ids = [
        "prod-0000-0004",
        "prod-0000-0005",
        "prod-0000-0006",
        "prod-0000-0007",
        "prod-0000-0008",
        "prod-0000-0009",
        "prod-0000-0010",
        "prod-0000-0011",
        "prod-0000-0012",
    ];

    for product_id in legacy_product_ids {
        sqlx::query("UPDATE products SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?")
            .bind(product_id)
            .execute(pool)
            .await?;
    }

    let legacy_table_ids = [
        "tbl-004", "tbl-005", "tbl-006", "tbl-007", "tbl-008", "tbl-009", "tbl-010",
        "tbl-011", "tbl-012", "tbl-013", "tbl-014", "tbl-015", "tbl-016", "tbl-017",
        "tbl-018", "tbl-019", "tbl-020",
    ];

    for table_id in legacy_table_ids {
        sqlx::query("UPDATE floor_tables SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?")
            .bind(table_id)
            .execute(pool)
            .await?;
    }

    Ok(())
}
