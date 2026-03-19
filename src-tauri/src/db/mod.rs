use sqlx::{SqlitePool, sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions}};
use std::path::PathBuf;

pub async fn init_db(db_path: PathBuf, _key: &str) -> anyhow::Result<SqlitePool> {
    // Build per-connection options: WAL mode + foreign keys enabled on every connection
    let opts = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true);

    // Pre-create all 5 connections eagerly (min = max) so there is zero
    // pool cold-start latency when management pages fire concurrent IPC calls.
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .min_connections(5)
        .connect_with(opts)
        .await?;

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
        include_str!("migrations/005_add_restaurant_logo.sql"),
        include_str!("migrations/006_recalculate_existing_orders.sql"),
        include_str!("migrations/007_kitchen_and_tables.sql"),
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
