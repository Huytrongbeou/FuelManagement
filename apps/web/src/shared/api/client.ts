const BUILD_TIME_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const API_BASE_KEY = 'fuel:v1:apiBase';
const TOKEN_KEY = 'fuel:v1:token';

/**
 * Server address, resolved per request rather than frozen at module load.
 *
 * A packaged APK would otherwise be locked to whatever URL it was built against, and the address
 * does change independently of app releases — a demo tunnel hands out a new URL every restart, a
 * DHCP LAN IP moves, and the VNPT server will have a different one again. Storing an override on
 * the device means the address can be corrected in the app instead of rebuilding and reinstalling.
 */
export function getApiBase(): string {
  return localStorage.getItem(API_BASE_KEY) || BUILD_TIME_API_URL;
}

/** Forgiving about what a user actually pastes: trailing slashes, and a missing `/api` suffix. */
export function normalizeApiBase(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

/** Empty input clears the override and falls back to the address baked in at build time. */
export function setApiBase(input: string): void {
  const normalized = normalizeApiBase(input);
  if (normalized) localStorage.setItem(API_BASE_KEY, normalized);
  else localStorage.removeItem(API_BASE_KEY);
}

export function getApiBaseOverride(): string | null {
  return localStorage.getItem(API_BASE_KEY);
}

/**
 * Bearer token support. The browser build can rely on the gateway's HttpOnly cookie, but a
 * native (Capacitor) build cannot: its webview origin is capacitor://localhost, so the API is
 * cross-origin and the cookie is not sent. The gateway reads the cookie first and falls back to
 * `Authorization: Bearer`, so storing and sending the token keeps ONE code path working on both.
 */
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function clearAuth() {
  localStorage.removeItem('fuel:v1:user');
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeader(),
    ...headers,
  };

  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: reqHeaders,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearAuth();
    window.location.reload();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    let data: Record<string, unknown> = {};
    try { data = await res.json(); } catch {}
    // Attach status + parsed body so callers can act on structured errors (e.g. a 409 carrying
    // `nearbyStations`), while `.message` keeps working for the common case.
    const err = new Error((data.error as string) || res.statusText) as ApiError;
    err.status = res.status;
    err.data = data;
    throw err;
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as unknown as T;
  return res.json();
}

export interface ApiError extends Error {
  status?: number;
  data?: Record<string, unknown>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

/** Blob → base64 payload (without the `data:...;base64,` prefix) for Capacitor Filesystem. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được dữ liệu file'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads an authenticated file.
 *
 * Browser: object URL + a[download], the normal path.
 * Native (Capacitor): there is no download manager and `a[download]` silently does nothing, so
 * the bytes are written to the app's cache directory and handed to the OS share sheet, which is
 * how a user actually gets an .xlsx off a phone (save to Files, send via Zalo/email, ...).
 */
export async function downloadWithAuth(path: string, filename: string): Promise<void> {
  const baseUrl = getApiBase().replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');

  const res = await fetch(`${baseUrl}/${cleanPath}`, { credentials: 'include', headers: authHeader() });
  if (res.status === 401) { clearAuth(); window.location.reload(); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`Download thất bại (${res.status})`);
  const blob = await res.blob();

  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const written = await Filesystem.writeFile({
      path: filename,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
    });
    await Share.share({ title: filename, url: written.uri });
    return;
  }

  let url: string | null = null;
  let a: HTMLAnchorElement | null = null;
  try {
    url = URL.createObjectURL(blob);
    a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
  } finally {
    if (a) a.remove();
    if (url) URL.revokeObjectURL(url);
  }
}

export async function uploadFile<T>(path: string, file: File, fieldName = 'file'): Promise<T> {
  const form = new FormData();
  form.append(fieldName, file);
  // No Content-Type here on purpose — the browser sets the multipart boundary itself.
  const res = await fetch(`${getApiBase()}${path}`, { method: 'POST', credentials: 'include', headers: authHeader(), body: form });
  if (res.status === 401) { clearAuth(); window.location.reload(); throw new Error('Unauthorized'); }
  if (!res.ok) {
    let msg = res.statusText;
    try { const data = await res.json(); msg = data.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}
