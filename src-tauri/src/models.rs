use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub restaurant_id: Option<String>,
    pub username: String,
    pub password_hash: String,
    pub role: String,
    pub full_name: Option<String>,
    pub khmer_name: Option<String>,
    pub is_deleted: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSession {
    pub id: String,
    pub username: String,
    pub role: String,
    pub full_name: Option<String>,
    pub khmer_name: Option<String>,
    pub restaurant_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestaurantSummary {
    pub id: String,
    pub name: String,
    pub khmer_name: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub license_expires_at: Option<String>,
    pub license_support_contact: Option<String>,
    pub created_at: String,
    pub admin_id: Option<String>,
    pub admin_username: Option<String>,
    pub admin_full_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub khmer_name: Option<String>,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductIngredient {
    pub id: String,
    pub product_id: String,
    pub inventory_item_id: String,
    pub usage_quantity: f64,
    pub inventory_item_name: Option<String>,
    pub inventory_item_unit: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    pub category_id: Option<String>,
    pub name: String,
    pub khmer_name: Option<String>,
    pub price_cents: i64,
    pub is_available: i64,
    pub image_path: Option<String>,
    pub category_name: Option<String>,
    pub category_khmer: Option<String>,
    pub ingredients: Vec<ProductIngredient>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloorTable {
    pub id: String,
    pub name: String,
    pub status: String,
    pub seat_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Restaurant {
    pub id: String,
    pub name: String,
    pub khmer_name: Option<String>,
    pub tin: Option<String>,
    pub address: Option<String>,
    pub address_kh: Option<String>,
    pub phone: Option<String>,
    pub website: Option<String>,
    pub vat_number: Option<String>,
    pub receipt_footer: Option<String>,
    pub logo_path: Option<String>,
    pub license_expires_at: Option<String>,
    pub license_support_contact: Option<String>,
    pub is_deleted: i64,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestaurantLicenseStatus {
    pub restaurant_id: String,
    pub restaurant_name: Option<String>,
    pub license_expires_at: Option<String>,
    pub license_support_contact: Option<String>,
    pub checked_online: bool,
    pub is_expired: bool,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestaurantUpsertInput {
    pub name: String,
    pub khmer_name: Option<String>,
    pub tin: Option<String>,
    pub address: Option<String>,
    pub address_kh: Option<String>,
    pub phone: Option<String>,
    pub website: Option<String>,
    pub vat_number: Option<String>,
    pub receipt_footer: Option<String>,
    pub logo_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupStatus {
    pub needs_restaurant_setup: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub user_id: Option<String>,
    pub table_id: Option<String>,
    pub session_id: Option<String>,
    pub round_number: i64,
    pub status: String,
    pub total_usd: i64,
    pub total_khr: i64,
    pub tax_vat: i64,
    pub tax_plt: i64,
    pub bakong_bill_number: Option<String>,
    pub notes: Option<String>,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct TableSession {
    pub id: String,
    pub table_id: Option<String>,
    pub status: String,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderItem {
    pub id: String,
    pub order_id: String,
    pub product_id: String,
    pub quantity: i64,
    pub price_at_order: i64,
    pub note: Option<String>,
    pub kitchen_status: String,
    pub product_name: Option<String>,
    pub product_khmer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KitchenOrderItem {
    pub id: String,
    pub product_name: String,
    pub product_khmer: Option<String>,
    pub quantity: i64,
    pub note: Option<String>,
    pub kitchen_status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KitchenOrder {
    pub order_id: String,
    pub table_id: Option<String>,
    pub created_at: String,
    pub items: Vec<KitchenOrderItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: String,
    pub order_id: String,
    pub method: String,
    pub currency: String,
    pub amount: i64,
    pub bakong_transaction_hash: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeRate {
    pub id: String,
    pub rate: f64,
    pub effective_from: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentInput {
    pub method: String,  // "cash", "khqr", "card"
    pub currency: String, // "USD", "KHR"
    pub amount: i64,
    pub bakong_transaction_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbStatus {
    pub connected: bool,
    pub path: String,
    pub mode: String, // "local" or "synced"
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryItem {
    pub id: String,
    pub name: String,
    pub khmer_name: Option<String>,
    pub unit_label: String,
    pub stock_qty: f64,
    pub stock_pct: f64,
    pub min_stock_qty: f64,
    pub cost_per_unit: f64,
    pub created_at: String,
}

