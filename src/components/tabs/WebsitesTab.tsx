import {
  Globe,
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { useApp, type SiteWithDomains } from "@/contexts/AppContext";
import { useState } from "react";
import AddSiteDialog from "@/components/dialogs/AddSiteDialog";
import EditDomainsDialog from "@/components/dialogs/EditDomainsDialog";

export default function WebsitesTab() {
  const {
    sites,
    openSiteWebview,
    switchActiveDomain,
    removeCustomSite,
  } = useApp();

  const [showAddSite, setShowAddSite] = useState(false);
  const [editingSite, setEditingSite] = useState<SiteWithDomains | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  const handleDomainSwitch = async (siteId: number, url: string) => {
    setOpenDropdown(null);
    await switchActiveDomain(siteId, url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <Globe size={24} className="text-[var(--color-accent-secondary)]" />
          Streaming Websites
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {sites.length} sites · Click to open in webview · Edit domains per site
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 stagger-grid">
        {sites.map((site) => (
          <div
            key={site.id}
            className="glass-card group overflow-visible"
            style={{
              position: "relative",
              zIndex: openDropdown === site.id ? 30 : 1,
              transform: "none",
            }}
          >
            {/* Click to open */}
            <div
              className="p-5 cursor-pointer transition-opacity hover:opacity-90"
              onClick={() => openSiteWebview(site)}
            >
              {/* Icon & Name */}
              <div className="text-center mb-3">
                <div className="text-3xl mb-2 transition-transform duration-300 group-hover:scale-110">
                  {site.icon || "🌐"}
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {site.name}
                </h3>
              </div>

              {/* Active Domain */}
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="status-dot online" />
                <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[140px]">
                  {site.activeDomain.replace(/^https?:\/\//, "")}
                </span>
              </div>

              {/* Custom badge */}
              {site.is_custom === 1 && (
                <div className="flex justify-center mt-2">
                  <span className="text-[10px] bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)]
                    px-2 py-0.5 rounded-full font-medium">
                    Custom
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex border-t border-[var(--color-border-default)]">
              {/* Domain Switcher */}
              <div className="relative flex-1">
                <button
                  className="w-full flex items-center justify-center gap-1 p-2 text-xs
                    text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]
                    hover:bg-[var(--color-bg-hover)] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdown(openDropdown === site.id ? null : site.id);
                  }}
                >
                  <RefreshCw size={11} />
                  Switch
                  <ChevronDown size={11} />
                </button>

                {/* Domain Dropdown - rendered as fixed position to escape stacking context */}
                {openDropdown === site.id && (
                  <div
                    className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-bg-secondary)]
                      border border-[var(--color-border-default)] rounded-lg shadow-2xl
                      animate-fade-in overflow-hidden"
                    style={{ zIndex: 9999 }}
                  >
                    <div className="py-1">
                      <p className="px-3 py-1.5 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                        Mirror Domains
                      </p>
                      {site.domains.map((domain) => (
                        <button
                          key={domain.id}
                          className={`w-full text-left px-3 py-2.5 text-xs transition-colors flex items-center gap-2
                            ${
                              domain.is_active
                                ? "bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] font-medium"
                                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                            }`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDomainSwitch(site.id, domain.url);
                          }}
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              domain.is_active
                                ? "bg-[var(--color-accent-primary)]"
                                : "bg-[var(--color-text-muted)]/30"
                            }`}
                          />
                          {domain.url.replace(/^https?:\/\//, "")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Edit Domains */}
              <button
                className="p-2 text-xs text-[var(--color-text-muted)]
                  hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]
                  transition-colors border-l border-[var(--color-border-default)]"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingSite(site);
                }}
                title="Edit domains"
              >
                <Edit3 size={13} />
              </button>

              {/* Delete (custom only) */}
              {site.is_custom === 1 && (
                <button
                  className="p-2 text-xs text-[var(--color-text-muted)]
                    hover:text-red-400 hover:bg-red-500/10
                    transition-colors border-l border-[var(--color-border-default)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${site.name}"?`)) {
                      removeCustomSite(site.id);
                    }
                  }}
                  title="Delete site"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add Custom Website Card */}
        <div
          className="glass-card cursor-pointer flex flex-col items-center justify-center p-6 min-h-[180px]
            border-dashed! hover:border-[var(--color-accent-primary)]"
          onClick={() => setShowAddSite(true)}
        >
          <Plus
            size={28}
            className="text-[var(--color-text-muted)] mb-2 transition-colors"
          />
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">
            Add Custom Site
          </span>
          <span className="text-xs text-[var(--color-text-muted)] mt-1">
            Any streaming website
          </span>
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {openDropdown !== null && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 5 }}
          onClick={() => setOpenDropdown(null)}
        />
      )}

      {showAddSite && <AddSiteDialog onClose={() => setShowAddSite(false)} />}
      {editingSite && (
        <EditDomainsDialog
          site={editingSite}
          onClose={() => setEditingSite(null)}
        />
      )}
    </div>
  );
}
