const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TOKEN_KEY = 'fuel:v1:token';

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

  const res = await fetch(`${API_URL}${path}`, {
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
    let msg = res.statusText;
    try { const data = await res.json(); msg = data.error || msg; } catch {}
    throw new Error(msg);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as unknown as T;
  return res.json();
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
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const baseUrl = base.replace(/\/$/, '');
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
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', credentials: 'include', headers: authHeader(), body: form });
  if (res.status === 401) { clearAuth(); window.location.reload(); throw new Error('Unauthorized'); }
  if (!res.ok) {
    let msg = res.statusText;
    try { const data = await res.json(); msg = data.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}
