import {
  X,
  CheckCircle2,
  AlertCircle,
  Download,
  PackageOpen,
  FileDown,
  FolderOpen,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import type { WatchStatus } from "@/lib/db";

interface AniyomiEntry {
  title: string;
  url: string;
  thumbnail: string;
  source: string;
}

interface Props {
  onClose: () => void;
}

type ActiveTab = "import" | "export";

// ── Draggable bottom-sheet hook ─────────────────────────────────────────────
function useDragSheet(onDismiss: () => void) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Only start drag from the handle area (top 48px of the sheet)
    const touch = e.touches[0];
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (touch.clientY - rect.top > 56) return; // Only handle area
    startY.current = touch.clientY;
    currentY.current = touch.clientY;
    setIsDragging(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    // Only allow dragging DOWN (positive offset)
    setDragOffset(Math.max(0, diff));
  }, [isDragging]);

  const onTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    // If dragged more than 120px down → dismiss
    if (dragOffset > 120) {
      onDismiss();
    }
    setDragOffset(0);
  }, [isDragging, dragOffset, onDismiss]);

  return { dragOffset, isDragging, onTouchStart, onTouchMove, onTouchEnd };
}

export default function BackupDialog({ onClose }: Props) {
  const { upsertToFavorites, importCustomSite, refreshFavorites, favorites, sites } = useApp();
  const [activeTab, setActiveTab] = useState<ActiveTab>("import");
  const { dragOffset, isDragging, onTouchStart, onTouchMove, onTouchEnd } = useDragSheet(onClose);

  // ─── Import state ───
  const [importStatus, setImportStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [importMessage, setImportMessage] = useState("");
  const [importedCount, setImportedCount] = useState(0);

  // ─── Export state ───
  const [exportStatus, setExportStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [exportMessage, setExportMessage] = useState("");

  // ──────────────────────────────────────────────────────────────────────────
  // IMPORT — Android-safe approach
  // ──────────────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    try {
      const filePath = await open({
        title: "Select Backup File (.anihub, .json, .tachibk, .gz)",
        multiple: false,
      });

      if (!filePath) return;

      setImportStatus("loading");
      setImportMessage("Reading backup file...");

      const fp = filePath as string;

      let textContent: string | null = null;
      try {
        textContent = await readTextFile(fp);
      } catch {
        textContent = null;
      }

      if (textContent !== null) {
        let jsonData: Record<string, unknown> | null = null;
        try {
          jsonData = JSON.parse(textContent);
        } catch {
          jsonData = null;
        }

        if (jsonData !== null) {
          // AnImEgThArInG own backup
          if (
            jsonData.app === "AnImEgThArInG" ||
            (Array.isArray(jsonData.favorites) && jsonData.favorites.length >= 0)
          ) {
            await importAnihubFromContent(jsonData);
            return;
          }

          // Aniyomi / Tachiyomi JSON backup
          if (Array.isArray(jsonData.backupManga) || Array.isArray((jsonData as Record<string, unknown>).backupAnime)) {
            const manga = (jsonData.backupManga as Record<string, unknown>[] | undefined) ?? [];
            const anime = ((jsonData as Record<string, unknown>).backupAnime as Record<string, unknown>[] | undefined) ?? [];
            const allEntries = [...manga, ...anime];
            await importAniyomiEntries(
              allEntries.map((m) => ({
                title: String(m.title ?? ""),
                url: String(m.url ?? ""),
                thumbnail: String(m.thumbnailUrl ?? ""),
                source: String(m.source ?? "Unknown"),
              })).filter((e) => e.title)
            );
            return;
          }

          setImportStatus("error");
          setImportMessage(
            "File is valid JSON but not a recognised backup format.\n" +
            "Expected an .anihub backup or an Aniyomi JSON backup."
          );
          return;
        }
      }

      // Binary file (proto.gz, tachibk)
      setImportMessage("Detected binary backup — parsing with Rust...");
      try {
        const entries: AniyomiEntry[] = await invoke("import_aniyomi_backup", {
          filePath: fp,
        });
        await importAniyomiEntries(entries);
      } catch (rustErr) {
        setImportStatus("error");
        setImportMessage(
          `Could not read this file on Android.\n` +
          `Please use an .anihub backup (created with "Create Backup") or a JSON-format Aniyomi backup.\n\nDetail: ${rustErr}`
        );
      }
    } catch (err) {
      setImportStatus("error");
      setImportMessage(`Import failed: ${err}`);
    }
  };

  // ── Import helpers ──────────────────────────────────────────────────────────
  const importAnihubFromContent = async (data: Record<string, unknown>) => {
    let newFavs = 0;
    let updatedFavs = 0;
    let newSites = 0;
    let updatedSites = 0;

    // ── 1. Restore Favorites (all 10 fields) ────────────────────────────────
    const favList = Array.isArray(data.favorites)
      ? (data.favorites as Record<string, unknown>[])
      : [];

    if (favList.length > 0) {
      setImportMessage(`Restoring ${favList.length} favorites...`);

      for (const fav of favList) {
        try {
          const existing = favorites.find(
            (f) =>
              f.page_url === String(fav.page_url ?? "") ||
              f.title === String(fav.title ?? "")
          );
          await upsertToFavorites(
            String(fav.title ?? ""),
            String(fav.thumbnail ?? ""),
            (fav.site_id as number) || null,
            String(fav.site_name ?? ""),
            String(fav.last_episode ?? ""),
            String(fav.page_url ?? ""),
            (fav.watched_episodes as number) || 0,
            (fav.total_episodes as number) || 0,
            (fav.status as WatchStatus) || "watching",
            String(fav.notes ?? "")
          );
          if (existing) updatedFavs++;
          else newFavs++;
        } catch {
          // skip individual failures
        }
      }
    }

    // ── 2. Restore Custom Sites + Domains ────────────────────────────────────
    const siteList = Array.isArray(data.customSites)
      ? (data.customSites as Record<string, unknown>[])
      : [];

    if (siteList.length > 0) {
      setImportMessage(`Restoring ${siteList.length} custom sites...`);

      for (const site of siteList) {
        try {
          const domains = Array.isArray(site.domains)
            ? (site.domains as { url: string; isActive: boolean }[]).map((d) => ({
                url: String(d.url ?? ""),
                isActive: Boolean(d.isActive),
              }))
            : [];

          const result = await importCustomSite(
            String(site.name ?? ""),
            String(site.icon ?? ""),
            domains
          );
          if (result.isNew) newSites++;
          else updatedSites++;
        } catch {
          // skip individual failures
        }
      }
    }

    const totalCount = newFavs + updatedFavs;
    setImportedCount(totalCount);
    setImportStatus("success");

    // Build descriptive message
    const parts: string[] = [];
    if (newFavs > 0) parts.push(`${newFavs} new favorites`);
    if (updatedFavs > 0) parts.push(`${updatedFavs} updated favorites`);
    if (newSites > 0) parts.push(`${newSites} new sites`);
    if (updatedSites > 0) parts.push(`${updatedSites} merged sites`);
    setImportMessage(parts.length > 0 ? `Restored: ${parts.join(" · ")}` : "Nothing to restore.");
    await refreshFavorites();
  };

  const importAniyomiEntries = async (entries: AniyomiEntry[]) => {
    if (entries.length === 0) {
      setImportStatus("error");
      setImportMessage("No anime entries found in the backup file.");
      return;
    }

    setImportMessage(`Found ${entries.length} entries. Importing...`);
    let imported = 0;
    let replaced = 0;

    for (const entry of entries) {
      try {
        const existing = favorites.find((f) => f.title === entry.title);
        await upsertToFavorites(
          entry.title,
          entry.thumbnail,
          0,
          entry.source,
          "",
          entry.url || `Imported: ${entry.title}`
        );
        if (existing) replaced++;
        else imported++;
      } catch {
        // skip
      }
    }

    setImportedCount(imported + replaced);
    setImportStatus("success");
    setImportMessage(`Imported ${imported} new · ${replaced} updated!`);
    await refreshFavorites();
  };

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      setExportStatus("loading");
      setExportMessage("Preparing backup...");

      const customSites = sites.filter((s) => s.is_custom === 1);
      const backupData = {
        version: "1.0",
        app: "AnImEgThArInG",
        exportedAt: new Date().toISOString(),
        favorites: favorites.map((f) => ({
          title: f.title,
          thumbnail: f.thumbnail,
          site_id: f.site_id,
          site_name: f.site_name,
          last_episode: f.last_episode,
          page_url: f.page_url,
          watched_episodes: f.watched_episodes,
          total_episodes: f.total_episodes,
          status: f.status,
          notes: f.notes,
        })),
        customSites: customSites.map((s) => ({
          name: s.name,
          icon: s.icon,
          domains: s.domains.map((d) => ({
            url: d.url,
            isActive: d.is_active === 1,
          })),
        })),
        stats: {
          totalFavorites: favorites.length,
          totalCustomSites: customSites.length,
        },
      };

      const json = JSON.stringify(backupData, null, 2);
      const today = new Date().toISOString().split("T")[0];

      const savePath = await save({
        title: "Save AnImEgThArInG Backup",
        defaultPath: `AnImEgThArInG-backup-${today}.anihub`,
        filters: [{ name: "AnImEgThArInG Backup", extensions: ["anihub"] }],
      });

      if (!savePath) {
        setExportStatus("idle");
        return;
      }

      await writeTextFile(savePath, json);
      setExportStatus("success");
      setExportMessage(
        `Backup saved!\n${favorites.length} favorites + ${customSites.length} custom sites exported.`
      );
    } catch (err) {
      setExportStatus("error");
      setExportMessage(`Export failed: ${err}`);
    }
  };

  // ── Tab button style helper ─────────────────────────────────────────────────
  const tabBtn = (tab: ActiveTab) => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "11px 0",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: activeTab === tab ? 600 : 400,
    background:
      activeTab === tab
        ? tab === "import"
          ? "rgba(168,85,247,0.15)"
          : "rgba(99,102,241,0.15)"
        : "transparent",
    color:
      activeTab === tab
        ? tab === "import"
          ? "#a855f7"
          : "#818cf8"
        : "var(--color-text-muted)",
    transition: "all 0.15s",
    WebkitTapHighlightColor: "transparent",
  } as React.CSSProperties);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9000,
          background: `rgba(0,0,0,${Math.max(0.1, 0.55 - dragOffset / 600)})`,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          transition: isDragging ? "none" : "background 0.3s",
        }}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9001,
          borderRadius: "24px 24px 0 0",
          background: "var(--color-bg-secondary)",
          borderTop: "1px solid rgba(148,163,184,0.12)",
          maxHeight: "88dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          animation: isDragging ? "none" : "slideUpSheet 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 12,
            paddingBottom: 8,
            flexShrink: 0,
            cursor: "grab",
          }}
        >
          <div style={{ width: 40, height: 5, borderRadius: 3, background: "rgba(148,163,184,0.35)" }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "var(--color-text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <PackageOpen size={20} color="#a855f7" />
            Backup &amp; Restore
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "none",
              background: "var(--color-bg-hover)",
              color: "var(--color-text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            gap: 6,
            margin: "0 20px 16px",
            background: "rgba(0,0,0,0.2)",
            borderRadius: 12,
            padding: 4,
            flexShrink: 0,
          }}
        >
          <button style={tabBtn("import")} onClick={() => { setActiveTab("import"); setImportStatus("idle"); }}>
            <FolderOpen size={15} /> Import / Restore
          </button>
          <button style={tabBtn("export")} onClick={() => { setActiveTab("export"); setExportStatus("idle"); }}>
            <FileDown size={15} /> Create Backup
          </button>
        </div>

        {/* ── Scrollable content body ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 20px 24px",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          {/* ═══ IMPORT ═══ */}
          {activeTab === "import" && (
            <>
              {importStatus === "idle" && (
                <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      background: "rgba(168,85,247,0.1)",
                      border: "1.5px solid rgba(168,85,247,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 14px",
                    }}
                  >
                    <FolderOpen size={32} color="#a855f7" />
                  </div>

                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 6 }}>
                    Choose a backup file
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>
                    Supported formats:
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, marginBottom: 8 }}>
                    {[".anihub ✓", ".tachibk", ".proto.gz", ".json"].map((ext) => (
                      <code
                        key={ext}
                        style={{
                          background: ext.includes("✓") ? "rgba(168,85,247,0.15)" : "var(--color-bg-hover)",
                          color: ext.includes("✓") ? "#a855f7" : "var(--color-text-muted)",
                          padding: "3px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: ext.includes("✓") ? 600 : 400,
                        }}
                      >
                        {ext}
                      </code>
                    ))}
                  </div>

                  {/* Info: restores favorites AND sites */}
                  <div
                    style={{
                      background: "rgba(168,85,247,0.06)",
                      border: "1px solid rgba(168,85,247,0.15)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      marginBottom: 12,
                      textAlign: "left",
                    }}
                  >
                    <p style={{ fontSize: 11, color: "#c084fc", lineHeight: 1.5 }}>
                      ✅ Restores <strong>favorites</strong> (with episode progress, status, notes) + <strong>custom sites &amp; domains</strong>. Duplicates are automatically merged.
                    </p>
                  </div>

                  {/* Android tip */}
                  <div
                    style={{
                      background: "rgba(245,158,11,0.08)",
                      border: "1px solid rgba(245,158,11,0.2)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      marginBottom: 18,
                      textAlign: "left",
                    }}
                  >
                    <p style={{ fontSize: 11, color: "#fbbf24", lineHeight: 1.5 }}>
                      📱 <strong>Android tip:</strong> The file picker shows ALL files. Navigate to your Downloads folder and pick your <code>.anihub</code> backup file.
                    </p>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={handleImport}
                    style={{ width: "100%", padding: "16px", fontSize: 15, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
                  >
                    <FolderOpen size={20} />
                    Browse &amp; Select File
                  </button>
                </div>
              )}

              {importStatus === "loading" && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      border: "3px solid rgba(168,85,247,0.2)",
                      borderTopColor: "#a855f7",
                      animation: "spin 0.8s linear infinite",
                      margin: "0 auto 16px",
                    }}
                  />
                  <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>{importMessage}</p>
                </div>
              )}

              {importStatus === "success" && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <CheckCircle2 size={52} color="#4ade80" style={{ margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#4ade80", marginBottom: 6 }}>
                    Done! {importedCount} entries restored
                  </p>
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 20, whiteSpace: "pre-line" }}>
                    {importMessage}
                  </p>
                  <button
                    className="btn-primary"
                    onClick={onClose}
                    style={{ width: "100%", padding: "14px", fontSize: 14, borderRadius: 12 }}
                  >
                    Done
                  </button>
                </div>
              )}

              {importStatus === "error" && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <AlertCircle size={52} color="#f87171" style={{ margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 13, color: "#f87171", marginBottom: 20, whiteSpace: "pre-line", lineHeight: 1.5 }}>
                    {importMessage}
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="btn-ghost"
                      onClick={onClose}
                      style={{ flex: 1, padding: "14px", fontSize: 14 }}
                    >
                      Close
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => { setImportStatus("idle"); setImportMessage(""); }}
                      style={{ flex: 1, padding: "14px", fontSize: 14 }}
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══ EXPORT ═══ */}
          {activeTab === "export" && (
            <>
              {exportStatus === "idle" && (
                <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      background: "rgba(99,102,241,0.1)",
                      border: "1.5px solid rgba(99,102,241,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 14px",
                    }}
                  >
                    <Download size={32} color="#818cf8" />
                  </div>

                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 14 }}>
                    Create Full Backup
                  </h3>

                  <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 16 }}>
                    <div>
                      <p style={{ fontSize: 28, fontWeight: 800, color: "#a855f7" }}>{favorites.length}</p>
                      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Favorites</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 28, fontWeight: 800, color: "#818cf8" }}>
                        {sites.filter((s) => s.is_custom === 1).length}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Custom Sites</p>
                    </div>
                  </div>

                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
                    Saves all your favorites (with episode progress, status, notes) and custom sites &amp; domains to a{" "}
                    <code style={{ background: "var(--color-bg-hover)", padding: "1px 6px", borderRadius: 4 }}>.anihub</code>{" "}
                    file. Restore it on any device.
                  </p>

                  <button
                    className="btn-primary"
                    onClick={handleExport}
                    disabled={favorites.length === 0 && sites.filter((s) => s.is_custom === 1).length === 0}
                    style={{ width: "100%", padding: "16px", fontSize: 15, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
                  >
                    <Download size={20} />
                    Save Backup File
                  </button>
                </div>
              )}

              {exportStatus === "loading" && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      border: "3px solid rgba(99,102,241,0.2)",
                      borderTopColor: "#818cf8",
                      animation: "spin 0.8s linear infinite",
                      margin: "0 auto 16px",
                    }}
                  />
                  <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>{exportMessage}</p>
                </div>
              )}

              {exportStatus === "success" && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <CheckCircle2 size={52} color="#4ade80" style={{ margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#4ade80", marginBottom: 6 }}>Backup Saved!</p>
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 20, whiteSpace: "pre-line" }}>
                    {exportMessage}
                  </p>
                  <button
                    className="btn-primary"
                    onClick={onClose}
                    style={{ width: "100%", padding: "14px", fontSize: 14, borderRadius: 12 }}
                  >
                    Done
                  </button>
                </div>
              )}

              {exportStatus === "error" && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <AlertCircle size={52} color="#f87171" style={{ margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 13, color: "#f87171", marginBottom: 20 }}>{exportMessage}</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn-ghost" onClick={onClose} style={{ flex: 1, padding: "14px" }}>Close</button>
                    <button
                      className="btn-primary"
                      onClick={() => { setExportStatus("idle"); setExportMessage(""); }}
                      style={{ flex: 1, padding: "14px" }}
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
