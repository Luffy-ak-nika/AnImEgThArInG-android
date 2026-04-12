import { X, FileUp, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

interface AniyomiEntry {
  title: string;
  url: string;
  thumbnail: string;
  source: string;
}

interface Props {
  onClose: () => void;
}

export default function ImportBackupDialog({ onClose }: Props) {
  const { addToFavorites, refreshFavorites } = useApp();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [importedCount, setImportedCount] = useState(0);

  const handleImport = async () => {
    try {
      // Open file picker
      const filePath = await open({
        title: "Select Aniyomi Backup",
        filters: [
          {
            name: "Aniyomi Backup",
            extensions: ["tachibk", "gz", "json"],
          },
        ],
        multiple: false,
      });

      if (!filePath) return;

      setStatus("loading");
      setMessage("Parsing backup file...");

      // Parse backup via Rust backend
      const entries: AniyomiEntry[] = await invoke("import_aniyomi_backup", {
        filePath: filePath as string,
      });

      if (entries.length === 0) {
        setStatus("error");
        setMessage("No anime entries found in the backup file.");
        return;
      }

      setMessage(`Found ${entries.length} entries. Importing...`);

      // Add each entry to favorites
      let imported = 0;
      for (const entry of entries) {
        try {
          await addToFavorites(
            entry.title,
            entry.thumbnail,
            0,
            entry.source,
            "",
            entry.url || `Imported: ${entry.title}`
          );
          imported++;
        } catch {
          // Skip duplicates or errors
        }
      }

      setImportedCount(imported);
      setStatus("success");
      setMessage(`Successfully imported ${imported} anime from backup!`);
      await refreshFavorites();
    } catch (err) {
      setStatus("error");
      setMessage(`Import failed: ${err}`);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <FileUp size={20} className="text-[var(--color-accent-primary)]" />
            Import Aniyomi Backup
          </h2>
          <button
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Status */}
        {status === "idle" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-accent-primary)]/10
              flex items-center justify-center">
              <Upload size={28} className="text-[var(--color-accent-primary)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              Select your backup file
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-6 max-w-xs mx-auto">
              Supported formats: <code className="bg-[var(--color-bg-hover)] px-1 rounded">.tachibk</code>{" "}
              and <code className="bg-[var(--color-bg-hover)] px-1 rounded">.proto.gz</code>
              <br />
              (Aniyomi / Tachiyomi backup files)
            </p>
            <button className="btn-primary" onClick={handleImport}>
              <span className="flex items-center gap-2">
                <FileUp size={16} />
                Choose Backup File
              </span>
            </button>
          </div>
        )}

        {status === "loading" && (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 border-3 border-[var(--color-accent-primary)]
              border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center py-8">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
            <p className="text-sm font-semibold text-green-400 mb-2">{message}</p>
            <button className="btn-primary mt-4" onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-8">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <p className="text-sm text-red-400 mb-4">{message}</p>
            <div className="flex justify-center gap-3">
              <button className="btn-ghost" onClick={onClose}>
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setStatus("idle");
                  setMessage("");
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
