import { X, Shield, ShieldCheck, DownloadCloud, Loader2, AlertTriangle } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  onClose: () => void;
}

const SUGGESTED_PROXIES = [
  { name: "Cloudflare WARP (local)", type: "socks5" as const, host: "127.0.0.1", port: 40000, note: "Install warp-cli first: curl -fsSL https://pkg.cloudflareclient.com/install.sh | sudo bash" },
  { name: "Tor (local)", type: "socks5" as const, host: "127.0.0.1", port: 9050, note: "Install tor: sudo apt install tor && sudo systemctl start tor" },
];

export default function ProxySettingsDialog({ onClose }: Props) {
  const { proxy, updateProxy } = useApp();
  const [config, setConfig] = useState({ ...proxy });
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProxy(config);
      onClose();
    } catch (err) {
      console.error("Failed to save proxy:", err);
    } finally {
      setSaving(false);
    }
  };

  const fetchFreeProxy = async () => {
    setFetching(true);
    setFetchError("");
    try {
      const data: { ip: string; port: number; proxy_type: string } = await invoke("fetch_universal_proxy");
      setConfig({
        enabled: true,
        proxyType: data.proxy_type as "http" | "socks5",
        host: data.ip,
        port: data.port,
      });
    } catch (err) {
      setFetchError(String(err));
    } finally {
      setFetching(false);
    }
  };

  const applySuggested = (s: typeof SUGGESTED_PROXIES[0]) => {
    setConfig({
      enabled: true,
      proxyType: s.type,
      host: s.host,
      port: s.port,
    });
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            {config.enabled ? (
              <ShieldCheck size={20} className="text-green-400" />
            ) : (
              <Shield size={20} className="text-[var(--color-text-muted)]" />
            )}
            Proxy Settings
          </h2>
          <button
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* ISP Block Warning */}
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-3">
          <div className="flex gap-2">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-red-400 font-medium">Your ISP blocks anime streaming sites</p>
              <p className="text-[11px] text-red-400/70 mt-0.5">
                The "TLS handshake" error means your ISP is actively blocking these domains. 
                You MUST enable a proxy to access any streaming site.
              </p>
            </div>
          </div>
        </div>

        {/* Android-specific notice */}
        <div className="p-3 rounded-xl border mb-4" style={{ background: "rgba(251,84,43,0.08)", borderColor: "rgba(251,84,43,0.25)" }}>
          <div className="flex gap-2">
            <span style={{ fontSize: 16, flexShrink: 0 }}>📱</span>
            <div>
              <p className="text-xs font-semibold" style={{ color: "#FB542B" }}>Android Note</p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(251,84,43,0.75)" }}>
                On Android, proxy settings apply to domain reachability checks only.
                For per-webview tunneling, use a system VPN app (e.g. Cloudflare WARP, ProtonVPN).
              </p>
            </div>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-primary)] mb-4 border border-[var(--color-border-default)]">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Enable Proxy</p>
            <p className="text-xs text-[var(--color-text-muted)]">Required to bypass ISP blocks</p>
          </div>
          <button
            className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${
              config.enabled ? "bg-[var(--color-accent-primary)]" : "bg-[var(--color-bg-hover)]"
            }`}
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              config.enabled ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>

        {/* Config Form */}
        <div className={`space-y-4 transition-opacity ${config.enabled ? "" : "opacity-40 pointer-events-none"}`}>
          {/* Suggested proxies */}
          <div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-2 font-medium">Quick Setup (Recommended)</p>
            <div className="space-y-2">
              {SUGGESTED_PROXIES.map((s) => (
                <button
                  key={s.name}
                  className="w-full text-left p-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border-default)]
                    hover:border-[var(--color-accent-primary)] transition-colors group"
                  onClick={() => applySuggested(s)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--color-text-primary)]">{s.name}</span>
                    <span className="text-[10px] text-[var(--color-accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                      Apply
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 font-mono">{s.type}://{s.host}:{s.port}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{s.note}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Auto-fetch */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border-default)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Or try a free public proxy</span>
            <button
              className="text-xs flex items-center gap-1 text-[var(--color-accent-secondary)] hover:text-[var(--color-accent-primary)] transition-colors"
              onClick={fetchFreeProxy}
              disabled={fetching}
            >
              {fetching ? <Loader2 size={12} className="animate-spin" /> : <DownloadCloud size={12} />}
              Auto-fetch
            </button>
          </div>
          {fetchError && <p className="text-xs text-red-400">{fetchError}</p>}

          {/* Proxy Type */}
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">Proxy Type</label>
            <div className="flex gap-2">
              {(["http", "socks5"] as const).map((type) => (
                <button
                  key={type}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    config.proxyType === type
                      ? "bg-[var(--color-accent-primary)]/15 border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                      : "bg-transparent border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                  }`}
                  onClick={() => setConfig({ ...config, proxyType: type })}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Host & Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">Host / IP</label>
              <input
                className="input-glass"
                placeholder="127.0.0.1"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">Port</label>
              <input
                className="input-glass"
                type="number"
                placeholder="40000"
                value={config.port || ""}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Preview */}
          {config.host && (
            <div className="p-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border-default)]">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Proxy URL:</p>
              <p className="text-sm font-mono text-[var(--color-accent-primary)]">
                {config.proxyType}://{config.host}:{config.port}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save & Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
