const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
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

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export async function subscribePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
  });

  const token = getToken();
  await fetch(`${API_BASE}/api/push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(sub.toJSON()),
  });
}

export async function unsubscribePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await sub.unsubscribe();

  const token = getToken();
  await fetch(`${API_BASE}/api/push/unsubscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
}
