import {
  Search as SearchIcon,
  ExternalLink,
  Heart,
  Globe,
  Command,
  Star,
  Tv,
  Loader2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { useApp, type SiteWithDomains } from "@/contexts/AppContext";
import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AnimeResult {
  mal_id: number;
  title: string;
  title_english: string | null;
  image_url: string;
  score: number | null;
  episodes: number | null;
  status: string;
  synopsis: string;
}

export default function SearchTab() {
  const { sites, searchQuery, setSearchQuery, openUrlWebview, addToFavorites, proxy, favorites } =
    useApp();

  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<AnimeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [openingSite, setOpeningSite] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const doSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const data: AnimeResult[] = await invoke("search_anime", { query: query.trim() });
      setResults(data);
    } catch (err) {
      console.error("Search error:", err);
      setError(String(err));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (searchQuery.trim().length >= 2) {
      searchTimeout.current = setTimeout(() => doSearch(searchQuery), 700);
    } else {
      setResults([]);
      setSearched(false);
    }

    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery, doSearch]);

  const handleOpenOnSite = async (anime: AnimeResult, site: SiteWithDomains) => {
    const animeName = anime.title_english || anime.title;
    const key = `${anime.mal_id}-${site.id}`;
    setOpeningSite(key);

    const searchPath = site.searchPath || "/search?q=";
    let targetPathAndQuery = `${searchPath}${encodeURIComponent(animeName)}`;

    try {
      // SMART ROUTING via MalSync API
      const siteMapping: Record<string, string> = {
        "HiAnime": "Zoro",
        "AnimePahe": "animepahe",
        "GogoAnime": "Gogoanime",
        "AniWave": "9anime",
        "AnimeSuge": "AnimeSuge",
      };
      
      const malSyncSite = siteMapping[site.name] || site.name;
      const res = await fetch(`https://api.malsync.moe/mal/anime/${anime.mal_id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.Sites && data.Sites[malSyncSite]) {
          const siteData = data.Sites[malSyncSite];
          const firstKey = Object.keys(siteData)[0];
          if (firstKey && siteData[firstKey].url) {
            // Extract just the path and query from the MalSync URL
            const nativeUrl = new URL(siteData[firstKey].url);
            targetPathAndQuery = nativeUrl.pathname + nativeUrl.search;
          }
        }
      }
    } catch (e) {
      console.warn("MALSync API lookup failed", e);
    }

    const domainsToTry = [
      site.activeDomain,
      ...site.domains.filter(d => d.url !== site.activeDomain).map(d => d.url),
    ];

    let targetUrl = `${domainsToTry[0]}${targetPathAndQuery}`;
    const proxyUrl = proxy.enabled ? `${proxy.proxyType}://${proxy.host}:${proxy.port}` : null;
    let found = false;

    // Round 1: try with proxy
    if (proxyUrl) {
      for (const domain of domainsToTry) {
        try {
          const works = await invoke<boolean>("check_domain", { url: domain, proxyUrl });
          if (works) {
            targetUrl = `${domain}${targetPathAndQuery}`;
            found = true;
            break;
          }
        } catch { continue; }
      }
    }

    // Round 2: try direct (no proxy)
    if (!found) {
      for (const domain of domainsToTry) {
        try {
          const works = await invoke<boolean>("check_domain", { url: domain, proxyUrl: null });
          if (works) {
            targetUrl = `${domain}${targetPathAndQuery}`;
            break;
          }
        } catch { continue; }
      }
    }

    const label = `webview-${site.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-search`;
    openUrlWebview(label, targetUrl, `${animeName} — ${site.name}`, found);
    setOpeningSite(null);
  };

  const handleSaveToFavorites = async (anime: AnimeResult) => {
    setSavingId(anime.mal_id);
    try {
      await addToFavorites(
        anime.title_english || anime.title,
        anime.image_url,
        null,
        "Search",
        anime.episodes ? `${anime.episodes} eps` : "",
        `https://myanimelist.net/anime/${anime.mal_id}`
      );
    } catch (err) {
      console.error("Save favorite error:", err);
    }
    setTimeout(() => setSavingId(null), 2000);
  };

  const searchableSites = sites.filter(s => s.searchPath && s.domains.length > 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <SearchIcon size={24} className="text-[var(--color-accent-primary)]" />
          Search Anime
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Search anime → Pick a streaming site → Opens with smart mirror routing
        </p>
      </div>

      {/* Search Input */}
      <div className="max-w-2xl mx-auto mb-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <div className="relative">
          <SearchIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSearch(searchQuery); }}
            placeholder="Type anime name to search..."
            className="input-glass pr-20 py-4 text-base rounded-2xl"
            style={{ paddingLeft: '48px' }}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1
            text-[var(--color-text-muted)] text-xs bg-[var(--color-bg-hover)] px-2 py-1 rounded-md">
            <Command size={10} /><span>K</span>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <Loader2 size={32} className="text-[var(--color-accent-primary)] animate-spin mb-3" />
          <p className="text-sm text-[var(--color-text-muted)]">Searching anime...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto mb-6 animate-fade-in">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle size={18} className="text-red-400 shrink-0" />
            <div>
              <p className="text-sm text-red-400 font-medium">Search failed</p>
              <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Proxy warning */}
      {!proxy.enabled && searched && (
        <div className="max-w-2xl mx-auto mb-4 animate-fade-in">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <p className="text-xs text-amber-400">
              ⚠️ Proxy is OFF. Anime sites are likely blocked by your ISP. Enable a proxy in Settings to access them.
            </p>
          </div>
        </div>
      )}

      {/* Results — Each anime followed by per-site buttons */}
      {!loading && results.length > 0 && (
        <div className="max-w-4xl mx-auto space-y-6 pb-8">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Found {results.length} results for "{searchQuery}"
          </p>

          {results.map((anime) => (
            <div key={anime.mal_id} className="glass-card overflow-hidden animate-fade-in-up"
              style={{ transform: "none" }}>
              {/* Anime info row */}
              <div className="flex gap-4 p-4">
                {/* Thumbnail */}
                <img
                  src={anime.image_url}
                  alt={anime.title}
                  className="w-20 h-28 object-cover rounded-xl shrink-0"
                  loading="lazy"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2">
                      {anime.title_english || anime.title}
                    </h3>
                    {/* Favorite button */}
                    <button
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                        savingId === anime.mal_id || favorites.some(f => f.title === (anime.title_english || anime.title))
                          ? "bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)]"
                          : "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-accent-primary)]/10"
                      }`}
                      onClick={() => !favorites.some(f => f.title === (anime.title_english || anime.title)) && handleSaveToFavorites(anime)}
                      disabled={favorites.some(f => f.title === (anime.title_english || anime.title))}
                      title={favorites.some(f => f.title === (anime.title_english || anime.title)) ? "Saved to Favorites" : "Save to Favorites"}
                    >
                      <Heart
                        size={14}
                        fill={favorites.some(f => f.title === (anime.title_english || anime.title)) || savingId === anime.mal_id ? "currentColor" : "none"}
                      />
                      {favorites.some(f => f.title === (anime.title_english || anime.title)) ? "Saved" : savingId === anime.mal_id ? "Saving" : "Save"}
                    </button>
                  </div>

                  {anime.title_english && anime.title_english !== anime.title && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">{anime.title}</p>
                  )}

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--color-text-secondary)]">
                    {anime.score && (
                      <span className="flex items-center gap-1">
                        <Star size={11} className="text-yellow-400" fill="currentColor" />
                        {anime.score}
                      </span>
                    )}
                    {anime.episodes && (
                      <span className="flex items-center gap-1">
                        <Tv size={11} /> {anime.episodes} eps
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-hover)] text-[10px]">
                      {anime.status}
                    </span>
                  </div>

                  {anime.synopsis && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5 line-clamp-2">
                      {anime.synopsis}
                    </p>
                  )}

                  {/* Status Indicator handled inline */}
                </div>
              </div>

              {/* Per-site buttons — SEPARATED */}
              <div className="border-t border-[var(--color-border-default)] bg-[var(--color-bg-primary)]/30">
                <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
                  Watch on streaming sites
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0">
                  {searchableSites.map((site) => {
                    const key = `${anime.mal_id}-${site.id}`;
                    const isOpening = openingSite === key;
                    return (
                      <button
                        key={site.id}
                        disabled={openingSite !== null}
                        className={`flex items-center gap-2 px-4 py-3 text-xs transition-colors
                          border-b border-r border-[var(--color-border-default)]
                          ${isOpening
                            ? "bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]"
                            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                          }
                          ${openingSite !== null && !isOpening ? "opacity-30" : ""}`}
                        onClick={() => handleOpenOnSite(anime, site)}
                      >
                        {isOpening ? (
                          <Loader2 size={14} className="animate-spin shrink-0" />
                        ) : (
                          <span className="text-base shrink-0">{site.icon}</span>
                        )}
                        <span className="truncate font-medium">{site.name}</span>
                        <ChevronRight size={12} className="ml-auto shrink-0 opacity-40" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {!loading && searched && results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <SearchIcon size={40} className="text-[var(--color-text-muted)] mb-3 opacity-30" />
          <p className="text-sm text-[var(--color-text-muted)]">No anime found for "{searchQuery}"</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !searched && (
        <div className="flex flex-col items-center justify-center h-[40vh] animate-fade-in">
          <Globe size={48} className="text-[var(--color-text-muted)] mb-4 opacity-30" />
          <p className="text-sm text-[var(--color-text-muted)] max-w-md text-center">
            Search for any anime by name. Each result shows all streaming sites separately — 
            tap one to open it with automatic mirror fallback.
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-3 opacity-60">
            Press <kbd className="bg-[var(--color-bg-hover)] px-1.5 py-0.5 rounded text-[var(--color-text-secondary)]">Ctrl+K</kbd> to focus search
          </p>
        </div>
      )}
    </div>
  );
}
