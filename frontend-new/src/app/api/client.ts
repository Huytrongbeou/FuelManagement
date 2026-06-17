const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function getToken(): string | null {
  return localStorage.getItem('fuel_token');
}

export function clearAuth() {
  localStorage.removeItem('fuel_token');
  localStorage.removeItem('fuel_user');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const token = getToken();
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) reqHeaders['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: reqHeaders,
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

export async function downloadWithAuth(path: string, filename: string): Promise<void> {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const token = localStorage.getItem('fuel_token');
  if (!token) throw new Error('Bạn chưa đăng nhập');
  const baseUrl = base.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  let url: string | null = null;
  let a: HTMLAnchorElement | null = null;
  try {
    const res = await fetch(`${baseUrl}/${cleanPath}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Download thất bại (${res.status})`);
    const blob = await res.blob();
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
  const token = getToken();
  const form = new FormData();
  form.append(fieldName, file);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: form });
  if (res.status === 401) { clearAuth(); window.location.reload(); throw new Error('Unauthorized'); }
  if (!res.ok) {
    let msg = res.statusText;
    try { const data = await res.json(); msg = data.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}
