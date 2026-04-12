import { load } from "@tauri-apps/plugin-store";

const STORE_NAME = "settings.json";

export interface ProxyConfig {
  enabled: boolean;
  proxyType: "http" | "socks5";
  host: string;
  port: number;
}

export const DEFAULT_PROXY: ProxyConfig = {
  enabled: false,
  proxyType: "http",
  host: "",
  port: 8080,
};

let storeInstance: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load(STORE_NAME);
  }
  return storeInstance;
}

export async function getProxySettings(): Promise<ProxyConfig> {
  try {
    const store = await getStore();
    const proxy = await store.get<ProxyConfig>("proxy");
    return proxy ?? DEFAULT_PROXY;
  } catch {
    return DEFAULT_PROXY;
  }
}

export async function setProxySettings(proxy: ProxyConfig): Promise<void> {
  const store = await getStore();
  await store.set("proxy", proxy);
  await store.save();
}

export function proxyToUrl(proxy: ProxyConfig): string | null {
  if (!proxy.enabled || !proxy.host) return null;
  return `${proxy.proxyType}://${proxy.host}:${proxy.port}`;
}

export async function getAppSettings(): Promise<Record<string, unknown>> {
  try {
    const store = await getStore();
    const settings = await store.get<Record<string, unknown>>("appSettings");
    return settings ?? {};
  } catch {
    return {};
  }
}

export async function setAppSetting(
  key: string,
  value: unknown
): Promise<void> {
  const store = await getStore();
  const settings = (await store.get<Record<string, unknown>>("appSettings")) ?? {};
  settings[key] = value;
  await store.set("appSettings", settings);
  await store.save();
}
