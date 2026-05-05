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
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";

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

export default function BackupDialog({ onClose }: Props) {
  const { upsertToFavorites, refreshFavorites, favorites, sites } = useApp();
  const [activeTab, setActiveTab] = useState<ActiveTab>("import");

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
  // IMPORT — Android-safe approach:
  //  1. Open picker with NO filters (Android shows all files including .anihub)
  //  2. Read file content as TEXT using readTextFile() — works with content:// URIs
  //  3. Detect format by CONTENT (not extension) — extension detection breaks
  //     on Android because the URI looks like content://...document/12345
  //  4. Only fall back to Rust for binary proto.gz/tachibk (desktop only)
  // ──────────────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    try {
      // No extension filters → Android shows ALL files so user can pick .anihub
      const filePath = await open({
        title: "Select Backup File (.anihub, .json, .tachibk, .gz)",
        multiple: false,
        // filters intentionally omitted — Android MIME types hide custom extensions
      });

      if (!filePath) return;

      setImportStatus("loading");
      setImportMessage("Reading backup file...");

      const fp = filePath as string;

      // ── Step 1: Try reading as text (works for .anihub and JSON backups,
      //    and works on Android content:// URIs via plugin-fs) ──────────────
      let textContent: string | null = null;
      try {
        textContent = await readTextFile(fp);
      } catch {
        // Binary file — readTextFile fails for proto.gz / tachibk
        textContent = null;
      }

      if (textContent !== null) {
        // ── Step 2: Try parsing as JSON ─────────────────────────────────────
        let jsonData: Record<string, unknown> | null = null;
        try {
          jsonData = JSON.parse(textContent);
        } catch {
          jsonData = null;
        }

        if (jsonData !== null) {
          // ── Detect: AnImEgThArInG own backup ─────────────────────────────
          if (
            jsonData.app === "AnImEgThArInG" ||
            (Array.isArray(jsonData.favorites) && jsonData.favorites.length >= 0)
          ) {
            await importAnihubFromContent(jsonData);
            return;
          }

          // ── Detect: Aniyomi / Tachiyomi JSON backup ───────────────────────
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

      // ── Step 3: Binary file (proto.gz, tachibk) → pass path to Rust ──────
      //    NOTE: Works on desktop. On Android the content URI may fail in Rust;
      //    in that case the user will see a meaningful error.
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
    let imported = 0;
    let replaced = 0;
    const favList = Array.isArray(data.favorites)
      ? (data.favorites as Record<string, unknown>[])
      : [];

    if (favList.length === 0) {
      setImportStatus("error");
      setImportMessage("No favorites found in this backup file.");
      return;
    }

    setImportMessage(`Found ${favList.length} entries. Importing...`);

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
          String(fav.page_url ?? "")
        );
        if (existing) replaced++;
        else imported++;
      } catch {
        // skip
      }
    }

    setImportedCount(imported + replaced);
    setImportStatus("success");
    setImportMessage(`Restored ${imported} new · ${replaced} updated!`);
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

  // ── Shared style helpers ─────────────────────────────────────────────────────
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
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, padding: "20px 16px" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
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
            marginBottom: 20,
            background: "rgba(0,0,0,0.2)",
            borderRadius: 12,
            padding: 4,
          }}
        >
          <button style={tabBtn("import")} onClick={() => { setActiveTab("import"); setImportStatus("idle"); }}>
            <FolderOpen size={15} /> Import / Restore
          </button>
          <button style={tabBtn("export")} onClick={() => { setActiveTab("export"); setExportStatus("idle"); }}>
            <FileDown size={15} /> Create Backup
          </button>
        </div>

        {/* ═══ IMPORT ═══ */}
        {activeTab === "import" && (
          <>
            {importStatus === "idle" && (
              <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                {/* Icon */}
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

                {/* ⚠️ Android tip */}
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

                {/* Big prominent button */}
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

                {/* Stats */}
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
                  Saves all your favorites (with episode progress) and custom sites to a{" "}
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
  );
}
