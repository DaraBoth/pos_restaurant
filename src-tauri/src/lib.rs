mod commands;
mod db;
mod models;
use db::RemoteDb;
use tauri::Manager;
use std::sync::Arc;

/// Tauri command: called from frontend after login to kick off the
/// per-restaurant sync daemon.  restaurant_id comes from the login response.
#[tauri::command]
async fn trigger_sync(
    restaurant_id: String,
    app_handle: tauri::AppHandle,
    local: tauri::State<'_, Arc<libsql::Connection>>,
    remote: tauri::State<'_, RemoteDb>,
) -> Result<(), String> {
    if let Some(remote_conn) = &remote.0 {
        let local_arc  = Arc::clone(&*local);
        let remote_arc = Arc::clone(remote_conn);
        db::start_sync_daemon(app_handle, local_arc, remote_arc, restaurant_id);
        Ok(())
    } else {
        // No remote — silently succeed (offline mode)
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .register_uri_scheme_protocol("asset", move |ctx, request| {
            let path = request.uri().path();
            // Remove leading slash if present
            let filename = path.trim_start_matches('/');
            
            let app_handle = ctx.app_handle();
            let app_dir = app_handle.path().app_data_dir().unwrap();
            let asset_path = app_dir.join("product-images").join(filename);

            if let Ok(content) = std::fs::read(&asset_path) {
                tauri::http::Response::builder()
                    .header("Access-Control-Allow-Origin", "*")
                    .body(content)
                    .unwrap()
            } else {
                // Try "logos" directory as fallback for restaurant logos
                let logo_path = app_dir.join("logos").join(filename);
                if let Ok(content) = std::fs::read(logo_path) {
                    tauri::http::Response::builder()
                        .header("Access-Control-Allow-Origin", "*")
                        .body(content)
                        .unwrap()
                } else {
                    tauri::http::Response::builder()
                        .status(404)
                        .body(Vec::new())
                        .unwrap()
                }
            }
        })
        .setup(move |app| {
            let app_handle = app.handle().clone();

            let app_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
            let db_path = app_dir.join("khpos.db");

            // Initialize both local and remote connections
            let (local_conn, remote_conn) = tauri::async_runtime::block_on(async {
                db::init_db(db_path, "khpos_secure_key_2024")
                    .await
                    .expect("Failed to initialize database")
            });

            // Seed the built-in super admin account if not present
            let pool_for_seed = Arc::clone(&local_conn);
            tauri::async_runtime::spawn(async move {
                commands::auth::seed_super_admin(&pool_for_seed).await;
            });

            // Register states — Arc<Connection> for all existing commands, RemoteDb for sync
            app_handle.manage(local_conn);
            app_handle.manage(RemoteDb(remote_conn));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            trigger_sync,
            db::sync::trigger_sync_reset,
            // Auth
            commands::auth::login,
            commands::auth::create_user,
            commands::auth::get_users,
            commands::auth::update_user,
            commands::auth::delete_user,
            commands::auth::list_all_restaurants,
            commands::auth::create_restaurant_with_admin,
            commands::auth::superadmin_create_restaurant_user,
            commands::auth::delete_restaurant,
            commands::auth::superadmin_update_admin,
            commands::auth::update_superadmin_profile,
            commands::auth::superadmin_get_all_users,
            commands::auth::superadmin_move_user,
            commands::restaurant::get_restaurant,
            commands::restaurant::get_setup_status,
            commands::restaurant::update_restaurant,
            commands::restaurant::update_restaurant_license,
            commands::restaurant::verify_restaurant_license,
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
            commands::orders::hold_order,
            commands::orders::void_order,
            commands::orders::get_revenue_summary,
            commands::orders::get_revenue_by_period,
            // Inventory
            commands::inventory::get_inventory_items,
            commands::inventory::create_inventory_item,
            commands::inventory::update_inventory_item,
            commands::inventory::delete_inventory_item,
            // Analytics
            commands::analytics::get_top_products,
            commands::analytics::get_revenue_by_category,
            commands::analytics::get_peak_hours,
            commands::analytics::get_slow_movers,
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
