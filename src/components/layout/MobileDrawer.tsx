import { X, Monitor, ExternalLink } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

interface Props {
  onClose: () => void;
}

export default function MobileDrawer({ onClose }: Props) {
  const { openWebviews, focusWebview, closeWebview } = useApp();

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Bottom Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 201,
          background: "var(--color-bg-secondary)",
          borderRadius: "20px 20px 0 0",
          borderTop: "1px solid var(--color-border-default)",
          padding: "16px",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          animation: "slideUpSheet 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: "36px",
            height: "4px",
            background: "rgba(255,255,255,0.15)",
            borderRadius: "2px",
            margin: "0 auto 16px",
          }}
        />

        {/* Title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Open Browsers
          </span>
          <button
            onClick={onClose}
            style={{
              padding: "6px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {openWebviews.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "32px",
                gap: "8px",
                opacity: 0.5,
              }}
            >
              <Monitor size={32} />
              <span style={{ fontSize: "14px" }}>No open browsers</span>
            </div>
          ) : (
            openWebviews.map((label) => {
              const siteName = label
                .replace("webview-", "")
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());

              return (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 12px",
                    borderRadius: "14px",
                    marginBottom: "6px",
                    background: "var(--color-bg-hover)",
                    border: "1px solid var(--color-border-default)",
                    cursor: "pointer",
                  }}
                  onClick={() => { focusWebview(label); onClose(); }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--color-status-online)",
                      boxShadow: "0 0 6px var(--color-status-online)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: "15px", fontWeight: 500 }}>
                    {siteName}
                  </span>
                  <ExternalLink
                    size={14}
                    style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); closeWebview(label); }}
                    style={{
                      padding: "6px",
                      borderRadius: "8px",
                      border: "none",
                      background: "rgba(239,68,68,0.1)",
                      color: "#f87171",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUpSheet {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
