import { useEffect, useState } from "react";
import { AppProvider, useApp } from "@/contexts/AppContext";
import MobileTopBar from "@/components/layout/MobileTopBar";
import MobileTabBar from "@/components/layout/MobileTabBar";
import MobileDrawer from "@/components/layout/MobileDrawer";
import FavoritesTab from "@/components/tabs/FavoritesTab";
import WebsitesTab from "@/components/tabs/WebsitesTab";
import SearchTab from "@/components/tabs/SearchTab";

function AppContent() {
  const { activeTab, isLoading, openWebviews } = useApp();
  const [showDrawer, setShowDrawer] = useState(false);

  // Close drawer if no open webviews
  useEffect(() => {
    if (openWebviews.length === 0) setShowDrawer(false);
  }, [openWebviews]);

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-4 animate-float">🎌</div>
          <h1 className="text-2xl font-bold gradient-text mb-2">AnImEgThArInG</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Loading your anime world...</p>
          <div className="mt-4 w-32 h-1 mx-auto rounded-full overflow-hidden bg-[var(--color-bg-hover)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-tertiary)]"
              style={{
                animation: "shimmer 1.5s ease-in-out infinite",
                backgroundSize: "200% 100%",
                width: "100%",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Mobile Top Bar */}
      <MobileTopBar openCount={openWebviews.length} onOpenDrawer={() => setShowDrawer(true)} />

      {/* Main content — scrollable, padded for top bar + bottom tab bar */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          paddingTop: "56px",  /* height of mobile top bar */
          paddingBottom: "70px", /* height of mobile tab bar */
        }}
      >
        {activeTab === "favorites" && <FavoritesTab />}
        {activeTab === "websites"  && <WebsitesTab />}
        {activeTab === "search"    && <SearchTab />}
      </main>

      {/* Bottom tab navigation */}
      <MobileTabBar />

      {/* Open browsers bottom sheet */}
      {showDrawer && <MobileDrawer onClose={() => setShowDrawer(false)} />}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
