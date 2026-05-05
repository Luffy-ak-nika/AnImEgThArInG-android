import {
  Globe,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  X,
  Check,
} from "lucide-react";
import { useApp, type SiteWithDomains } from "@/contexts/AppContext";
import { useState } from "react";
import AddSiteDialog from "@/components/dialogs/AddSiteDialog";
import EditDomainsDialog from "@/components/dialogs/EditDomainsDialog";

// ── Domain switcher bottom sheet ─────────────────────────────────────────────
interface DomainSheetProps {
  site: SiteWithDomains;
  onSelect: (url: string) => void;
  onClose: () => void;
}

function DomainSheet({ site, onSelect, onClose }: DomainSheetProps) {
  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9000,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9001,
          background: "var(--color-bg-secondary)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px 20px 0 0",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(148,163,184,0.25)" }} />
        </div>

        <div style={{ padding: "0 16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>
              {site.icon || "🌐"} {site.name} — Mirror Domains
            </h3>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8, border: "none",
                background: "var(--color-bg-hover)", color: "var(--color-text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>

          {site.domains.map((d) => {
            const active = d.is_active === 1 || d.url === site.activeDomain;
            return (
              <button
                key={d.id}
                onClick={() => { onSelect(d.url); onClose(); }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  marginBottom: 6,
                  borderRadius: 12,
                  border: `1.5px solid ${active ? "rgba(168,85,247,0.4)" : "rgba(148,163,184,0.1)"}`,
                  background: active ? "rgba(168,85,247,0.1)" : "var(--color-bg-hover)",
                  cursor: "pointer",
                  textAlign: "left",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span
                  style={{
                    width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                    background: active ? "#a855f7" : "rgba(148,163,184,0.3)",
                    boxShadow: active ? "0 0 6px #a855f7" : "none",
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: active ? "#a855f7" : "var(--color-text-secondary)",
                    fontWeight: active ? 600 : 400,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {d.url.replace(/^https?:\/\//, "")}
                </span>
                {active && <Check size={15} color="#a855f7" />}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Delete confirmation inline ────────────────────────────────────────────────
interface DeleteConfirmProps {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ name, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.55)" }}
        onClick={onCancel}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9001,
          background: "var(--color-bg-secondary)",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px",
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 6 }}>
          Delete "{name}"?
        </h3>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 20 }}>
          This will remove the site and all its saved mirrors.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "14px", borderRadius: 12, border: "1.5px solid rgba(148,163,184,0.2)",
              background: "transparent", color: "var(--color-text-secondary)", fontSize: 14,
              fontWeight: 600, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: "14px", borderRadius: 12, border: "none",
              background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 14,
              fontWeight: 600, cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main tab ─────────────────────────────────────────────────────────────────
export default function WebsitesTab() {
  const { sites, openSiteWebview, switchActiveDomain, removeCustomSite } = useApp();

  const [showAddSite, setShowAddSite] = useState(false);
  const [editingSite, setEditingSite] = useState<SiteWithDomains | null>(null);
  const [domainSheetSite, setDomainSheetSite] = useState<SiteWithDomains | null>(null);
  const [deletingSite, setDeletingSite] = useState<SiteWithDomains | null>(null);

  return (
    <div style={{ padding: "16px 12px", paddingBottom: 20 }}>
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
          <Globe size={22} color="var(--color-accent-secondary)" />
          Streaming Sites
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          {sites.length} sites · Tap to open · Long-press to switch mirror
        </p>
      </div>

      {/* Grid — 2 cols on phone, 3 on tablet */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 10,
        }}
      >
        {sites.map((site) => (
          <div
            key={site.id}
            style={{
              background: "var(--color-bg-glass)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 16,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Tappable main area */}
            <div
              style={{ padding: "16px 12px 10px", cursor: "pointer", flex: 1 }}
              onClick={() => openSiteWebview(site)}
            >
              {/* Big emoji icon */}
              <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8, lineHeight: 1 }}>
                {site.icon || "🌐"}
              </div>

              {/* Site name */}
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  textAlign: "center",
                  marginBottom: 6,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {site.name}
              </h3>

              {/* Active domain */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <span className="status-dot online" style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--color-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "90%",
                  }}
                >
                  {site.activeDomain.replace(/^https?:\/\//, "")}
                </span>
              </div>

              {/* Custom badge */}
              {site.is_custom === 1 && (
                <div style={{ textAlign: "center", marginTop: 6 }}>
                  <span
                    style={{
                      fontSize: 9,
                      background: "rgba(168,85,247,0.15)",
                      color: "#a855f7",
                      padding: "2px 8px",
                      borderRadius: 20,
                      fontWeight: 600,
                    }}
                  >
                    Custom
                  </span>
                </div>
              )}
            </div>

            {/* Action row */}
            <div
              style={{
                display: "flex",
                borderTop: "1px solid var(--color-border-default)",
              }}
            >
              {/* Switch mirror */}
              {site.domains.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDomainSheetSite(site); }}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    padding: "10px 6px",
                    border: "none",
                    background: "transparent",
                    color: "var(--color-text-muted)",
                    fontSize: 11,
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <RefreshCw size={13} />
                  Mirror
                </button>
              )}

              {/* Edit domains */}
              <button
                onClick={(e) => { e.stopPropagation(); setEditingSite(site); }}
                style={{
                  flex: site.domains.length > 1 ? 0 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  padding: "10px 12px",
                  border: "none",
                  borderLeft: site.domains.length > 1 ? "1px solid var(--color-border-default)" : "none",
                  background: "transparent",
                  color: "var(--color-text-muted)",
                  fontSize: 11,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <Edit3 size={13} />
                {site.domains.length <= 1 ? "Edit" : ""}
              </button>

              {/* Delete (custom only) */}
              {site.is_custom === 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeletingSite(site); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 12px",
                    border: "none",
                    borderLeft: "1px solid var(--color-border-default)",
                    background: "transparent",
                    color: "#f87171",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add Custom Site card */}
        <div
          onClick={() => setShowAddSite(true)}
          style={{
            background: "transparent",
            border: "1.5px dashed rgba(168,85,247,0.25)",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 12px",
            minHeight: 160,
            cursor: "pointer",
            gap: 8,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(168,85,247,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={22} color="var(--color-text-muted)" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
            Add Custom Site
          </span>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", textAlign: "center" }}>
            Any streaming website
          </span>
        </div>
      </div>

      {/* Domain bottom sheet */}
      {domainSheetSite && (
        <DomainSheet
          site={domainSheetSite}
          onSelect={(url) => switchActiveDomain(domainSheetSite.id, url)}
          onClose={() => setDomainSheetSite(null)}
        />
      )}

      {/* Delete confirmation */}
      {deletingSite && (
        <DeleteConfirm
          name={deletingSite.name}
          onConfirm={() => {
            removeCustomSite(deletingSite.id);
            setDeletingSite(null);
          }}
          onCancel={() => setDeletingSite(null)}
        />
      )}

      {showAddSite && <AddSiteDialog onClose={() => setShowAddSite(false)} />}
      {editingSite && (
        <EditDomainsDialog site={editingSite} onClose={() => setEditingSite(null)} />
      )}
    </div>
  );
}
