import {
  Heart,
  Play,
  Trash2,
  Upload,
  PackageOpen,
  BookOpen,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  ListTodo,
  ChevronDown,
  Save,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useState, useCallback } from "react";
import BackupDialog from "@/components/dialogs/BackupDialog";
import type { WatchStatus, DbFavorite } from "@/lib/db";

// ── Status configuration ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  WatchStatus,
  { label: string; color: string; bg: string; Icon: typeof BookOpen }
> = {
  watching: {
    label: "Watching",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
    Icon: Play,
  },
  completed: {
    label: "Completed",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.15)",
    Icon: CheckCircle2,
  },
  "on-hold": {
    label: "On Hold",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.15)",
    Icon: PauseCircle,
  },
  dropped: {
    label: "Dropped",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
    Icon: XCircle,
  },
  "plan-to-watch": {
    label: "Plan to Watch",
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.15)",
    Icon: ListTodo,
  },
};

const ALL_STATUSES = Object.entries(STATUS_CONFIG) as [
  WatchStatus,
  (typeof STATUS_CONFIG)[WatchStatus]
][];

// ── Progress bottom-sheet ────────────────────────────────────────────────────
interface ProgressSheetProps {
  fav: DbFavorite;
  onClose: () => void;
}

function ProgressSheet({ fav, onClose }: ProgressSheetProps) {
  const { updateFavoriteProgress } = useApp();
  const [watched, setWatched] = useState(String(fav.watched_episodes || 0));
  const [total, setTotal] = useState(String(fav.total_episodes || 0));
  const [status, setStatus] = useState<WatchStatus>(
    (fav.status as WatchStatus) || "watching"
  );
  const [lastEp, setLastEp] = useState(fav.last_episode || "");
  const [notes, setNotes] = useState(fav.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await updateFavoriteProgress(
      fav.id,
      parseInt(watched) || 0,
      parseInt(total) || 0,
      status,
      lastEp,
      notes
    );
    setSaving(false);
    onClose();
  }, [fav.id, watched, total, status, lastEp, notes, updateFavoriteProgress, onClose]);

  const cfg = STATUS_CONFIG[status];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9000] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9001] rounded-t-3xl overflow-hidden"
        style={{
          background: "var(--color-bg-secondary)",
          borderTop: "1px solid rgba(148,163,184,0.12)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          maxHeight: "85dvh",
          overflowY: "auto",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: "rgba(148,163,184,0.3)",
            }}
          />
        </div>

        <div className="px-5 pb-6">
          {/* Title */}
          <div className="flex items-start gap-3 mb-5">
            {fav.thumbnail ? (
              <img
                src={fav.thumbnail}
                alt=""
                style={{
                  width: 52,
                  height: 72,
                  objectFit: "cover",
                  borderRadius: 10,
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 52,
                  height: 72,
                  background: "var(--color-bg-hover)",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                }}
              >
                🎬
              </div>
            )}
            <div className="min-w-0">
              <h3
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: "var(--color-text-primary)",
                  lineHeight: 1.3,
                  marginBottom: 4,
                }}
              >
                {fav.title}
              </h3>
              {fav.site_name && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    background: "var(--color-bg-hover)",
                    borderRadius: 6,
                    padding: "2px 8px",
                  }}
                >
                  {fav.site_name}
                </span>
              )}
            </div>
          </div>

          {/* Status selector */}
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              display: "block",
              marginBottom: 8,
            }}
          >
            Watch Status
          </label>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 18,
            }}
          >
            {ALL_STATUSES.map(([val, c]) => {
              const active = status === val;
              return (
                <button
                  key={val}
                  onClick={() => setStatus(val)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 20,
                    border: `1.5px solid ${active ? c.color : "rgba(148,163,184,0.15)"}`,
                    background: active ? c.bg : "transparent",
                    color: active ? c.color : "var(--color-text-muted)",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Episode progress */}
          <div
            style={{ display: "flex", gap: 12, marginBottom: 16 }}
          >
            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Watched
              </label>
              <input
                type="number"
                min="0"
                value={watched}
                onChange={(e) => {
                  setWatched(e.target.value);
                  if (parseInt(e.target.value) > 0 && !total) setTotal("");
                }}
                inputMode="numeric"
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(148,163,184,0.15)",
                  background: "var(--color-bg-hover)",
                  color: "var(--color-text-primary)",
                  fontSize: 16,
                  outline: "none",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                paddingBottom: 10,
                color: "var(--color-text-muted)",
                fontSize: 18,
                fontWeight: 300,
              }}
            >
              /
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Total
              </label>
              <input
                type="number"
                min="0"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                inputMode="numeric"
                placeholder="?"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(148,163,184,0.15)",
                  background: "var(--color-bg-hover)",
                  color: "var(--color-text-primary)",
                  fontSize: 16,
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Last episode / chapter label */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Last Watched (e.g. "Episode 12")
            </label>
            <input
              type="text"
              value={lastEp}
              onChange={(e) => setLastEp(e.target.value)}
              placeholder="Episode 1"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 12,
                border: "1.5px solid rgba(148,163,184,0.15)",
                background: "var(--color-bg-hover)",
                color: "var(--color-text-primary)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes, e.g. currently on season 2..."
              rows={2}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 12,
                border: "1.5px solid rgba(148,163,184,0.15)",
                background: "var(--color-bg-hover)",
                color: "var(--color-text-primary)",
                fontSize: 14,
                outline: "none",
                resize: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 14,
              border: "none",
              background: saving
                ? "rgba(168,85,247,0.4)"
                : "linear-gradient(135deg, #a855f7, #6366f1)",
              color: "white",
              fontWeight: 700,
              fontSize: 15,
              cursor: saving ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {saving ? (
              <div
                style={{
                  width: 18,
                  height: 18,
                  border: "2px solid white",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
            ) : (
              <Save size={16} />
            )}
            {saving ? "Saving..." : "Save Progress"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Progress bar pill ────────────────────────────────────────────────────────
function ProgressBar({
  watched,
  total,
}: {
  watched: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min((watched / total) * 100, 100) : 0;
  return (
    <div
      style={{
        height: 3,
        borderRadius: 2,
        background: "rgba(148,163,184,0.15)",
        overflow: "hidden",
        marginTop: 6,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg, #a855f7, #6366f1)",
          borderRadius: 2,
          transition: "width 0.4s",
        }}
      />
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
type FilterStatus = WatchStatus | "all";

const FILTER_LABELS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "watching", label: "Watching" },
  { value: "completed", label: "Completed" },
  { value: "on-hold", label: "On Hold" },
  { value: "dropped", label: "Dropped" },
  { value: "plan-to-watch", label: "Plan to Watch" },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function FavoritesTab() {
  const { favorites, removeFromFavorites, openUrlWebview } = useApp();
  const [showImport, setShowImport] = useState(false);
  const [editingFav, setEditingFav] = useState<DbFavorite | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const handleOpenFavorite = (fav: DbFavorite) => {
    const label = `webview-fav-${fav.id}`;
    openUrlWebview(label, fav.page_url, fav.title);
  };

  const filtered =
    filterStatus === "all"
      ? favorites
      : favorites.filter((f) => (f.status || "watching") === filterStatus);

  // Count per status
  const counts: Partial<Record<WatchStatus, number>> = {};
  for (const f of favorites) {
    const s = (f.status || "watching") as WatchStatus;
    counts[s] = (counts[s] ?? 0) + 1;
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--color-text-primary)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <Heart size={22} color="#ec4899" />
          My Library
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          {favorites.length} saved · {counts["watching"] ?? 0} watching ·{" "}
          {counts["completed"] ?? 0} completed
        </p>
      </div>

      {/* Filter chips */}
      {favorites.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 4,
            marginBottom: 14,
            scrollbarWidth: "none",
          }}
        >
          {FILTER_LABELS.map(({ value, label }) => {
            const active = filterStatus === value;
            const cfg = value !== "all" ? STATUS_CONFIG[value] : null;
            return (
              <button
                key={value}
                onClick={() => setFilterStatus(value)}
                style={{
                  flexShrink: 0,
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: `1.5px solid ${
                    active
                      ? cfg?.color ?? "var(--color-accent-primary)"
                      : "rgba(148,163,184,0.15)"
                  }`,
                  background: active
                    ? cfg?.bg ?? "rgba(168,85,247,0.15)"
                    : "transparent",
                  color: active
                    ? cfg?.color ?? "var(--color-accent-primary)"
                    : "var(--color-text-muted)",
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {label}
                {value !== "all" && counts[value as WatchStatus]
                  ? ` · ${counts[value as WatchStatus]}`
                  : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {favorites.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "55dvh",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 56 }}>🎌</div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--color-text-secondary)",
            }}
          >
            No anime saved yet
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-muted)",
              textAlign: "center",
              maxWidth: 280,
              lineHeight: 1.5,
            }}
          >
            Browse the Websites tab and save anime to track your progress, or
            import your Aniyomi backup.
          </p>
          <button className="btn-primary" onClick={() => setShowImport(true)}>
            <PackageOpen size={15} />
            Backup &amp; Restore
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "var(--color-text-muted)",
          }}
        >
          No anime in "{FILTER_LABELS.find((f) => f.value === filterStatus)?.label}" yet.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
            paddingBottom: 100,
          }}
        >
          {filtered.map((fav) => {
            const st = (fav.status || "watching") as WatchStatus;
            const cfg = STATUS_CONFIG[st];
            const hasProgress =
              fav.watched_episodes > 0 || fav.total_episodes > 0;

            return (
              <div
                key={fav.id}
                style={{
                  background: "var(--color-bg-card)",
                  borderRadius: 16,
                  overflow: "hidden",
                  border: "1px solid rgba(148,163,184,0.08)",
                  cursor: "pointer",
                }}
                onClick={() => handleOpenFavorite(fav)}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "3/4",
                    background: "var(--color-bg-hover)",
                  }}
                >
                  {fav.thumbnail ? (
                    <img
                      src={fav.thumbnail}
                      alt={fav.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 32,
                      }}
                    >
                      🎬
                    </div>
                  )}

                  {/* Status dot */}
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: cfg.color,
                      boxShadow: `0 0 6px ${cfg.color}`,
                      border: "1.5px solid rgba(0,0,0,0.4)",
                    }}
                  />

                  {/* Episode badge */}
                  {hasProgress && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        background: "rgba(0,0,0,0.75)",
                        backdropFilter: "blur(6px)",
                        borderRadius: 8,
                        padding: "2px 7px",
                        fontSize: 10,
                        fontWeight: 600,
                        color: "white",
                      }}
                    >
                      {fav.watched_episodes}
                      {fav.total_episodes > 0 ? `/${fav.total_episodes}` : ""}
                    </div>
                  )}

                  {/* Play overlay on tap */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      paddingBottom: 12,
                      opacity: 0,
                    }}
                    className="group-hover:opacity-100"
                  />
                </div>

                {/* Info */}
                <div style={{ padding: "10px 10px 8px" }}>
                  <h3
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      lineHeight: 1.3,
                      marginBottom: 4,
                    }}
                  >
                    {fav.title}
                  </h3>

                  {/* Status chip */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      padding: "2px 7px",
                      borderRadius: 6,
                      background: cfg.bg,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 10, color: cfg.color, fontWeight: 600 }}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {hasProgress && (
                    <ProgressBar
                      watched={fav.watched_episodes}
                      total={fav.total_episodes}
                    />
                  )}

                  {/* Last ep */}
                  {fav.last_episode && (
                    <p
                      style={{
                        fontSize: 10,
                        color: "var(--color-text-muted)",
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fav.last_episode}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 8,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setEditingFav(fav)}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        borderRadius: 8,
                        border: "1px solid rgba(148,163,184,0.15)",
                        background: "transparent",
                        color: "var(--color-text-muted)",
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <ChevronDown size={11} />
                      Update
                    </button>
                    <button
                      onClick={() => removeFromFavorites(fav.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid rgba(239,68,68,0.2)",
                        background: "transparent",
                        color: "#ef4444",
                        fontSize: 11,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating backup button */}
      <button className="fab" onClick={() => setShowImport(true)}>
        <Upload size={18} />
        Backup &amp; Restore
      </button>

      {/* Progress edit sheet */}
      {editingFav && (
        <ProgressSheet
          fav={editingFav}
          onClose={() => setEditingFav(null)}
        />
      )}

      {/* Backup dialog */}
      {showImport && <BackupDialog onClose={() => setShowImport(false)} />}
    </div>
  );
}
