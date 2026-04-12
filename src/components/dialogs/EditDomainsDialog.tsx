import { X, Plus, Trash2, Edit3 } from "lucide-react";
import { useApp, type SiteWithDomains } from "@/contexts/AppContext";
import { useState } from "react";

interface Props {
  site: SiteWithDomains;
  onClose: () => void;
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

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Edit3 size={18} className="text-[var(--color-accent-primary)]" />
            Edit Domains — {site.icon} {site.name}
          </h2>
          <button
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Info */}
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Select the active domain (filled circle). This is the URL that opens when you click the site.
        </p>

        {/* Domains */}
        <div className="space-y-2">
          {domains.map((domain, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                className={`shrink-0 w-5 h-5 rounded-full border-2 transition-colors
                  ${
                    domain.isActive
                      ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]"
                      : "border-[var(--color-border-default)] hover:border-[var(--color-text-muted)]"
                  }`}
                onClick={() => setActive(i)}
                title="Set as active domain"
              />
              <input
                className="input-glass flex-1"
                placeholder="https://example.com"
                value={domain.url}
                onChange={(e) => updateDomainUrl(i, e.target.value)}
              />
              {domains.length > 1 && (
                <button
                  className="p-2 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                  onClick={() => removeDomain(i)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          className="mt-3 flex items-center gap-1 text-xs text-[var(--color-accent-primary)]
            hover:text-[var(--color-accent-tertiary)] transition-colors"
          onClick={addDomain}
        >
          <Plus size={12} />
          Add another domain
        </button>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
