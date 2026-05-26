const RAW_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

function resolveApiBase() {
  if (typeof window === "undefined") return RAW_API_BASE;
  if (window.location.protocol === "https:" && RAW_API_BASE.startsWith("http://")) {
    return RAW_API_BASE.replace(/^http:\/\//, "https://");
  }
  return RAW_API_BASE;
}

const API_BASE = resolveApiBase();

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/bwf_token=([^;]+)/);
  return match ? match[1] : null;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      document.cookie = "bwf_token=; path=/; max-age=0";
      window.location.href = "/login";
      return new Promise(() => {}); // never resolves — redirect in progress
    }
    const text = await res.text().catch(() => "");
    let message = text;
    try { message = JSON.parse(text).error ?? text; } catch {}
    throw new Error(message || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}
