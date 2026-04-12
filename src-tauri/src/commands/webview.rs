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
            badge.classList.add('visible');
            badge.style.transform = 'scale(1.35)';
            setTimeout(() => { badge.style.transform = 'scale(1)'; }, 180);
        }
        const panelCount = document.getElementById('ang-panel-count');
        if (panelCount) panelCount.textContent = String(blockedCount);
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
            if (isAdUrl(url)) { incBlocked(); return fakeWindow(url); }
            return Reflect.apply(target, thisArg, args);
        }
    });

    // ─── 2. Intercept location changes ──────────────────────────────────────
    (function() {
        const origAssign  = location.assign.bind(location);
        const origReplace = location.replace.bind(location);
        try {
            Object.defineProperty(location, 'assign', {
                configurable: true,
                value: function(url) { if (isAdUrl(url)) { incBlocked(); return; } origAssign(url); }
            });
            Object.defineProperty(location, 'replace', {
                configurable: true,
                value: function(url) { if (isAdUrl(url)) { incBlocked(); return; } origReplace(url); }
            });
        } catch(e) {}
    })();

    // ─── 3. CSS: hide known ad elements ─────────────────────────────────────
    const adStyle = document.createElement('style');
    adStyle.textContent = `
        iframe[src*="popads"], iframe[src*="exoclick"], iframe[src*="adsterra"],
        iframe[src*="doubleclick"], iframe[src*="trafficjunky"], iframe[src*="propellerads"],
        iframe[src*="googlesyndication"], iframe[src*="pagead2"],
        .adsbygoogle, .banner-ad, [id^="div-gpt-ad"], [data-ad-unit],
        #ad-overlay, .ad-overlay, .overlay-ad, .popup-ad,
        [class*="badge"][style*="position"],[class*="ribbon"][style*="position"],
        a[href][target="_blank"][style*="position: fixed"],
        a[href][target="_blank"][style*="position:fixed"],
        div[style*="position: fixed"][style*="z-index: 9"],
        img[src*="/new."], img[src*="new-"], img[alt="new"], img[alt="NEW"] {
            display: none !important; pointer-events: none !important; visibility: hidden !important;
        }
        body { padding-top: 52px !important; padding-bottom: 58px !important; }
    `;
    (document.head || document.documentElement).appendChild(adStyle);

    // ─── 4. MutationObserver: remove ad overlays ────────────────────────────
    const obs = new MutationObserver(() => {
        document.querySelectorAll('a[target="_blank"]').forEach(a => {
            const s = a.style;
            const rect = a.getBoundingClientRect();
            if ((s.position === 'fixed' || s.position === 'absolute') &&
                rect.width > 200 && rect.height > 200 && !a.textContent.trim()) {
                a.style.pointerEvents = 'none'; a.style.display = 'none'; incBlocked();
            }
        });
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    // ─── 5. HLS.js buffer enhancement ───────────────────────────────────────
    (function patchHLS() {
        function apply() {
            if (!window.Hls || !window.Hls.defaultConfig) return;
            const c = window.Hls.defaultConfig;
            c.maxBufferLength    = Math.max(c.maxBufferLength    || 0, 60);
            c.maxMaxBufferLength = Math.max(c.maxMaxBufferLength || 0, 600);
            c.maxBufferSize      = Math.max(c.maxBufferSize      || 0, 60*1000*1000);
            c.abrBandWidthFactor = 0.95; c.abrBandWidthUpFactor = 0.7;
            c.maxBufferHole      = Math.max(c.maxBufferHole || 0, 1.5);
            c.lowLatencyMode     = false;
        }
        const orig = document.createElement.bind(document);
        document.createElement = function(tag) {
            const el = orig(tag);
            if (typeof tag === 'string' && tag.toLowerCase() === 'script')
                el.addEventListener('load', () => setTimeout(apply, 20));
            return el;
        };
        [200,500,1000,2000,4000].forEach(ms => setTimeout(apply, ms));
    })();

    // ─── 6. Video stall recovery ─────────────────────────────────────────────
    (function() {
        function boost(v) {
            if (v._ang) return; v._ang = true; v.preload = 'auto';
            function rec() { if (!v.paused && v.readyState < 3) { const t=v.currentTime; v.load(); v.currentTime=t; v.play().catch(()=>{}); } }
            v.addEventListener('stalled', () => setTimeout(rec, 2000));
            v.addEventListener('waiting', () => setTimeout(rec, 3000));
            v.addEventListener('emptied', () => setTimeout(rec, 1000));
        }
        document.querySelectorAll('video').forEach(boost);
        new MutationObserver(() => document.querySelectorAll('video:not([data-ang])').forEach(v => { v.dataset.ang='1'; boost(v); }))
            .observe(document.documentElement, { childList: true, subtree: true });
    })();

    // ─── 7. Brave-like Browser Chrome ───────────────────────────────────────
    function injectBraveChrome() {
        if (document.getElementById('ang-brave-chrome')) return;
        const isHttps = location.protocol === 'https:';
        const hostname = location.hostname || location.href;

        const chromeStyle = document.createElement('style');
        chromeStyle.textContent = `
            :root {
                --brave-bg: rgba(14,14,24,0.97); --brave-border: rgba(255,255,255,0.08);
                --brave-text: #e2e8f0; --brave-muted: #94a3b8;
                --brave-orange: #FB542B; --brave-orange-dim: rgba(251,84,43,0.18);
                --brave-green: #22c55e;
            }
            #ang-brave-chrome * { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; }
            #ang-brave-chrome {
                position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
                height: 52px; background: var(--brave-bg);
                backdrop-filter: blur(20px) saturate(200%); -webkit-backdrop-filter: blur(20px) saturate(200%);
                border-bottom: 1px solid var(--brave-border);
                display: flex; align-items: center; gap: 4px; padding: 0 10px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.4);
            }
            .ang-ib { display:flex; align-items:center; justify-content:center; width:40px; height:40px;
                border-radius:10px; background:transparent; border:none; cursor:pointer; color:var(--brave-muted);
                transition:all 0.15s; flex-shrink:0; font-size:18px; -webkit-tap-highlight-color:transparent; }
            .ang-ib:active { background:rgba(255,255,255,0.1); transform:scale(0.9); }
            #ang-addr { flex:1; height:36px; background:rgba(255,255,255,0.06); border:1px solid var(--brave-border);
                border-radius:20px; display:flex; align-items:center; gap:8px; padding:0 14px; cursor:pointer;
                transition:all 0.2s; min-width:0; }
            #ang-addr:active { background:rgba(255,255,255,0.1); }
            #ang-lock { font-size:12px; flex-shrink:0; }
            #ang-url-t { flex:1; font-size:13px; color:var(--brave-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #ang-sh { position:relative; display:flex; align-items:center; justify-content:center;
                width:42px; height:40px; border-radius:10px; background:var(--brave-orange-dim);
                border:1px solid rgba(251,84,43,0.25); cursor:pointer; flex-shrink:0;
                -webkit-tap-highlight-color:transparent; }
            #ang-sh:active { transform:scale(0.9); }
            #ang-shields-badge { position:absolute; top:2px; right:2px; background:var(--brave-orange); color:#fff;
                font-size:9px; font-weight:700; min-width:16px; height:16px; border-radius:8px;
                display:none; align-items:center; justify-content:center; padding:0 3px;
                transition:transform 0.15s cubic-bezier(0.34,1.56,0.64,1); }
            #ang-shields-badge.visible { display:flex; }
            #ang-menu { display:flex; align-items:center; justify-content:center; width:40px; height:40px;
                border-radius:10px; background:transparent; border:none; cursor:pointer; color:var(--brave-muted);
                -webkit-tap-highlight-color:transparent; flex-shrink:0; }
            #ang-menu:active { background:rgba(255,255,255,0.1); }
            /* Bottom bar */
            #ang-bot { position:fixed; bottom:0; left:0; right:0; z-index:2147483646;
                height:56px; background:var(--brave-bg);
                backdrop-filter:blur(20px) saturate(200%); -webkit-backdrop-filter:blur(20px) saturate(200%);
                border-top:1px solid var(--brave-border);
                display:flex; align-items:center; justify-content:space-around; padding:0 4px;
                padding-bottom:env(safe-area-inset-bottom,0); }
            .ang-bb { display:flex; flex-direction:column; align-items:center; gap:3px; flex:1;
                padding:6px 0; border:none; background:transparent; cursor:pointer; color:var(--brave-muted);
                -webkit-tap-highlight-color:transparent; border-radius:12px; }
            .ang-bb:active { background:rgba(255,255,255,0.08); }
            .ang-bb-i { font-size:20px; line-height:1; }
            .ang-bb-l { font-size:10px; font-weight:500; }
            /* Panels */
            #ang-sh-panel, #ang-m-panel {
                position:fixed; top:58px; right:10px; z-index:2147483647;
                background:rgba(12,12,22,0.98); border:1px solid var(--brave-border);
                border-radius:16px; backdrop-filter:blur(20px); display:none; flex-direction:column;
                box-shadow:0 8px 32px rgba(0,0,0,0.6); }
            #ang-sh-panel.v, #ang-m-panel.v { display:flex; }
            #ang-sh-panel { width:min(280px,90vw); padding:16px; gap:12px; }
            #ang-m-panel { width:min(200px,80vw); overflow:hidden; }
            .ang-mi { display:flex; align-items:center; gap:12px; padding:14px 16px; font-size:14px;
                color:var(--brave-text); cursor:pointer; border:none; background:transparent; width:100%; text-align:left;
                -webkit-tap-highlight-color:transparent; }
            .ang-mi:active { background:rgba(255,255,255,0.08); }
            .ang-mi+.ang-mi { border-top:1px solid var(--brave-border); }
            .ang-mi-i { font-size:16px; width:22px; text-align:center; }
            #ang-url-tip { position:fixed; top:58px; left:50%; transform:translateX(-50%);
                background:rgba(10,10,20,0.95); color:var(--brave-text); font-size:11px;
                padding:8px 14px; border-radius:10px; border:1px solid var(--brave-border);
                max-width:90vw; word-break:break-all; backdrop-filter:blur(12px);
                z-index:2147483647; opacity:0; pointer-events:none; transition:opacity 0.2s; }
        `;
        (document.head || document.documentElement).appendChild(chromeStyle);

        const chrome = document.createElement('div'); chrome.id = 'ang-brave-chrome';

        // Back
        const backBtn = document.createElement('button'); backBtn.className='ang-ib'; backBtn.textContent='‹';
        backBtn.title='Back'; backBtn.addEventListener('click', () => history.back());
        // Fwd
        const fwdBtn = document.createElement('button'); fwdBtn.className='ang-ib'; fwdBtn.textContent='›';
        fwdBtn.title='Forward'; fwdBtn.addEventListener('click', () => history.forward());
        // Refresh
        const refBtn = document.createElement('button'); refBtn.className='ang-ib'; refBtn.textContent='⟳';
        refBtn.title='Reload'; refBtn.addEventListener('click', () => location.reload());

        // Address bar
        const addr = document.createElement('div'); addr.id='ang-addr'; addr.title='Tap for full URL';
        const lock = document.createElement('span'); lock.id='ang-lock';
        lock.textContent = isHttps ? '🔒' : '⚠️'; lock.style.color = isHttps ? 'var(--brave-green)' : 'var(--brave-orange)';
        const urlT = document.createElement('span'); urlT.id='ang-url-t'; urlT.textContent = hostname;
        addr.appendChild(lock); addr.appendChild(urlT);

        // URL tooltip
        const tip = document.createElement('div'); tip.id='ang-url-tip'; tip.textContent = location.href;

        // Shields
        const sh = document.createElement('div'); sh.id='ang-sh'; sh.title='Brave Shields';
        sh.innerHTML = '<span style="font-size:18px">🛡️</span><span id="ang-shields-badge">0</span>';

        // Menu
        const menu = document.createElement('div'); menu.id='ang-menu';
        menu.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>';

        chrome.appendChild(backBtn); chrome.appendChild(fwdBtn); chrome.appendChild(refBtn);
        chrome.appendChild(addr); chrome.appendChild(sh); chrome.appendChild(menu);

        // Shields panel
        const shPanel = document.createElement('div'); shPanel.id='ang-sh-panel';
        shPanel.innerHTML = '<b style="font-size:15px;color:var(--brave-text)">🛡️ Brave Shields</b><div style="display:flex;justify-content:space-between;font-size:13px;color:var(--brave-text)"><span>Ads & Trackers Blocked</span><span id="ang-panel-count" style="background:var(--brave-orange-dim);color:var(--brave-orange);font-weight:700;padding:2px 10px;border-radius:20px">0</span></div>';

        // Menu panel
        const mPanel = document.createElement('div'); mPanel.id='ang-m-panel';
        [{i:'⟳',l:'Reload',a:()=>location.reload()},{i:'📋',l:'Copy URL',a:()=>navigator.clipboard?.writeText(location.href).catch(()=>{})},{i:'🏠',l:'Home',a:()=>window.close()}].forEach(item => {
            const b = document.createElement('button'); b.className='ang-mi';
            b.innerHTML=`<span class="ang-mi-i">${item.i}</span><span>${item.l}</span>`;
            b.addEventListener('click', () => { mPanel.classList.remove('v'); item.a(); });
            mPanel.appendChild(b);
        });

        // Bottom bar
        const bot = document.createElement('div'); bot.id='ang-bot';
        [{i:'←',l:'Back',a:()=>history.back()},{i:'→',l:'Forward',a:()=>history.forward()},{i:'⟳',l:'Reload',a:()=>location.reload()},{i:'🏠',l:'Home',a:()=>window.close()}].forEach(item => {
            const b = document.createElement('button'); b.className='ang-bb';
            b.innerHTML=`<span class="ang-bb-i">${item.i}</span><span class="ang-bb-l">${item.l}</span>`;
            b.addEventListener('click', item.a); bot.appendChild(b);
        });

        // Mount
        document.documentElement.insertBefore(chrome, document.body);
        document.body.appendChild(tip);
        document.body.appendChild(shPanel);
        document.body.appendChild(mPanel);
        document.body.appendChild(bot);

        // Events
        let tipOpen = false;
        addr.addEventListener('click', () => { tipOpen=!tipOpen; tip.textContent=location.href; tip.style.opacity=tipOpen?'1':'0'; });
        document.addEventListener('click', e => { if(!addr.contains(e.target)){tipOpen=false;tip.style.opacity='0';} });
        sh.addEventListener('click', e => { e.stopPropagation(); mPanel.classList.remove('v'); shPanel.classList.toggle('v'); });
        menu.addEventListener('click', e => { e.stopPropagation(); shPanel.classList.remove('v'); mPanel.classList.toggle('v'); });
        document.addEventListener('click', e => { if(!sh.contains(e.target)) shPanel.classList.remove('v'); if(!menu.contains(e.target)) mPanel.classList.remove('v'); });
        window.addEventListener('popstate', () => { urlT.textContent=location.hostname||location.href; tip.textContent=location.href; lock.textContent=location.protocol==='https:'?'🔒':'⚠️'; lock.style.color=location.protocol==='https:'?'var(--brave-green)':'var(--brave-orange)'; });
    }

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
    // If window already open, bring it forward (desktop only — mobile is always in focus)
    if let Some(existing) = app.get_webview_window(&label) {
        #[cfg(desktop)]
        let _ = existing.set_focus();
        let _ = existing; // suppress unused warning on mobile
        return Ok(());
    }

    let parsed_url: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;

    // ── Base builder — only methods that exist on BOTH desktop and mobile ──
    let mut builder = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::External(parsed_url),
    )
    .user_agent(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 \
         (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
    )
    .initialization_script(BRAVE_CHROME_SCRIPT);

    // ── Desktop-only: window chrome, proxy, navigation-level ad blocking ──
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
                    || s.contains("shorte.st")
                    || s.contains("ouo.io");
                if blocked { eprintln!("[AnImEgThArInG] Blocked: {}", url.as_str()); }
                !blocked
            })
            .title(&title)
            .inner_size(1280.0, 820.0)
            .center()
            .resizable(true)
            .decorations(true);

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

    // Proxy support — desktop only (Android uses system VPN)
    #[cfg(desktop)]
    if let Some(ref proxy) = proxy_url {
        if !proxy.is_empty() {
            if let Ok(p) = reqwest::Proxy::all(proxy) {
                client_builder = client_builder.proxy(p);
            }
        }
    }
    let _ = proxy_url; // suppress unused warning on mobile

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
    #[cfg(desktop)]
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e: tauri::Error| e.to_string())?;
    }
    #[cfg(not(desktop))]
    let _ = (app, label); // no-op on mobile — WebView is always visible
    Ok(())
}

#[tauri::command]
pub fn navigate_back_webview(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.eval("history.back();").map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn navigate_forward_webview(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.eval("history.forward();").map_err(|e: tauri::Error| e.to_string())?;
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
