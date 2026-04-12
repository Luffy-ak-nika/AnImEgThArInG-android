mod commands;
mod db;

use commands::aniyomi::import_aniyomi_backup;
use commands::proxy::{get_proxy_url, fetch_universal_proxy, auto_detect_proxy};
use commands::search::search_anime;
use commands::webview::{
    check_domain, close_webview, focus_webview, list_open_webviews, navigate_webview,
    navigate_back_webview, navigate_forward_webview, open_site_webview,
};
use db::get_init_sql;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            open_site_webview,
            close_webview,
            focus_webview,
            navigate_webview,
            navigate_back_webview,
            navigate_forward_webview,
            list_open_webviews,
            check_domain,
            get_proxy_url,
            fetch_universal_proxy,
            auto_detect_proxy,
            import_aniyomi_backup,
            get_init_sql,
            search_anime,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AnImEgThArInG");
}
