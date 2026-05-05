import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  initDatabase,
  getAllSites,
  getSiteDomains,
  getAllFavorites,
  insertSite,
  siteCount,
  type DbSite,
  type DbDomain,
  type DbFavorite,
  type WatchStatus,
  addFavorite as dbAddFavorite,
  removeFavorite as dbRemoveFavorite,
  updateSiteDomains as dbUpdateDomains,
  setActiveDomain as dbSetActiveDomain,
  deleteSite as dbDeleteSite,
  upsertFavorite as dbUpsertFavorite,
  updateFavoriteProgress as dbUpdateFavoriteProgress,
} from "@/lib/db";
import { DEFAULT_SITES } from "@/lib/sites";
import {
  getProxySettings,
  setProxySettings,
  proxyToUrl,
  type ProxyConfig,
  DEFAULT_PROXY,
} from "@/lib/store";

export type TabId = "favorites" | "websites" | "search";

export interface SiteWithDomains extends DbSite {
  domains: DbDomain[];
  activeDomain: string;
  searchPath?: string;
}

interface AppContextValue {
  // Navigation
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;

  // Sites
  sites: SiteWithDomains[];
  refreshSites: () => Promise<void>;
  addCustomSite: (
    name: string,
    icon: string,
    domains: { url: string; isActive: boolean }[]
  ) => Promise<void>;
  updateDomains: (
    siteId: number,
    domains: { url: string; isActive: boolean }[]
  ) => Promise<void>;
  switchActiveDomain: (siteId: number, domainUrl: string) => Promise<void>;
  removeCustomSite: (siteId: number) => Promise<void>;

  // Favorites
  favorites: DbFavorite[];
  refreshFavorites: () => Promise<void>;
  addToFavorites: (
    title: string,
    thumbnail: string,
    siteId: number | null,
    siteName: string,
    lastEpisode: string,
    pageUrl: string
  ) => Promise<void>;
  upsertToFavorites: (
    title: string,
    thumbnail: string,
    siteId: number | null,
    siteName: string,
    lastEpisode: string,
    pageUrl: string
  ) => Promise<void>;
  updateFavoriteProgress: (
    id: number,
    watchedEpisodes: number,
    totalEpisodes: number,
    status: WatchStatus,
    lastEpisode: string,
    notes: string
  ) => Promise<void>;
  removeFromFavorites: (id: number) => Promise<void>;

  // Webviews
  openWebviews: string[];
  openSiteWebview: (site: SiteWithDomains) => Promise<void>;
  openUrlWebview: (label: string, url: string, title: string, useProxy?: boolean) => Promise<void>;
  closeWebview: (label: string) => Promise<void>;
  focusWebview: (label: string) => Promise<void>;
  navigateWebviewBack: (label: string) => Promise<void>;
  navigateWebviewForward: (label: string) => Promise<void>;
  refreshOpenWebviews: () => Promise<void>;

  // Proxy
  proxy: ProxyConfig;
  updateProxy: (proxy: ProxyConfig) => Promise<void>;

  // UI State
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabId>("favorites");
  const [sites, setSites] = useState<SiteWithDomains[]>([]);
  const [favorites, setFavorites] = useState<DbFavorite[]>([]);
  const [openWebviews, setOpenWebviews] = useState<string[]>([]);
  const [proxy, setProxy] = useState<ProxyConfig>(DEFAULT_PROXY);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Initialize database and load data
  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        // Seed default sites if empty
        const count = await siteCount();
        if (count === 0) {
          for (const site of DEFAULT_SITES) {
            await insertSite(site.name, site.icon, site.isCustom, site.domains);
          }
        }
        await refreshSites();
        await refreshFavorites();

        // Load saved proxy settings
        const savedProxy = await getProxySettings();

        // If proxy was never saved (first launch), auto-detect a local proxy
        if (!savedProxy.host) {
          try {
            const detected: { ip: string; port: number; proxy_type: string } =
              await invoke("auto_detect_proxy");
            const autoProxy: ProxyConfig = {
              enabled: true,
              proxyType: detected.proxy_type as "http" | "socks5",
              host: detected.ip,
              port: detected.port,
            };
            await setProxySettings(autoProxy);
            setProxy(autoProxy);
          } catch {
            // No local proxy found — leave disabled
            setProxy(savedProxy);
          }
        } else {
          setProxy(savedProxy);
        }
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Poll open webviews periodically
  useEffect(() => {
    const interval = setInterval(refreshOpenWebviews, 2000);
    return () => clearInterval(interval);
  }, []);

