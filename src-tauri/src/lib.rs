mod commands;
mod db;
mod models;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Determine database path in app data directory
            let app_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
            let db_path = app_dir.join("khpos.db");

            // Initialize DB synchronously via blocking spawn
            let pool = tauri::async_runtime::block_on(async {
                db::init_db(db_path, "khpos_secure_key_2024")
                    .await
                    .expect("Failed to initialize database")
            });

            app_handle.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth::login,
            commands::auth::create_user,
            commands::auth::get_users,
            commands::auth::update_user,
            commands::auth::delete_user,
            commands::restaurant::get_restaurant,
            commands::restaurant::get_setup_status,
            commands::restaurant::update_restaurant,
            // Products & Categories
            commands::products::get_categories,
            commands::products::get_products,
            commands::products::get_inventory_logs,
            commands::products::create_product,
            commands::products::update_product,
            commands::products::update_stock,
            commands::products::delete_product,
            commands::products::create_category,
            commands::products::update_category,
            commands::products::delete_category,
            // Orders
            commands::orders::create_order,
            commands::orders::add_order_item,
            commands::orders::update_order_item_quantity,
            commands::orders::get_order_items,
            commands::orders::get_orders,
            commands::orders::get_active_order_for_table,
            commands::orders::get_orders_for_table,
            commands::orders::checkout_order,
            commands::orders::void_order,
            // Exchange Rates & DB
            commands::exchange::get_exchange_rate,
            commands::exchange::set_exchange_rate,
            commands::exchange::get_db_status,
            commands::exchange::get_payments_for_order,
            // Tables
            commands::tables::get_tables,
            commands::tables::create_table,
            commands::tables::delete_table,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
