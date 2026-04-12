use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WebviewInfo {
    pub label: String,
    pub title: String,
    pub url: String,
}

/// Brave-style browser chrome + full ad-blocker injected into every webview
const BRAVE_CHROME_SCRIPT: &str = r#"
(function() {
    'use strict';

    // ─── Shields: real-time blocked count ───────────────────────────────────
    let blockedCount = 0;
    function incBlocked() {
        blockedCount++;
        const badge = document.getElementById('ang-shields-badge');
        if (badge) {
            badge.textContent = blockedCount > 99 ? '99+' : String(blockedCount);
            badge.style.transform = 'scale(1.35)';
            setTimeout(() => { badge.style.transform = 'scale(1)'; }, 180);
        }
    }

    // ─── Helper: is this URL an ad/spam/redirect destination? ──────────────
    function isAdUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return false;
        const url = rawUrl.toLowerCase().trim();
        if (url === '' || url === 'about:blank' || url.startsWith('/') ||
            url.startsWith('#') || url.startsWith('blob:') || url.startsWith('data:')) {
            return false;
        }
        const adPatterns = [
            'popads', 'popcash', 'exoclick', 'adsterra', 'adnium',
            'trafficjunky', 'hilltopads', 'clickadu', 'propellerads',
            'realsrv', 'adskeeper', 'mgid', 'taboola', 'outbrain',
            'doubleclick.net', 'googlesyndication', 'pagead2',
            'shorte.st', 'ouo.io', 'bc.vc', 'adf.ly', 'linkvertise',
            'clk.ink', 'shrinkme', 'shrinkurl', 'za.gl', 'fc.lc',
            'owl.ly', 'bit.ly/ad', 'tinyurl.com/ad',
            'google.com/url?', 'google.com/aclk', 'google.com/pagead',
            'googleadservices.com', 'googlesyndication.com',
        ];
        for (const pat of adPatterns) {
            if (url.includes(pat)) return true;
        }
        try {
            const parsed = new URL(rawUrl);
            const host = parsed.hostname.replace(/^www\./, '');
            const path = parsed.pathname;
            if (host === 'google.com' && (path === '/' || path === '')) return true;
            if (host === 'google.co.in' && (path === '/' || path === '')) return true;
        } catch(e) {}
        return false;
    }

    function fakeWindow(url) {
        return {
            closed: false, name: '', focus: function(){}, blur: function(){},
            close: function(){}, postMessage: function(){}, stop: function(){},
            document: { write: function(){}, open: function(){}, close: function(){},
                        readyState: 'complete', title: '' },
            location: { href: url || '', assign: function(){}, replace: function(){},
                        reload: function(){} },
            screen: window.screen, navigator: window.navigator,
            history: { back: function(){}, forward: function(){}, go: function(){} },
        };
    }

    // ─── 1. Intercept window.open ────────────────────────────────────────────
    const _origOpen = window.open;
    window.open = new Proxy(_origOpen, {
        apply: function(target, thisArg, args) {
            const url = args[0];
            if (isAdUrl(url)) {
                incBlocked();
                return fakeWindow(url);
            }
            return Reflect.apply(target, thisArg, args);
        }
    });
    Object.defineProperty(window.open, 'toString', {
        value: function() { return "function open() { [native code] }"; },
        configurable: true, writable: true
    });

    // ─── 2. Intercept location changes ──────────────────────────────────────
    (function() {
        const origAssign  = location.assign.bind(location);
        const origReplace = location.replace.bind(location);
        try {
            Object.defineProperty(location, 'assign', {
                configurable: true,
                value: function(url) {
                    if (isAdUrl(url)) { incBlocked(); return; }
                    origAssign(url);
                }
            });
            Object.defineProperty(location, 'replace', {
                configurable: true,
                value: function(url) {
                    if (isAdUrl(url)) { incBlocked(); return; }
                    origReplace(url);
                }
            });
        } catch(e) {}
    })();

    // ─── 3. CSS: hide known ad elements ─────────────────────────────────────
    const adStyle = document.createElement('style');
    adStyle.id = 'ang-adblock-css';
    adStyle.textContent = `
        iframe[src*="popads"], iframe[src*="exoclick"], iframe[src*="adsterra"],
        iframe[src*="doubleclick"], iframe[src*="trafficjunky"], iframe[src*="propellerads"],
        iframe[src*="googlesyndication"], iframe[src*="pagead2"],
        .adsbygoogle, .banner-ad, [id^="div-gpt-ad"], [data-ad-unit],
        #ad-overlay, .ad-overlay, .overlay-ad, .popup-ad,
        [class*="badge"][style*="position"],[class*="ribbon"][style*="position"],
        [class*="sticker"][style*="position"],[class*="corner"][style*="position"],
        [class*="seal"][style*="position"],
        a[href][target="_blank"][style*="position: fixed"],
        a[href][target="_blank"][style*="position:fixed"],
        div[style*="position: fixed"][style*="z-index: 9"],
        div[style*="position:fixed"][style*="z-index:9"],
        img[src*="/new."], img[src*="new-"], img[src*="NEW"],
        img[alt="new"], img[alt="NEW"], img[alt="New"] {
            display: none !important;
            pointer-events: none !important;
            visibility: hidden !important;
        }
        /* Extra top padding for Brave chrome */
        body { padding-top: 52px !important; }
    `;
    (document.head || document.documentElement).appendChild(adStyle);

    // ─── 4. MutationObserver: remove ad overlays ────────────────────────────
    const removeAds = () => {
        document.querySelectorAll('a[target="_blank"]').forEach(a => {
            const rect = a.getBoundingClientRect();
            const s = a.style;
            if ((s.position === 'fixed' || s.position === 'absolute') &&
                rect.width > 200 && rect.height > 200 && !a.textContent.trim()) {
                a.style.pointerEvents = 'none';
                a.style.display = 'none';
                incBlocked();
            }
        });
    };
    const obs = new MutationObserver(() => removeAds());
    obs.observe(document.documentElement, { childList: true, subtree: true });

    // ─── 5. HLS.js buffer enhancement ───────────────────────────────────────
    (function patchHLSBuffer() {
        function applyPatch() {
            if (!window.Hls || !window.Hls.defaultConfig) return false;
            const cfg = window.Hls.defaultConfig;
            cfg.maxBufferLength    = Math.max(cfg.maxBufferLength    || 0, 60);
            cfg.maxMaxBufferLength = Math.max(cfg.maxMaxBufferLength || 0, 600);
            cfg.maxBufferSize      = Math.max(cfg.maxBufferSize      || 0, 60 * 1000 * 1000);
            if (cfg.startLevel === undefined || cfg.startLevel === -1) cfg.startLevel = -1;
            cfg.abrBandWidthFactor   = 0.95;
            cfg.abrBandWidthUpFactor = 0.7;
            cfg.maxBufferHole        = Math.max(cfg.maxBufferHole || 0, 1.5);
            cfg.lowLatencyMode       = false;
            return true;
        }
        const _origCreateElement = document.createElement.bind(document);
        document.createElement = function(tag) {
            const el = _origCreateElement(tag);
            if (typeof tag === 'string' && tag.toLowerCase() === 'script') {
                el.addEventListener('load', () => setTimeout(applyPatch, 20));
            }
            return el;
        };
        [200, 500, 1000, 2000, 4000].forEach(ms => setTimeout(applyPatch, ms));
    })();

    // ─── 6. Video stall recovery ─────────────────────────────────────────────
    (function enhanceVideoElements() {
        function boostVideo(v) {
            if (v._angBoosted) return;
            v._angBoosted = true;
            v.preload = 'auto';
            function tryRecover() {
                if (!v.paused && v.readyState < 3) {
                    const t = v.currentTime;
                    v.load(); v.currentTime = t; v.play().catch(() => {});
                }
            }
            v.addEventListener('stalled',  () => setTimeout(tryRecover, 2000));
            v.addEventListener('waiting',  () => setTimeout(tryRecover, 3000));
            v.addEventListener('emptied',  () => setTimeout(tryRecover, 1000));
        }
        document.querySelectorAll('video').forEach(boostVideo);
        const videoObs = new MutationObserver(() => {
            document.querySelectorAll('video:not([data-ang-boosted])').forEach(v => {
                v.dataset.angBoosted = '1'; boostVideo(v);
            });
        });
        videoObs.observe(document.documentElement, { childList: true, subtree: true });
    })();

    // ─── 7. Brave-like Browser Chrome ───────────────────────────────────────
    function injectBraveChrome() {
        if (document.getElementById('ang-brave-chrome')) return;

        const isHttps = location.protocol === 'https:';
        const hostname = location.hostname || location.href;

        // ── CSS for chrome ──
        const chromeStyle = document.createElement('style');
        chromeStyle.textContent = `
            :root {
                --brave-bg: #1a1a2e;
                --brave-surface: rgba(20,20,35,0.96);
                --brave-border: rgba(255,255,255,0.08);
                --brave-text: #e2e8f0;
                --brave-muted: #94a3b8;
                --brave-orange: #FB542B;
                --brave-orange-dim: rgba(251,84,43,0.18);
                --brave-green: #22c55e;
                --brave-red: #ef4444;
                --brave-radius: 12px;
                --brave-bar-h: 52px;
                --brave-bottom-h: 56px;
            }
            #ang-brave-chrome * { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; }
            #ang-brave-chrome {
                position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
                display: flex; flex-direction: column;
                filter: drop-shadow(0 2px 12px rgba(0,0,0,0.5));
            }
            /* ── Top Bar ── */
            #ang-topbar {
                height: var(--brave-bar-h);
                background: var(--brave-surface);
                backdrop-filter: blur(20px) saturate(200%);
                -webkit-backdrop-filter: blur(20px) saturate(200%);
                border-bottom: 1px solid var(--brave-border);
                display: flex; align-items: center; gap: 4px;
                padding: 0 10px;
            }
            .ang-icon-btn {
                display: flex; align-items: center; justify-content: center;
                width: 38px; height: 38px; border-radius: 10px;
                background: transparent; border: none; cursor: pointer;
                color: var(--brave-muted); transition: all 0.15s ease;
                flex-shrink: 0; font-size: 16px;
                -webkit-tap-highlight-color: transparent;
            }
            .ang-icon-btn:active { background: rgba(255,255,255,0.1); transform: scale(0.92); }
            .ang-icon-btn:hover { background: rgba(255,255,255,0.07); color: var(--brave-text); }
            .ang-icon-btn.disabled { opacity: 0.3; pointer-events: none; }
            /* ── Address Bar ── */
            #ang-address-bar {
                flex: 1; height: 36px; min-width: 0;
                background: rgba(255,255,255,0.06);
                border: 1px solid var(--brave-border);
                border-radius: 20px;
                display: flex; align-items: center; gap: 8px;
                padding: 0 14px; cursor: pointer;
                transition: all 0.2s ease;
            }
            #ang-address-bar:hover { background: rgba(255,255,255,0.1); border-color: var(--brave-orange); }
            #ang-lock-icon { font-size: 12px; flex-shrink: 0; }
            #ang-url-text {
                flex: 1; font-size: 13px; color: var(--brave-text); min-width: 0;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                letter-spacing: 0.01em;
            }
            /* ── Shields Button ── */
            #ang-shields-btn {
                position: relative;
                display: flex; align-items: center; justify-content: center;
                width: 42px; height: 38px; border-radius: 10px;
                background: var(--brave-orange-dim); border: 1px solid rgba(251,84,43,0.25);
                cursor: pointer; flex-shrink: 0;
                transition: all 0.15s ease;
                -webkit-tap-highlight-color: transparent;
            }
            #ang-shields-btn:active { transform: scale(0.92); }
            #ang-shields-icon { font-size: 17px; }
            #ang-shields-badge {
                position: absolute; top: 2px; right: 2px;
                background: var(--brave-orange); color: white;
                font-size: 9px; font-weight: 700; min-width: 16px; height: 16px;
                border-radius: 8px; display: flex; align-items: center; justify-content: center;
                padding: 0 3px; line-height: 1;
                transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
                display: none;
            }
            #ang-shields-badge.visible { display: flex; }
            /* ── Menu Button ── */
            #ang-menu-btn {
                display: flex; align-items: center; justify-content: center;
                width: 38px; height: 38px; border-radius: 10px;
                background: transparent; border: none; cursor: pointer;
                color: var(--brave-muted); transition: all 0.15s ease; flex-shrink: 0;
                -webkit-tap-highlight-color: transparent;
            }
            #ang-menu-btn:active { background: rgba(255,255,255,0.1); transform: scale(0.92); }
            /* ── Bottom Bar ── */
            #ang-bottombar {
                position: fixed; bottom: 0; left: 0; right: 0;
                z-index: 2147483646;
                height: var(--brave-bottom-h);
                background: var(--brave-surface);
                backdrop-filter: blur(20px) saturate(200%);
                -webkit-backdrop-filter: blur(20px) saturate(200%);
                border-top: 1px solid var(--brave-border);
                display: flex; align-items: center; justify-content: space-around;
                padding: 0 8px;
                padding-bottom: env(safe-area-inset-bottom, 0px);
            }
            .ang-bottom-btn {
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                gap: 3px; padding: 6px 16px; border-radius: 12px;
                background: transparent; border: none; cursor: pointer;
                color: var(--brave-muted); transition: all 0.15s ease;
                min-width: 56px; flex: 1;
                -webkit-tap-highlight-color: transparent;
            }
            .ang-bottom-btn:active { background: rgba(255,255,255,0.08); transform: scale(0.95); }
            .ang-bottom-btn .ang-btn-icon { font-size: 20px; line-height: 1; }
            .ang-bottom-btn .ang-btn-label { font-size: 10px; font-weight: 500; letter-spacing: 0.02em; }
            /* Disabled nav buttons */
            .ang-bottom-btn.nav-disabled { opacity: 0.25; pointer-events: none; }
            /* Bottom spacer so page content shows above bottom bar */
            #ang-bottom-spacer {
                height: var(--brave-bottom-h); width: 100%; display: block;
            }
            /* ── Tooltip ── */
            #ang-url-tooltip {
                position: fixed; top: calc(var(--brave-bar-h) + 6px);
                left: 50%; transform: translateX(-50%);
                background: rgba(10,10,20,0.95); color: var(--brave-text);
                font-size: 11px; padding: 8px 14px; border-radius: 10px;
                border: 1px solid var(--brave-border);
                max-width: 90vw; word-break: break-all;
                backdrop-filter: blur(12px); z-index: 2147483647;
                opacity: 0; pointer-events: none;
                transition: opacity 0.2s ease;
            }
            /* ── Shields panel ── */
            #ang-shields-panel {
                position: fixed; top: calc(var(--brave-bar-h) + 6px);
                right: 10px; width: min(280px, 90vw);
                background: rgba(15,15,28,0.98); border: 1px solid var(--brave-border);
                border-radius: 16px; padding: 16px;
                backdrop-filter: blur(20px); z-index: 2147483647;
                display: none; flex-direction: column; gap: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            }
            #ang-shields-panel.visible { display: flex; }
            .ang-shield-row {
                display: flex; align-items: center; justify-content: space-between;
                font-size: 13px; color: var(--brave-text);
            }
            .ang-shield-count {
                background: var(--brave-orange-dim); color: var(--brave-orange);
                font-weight: 700; font-size: 12px;
                padding: 2px 10px; border-radius: 20px;
            }
            .ang-shield-title {
                font-size: 15px; font-weight: 700; color: var(--brave-text);
                display: flex; align-items: center; gap: 8px;
            }
            /* ── Menu panel ── */
            #ang-menu-panel {
                position: fixed; top: calc(var(--brave-bar-h) + 6px);
                right: 10px; width: min(200px, 80vw);
                background: rgba(15,15,28,0.98); border: 1px solid var(--brave-border);
                border-radius: 16px; overflow: hidden;
                backdrop-filter: blur(20px); z-index: 2147483647;
                display: none; flex-direction: column;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            }
            #ang-menu-panel.visible { display: flex; }
            .ang-menu-item {
                display: flex; align-items: center; gap: 12px;
                padding: 14px 16px; font-size: 14px; color: var(--brave-text);
                cursor: pointer; transition: background 0.15s ease; border: none;
                background: transparent; width: 100%; text-align: left;
                -webkit-tap-highlight-color: transparent;
            }
            .ang-menu-item:active { background: rgba(255,255,255,0.1); }
            .ang-menu-item + .ang-menu-item { border-top: 1px solid var(--brave-border); }
            .ang-menu-item .ang-mi-icon { font-size: 16px; width: 22px; text-align: center; }
        `;
        (document.head || document.documentElement).appendChild(chromeStyle);

        // ── Build Top Bar ──
        const chrome = document.createElement('div');
        chrome.id = 'ang-brave-chrome';

        const topBar = document.createElement('div');
        topBar.id = 'ang-topbar';

        // Back button
        const backBtn = document.createElement('button');
        backBtn.className = 'ang-icon-btn'; backBtn.id = 'ang-back';
        backBtn.title = 'Go Back'; backBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;

        // Forward button
        const fwdBtn = document.createElement('button');
        fwdBtn.className = 'ang-icon-btn'; fwdBtn.id = 'ang-fwd';
        fwdBtn.title = 'Go Forward'; fwdBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

        // Refresh
        const refBtn = document.createElement('button');
        refBtn.className = 'ang-icon-btn'; refBtn.id = 'ang-ref';
        refBtn.title = 'Refresh'; refBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.85"/></svg>`;

        // Address bar
        const addrBar = document.createElement('div');
        addrBar.id = 'ang-address-bar';
        addrBar.title = 'Tap to see full URL';
        const lockIcon = document.createElement('span');
        lockIcon.id = 'ang-lock-icon';
        lockIcon.textContent = isHttps ? '🔒' : '⚠️';
        lockIcon.style.color = isHttps ? 'var(--brave-green)' : 'var(--brave-orange)';
        const urlText = document.createElement('span');
        urlText.id = 'ang-url-text';
        urlText.textContent = hostname;
        addrBar.appendChild(lockIcon); addrBar.appendChild(urlText);

        // URL tooltip
        const urlTooltip = document.createElement('div');
        urlTooltip.id = 'ang-url-tooltip';
        urlTooltip.textContent = location.href;

        // Shields button
        const shieldsBtn = document.createElement('div');
        shieldsBtn.id = 'ang-shields-btn'; shieldsBtn.title = 'Brave Shields';
        const shieldIcon = document.createElement('span');
        shieldIcon.id = 'ang-shields-icon'; shieldIcon.textContent = '🛡️';
        const shieldBadge = document.createElement('span');
        shieldBadge.id = 'ang-shields-badge';
        shieldBadge.textContent = '0';
        shieldsBtn.appendChild(shieldIcon); shieldsBtn.appendChild(shieldBadge);

        // Menu button
        const menuBtn = document.createElement('div');
        menuBtn.id = 'ang-menu-btn'; menuBtn.title = 'Browser menu';
        menuBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>`;

        topBar.appendChild(backBtn); topBar.appendChild(fwdBtn); topBar.appendChild(refBtn);
        topBar.appendChild(addrBar); topBar.appendChild(shieldsBtn); topBar.appendChild(menuBtn);
        chrome.appendChild(topBar);

        // ── Build Shields Panel ──
        const shieldsPanel = document.createElement('div');
        shieldsPanel.id = 'ang-shields-panel';
        shieldsPanel.innerHTML = `
            <div class="ang-shield-title">🛡️ Brave Shields</div>
            <div class="ang-shield-row">
                <span>Ads & Trackers Blocked</span>
                <span class="ang-shield-count" id="ang-panel-count">0</span>
            </div>
            <div class="ang-shield-row" style="font-size:11px;color:var(--brave-muted)">
                Blocking popups, redirects & overlays
            </div>
        `;

        // ── Build Menu Panel ──
        const menuPanel = document.createElement('div');
        menuPanel.id = 'ang-menu-panel';
        const menuItems = [
            { icon: '⟳',  label: 'Reload page',   action: () => location.reload() },
            { icon: '📋',  label: 'Copy URL',       action: () => { try { navigator.clipboard.writeText(location.href); } catch(e){} } },
            { icon: '🏠',  label: 'Go Home',        action: () => window.close() },
        ];
        menuItems.forEach(item => {
            const el = document.createElement('button');
            el.className = 'ang-menu-item';
            el.innerHTML = `<span class="ang-mi-icon">${item.icon}</span><span>${item.label}</span>`;
            el.addEventListener('click', () => { menuPanel.classList.remove('visible'); item.action(); });
            menuPanel.appendChild(el);
        });

        // ── Build Bottom Bar ──
        const bottomBar = document.createElement('div');
        bottomBar.id = 'ang-bottombar';
        const bottomSpacer = document.createElement('div');
        bottomSpacer.id = 'ang-bottom-spacer';

        const bBtns = [
            { icon: '←', label: 'Back',    id: 'ang-b-back',    action: () => history.back() },
            { icon: '→', label: 'Forward', id: 'ang-b-fwd',     action: () => history.forward() },
            { icon: '⟳', label: 'Reload',  id: 'ang-b-ref',     action: () => location.reload() },
            { icon: '🏠', label: 'Home',    id: 'ang-b-home',   action: () => window.close() },
        ];
        bBtns.forEach(b => {
            const btn = document.createElement('button');
            btn.className = 'ang-bottom-btn'; btn.id = b.id;
            btn.innerHTML = `<span class="ang-btn-icon">${b.icon}</span><span class="ang-btn-label">${b.label}</span>`;
            btn.addEventListener('click', b.action);
            bottomBar.appendChild(btn);
        });

        // Assemble into document
        document.documentElement.insertBefore(chrome, document.body);
        document.body.appendChild(urlTooltip);
        document.body.appendChild(shieldsPanel);
        document.body.appendChild(menuPanel);
        document.body.appendChild(bottomBar);
        document.body.appendChild(bottomSpacer);

        // ── Wire events ──
        backBtn.addEventListener('click', () => history.back());
        fwdBtn.addEventListener('click',  () => history.forward());
        refBtn.addEventListener('click',  () => location.reload());

        // URL tooltip toggle
        let tooltipVisible = false;
        addrBar.addEventListener('click', () => {
            tooltipVisible = !tooltipVisible;
            urlTooltip.style.opacity = tooltipVisible ? '1' : '0';
            urlTooltip.textContent = location.href;
        });
        document.addEventListener('click', (e) => {
            if (!addrBar.contains(e.target) && !urlTooltip.contains(e.target)) {
                tooltipVisible = false; urlTooltip.style.opacity = '0';
            }
        });

        // Shields panel toggle
        shieldsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menuPanel.classList.remove('visible');
            shieldsPanel.classList.toggle('visible');
        });
        document.addEventListener('click', (e) => {
            if (!shieldsBtn.contains(e.target)) shieldsPanel.classList.remove('visible');
        });

        // Menu panel toggle
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            shieldsPanel.classList.remove('visible');
            menuPanel.classList.toggle('visible');
        });
        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target)) menuPanel.classList.remove('visible');
        });

        // Update URL text on navigation
        const updateUrl = () => {
            const newHostname = location.hostname || location.href;
            urlText.textContent = newHostname;
            urlTooltip.textContent = location.href;
            const https = location.protocol === 'https:';
            lockIcon.textContent = https ? '🔒' : '⚠️';
            lockIcon.style.color = https ? 'var(--brave-green)' : 'var(--brave-orange)';
        };
        window.addEventListener('popstate', updateUrl);

        // Update shields panel count in sync with incBlocked
        const origIncBlocked = incBlocked;
        function incBlockedWithPanel() {
            origIncBlocked();
            const panelCount = document.getElementById('ang-panel-count');
            if (panelCount) panelCount.textContent = String(blockedCount);
            const badge = document.getElementById('ang-shields-badge');
            if (badge) badge.classList.add('visible');
        }
        // Replace incBlocked globally
        window.__angIncBlocked = incBlockedWithPanel;

        // Patch incBlocked in all future calls (best-effort since JS is single-scope)
        // We monkey-patch it via a shared variable trick:
        window.__angBlockedCount = () => blockedCount;
    }

    // Inject chrome when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectBraveChrome);
    } else {
        injectBraveChrome();
    }

    console.log('[AnImEgThArInG] 🛡️ Brave Chrome + Shield v3 active');
})();
"#;

#[tauri::command]
pub fn open_site_webview(
    app: AppHandle,
    label: String,
    url: String,
    title: String,
    proxy_url: Option<String>,
) -> Result<(), String> {
    // If window already exists, bring it to front
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.set_focus();
        return Ok(());
    }

    let parsed_url: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;

    let mut builder = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::External(parsed_url),
    )
    .title(&title)
    .inner_size(1280.0, 820.0)
    .resizable(true)
    .user_agent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36")
    .initialization_script(BRAVE_CHROME_SCRIPT);

    // Desktop-only: navigation-level ad blocking and window decorations
    #[cfg(desktop)]
    {
        builder = builder
            .on_navigation(|url| {
                let s = url.as_str().to_lowercase();
                let blocked =
                    s.contains("popads.net")
                    || s.contains("popcash.net")
                    || s.contains("exoclick.com")
                    || s.contains("adsterra.com")
                    || s.contains("adnium.com")
                    || s.contains("trafficjunky.com")
                    || s.contains("propellerads.com")
                    || s.contains("hilltopads.com")
                    || s.contains("clickadu.com")
                    || s.contains("realsrv.com")
                    || s.contains("adskeeper.com")
                    || s.contains("doubleclick.net")
                    || s.contains("googlesyndication.com")
                    || s.contains("googleadservices.com")
                    || (s.contains("google.com/url") && s.contains('?'))
                    || s.contains("google.com/aclk")
                    || s.contains("google.com/pagead")
                    || s == "https://www.google.com/"
                    || s == "https://www.google.com"
                    || s == "http://www.google.com/"
                    || s == "http://www.google.com"
                    || s.contains("shorte.st")
                    || s.contains("ouo.io");

                if blocked {
                    eprintln!("[AnImEgThArInG] Blocked navigation: {}", url.as_str());
                }
                !blocked
            })
            .center()
            .decorations(true);

        // Apply proxy if provided (desktop-only feature)
        if let Some(ref proxy) = proxy_url {
            if !proxy.is_empty() {
                let proxy_parsed: url::Url =
                    proxy.parse().map_err(|e: url::ParseError| e.to_string())?;
                builder = builder.proxy_url(proxy_parsed);
            }
        }
    }

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn check_domain(url: String, proxy_url: Option<String>) -> bool {
    let mut client_builder = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .danger_accept_invalid_certs(true);

    #[cfg(desktop)]
    if let Some(proxy) = proxy_url {
        if !proxy.is_empty() {
            if let Ok(p) = reqwest::Proxy::all(&proxy) {
                client_builder = client_builder.proxy(p);
            }
        }
    }

    if let Ok(client) = client_builder.build() {
        if let Ok(resp) = client.get(&url).send().await {
            return resp.status().is_success() || resp.status().is_redirection();
        }
    }
    false
}

#[tauri::command]
pub fn close_webview(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn focus_webview(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window
            .set_focus()
            .map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

/// Navigate back in the webview's history using JS history.back()
#[tauri::command]
pub fn navigate_back_webview(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window
            .eval("history.back();")
            .map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

/// Navigate forward in the webview's history using JS history.forward()
#[tauri::command]
pub fn navigate_forward_webview(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window
            .eval("history.forward();")
            .map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn navigate_webview(
    app: AppHandle,
    label: String,
    url: String,
    title: String,
    proxy_url: Option<String>,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e: tauri::Error| e.to_string())?;
    }

    std::thread::sleep(std::time::Duration::from_millis(200));
    open_site_webview(app, label, url, title, proxy_url)
}

#[tauri::command]
pub fn list_open_webviews(app: AppHandle) -> Vec<String> {
    app.webview_windows()
        .keys()
        .filter(|l: &&String| l.starts_with("webview-"))
        .cloned()
        .collect()
}
