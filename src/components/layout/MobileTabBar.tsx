import { Heart, Globe, Search } from "lucide-react";
import { useApp, type TabId } from "@/contexts/AppContext";

const tabs: { id: TabId; label: string; icon: React.ReactNode; activeIcon?: React.ReactNode }[] = [
  { id: "favorites", label: "Favorites", icon: <Heart size={22} /> },
  { id: "websites",  label: "Browse",    icon: <Globe  size={22} /> },
  { id: "search",    label: "Search",    icon: <Search size={22} /> },
];

export default function MobileTabBar() {
  const { activeTab, setActiveTab } = useApp();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: "62px",
        background: "rgba(14,14,24,0.97)",
        backdropFilter: "blur(20px) saturate(200%)",
        WebkitBackdropFilter: "blur(20px) saturate(200%)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              padding: "6px 0",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              transition: "all 0.2s ease",
              WebkitTapHighlightColor: "transparent",
              color: isActive
                ? "var(--color-accent-primary)"
                : "var(--color-text-muted)",
            }}
          >
            {/* Icon */}
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "38px",
                height: "28px",
                borderRadius: "10px",
                background: isActive
                  ? "rgba(168,85,247,0.15)"
                  : "transparent",
                transition: "all 0.2s ease",
              }}
            >
              {tab.icon}
            </span>
            {/* Label */}
            <span
              style={{
                fontSize: "10px",
                fontWeight: isActive ? 600 : 400,
                letterSpacing: "0.02em",
                lineHeight: 1,
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
