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
      watched_episodes INTEGER DEFAULT 0,
      total_episodes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'watching',
      notes TEXT DEFAULT '',
      page_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── Migrations for existing databases (safe to run multiple times) ──────
  await database.execute(`ALTER TABLE favorites ADD COLUMN watched_episodes INTEGER DEFAULT 0`).catch(() => {});
  await database.execute(`ALTER TABLE favorites ADD COLUMN total_episodes INTEGER DEFAULT 0`).catch(() => {});
  await database.execute(`ALTER TABLE favorites ADD COLUMN status TEXT DEFAULT 'watching'`).catch(() => {});
  await database.execute(`ALTER TABLE favorites ADD COLUMN notes TEXT DEFAULT ''`).catch(() => {});

  // Unique index on page_url enables upsert (ON CONFLICT) for backup restore
  await database.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_page_url ON favorites(page_url)`
  ).catch(() => {});
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

export type WatchStatus =
  | "watching"
  | "completed"
  | "on-hold"
  | "dropped"
  | "plan-to-watch";

export interface DbFavorite {
  id: number;
  title: string;
  thumbnail: string;
  site_id: number | null;
  site_name: string;
  last_episode: string;
  watched_episodes: number;
  total_episodes: number;
  status: WatchStatus;
  notes: string;
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

/**
 * Upsert a favorite — if an entry with the same page_url already exists,
 * UPDATE it (replacing data) instead of creating a duplicate.
 * Falls back to title match if page_url is empty/generic.
 */
export async function upsertFavorite(
  title: string,
  thumbnail: string,
  siteId: number | null,
  siteName: string,
  lastEpisode: string,
  pageUrl: string,
  watchedEpisodes = 0,
  totalEpisodes = 0,
  status: WatchStatus = "watching",
  notes = ""
): Promise<number> {
  const database = await getDb();

  // Check for existing entry by page_url first, then by title
  const existing: { id: number }[] = await database.select(
    `SELECT id FROM favorites WHERE page_url = ? OR (page_url = '' AND title = ?) LIMIT 1`,
    [pageUrl, title]
  );

  if (existing.length > 0) {
    const id = existing[0].id;
    await database.execute(
      `UPDATE favorites SET
        title = ?,
        thumbnail = CASE WHEN ? != '' THEN ? ELSE thumbnail END,
        site_id = CASE WHEN ? IS NOT NULL THEN ? ELSE site_id END,
        site_name = CASE WHEN ? != '' THEN ? ELSE site_name END,
        last_episode = CASE WHEN ? != '' THEN ? ELSE last_episode END,
        watched_episodes = CASE WHEN ? > 0 THEN ? ELSE watched_episodes END,
        total_episodes = CASE WHEN ? > 0 THEN ? ELSE total_episodes END,
        status = CASE WHEN ? != 'watching' THEN ? ELSE status END,
        notes = CASE WHEN ? != '' THEN ? ELSE notes END,
        page_url = CASE WHEN ? != '' THEN ? ELSE page_url END
       WHERE id = ?`,
      [
        title,
        thumbnail, thumbnail,
        siteId, siteId,
        siteName, siteName,
        lastEpisode, lastEpisode,
        watchedEpisodes, watchedEpisodes,
        totalEpisodes, totalEpisodes,
        status, status,
        notes, notes,
        pageUrl, pageUrl,
        id,
      ]
    );
    return id;
  }

  // Not found — insert new
  const result = await database.execute(
    `INSERT INTO favorites
      (title, thumbnail, site_id, site_name, last_episode, page_url,
       watched_episodes, total_episodes, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, thumbnail, siteId, siteName, lastEpisode, pageUrl,
     watchedEpisodes, totalEpisodes, status, notes]
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

/** Update watch progress fields only */
export async function updateFavoriteProgress(
  id: number,
  watchedEpisodes: number,
  totalEpisodes: number,
  status: WatchStatus,
  lastEpisode: string,
  notes: string
): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE favorites SET
       watched_episodes = ?,
       total_episodes = ?,
       status = ?,
       last_episode = ?,
       notes = ?
     WHERE id = ?`,
    [watchedEpisodes, totalEpisodes, status, lastEpisode, notes, id]
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

/**
 * Upsert a custom site — if a site with the same name (case-insensitive) already exists,
 * merge its domains (add only new URLs that don't already exist).
 * If it doesn't exist, insert a brand-new custom site with all its domains.
 * Returns { isNew: boolean, siteId: number }
 */
export async function upsertCustomSite(
  name: string,
  icon: string,
  domains: { url: string; isActive: boolean }[]
): Promise<{ isNew: boolean; siteId: number }> {
  const database = await getDb();

  // Check if a custom site with the same name already exists (case-insensitive)
  const existing: { id: number }[] = await database.select(
    "SELECT id FROM sites WHERE LOWER(name) = LOWER(?) AND is_custom = 1 LIMIT 1",
    [name]
  );

  if (existing.length > 0) {
    const siteId = existing[0].id;

    // Get existing domain URLs for this site
    const existingDomains: { url: string }[] = await database.select(
      "SELECT url FROM domains WHERE site_id = ?",
      [siteId]
    );
    const existingUrls = new Set(existingDomains.map((d) => d.url.toLowerCase()));

    // Get current max position
    const posRows: { maxPos: number | null }[] = await database.select(
      "SELECT MAX(position) as maxPos FROM domains WHERE site_id = ?",
      [siteId]
    );
    let nextPos = (posRows[0]?.maxPos ?? -1) + 1;

    // Insert only domains that don't already exist
    let addedCount = 0;
    for (const domain of domains) {
      if (!existingUrls.has(domain.url.toLowerCase())) {
        await database.execute(
          "INSERT INTO domains (site_id, url, is_active, position) VALUES (?, ?, ?, ?)",
          [siteId, domain.url, domain.isActive ? 1 : 0, nextPos]
        );
        nextPos++;
        addedCount++;
      }
    }

    // Update icon if provided and different
    if (icon) {
      await database.execute("UPDATE sites SET icon = ? WHERE id = ?", [icon, siteId]);
    }

    return { isNew: false, siteId };
  }

  // Not found — insert new custom site
  const siteId = await insertSite(name, icon, true, domains);
  return { isNew: true, siteId };
}
