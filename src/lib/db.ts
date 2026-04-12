import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:animegtharing.db");
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = await getDb();

  // Enable WAL mode for better concurrent performance
  await database.execute("PRAGMA journal_mode=WAL");

  await database.execute(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '',
      is_custom BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 0,
      position INTEGER DEFAULT 0
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      thumbnail TEXT DEFAULT '',
      site_id INTEGER,
      site_name TEXT DEFAULT '',
      last_episode TEXT DEFAULT '',
      page_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// ===== Sites =====

export interface DbSite {
  id: number;
  name: string;
  icon: string;
  is_custom: number;
}

export interface DbDomain {
  id: number;
  site_id: number;
  url: string;
  is_active: number;
  position: number;
}

export interface DbFavorite {
  id: number;
  title: string;
  thumbnail: string;
  site_id: number | null;
  site_name: string;
  last_episode: string;
  page_url: string;
  created_at: string;
}

export async function getAllSites(): Promise<DbSite[]> {
  const database = await getDb();
  return database.select("SELECT * FROM sites ORDER BY is_custom ASC, id ASC");
}

export async function getSiteDomains(siteId: number): Promise<DbDomain[]> {
  const database = await getDb();
  return database.select(
    "SELECT * FROM domains WHERE site_id = ? ORDER BY position ASC",
    [siteId]
  );
}

export async function getActiveDomain(siteId: number): Promise<string> {
  const database = await getDb();
  const rows: DbDomain[] = await database.select(
    "SELECT url FROM domains WHERE site_id = ? AND is_active = 1 LIMIT 1",
    [siteId]
  );
  if (rows.length > 0) return rows[0].url;
  const fallback: DbDomain[] = await database.select(
    "SELECT url FROM domains WHERE site_id = ? ORDER BY position ASC LIMIT 1",
    [siteId]
  );
  return fallback.length > 0 ? fallback[0].url : "";
}

export async function insertSite(
  name: string,
  icon: string,
  isCustom: boolean,
  domains: { url: string; isActive: boolean }[]
): Promise<number> {
  const database = await getDb();
  const result = await database.execute(
    "INSERT INTO sites (name, icon, is_custom) VALUES (?, ?, ?)",
    [name, icon, isCustom ? 1 : 0]
  );
  const siteId = result.lastInsertId;

  for (let i = 0; i < domains.length; i++) {
    await database.execute(
      "INSERT INTO domains (site_id, url, is_active, position) VALUES (?, ?, ?, ?)",
      [siteId, domains[i].url, domains[i].isActive ? 1 : 0, i]
    );
  }

  return siteId ?? 0;
}

export async function updateSiteDomains(
  siteId: number,
  domains: { url: string; isActive: boolean }[]
): Promise<void> {
  const database = await getDb();
  await database.execute("DELETE FROM domains WHERE site_id = ?", [siteId]);
  for (let i = 0; i < domains.length; i++) {
    await database.execute(
      "INSERT INTO domains (site_id, url, is_active, position) VALUES (?, ?, ?, ?)",
      [siteId, domains[i].url, domains[i].isActive ? 1 : 0, i]
    );
  }
}

export async function setActiveDomain(
  siteId: number,
  domainUrl: string
): Promise<void> {
  const database = await getDb();
  await database.execute(
    "UPDATE domains SET is_active = 0 WHERE site_id = ?",
    [siteId]
  );
  await database.execute(
    "UPDATE domains SET is_active = 1 WHERE site_id = ? AND url = ?",
    [siteId, domainUrl]
  );
}

export async function deleteSite(siteId: number): Promise<void> {
  const database = await getDb();
  await database.execute("DELETE FROM domains WHERE site_id = ?", [siteId]);
  await database.execute("DELETE FROM favorites WHERE site_id = ?", [siteId]);
  await database.execute("DELETE FROM sites WHERE id = ?", [siteId]);
}

// ===== Favorites =====

export async function getAllFavorites(): Promise<DbFavorite[]> {
  const database = await getDb();
  return database.select(
    "SELECT * FROM favorites ORDER BY created_at DESC"
  );
}

export async function addFavorite(
  title: string,
  thumbnail: string,
  siteId: number | null,
  siteName: string,
  lastEpisode: string,
  pageUrl: string
): Promise<number> {
  const database = await getDb();
  const result = await database.execute(
    "INSERT INTO favorites (title, thumbnail, site_id, site_name, last_episode, page_url) VALUES (?, ?, ?, ?, ?, ?)",
    [title, thumbnail, siteId, siteName, lastEpisode, pageUrl]
  );
  return result.lastInsertId ?? 0;
}

export async function updateFavorite(
  id: number,
  lastEpisode: string,
  pageUrl: string
): Promise<void> {
  const database = await getDb();
  await database.execute(
    "UPDATE favorites SET last_episode = ?, page_url = ? WHERE id = ?",
    [lastEpisode, pageUrl, id]
  );
}

export async function removeFavorite(id: number): Promise<void> {
  const database = await getDb();
  await database.execute("DELETE FROM favorites WHERE id = ?", [id]);
}

export async function siteCount(): Promise<number> {
  const database = await getDb();
  const rows: { count: number }[] = await database.select(
    "SELECT COUNT(*) as count FROM sites"
  );
  return rows[0]?.count ?? 0;
}
