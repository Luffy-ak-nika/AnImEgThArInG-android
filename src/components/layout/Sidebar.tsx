import { X, ExternalLink, ChevronLeft, ChevronRight, Monitor } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useState } from "react";

export default function Sidebar() {
  const { openWebviews, focusWebview, closeWebview } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`glass shrink-0 flex flex-col transition-all duration-300 ease-in-out ${
        collapsed ? "w-12" : "w-56"
      }`}
      style={{ borderTop: "none", borderBottom: "none", borderLeft: "none" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border-default)]">
        {!collapsed && (
          <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider animate-fade-in">
            Open Windows
          </span>
        )}
        <button
          className="p-1 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Webview List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {openWebviews.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-full text-center
            ${collapsed ? "" : "px-2"}`}>
            {!collapsed && (
              <div className="animate-fade-in">
                <Monitor size={24} className="text-[var(--color-text-muted)] mx-auto mb-2 opacity-40" />
                <p className="text-xs text-[var(--color-text-muted)]">
                  No open windows
                </p>
              </div>
            )}
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
                className={`group flex items-center gap-2 rounded-lg cursor-pointer
                  transition-all duration-200 hover:bg-[var(--color-bg-hover)]
                  ${collapsed ? "p-2 justify-center" : "p-2 pr-1"}`}
                onClick={() => focusWebview(label)}
                title={collapsed ? siteName : undefined}
              >
                <div className="status-dot online shrink-0" />
                {!collapsed && (
                  <>
                    <span className="text-sm text-[var(--color-text-primary)] truncate flex-1">
                      {siteName}
                    </span>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md
                        hover:bg-red-500/20 text-[var(--color-text-muted)] hover:text-red-400
                        transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeWebview(label);
                      }}
                      title="Close"
                    >
                      <X size={12} />
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {!collapsed && openWebviews.length > 0 && (
        <div className="p-3 border-t border-[var(--color-border-default)] animate-fade-in">
          <p className="text-xs text-[var(--color-text-muted)] text-center">
            {openWebviews.length} window{openWebviews.length !== 1 ? "s" : ""} open
          </p>
        </div>
      )}
    </aside>
  );
}
