use serde::{Deserialize, Serialize};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProxySettings {
    pub enabled: bool,
    pub proxy_type: String, // "http" | "socks5"
    pub host: String,
    pub port: u16,
}

impl ProxySettings {
    pub fn to_url(&self) -> Option<String> {
        if !self.enabled || self.host.is_empty() {
            return None;
        }
        Some(format!("{}://{}:{}", self.proxy_type, self.host, self.port))
    }
}

impl Default for ProxySettings {
    fn default() -> Self {
        Self {
            enabled: false,
            proxy_type: "socks5".to_string(),
            host: String::new(),
            port: 40000,
        }
    }
}

#[tauri::command]
pub fn get_proxy_url(enabled: bool, proxy_type: String, host: String, port: u16) -> Option<String> {
    let settings = ProxySettings {
        enabled,
        proxy_type,
        host,
        port,
    };
    settings.to_url()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProxyInfo {
    pub ip: String,
    pub port: u16,
    pub proxy_type: String,
}

/// Check if a local TCP port is accepting connections (to detect WARP/Tor)
fn is_local_proxy_running(host: &str, port: u16) -> bool {
    let addr: SocketAddr = format!("{}:{}", host, port)
        .parse()
        .unwrap_or("127.0.0.1:9050".parse().unwrap());
    TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
}

/// Auto-detect the best available local proxy:
/// 1. Cloudflare WARP (socks5://127.0.0.1:40000)
/// 2. Tor (socks5://127.0.0.1:9050)
/// 3. Fall back to fetching a free public proxy
#[tauri::command]
pub async fn auto_detect_proxy() -> Result<ProxyInfo, String> {
    // Priority 1: Cloudflare WARP
    if is_local_proxy_running("127.0.0.1", 40000) {
        return Ok(ProxyInfo {
            ip: "127.0.0.1".to_string(),
            port: 40000,
            proxy_type: "socks5".to_string(),
        });
    }

    // Priority 2: Tor Browser / Tor service
    if is_local_proxy_running("127.0.0.1", 9050) {
        return Ok(ProxyInfo {
            ip: "127.0.0.1".to_string(),
            port: 9050,
            proxy_type: "socks5".to_string(),
        });
    }

    // Priority 3: Tor Browser's SOCKS port
    if is_local_proxy_running("127.0.0.1", 9150) {
        return Ok(ProxyInfo {
            ip: "127.0.0.1".to_string(),
            port: 9150,
            proxy_type: "socks5".to_string(),
        });
    }

    // Priority 4: fetch a free public HTTP(S) proxy
    fetch_free_proxy().await
}

async fn fetch_free_proxy() -> Result<ProxyInfo, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    // Use proxyscrape API — anonymous HTTPS proxies
    let res = client
        .get("https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=anonymous")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;

    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() == 2 {
            if let Ok(port) = parts[1].parse::<u16>() {
                let addr_str = format!("{}:{}", parts[0], port);
                if let Ok(addr) = addr_str.parse::<SocketAddr>() {
                    if TcpStream::connect_timeout(&addr, Duration::from_secs(2)).is_ok() {
                        return Ok(ProxyInfo {
                            ip: parts[0].to_string(),
                            port,
                            proxy_type: "http".to_string(),
                        });
                    }
                }
            }
        }
    }

    Err("No proxy could be reached. Try installing Cloudflare WARP or Tor.".to_string())
}

/// Legacy command — kept for compatibility
#[tauri::command]
pub async fn fetch_universal_proxy() -> Result<ProxyInfo, String> {
    auto_detect_proxy().await
}
