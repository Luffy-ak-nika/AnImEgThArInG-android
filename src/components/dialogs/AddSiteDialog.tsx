import { X, Plus, Trash2, Globe } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useState } from "react";

interface Props {
  onClose: () => void;
}

export default function AddSiteDialog({ onClose }: Props) {
  const { addCustomSite } = useApp();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🌐");
  const [domains, setDomains] = useState([{ url: "", isActive: true }]);
  const [saving, setSaving] = useState(false);

  const addDomain = () => {
    setDomains([...domains, { url: "", isActive: false }]);
  };

  const removeDomain = (index: number) => {
    if (domains.length <= 1) return;
    const newDomains = domains.filter((_, i) => i !== index);
    // Ensure at least one is active
    if (!newDomains.some((d) => d.isActive)) {
      newDomains[0].isActive = true;
    }
    setDomains(newDomains);
  };

  const updateDomain = (index: number, url: string) => {
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
    if (!name.trim() || !domains.some((d) => d.url.trim())) return;
    setSaving(true);
    try {
      const validDomains = domains
        .filter((d) => d.url.trim())
        .map((d) => ({
          url: d.url.startsWith("http") ? d.url : `https://${d.url}`,
          isActive: d.isActive,
        }));
      await addCustomSite(name.trim(), icon, validDomains);
      onClose();
    } catch (err) {
      console.error("Failed to add site:", err);
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
            <Globe size={20} className="text-[var(--color-accent-primary)]" />
            Add Custom Website
          </h2>
          <button
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Name & Icon */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">
                Site Name
              </label>
              <input
                className="input-glass"
                placeholder="e.g., MyAnime"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="w-20">
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">
                Icon
              </label>
              <input
                className="input-glass text-center text-xl"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
              />
            </div>
          </div>

          {/* Domains */}
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">
              Mirror Domains (min. 1)
            </label>
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
                    onChange={(e) => updateDomain(i, e.target.value)}
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
              className="mt-2 flex items-center gap-1 text-xs text-[var(--color-accent-primary)]
                hover:text-[var(--color-accent-tertiary)] transition-colors"
              onClick={addDomain}
            >
              <Plus size={12} />
              Add another domain
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || !name.trim() || !domains.some((d) => d.url.trim())}
          >
            {saving ? "Adding..." : "Add Website"}
          </button>
        </div>
      </div>
    </div>
  );
}
