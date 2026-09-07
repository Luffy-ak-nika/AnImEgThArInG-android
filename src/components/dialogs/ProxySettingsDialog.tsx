import { X, Shield, ShieldCheck, DownloadCloud, Loader2, AlertTriangle } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  onClose: () => void;
}

const SUGGESTED_PROXIES = [
  { name: "Cloudflare WARP (local)", type: "socks5" as const, host: "127.0.0.1", port: 40000, note: "Install warp-cli first: curl -fsSL https://pkg.cloudflareclient.com/install.sh | sudo bash" },
  { name: "Tor (local)", type: "socks5" as const, host: "127.0.0.1", port: 9050, note: "Install tor: sudo apt install tor && sudo systemctl start tor" },
];

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

export default function ProxySettingsDialog({ onClose }: Props) {
  const { proxy, updateProxy } = useApp();
  const [config, setConfig] = useState({ ...proxy });
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const { dragOffset, isDragging, onTouchStart, onTouchMove, onTouchEnd } = useDragSheet(onClose);

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
          maxHeight: "88dvh",
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
            marginBottom: 16,
            flexShrink: 0,
          }}
        >
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
            {config.enabled ? (
              <ShieldCheck size={20} color="#4ade80" />
            ) : (
              <Shield size={20} color="var(--color-text-muted)" />
            )}
            Proxy Settings
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
          {/* ISP Block Warning */}
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <AlertTriangle size={16} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontSize: 12, color: "#f87171", fontWeight: 600 }}>Your ISP blocks anime streaming sites</p>
                <p style={{ fontSize: 11, color: "rgba(248,113,113,0.7)", marginTop: 2 }}>
                  The "TLS handshake" error means your ISP is actively blocking these domains.
                  You MUST enable a proxy to access any streaming site.
                </p>
              </div>
            </div>
          </div>

          {/* Android notice */}
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "rgba(251,84,43,0.08)",
              border: "1px solid rgba(251,84,43,0.25)",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>📱</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#FB542B" }}>Android Note</p>
                <p style={{ fontSize: 11, marginTop: 2, color: "rgba(251,84,43,0.75)" }}>
                  On Android, proxy settings apply to domain reachability checks only.
                  For per-webview tunneling, use a system VPN app (e.g. Cloudflare WARP, ProtonVPN).
                </p>
              </div>
            </div>
          </div>

          {/* Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 12,
              borderRadius: 12,
              background: "var(--color-bg-primary)",
              border: "1px solid var(--color-border-default)",
              marginBottom: 16,
            }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>Enable Proxy</p>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Required to bypass ISP blocks</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              style={{
                width: 48,
                height: 28,
                borderRadius: 14,
                border: "none",
                background: config.enabled ? "var(--color-accent-primary)" : "var(--color-bg-hover)",
                position: "relative",
                cursor: "pointer",
                flexShrink: 0,
                transition: "background 0.2s",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 4,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  background: "white",
                  transition: "transform 0.2s",
                  transform: config.enabled ? "translateX(24px)" : "translateX(4px)",
                }}
              />
            </button>
          </div>

          {/* Config — fades when disabled */}
          <div style={{ opacity: config.enabled ? 1 : 0.35, pointerEvents: config.enabled ? "auto" : "none", transition: "opacity 0.2s" }}>
            {/* Suggested proxies */}
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, fontWeight: 500 }}>Quick Setup (Recommended)</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {SUGGESTED_PROXIES.map((s) => (
                <button
                  key={s.name}
                  onClick={() => applySuggested(s)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 12,
                    background: "var(--color-bg-primary)",
                    border: "1px solid var(--color-border-default)",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{s.name}</p>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2, fontFamily: "monospace" }}>
                    {s.type}://{s.host}:{s.port}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 2 }}>{s.note}</p>
                </button>
              ))}
            </div>

            {/* Auto-fetch */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                borderRadius: 12,
                background: "var(--color-bg-primary)",
                border: "1px solid var(--color-border-default)",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Or try a free public proxy</span>
              <button
                onClick={fetchFreeProxy}
                disabled={fetching}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  color: "var(--color-accent-secondary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 10px",
                  borderRadius: 8,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {fetching ? <Loader2 size={12} className="animate-spin" /> : <DownloadCloud size={12} />}
                Auto-fetch
              </button>
            </div>
            {fetchError && <p style={{ fontSize: 12, color: "#f87171", marginBottom: 12 }}>{fetchError}</p>}

            {/* Proxy Type */}
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>Proxy Type</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["http", "socks5"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setConfig({ ...config, proxyType: type })}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 500,
                    border: `1.5px solid ${config.proxyType === type ? "var(--color-accent-primary)" : "var(--color-border-default)"}`,
                    background: config.proxyType === type ? "rgba(168,85,247,0.1)" : "transparent",
                    color: config.proxyType === type ? "var(--color-accent-primary)" : "var(--color-text-secondary)",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Host & Port */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>Host / IP</p>
                <input
                  className="input-glass"
                  placeholder="127.0.0.1"
                  value={config.host}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid rgba(148,163,184,0.15)", background: "var(--color-bg-hover)", color: "var(--color-text-primary)", fontSize: 14, outline: "none" }}
                />
              </div>
              <div>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>Port</p>
                <input
                  className="input-glass"
                  type="number"
                  placeholder="40000"
                  value={config.port || ""}
                  onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid rgba(148,163,184,0.15)", background: "var(--color-bg-hover)", color: "var(--color-text-primary)", fontSize: 14, outline: "none" }}
                />
              </div>
            </div>

            {/* Preview */}
            {config.host && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "var(--color-bg-primary)",
                  border: "1px solid var(--color-border-default)",
                  marginBottom: 8,
                }}
              >
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Proxy URL:</p>
                <p style={{ fontSize: 14, fontFamily: "monospace", color: "var(--color-accent-primary)" }}>
                  {config.proxyType}://{config.host}:{config.port}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── STICKY Save button footer ── */}
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
            {saving ? "Saving..." : "Save & Apply"}
          </button>
        </div>
      </div>
    </>
  );
}