  const refreshSites = useCallback(async () => {
    const allSites = await getAllSites();
    const sitesWithDomains: SiteWithDomains[] = [];

    for (const site of allSites) {
      const domains = await getSiteDomains(site.id);
      const activeDomain =
        domains.find((d) => d.is_active)?.url || domains[0]?.url || "";

      // Find search path from default sites
      const defaultSite = DEFAULT_SITES.find(
        (ds) => ds.name.toLowerCase() === site.name.toLowerCase()
      );

      sitesWithDomains.push({
        ...site,
        domains,
        activeDomain,
        searchPath: defaultSite?.searchPath,
      });
    }

    setSites(sitesWithDomains);
  }, []);

  const refreshFavorites = useCallback(async () => {
    const allFavs = await getAllFavorites();
    setFavorites(allFavs);
  }, []);

  const refreshOpenWebviews = useCallback(async () => {
    try {
      const labels: string[] = await invoke("list_open_webviews");
      setOpenWebviews(labels);
    } catch {
      // Ignore errors during polling
    }
  }, []);

  const addCustomSite = useCallback(
    async (
      name: string,
      icon: string,
      domains: { url: string; isActive: boolean }[]
    ) => {
      await insertSite(name, icon, true, domains);
      await refreshSites();
    },
    [refreshSites]
  );

  const updateDomains = useCallback(
    async (siteId: number, domains: { url: string; isActive: boolean }[]) => {
      await dbUpdateDomains(siteId, domains);
      await refreshSites();
    },
    [refreshSites]
  );

  const switchActiveDomain = useCallback(
    async (siteId: number, domainUrl: string) => {
      await dbSetActiveDomain(siteId, domainUrl);
      await refreshSites();
    },
    [refreshSites]
  );

  const removeCustomSite = useCallback(
    async (siteId: number) => {
      await dbDeleteSite(siteId);
      await refreshSites();
    },
    [refreshSites]
  );

  const addToFavorites = useCallback(
    async (
      title: string,
      thumbnail: string,
      siteId: number | null,
      siteName: string,
      lastEpisode: string,
      pageUrl: string
    ) => {
      try {
        await dbAddFavorite(title, thumbnail, siteId, siteName, lastEpisode, pageUrl);
        await refreshFavorites();
      } catch (err) {
        console.error("Failed to add favorite:", err);
      }
    },
    [refreshFavorites]
  );

  const upsertToFavorites = useCallback(
    async (
      title: string,
      thumbnail: string,
      siteId: number | null,
      siteName: string,
      lastEpisode: string,
      pageUrl: string
    ) => {
      try {
        await dbUpsertFavorite(title, thumbnail, siteId, siteName, lastEpisode, pageUrl);
        await refreshFavorites();
      } catch (err) {
        console.error("Failed to upsert favorite:", err);
      }
    },
    [refreshFavorites]
  );

  const updateFavoriteProgress = useCallback(
    async (
      id: number,
      watchedEpisodes: number,
      totalEpisodes: number,
      status: WatchStatus,
      lastEpisode: string,
      notes: string
    ) => {
      try {
        await dbUpdateFavoriteProgress(id, watchedEpisodes, totalEpisodes, status, lastEpisode, notes);
        await refreshFavorites();
      } catch (err) {
        console.error("Failed to update progress:", err);
      }
    },
    [refreshFavorites]
  );

  const removeFromFavorites = useCallback(
    async (id: number) => {
      await dbRemoveFavorite(id);
      await refreshFavorites();
    },
    [refreshFavorites]
  );

