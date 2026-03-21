mod commands;
mod db;
mod models;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
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
            // Seed the built-in super admin account if not present
            let pool_for_seed = std::sync::Arc::clone(&pool);
            tauri::async_runtime::spawn(async move {
                commands::auth::seed_super_admin(&pool_for_seed).await;
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
            commands::auth::list_all_restaurants,
            commands::auth::create_restaurant_with_admin,
            commands::restaurant::get_restaurant,
            commands::restaurant::get_setup_status,
            commands::restaurant::update_restaurant,
            commands::restaurant::save_logo,
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
            commands::products::save_product_image,
            // Orders
            commands::orders::create_order,
            commands::orders::add_order_item,
            commands::orders::update_order_item_quantity,
            commands::orders::update_order_item_note,
            commands::orders::get_order_items,
            commands::orders::get_orders,
            commands::orders::get_active_order_for_table,
            commands::orders::get_orders_for_table,
            commands::orders::get_session_rounds,
            commands::orders::add_round,
            commands::orders::checkout_order,
            commands::orders::checkout_session,
            
            // Inventory
            commands::inventory::get_inventory_items,
            commands::inventory::create_inventory_item,
            commands::inventory::update_inventory_item,
            commands::inventory::delete_inventory_item,
            commands::inventory::get_product_ingredients,
            commands::inventory::set_product_ingredient,
            commands::inventory::remove_product_ingredient,
            
            // Analytics
            commands::analytics::get_top_products,
            commands::analytics::get_revenue_by_category,
            commands::analytics::get_peak_hours,
            commands::analytics::get_slow_movers,

            commands::orders::hold_order,
            commands::orders::void_order,
            commands::orders::get_revenue_summary,
            commands::orders::get_revenue_by_period,
            // Exchange Rates & DB
            commands::exchange::get_exchange_rate,
            commands::exchange::set_exchange_rate,
            commands::exchange::get_db_status,
            commands::exchange::get_payments_for_order,
            // Tables
            commands::tables::get_tables,
            commands::tables::create_table,
            commands::tables::delete_table,
            // Kitchen
            commands::kitchen::get_kitchen_orders,
            commands::kitchen::update_kitchen_item_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
