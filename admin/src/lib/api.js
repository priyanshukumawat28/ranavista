import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'rv_admin_token';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

const api = axios.create({ baseURL: `${API_BASE}/api` });

api.interceptors.request.use((cfg) => {
  const t = tokenStore.get();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.';
export const fileUrl = (u) => (u?.startsWith('http') ? u : `${API_BASE}${u}`);

/** Download a protected file (e.g. invoice) with the auth header. */
export async function download(path, filename) {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function uploadFiles(files) {
  const fd = new FormData();
  [...files].forEach((f) => fd.append('files', f));
  const { data } = await api.post('/uploads', fd);
  return data;
}

export default api;
