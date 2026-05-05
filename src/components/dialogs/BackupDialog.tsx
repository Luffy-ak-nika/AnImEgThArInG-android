import {
  X,
  FileUp,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  PackageOpen,
  FileDown,
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

  const handleImport = async () => {
    try {
      const filePath = await open({
        title: "Select Backup File",
        filters: [
          {
            name: "Backup Files",
            extensions: ["tachibk", "gz", "json", "anihub"],
          },
        ],
        multiple: false,
      });

      if (!filePath) return;

      setImportStatus("loading");
      setImportMessage("Parsing backup file...");

      // Check if it's our own .anihub.json backup
      const fp = filePath as string;
      if (fp.endsWith(".anihub") || fp.endsWith(".anihub.json")) {
        await importAnihubBackup(fp);
        return;
      }

      // Otherwise treat it as Aniyomi/Tachiyomi backup
      const entries: AniyomiEntry[] = await invoke("import_aniyomi_backup", {
        filePath: fp,
      });

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
          const existing = favorites.find(f => f.title === entry.title);
          await upsertToFavorites(
            entry.title,
            entry.thumbnail,
            0,
            entry.source,
            "",
            entry.url || `Imported: ${entry.title}`
          );
          if (existing) replaced++; else imported++;
        } catch {
          // Skip errors
        }
      }

      setImportedCount(imported + replaced);
      setImportStatus("success");
      setImportMessage(
        `Imported ${imported} new · ${replaced} updated from backup!`
      );
      await refreshFavorites();
    } catch (err) {
      setImportStatus("error");
      setImportMessage(`Import failed: ${err}`);
    }
  };

  const importAnihubBackup = async (filePath: string) => {
    try {
      const content = await readTextFile(filePath);
      const data = JSON.parse(content);

      let imported = 0;
      let replaced = 0;
      if (data.favorites && Array.isArray(data.favorites)) {
        for (const fav of data.favorites) {
          try {
            const existing = favorites.find(
              f => f.page_url === fav.page_url || f.title === fav.title
            );
            await upsertToFavorites(
              fav.title,
              fav.thumbnail || "",
              fav.site_id || null,
              fav.site_name || "",
              fav.last_episode || "",
              fav.page_url || ""
            );
            if (existing) replaced++; else imported++;
          } catch {
            // Skip errors
          }
        }
      }

      setImportedCount(imported + replaced);
      setImportStatus("success");
      setImportMessage(
        `Restored ${imported} new · ${replaced} updated from backup!`
      );
      await refreshFavorites();
    } catch (err) {
      setImportStatus("error");
      setImportMessage(`Failed to read AnImEgThArInG backup: ${err}`);
    }
  };

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
        filters: [
          {
            name: "AnImEgThArInG Backup",
            extensions: ["anihub"],
          },
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
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

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <PackageOpen size={20} className="text-[var(--color-accent-primary)]" />
            Backup &amp; Restore
          </h2>
          <button
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-[var(--color-bg-primary)]/40 rounded-xl p-1">
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "import"
                ? "bg-[var(--color-accent-primary)]/15 text-[var(--color-accent-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
            onClick={() => {
              setActiveTab("import");
              setImportStatus("idle");
              setImportMessage("");
            }}
          >
            <FileUp size={15} />
            Import / Restore
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "export"
                ? "bg-[var(--color-accent-primary)]/15 text-[var(--color-accent-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
            onClick={() => {
              setActiveTab("export");
              setExportStatus("idle");
              setExportMessage("");
            }}
          >
            <FileDown size={15} />
            Create Backup
          </button>
        </div>

        {/* ═══ IMPORT PANEL ═══ */}
        {activeTab === "import" && (
          <>
            {importStatus === "idle" && (
              <div className="text-center py-6">
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-accent-primary)]/10
                  flex items-center justify-center"
                >
                  <Upload size={28} className="text-[var(--color-accent-primary)]" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                  Choose a backup file
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-2 max-w-xs mx-auto">
                  Supported formats:
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-5">
                  {[".anihub", ".tachibk", ".proto.gz", ".json"].map((ext) => (
                    <code
                      key={ext}
                      className="bg-[var(--color-bg-hover)] px-2 py-0.5 rounded text-xs text-[var(--color-accent-secondary)]"
                    >
                      {ext}
                    </code>
                  ))}
                </div>
                <button className="btn-primary" onClick={handleImport}>
                  <span className="flex items-center gap-2">
                    <FileUp size={16} />
                    Choose File
                  </span>
                </button>
              </div>
            )}

            {importStatus === "loading" && (
              <div className="text-center py-8">
                <div
                  className="w-12 h-12 mx-auto mb-4 border-2 border-[var(--color-accent-primary)]
                  border-t-transparent rounded-full animate-spin"
                />
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {importMessage}
                </p>
              </div>
            )}

            {importStatus === "success" && (
              <div className="text-center py-8">
                <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
                <p className="text-sm font-semibold text-green-400 mb-2">
                  {importMessage}
                </p>
                <button className="btn-primary mt-4" onClick={onClose}>
                  Done
                </button>
              </div>
            )}

            {importStatus === "error" && (
              <div className="text-center py-8">
                <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
                <p className="text-sm text-red-400 mb-4">{importMessage}</p>
                <div className="flex justify-center gap-3">
                  <button className="btn-ghost" onClick={onClose}>
                    Close
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setImportStatus("idle");
                      setImportMessage("");
                    }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ EXPORT PANEL ═══ */}
        {activeTab === "export" && (
          <>
            {exportStatus === "idle" && (
              <div className="text-center py-6">
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-accent-secondary)]/10
                  flex items-center justify-center"
                >
                  <Download size={28} className="text-[var(--color-accent-secondary)]" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                  Create Full Backup
                </h3>

                {/* Stats */}
                <div className="flex justify-center gap-6 mb-5">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[var(--color-accent-primary)]">
                      {favorites.length}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">Favorites</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[var(--color-accent-secondary)]">
                      {sites.filter((s) => s.is_custom === 1).length}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">Custom Sites</p>
                  </div>
                </div>

                <p className="text-xs text-[var(--color-text-muted)] mb-5 max-w-xs mx-auto">
                  Saves all your favorites and custom streaming sites to a{" "}
                  <code className="bg-[var(--color-bg-hover)] px-1 rounded">.anihub</code>{" "}
                  file you can restore later.
                </p>

                <button
                  className="btn-primary"
                  onClick={handleExport}
                  disabled={favorites.length === 0 && sites.filter(s => s.is_custom === 1).length === 0}
                >
                  <span className="flex items-center gap-2">
                    <Download size={16} />
                    Save Backup File
                  </span>
                </button>

                {favorites.length === 0 && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-3">
                    Add some favorites first to include them in the backup.
                  </p>
                )}
              </div>
            )}

            {exportStatus === "loading" && (
              <div className="text-center py-8">
                <div
                  className="w-12 h-12 mx-auto mb-4 border-2 border-[var(--color-accent-secondary)]
                  border-t-transparent rounded-full animate-spin"
                />
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {exportMessage}
                </p>
              </div>
            )}

            {exportStatus === "success" && (
              <div className="text-center py-8">
                <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
                <p className="text-sm font-semibold text-green-400 mb-1">Backup Created!</p>
                <p className="text-xs text-[var(--color-text-muted)] mb-4 whitespace-pre-line">
                  {exportMessage}
                </p>
                <button className="btn-primary mt-2" onClick={onClose}>
                  Done
                </button>
              </div>
            )}

            {exportStatus === "error" && (
              <div className="text-center py-8">
                <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
                <p className="text-sm text-red-400 mb-4">{exportMessage}</p>
                <div className="flex justify-center gap-3">
                  <button className="btn-ghost" onClick={onClose}>
                    Close
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setExportStatus("idle");
                      setExportMessage("");
                    }}
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