  // Smart mirror routing: try active domain first, then try all other mirrors
  // If proxy is enabled but failing, falls back to direct connection
  const findWorkingUrl = useCallback(
    async (site: SiteWithDomains): Promise<{ url: string; useProxy: boolean }> => {
      const proxyUrl = proxyToUrl(proxy);
      const allDomains = [
        site.activeDomain,
        ...site.domains.filter(d => d.url !== site.activeDomain).map(d => d.url),
      ];

      // Round 1: try with proxy (if enabled)
      if (proxyUrl) {
        for (const domainUrl of allDomains) {
          try {
            const works = await invoke<boolean>("check_domain", {
              url: domainUrl,
              proxyUrl,
            });
            if (works) {
              if (domainUrl !== site.activeDomain) {
                await switchActiveDomain(site.id, domainUrl);
              }
              return { url: domainUrl, useProxy: true };
            }
          } catch {
            continue;
          }
        }
      }

      // Round 2: try direct (no proxy) — either proxy is off, or it failed
      for (const domainUrl of allDomains) {
        try {
          const works = await invoke<boolean>("check_domain", {
            url: domainUrl,
            proxyUrl: null,
          });
          if (works) {
            if (domainUrl !== site.activeDomain) {
              await switchActiveDomain(site.id, domainUrl);
            }
            return { url: domainUrl, useProxy: false };
          }
        } catch {
          continue;
        }
      }

      // Nothing worked, return active domain without proxy (let it show the site's own error)
      return { url: site.activeDomain, useProxy: false };
    },
    [proxy, switchActiveDomain]
  );

  const openSiteWebview = useCallback(
    async (site: SiteWithDomains) => {
      const label = `webview-${site.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

      // Smart mirror routing — returns working URL and whether proxy worked
      const { url: workingUrl, useProxy } = await findWorkingUrl(site);
      const proxyUrl = useProxy ? proxyToUrl(proxy) : null;

      try {
        await invoke("open_site_webview", {
          label,
          url: workingUrl,
          title: `AnImEgThArInG — ${site.name}`,
          proxyUrl,
        });
        await refreshOpenWebviews();
      } catch (err) {
        console.error("Failed to open webview:", err);
      }
    },
    [proxy, refreshOpenWebviews, findWorkingUrl]
  );

  const openUrlWebview = useCallback(
    async (label: string, url: string, title: string, useProxy: boolean = true) => {
      const proxyUrl = useProxy ? proxyToUrl(proxy) : null;
      try {
        await invoke("open_site_webview", {
          label,
          url,
          title: `AnImEgThArInG — ${title}`,
          proxyUrl,
        });
        await refreshOpenWebviews();
      } catch (err) {
        console.error("Failed to open webview:", err);
      }
    },
    [proxy, refreshOpenWebviews]
  );

  const closeWebview = useCallback(
    async (label: string) => {
      try {
        await invoke("close_webview", { label });
        await refreshOpenWebviews();
      } catch (err) {
        console.error("Failed to close webview:", err);
      }
    },
    [refreshOpenWebviews]
  );

  const focusWebview = useCallback(async (label: string) => {
    try {
      await invoke("focus_webview", { label });
    } catch (err) {
      console.error("Failed to focus webview:", err);
    }
  }, []);

  const navigateWebviewBack = useCallback(async (label: string) => {
    try {
      await invoke("navigate_back_webview", { label });
    } catch (err) {
      console.error("Failed to navigate back:", err);
    }
  }, []);

  const navigateWebviewForward = useCallback(async (label: string) => {
    try {
      await invoke("navigate_forward_webview", { label });
    } catch (err) {
      console.error("Failed to navigate forward:", err);
    }
  }, []);

  const updateProxy = useCallback(async (newProxy: ProxyConfig) => {
    await setProxySettings(newProxy);
    setProxy(newProxy);
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        sites,
        refreshSites,
        addCustomSite,
        updateDomains,
        switchActiveDomain,
        removeCustomSite,
        favorites,
        refreshFavorites,
        addToFavorites,
        upsertToFavorites,
        updateFavoriteProgress,
        removeFromFavorites,
        openWebviews,
        openSiteWebview,
        openUrlWebview,
        closeWebview,
        focusWebview,
        navigateWebviewBack,
        navigateWebviewForward,
        refreshOpenWebviews,
        proxy,
        updateProxy,
        isLoading,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
