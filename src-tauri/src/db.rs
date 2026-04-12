/// Database initialization SQL for AniHub.
/// Called from the frontend via tauri-plugin-sql after connecting.
pub const INIT_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '',
    is_custom BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 0,
    position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    thumbnail TEXT DEFAULT '',
    site_id INTEGER REFERENCES sites(id),
    site_name TEXT DEFAULT '',
    last_episode TEXT DEFAULT '',
    page_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
"#;

#[tauri::command]
pub fn get_init_sql() -> String {
    INIT_SQL.to_string()
}
