import { Heart, Play, Trash2, Upload, FileUp, PackageOpen } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useState } from "react";
import BackupDialog from "@/components/dialogs/BackupDialog";

export default function FavoritesTab() {
  const { favorites, removeFromFavorites, openUrlWebview } = useApp();
  const [showImport, setShowImport] = useState(false);

  const handleOpenFavorite = (fav: typeof favorites[0]) => {
    const label = `webview-fav-${fav.id}`;
    openUrlWebview(label, fav.page_url, fav.title);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 relative">
      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <Heart size={24} className="text-[var(--color-accent-tertiary)]" />
          My Favorites
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {favorites.length} saved anime · Click to continue watching
        </p>
      </div>

      {/* Grid */}
      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
          <div className="text-6xl mb-4 animate-float">🎌</div>
          <h2 className="text-xl font-semibold text-[var(--color-text-secondary)] mb-2">
            No favorites yet
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md text-center mb-4">
            Browse the Websites tab and save anime to your favorites for quick access.
            You can also import your Aniyomi backup!
          </p>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowImport(true)}
          >
            <PackageOpen size={16} />
            Backup &amp; Restore
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 stagger-grid pb-20">
          {favorites.map((fav) => (
            <div
              key={fav.id}
              className="glass-card group cursor-pointer overflow-hidden"
              onClick={() => handleOpenFavorite(fav)}
            >
              {/* Thumbnail */}
              <div className="relative aspect-[3/4] bg-[var(--color-bg-hover)] overflow-hidden rounded-t-2xl">
                {fav.thumbnail ? (
                  <img
                    src={fav.thumbnail}
                    alt={fav.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    🎬
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent
                  opacity-0 group-hover:opacity-100 transition-opacity duration-300
                  flex items-end justify-center pb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-[var(--color-accent-primary)] rounded-full p-2 shadow-lg">
                      <Play size={16} fill="white" className="text-white" />
                    </div>
                  </div>
                </div>

                {/* Site badge */}
                {fav.site_name && (
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1
                    text-xs text-[var(--color-text-secondary)]">
                    {fav.site_name}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {fav.title}
                </h3>
                {fav.last_episode && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                    {fav.last_episode}
                  </p>
                )}

                {/* Delete button */}
                <button
                  className="mt-2 opacity-0 group-hover:opacity-100 flex items-center gap-1
                    text-xs text-red-400 hover:text-red-300 transition-all duration-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromFavorites(fav.id);
                  }}
                >
                  <Trash2 size={11} />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Import Button */}
      <button className="fab" onClick={() => setShowImport(true)}>
        <Upload size={18} />
        Backup &amp; Restore
      </button>

      {showImport && <BackupDialog onClose={() => setShowImport(false)} />}
    </div>
  );
}
