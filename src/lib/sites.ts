export interface SiteDomain {
  url: string;
  isActive: boolean;
}

export interface SiteDefinition {
  name: string;
  icon: string;
  domains: SiteDomain[];
  isCustom: boolean;
  searchPath?: string;
}

export const DEFAULT_SITES: SiteDefinition[] = [
  {
    name: "HiAnime",
    icon: "👁️",
    domains: [
      { url: "https://hianime.to", isActive: true },
      { url: "https://hianime.nz", isActive: false },
      { url: "https://hianime.sx", isActive: false },
      { url: "https://hianime.mn", isActive: false },
    ],
    isCustom: false,
    searchPath: "/search?keyword=",
  },
  {
    name: "AniWave",
    icon: "🌊",
    domains: [
      { url: "https://aniwave.to", isActive: true },
      { url: "https://aniwave.live", isActive: false },
      { url: "https://aniwave.vc", isActive: false },
      { url: "https://aniwave.se", isActive: false },
    ],
    isCustom: false,
    searchPath: "/filter?keyword=",
  },
  {
    name: "GogoAnime",
    icon: "🎬",
    domains: [
      { url: "https://anitaku.pe", isActive: true },
      { url: "https://anitaku.so", isActive: false },
      { url: "https://gogoanime3.co", isActive: false },
      { url: "https://gogoanime3.net", isActive: false },
    ],
    isCustom: false,
    searchPath: "/search.html?keyword=",
  },
  {
    name: "AnimePahe",
    icon: "🎭",
    domains: [
      { url: "https://animepahe.pw", isActive: true },
      { url: "https://animepahe.com", isActive: false },
      { url: "https://animepahe.ru", isActive: false },
      { url: "https://animepahe.org", isActive: false },
    ],
    isCustom: false,
    searchPath: "/anime?q=",
  },
  {
    name: "AnimeKai",
    icon: "🔥",
    domains: [
      { url: "https://animekai.to", isActive: true },
      { url: "https://animekai.bz", isActive: false },
      { url: "https://animekai.info", isActive: false },
    ],
    isCustom: false,
    searchPath: "/search?q=",
  },
  {
    name: "AllAnime",
    icon: "🌐",
    domains: [
      { url: "https://allanime.to", isActive: true },
      { url: "https://allanime.day", isActive: false },
      { url: "https://allmanga.to", isActive: false },
    ],
    isCustom: false,
    searchPath: "/search?q=",
  },
  {
    name: "KickAssAnime",
    icon: "👊",
    domains: [
      { url: "https://kaas.ro", isActive: true },
      { url: "https://kickassanime.am", isActive: false },
      { url: "https://kickassanimes.io", isActive: false },
    ],
    isCustom: false,
    searchPath: "/search?q=",
  },
  {
    name: "AnimeSuge",
    icon: "⚡",
    domains: [
      { url: "https://animesuge.to", isActive: true },
      { url: "https://animesuge.cc", isActive: false },
      { url: "https://animesuge.io", isActive: false },
    ],
    isCustom: false,
    searchPath: "/search?keyword=",
  },
  {
    name: "AnimeHeaven",
    icon: "😇",
    domains: [
      { url: "https://animeheaven.me", isActive: true },
      { url: "https://animeheaven.dev", isActive: false },
      { url: "https://animeheaven.ru", isActive: false },
    ],
    isCustom: false,
    searchPath: "/search?q=",
  },
  {
    name: "Animension",
    icon: "🌀",
    domains: [
      { url: "https://animension.to", isActive: true },
      { url: "https://animension.com", isActive: false },
      { url: "https://animension.org", isActive: false },
    ],
    isCustom: false,
    searchPath: "/search?q=",
  },
];
