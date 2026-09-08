import { X, Plus, Trash2, Edit3 } from "lucide-react";
import { useApp, type SiteWithDomains } from "@/contexts/AppContext";
import { useState, useRef, useCallback } from "react";

interface Props {
  site: SiteWithDomains;
  onClose: () => void;
}

// ── Draggable bottom-sheet hook ─────────────────────────────────────────────
function useDragSheet(onDismiss: () => void) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (touch.clientY - rect.top > 56) return;
    startY.current = touch.clientY;
    setIsDragging(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientY - startY.current;
    setDragOffset(Math.max(0, diff));
  }, [isDragging]);

  const onTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset > 120) {
      onDismiss();
    }
    setDragOffset(0);
  }, [isDragging, dragOffset, onDismiss]);

  return { dragOffset, isDragging, onTouchStart, onTouchMove, onTouchEnd };
}

export default function EditDomainsDialog({ site, onClose }: Props) {
  const { updateDomains } = useApp();
  const [domains, setDomains] = useState(
    site.domains.map((d) => ({
      url: d.url,
      isActive: d.is_active === 1,
    }))
  );
  const [saving, setSaving] = useState(false);
  const { dragOffset, isDragging, onTouchStart, onTouchMove, onTouchEnd } = useDragSheet(onClose);

  const addDomain = () => {
    setDomains([...domains, { url: "", isActive: false }]);
  };

  const removeDomain = (index: number) => {
    if (domains.length <= 1) return;
    const newDomains = domains.filter((_, i) => i !== index);
    if (!newDomains.some((d) => d.isActive)) {
      newDomains[0].isActive = true;
    }
    setDomains(newDomains);
  };

  const updateDomainUrl = (index: number, url: string) => {
    const newDomains = [...domains];
    newDomains[index] = { ...newDomains[index], url };
    setDomains(newDomains);
  };

  const setActive = (index: number) => {
    setDomains(
      domains.map((d, i) => ({ ...d, isActive: i === index }))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const validDomains = domains
        .filter((d) => d.url.trim())
        .map((d) => ({
          url: d.url.startsWith("http") ? d.url : `https://${d.url}`,
          isActive: d.isActive,
        }));
      await updateDomains(site.id, validDomains);
      onClose();
    } catch (err) {
      console.error("Failed to update domains:", err);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1.5px solid rgba(148,163,184,0.15)",
    background: "var(--color-bg-hover)",
    color: "var(--color-text-primary)",
    fontSize: 14,
    outline: "none",
  };

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
          maxHeight: "85dvh",
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
              fontSize: 16,
              fontWeight: 700,
              color: "var(--color-text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Edit3 size={18} color="#a855f7" />
            Edit — {site.icon} {site.name}
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

        {/* ── Scrollable content body ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 20px",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
            Select the active domain (filled circle). This is the URL that opens when you click the site.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {domains.map((domain, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => setActive(i)}
                  title="Set as active domain"
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    border: `2px solid ${domain.isActive ? "var(--color-accent-primary)" : "var(--color-border-default)"}`,
                    background: domain.isActive ? "var(--color-accent-primary)" : "transparent",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                    padding: 0,
                  }}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="https://example.com"
                  value={domain.url}
                  onChange={(e) => updateDomainUrl(i, e.target.value)}
                />
                {domains.length > 1 && (
                  <button
                    onClick={() => removeDomain(i)}
                    style={{
                      padding: 10,
                      color: "var(--color-text-muted)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addDomain}
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 13,
              color: "var(--color-accent-primary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 0",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <Plus size={14} />
            Add another domain
          </button>
        </div>

        {/* ── STICKY footer buttons ── */}
        <div
          style={{
            flexShrink: 0,
            padding: "12px 20px",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
            borderTop: "1px solid rgba(148,163,184,0.08)",
            background: "var(--color-bg-secondary)",
            display: "flex",
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: 12,
              border: "1px solid var(--color-border-default)",
              background: "transparent",
              color: "var(--color-text-muted)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: 12,
              border: "none",
              background: saving ? "rgba(168,85,247,0.4)" : "linear-gradient(135deg, #a855f7, #6366f1)",
              color: "white",
              fontSize: 14,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}
