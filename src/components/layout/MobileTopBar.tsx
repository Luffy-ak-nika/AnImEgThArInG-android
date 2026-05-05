import { Shield, ShieldCheck, LayoutGrid, Settings } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useState } from "react";
import ProxySettingsDialog from "@/components/dialogs/ProxySettingsDialog";

interface Props {
  openCount: number;
  onOpenDrawer: () => void;
}

export default function MobileTopBar({ openCount, onOpenDrawer }: Props) {
  const { proxy } = useApp();
  const [showProxy, setShowProxy] = useState(false);

  return (
    <>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 90,
          height: "calc(56px + env(safe-area-inset-top, 0px))",
          background: "rgba(12,12,20,0.97)",
          backdropFilter: "blur(20px) saturate(200%)",
          WebkitBackdropFilter: "blur(20px) saturate(200%)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "flex-end",   /* content sits at bottom of bar, above safe area */
          paddingLeft: "16px",
          paddingRight: "12px",
          paddingBottom: "8px",
          gap: "10px",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        {/* Logo */}
        <span
          style={{
            flex: 1,
            fontSize: "17px",
            fontWeight: 700,
            background: "linear-gradient(135deg, #a855f7, #ec4899)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.01em",
          }}
        >
          🎌 AnImEgThArInG
        </span>

        {/* Open browsers badge button */}
        {openCount > 0 && (
          <button
            onClick={onOpenDrawer}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 12px",
              borderRadius: "20px",
              border: "1px solid rgba(168,85,247,0.3)",
              background: "rgba(168,85,247,0.12)",
              color: "#a855f7",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <LayoutGrid size={13} />
            {openCount} open
          </button>
        )}

        {/* Proxy indicator */}
        <button
          onClick={() => setShowProxy(true)}
          title="Proxy Settings"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "6px 10px",
            borderRadius: "20px",
            border: proxy.enabled
              ? "1px solid rgba(34,197,94,0.3)"
              : "1px solid rgba(239,68,68,0.2)",
            background: proxy.enabled
              ? "rgba(34,197,94,0.1)"
              : "rgba(239,68,68,0.08)",
            color: proxy.enabled ? "#4ade80" : "#f87171",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {proxy.enabled ? (
            <ShieldCheck size={13} />
          ) : (
            <Shield size={13} />
          )}
          {proxy.enabled ? "VPN" : "No VPN"}
        </button>

        {/* Settings */}
        <button
          onClick={() => setShowProxy(true)}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <Settings size={17} />
        </button>
      </header>

      {showProxy && <ProxySettingsDialog onClose={() => setShowProxy(false)} />}
    </>
  );
}
