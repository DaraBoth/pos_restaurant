#![allow(clippy::too_many_arguments)]

use libsql::{params, Connection};

pub const ROLE_SUPER_ADMIN: &str = "super_admin";
pub const ROLE_ADMIN: &str = "admin";
pub const ROLE_BUSINESS_ADMIN: &str = "business_admin";
pub const ROLE_CASHIER: &str = "cashier";

// Storage-compatible mapping: legacy DB values are preserved where required.
pub fn normalize_role_for_session(role: &str) -> String {
    match role.trim().to_lowercase().as_str() {
        ROLE_SUPER_ADMIN => ROLE_SUPER_ADMIN.to_string(),
        ROLE_ADMIN => ROLE_ADMIN.to_string(),
        "business_admin" | "manager" => ROLE_BUSINESS_ADMIN.to_string(),
        "cashier" | "waiter" | "chef" => ROLE_CASHIER.to_string(),
        _ => ROLE_CASHIER.to_string(),
    }
}

pub fn to_storage_role(role: &str) -> String {
    match normalize_role_for_session(role).as_str() {
        ROLE_BUSINESS_ADMIN => "manager".to_string(),
        ROLE_CASHIER => ROLE_CASHIER.to_string(),
        ROLE_ADMIN => ROLE_ADMIN.to_string(),
        ROLE_SUPER_ADMIN => ROLE_SUPER_ADMIN.to_string(),
        _ => ROLE_CASHIER.to_string(),
    }
}

pub fn can_delete(role: &str) -> bool {
    matches!(normalize_role_for_session(role).as_str(), ROLE_SUPER_ADMIN | ROLE_ADMIN)
}

pub async fn resolve_actor_role(
    conn: &Connection,
    actor_user_id: &str,
    restaurant_id: &str,
) -> Result<String, String> {
    let mut rows = conn
        .query(
            "SELECT role FROM users WHERE id = ? AND restaurant_id = ? AND is_deleted = 0",
            params![actor_user_id.to_string(), restaurant_id.to_string()],
        )
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let row = rows
        .next()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Actor user not found or deleted".to_string())?;

    let role = row.get::<String>(0).unwrap_or_else(|_| ROLE_CASHIER.to_string());
    Ok(normalize_role_for_session(&role))
}

pub async fn require_delete_permission(
    conn: &Connection,
    actor_user_id: &str,
    restaurant_id: &str,
) -> Result<String, String> {
    let actor_role = resolve_actor_role(conn, actor_user_id, restaurant_id).await?;
    if !can_delete(&actor_role) {
        return Err("Permission denied: only Super Admin and Admin may delete records".to_string());
    }
    Ok(actor_role)
}

pub async fn write_audit_log(
    conn: &Connection,
    restaurant_id: &str,
    actor_user_id: &str,
    actor_role: &str,
    action: &str,
    entity_type: &str,
    entity_id: &str,
    metadata_json: Option<String>,
) {
    let _ = conn
        .execute(
            "INSERT INTO app_audit_logs (id, restaurant_id, actor_user_id, actor_role, action, entity_type, entity_id, metadata_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
            params![
                uuid::Uuid::new_v4().to_string(),
                restaurant_id.to_string(),
                actor_user_id.to_string(),
                normalize_role_for_session(actor_role),
                action.to_string(),
                entity_type.to_string(),
                entity_id.to_string(),
                metadata_json.unwrap_or_default(),
            ],
        )
        .await;
}
