import { Heart, Globe, Search, Shield, ShieldCheck, Settings } from "lucide-react";
import { useApp, type TabId } from "@/contexts/AppContext";
import { useState } from "react";
import ProxySettingsDialog from "@/components/dialogs/ProxySettingsDialog";

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "favorites", label: "Favorites", icon: <Heart size={16} /> },
  { id: "websites", label: "Websites", icon: <Globe size={16} /> },
  { id: "search", label: "Search", icon: <Search size={16} /> },
];

export default function TopBar() {
  const { activeTab, setActiveTab, proxy } = useApp();
  const [showProxy, setShowProxy] = useState(false);

  return (
    <>
      <header className="glass flex items-center justify-between px-6 h-14 shrink-0 select-none"
        style={{ borderTop: "none", borderLeft: "none", borderRight: "none" }}>
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold gradient-text tracking-tight">
            🎌 AnImEgThArInG
          </span>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 bg-[var(--color-bg-primary)]/40 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn flex items-center gap-2 ${
                activeTab === tab.id ? "active" : ""
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {/* Proxy Status */}
          <button
            className="flex items-center gap-2 btn-ghost text-xs"
            onClick={() => setShowProxy(true)}
            title="Proxy Settings"
          >
            {proxy.enabled ? (
              <>
                <ShieldCheck size={14} className="text-green-400" />
                <span className="text-green-400">Proxy ON</span>
              </>
            ) : (
              <>
                <Shield size={14} className="text-red-400" />
                <span className="text-red-400">Proxy OFF</span>
              </>
            )}
          </button>

          <button
            className="btn-ghost p-2"
            title="Settings"
            onClick={() => setShowProxy(true)}
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {showProxy && <ProxySettingsDialog onClose={() => setShowProxy(false)} />}
    </>
  );
}
