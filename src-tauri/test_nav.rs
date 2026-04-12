use tauri::webview::WebviewWindowBuilder;
fn test() {
    // Just a dummy to check if on_navigation exists and accepts bool
    let _ = WebviewWindowBuilder::new(todo!(), "l", todo!()).on_navigation(|url| true);
}
