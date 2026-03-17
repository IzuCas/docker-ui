import type {
  ContainerSummary,
  Container,
  ContainerCreateConfig,
  ContainerStats,
  ExecConfig,
  ExecResult,
  ImageSummary,
  ImageInspect,
  ImageHistory,
  ImagePullOptions,
  Volume,
  VolumeCreateOptions,
  NetworkSummary,
  Network,
  NetworkCreateOptions,
  SystemInfo,
  DiskUsage,
  Version,
  PruneReport,
} from '../types';

// Detect if running in Electron and get API URL accordingly
function getApiUrl(): string {
  // Check if running in Electron
  if (window.electronAPI?.isElectron) {
    const url = window.electronAPI.getApiUrl();
    console.log('[API] Running in Electron, API URL:', url);
    return url;
  }
  // In web mode, use proxy (relative URL) or environment variable
  const url = import.meta.env.VITE_API_URL || '/api';
  console.log('[API] Running in web mode, API URL:', url);
  return url;
}

const API_URL = getApiUrl();
console.log('[API] Initialized with URL:', API_URL);

// Export the base URL for SSE/EventSource usage
export function getApiBaseUrl(): string {
  // For SSE, we need the direct API URL (not the proxy)
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.getApiUrl().replace('/api', '');
  }
  // In web mode, use the actual API server URL
  // The SSE endpoint is registered at /images/pull/stream (without /api prefix)
  return 'http://localhost:8001';
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  console.log(`[API] Request: ${options.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...options.headers,
      },
    });

    console.log(`[API] Response: ${response.status} ${response.statusText}`);

    if (response.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_username');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      console.error('[API] Error response:', error);
      throw new Error(error.detail || error.message || 'Request failed');
    }

    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();
    console.log(`[API] Data received:`, Array.isArray(data) ? `Array(${data.length})` : typeof data);
    return data;
  } catch (error) {
    console.error(`[API] Fetch error for ${url}:`, error);
    throw error;
  }
}

// Auth API (no token required)
export const authApi = {
  login: (username: string, password: string) =>
    fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Login failed' }));
        throw new Error(err.detail || err.message || 'Invalid username or password');
      }
      return res.json() as Promise<{ token: string; username: string; require_password_change: boolean }>;
    }),

  changePassword: (currentPassword: string, newPassword: string, newUsername?: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        ...(newUsername ? { new_username: newUsername } : {}),
      }),
    }),
};

// Container API
export const containerApi = {
  list: (all = false) =>
    request<ContainerSummary[]>(`/containers?all=${all}`),

  inspect: (id: string) =>
    request<Container>(`/containers/${id}`),

  create: (config: ContainerCreateConfig) =>
    request<{ id: string }>('/containers', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  start: (id: string) =>
    request<void>(`/containers/${id}/start`, { method: 'POST' }),

  stop: (id: string, timeout = 10) =>
    request<void>(`/containers/${id}/stop?timeout=${timeout}`, { method: 'POST' }),

  restart: (id: string, timeout = 10) =>
    request<void>(`/containers/${id}/restart?timeout=${timeout}`, { method: 'POST' }),

  pause: (id: string) =>
    request<void>(`/containers/${id}/pause`, { method: 'POST' }),

  unpause: (id: string) =>
    request<void>(`/containers/${id}/unpause`, { method: 'POST' }),

  kill: (id: string, signal = 'SIGKILL') =>
    request<void>(`/containers/${id}/kill?signal=${signal}`, { method: 'POST' }),

  remove: (id: string, force = false, v = false) =>
    request<void>(`/containers/${id}?force=${force}&v=${v}`, { method: 'DELETE' }),

  rename: (id: string, name: string) =>
    request<void>(`/containers/${id}/rename?name=${name}`, { method: 'POST' }),

  logs: (id: string, options: { stdout?: boolean; stderr?: boolean; tail?: string } = {}) => {
    const params = new URLSearchParams();
    params.set('stdout', String(options.stdout ?? true));
    params.set('stderr', String(options.stderr ?? true));
    if (options.tail) params.set('tail', options.tail);
    return request<{ logs: string }>(`/containers/${id}/logs?${params}`);
  },

  stats: (id: string) =>
    request<ContainerStats>(`/containers/${id}/stats`),

  exec: (id: string, config: ExecConfig) =>
    request<ExecResult>(`/containers/${id}/exec`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  top: (id: string, psArgs?: string) => {
    const params = psArgs ? `?ps_args=${encodeURIComponent(psArgs)}` : '';
    return request<{ titles: string[]; processes: string[][] }>(`/containers/${id}/top${params}`);
  },

  updateEnv: (id: string, env: string[]) =>
    request<{ id: string; message: string }>(`/containers/${id}/env`, {
      method: 'PUT',
      body: JSON.stringify({ env }),
    }),

  prune: () =>
    request<{ containersDeleted: string[]; spaceReclaimed: number }>('/containers/prune', {
      method: 'POST',
    }),
};

// Image API
export const imageApi = {
  list: (all = false) =>
    request<ImageSummary[]>(`/images?all=${all}`),

  inspect: (id: string) =>
    request<ImageInspect>(`/images/${encodeURIComponent(id)}`),

  pull: (options: ImagePullOptions) =>
    request<void>('/images/pull', {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  remove: (id: string, force = false, pruneChildren = false) =>
    request<{ deleted: string[]; untagged: string[] }>(
      `/images/${encodeURIComponent(id)}?force=${force}&pruneChildren=${pruneChildren}`,
      { method: 'DELETE' }
    ),

  tag: (id: string, repo: string, tag: string) =>
    request<void>(`/images/${encodeURIComponent(id)}/tag?repo=${encodeURIComponent(repo)}&tag=${encodeURIComponent(tag)}`, {
      method: 'POST',
    }),

  history: (id: string) =>
    request<ImageHistory[]>(`/images/${encodeURIComponent(id)}/history`),

  search: (term: string, limit = 25) =>
    request<Array<{ name: string; description: string; starCount: number; isOfficial: boolean }>>
      (`/images/search?term=${encodeURIComponent(term)}&limit=${limit}`),

  prune: (all = false) =>
    request<{ imagesDeleted: string[]; spaceReclaimed: number }>(`/images/prune?all=${all}`, {
      method: 'POST',
    }),
};

// Volume API
export const volumeApi = {
  list: (filters?: Record<string, string>) => {
    const params = filters ? `?filters=${encodeURIComponent(JSON.stringify(filters))}` : '';
    return request<Volume[]>(`/volumes${params}`);
  },

  inspect: (name: string) =>
    request<Volume>(`/volumes/${name}`),

  create: (options: VolumeCreateOptions) =>
    request<Volume>('/volumes', {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  remove: (name: string, force = false) =>
    request<void>(`/volumes/${name}?force=${force}`, { method: 'DELETE' }),

  prune: () =>
    request<{ volumesDeleted: string[]; spaceReclaimed: number }>('/volumes/prune', {
      method: 'POST',
    }),
};

// Network API
export const networkApi = {
  list: () =>
    request<NetworkSummary[]>('/networks'),

  inspect: (id: string) =>
    request<Network>(`/networks/${id}`),

  create: (options: NetworkCreateOptions) =>
    request<{ id: string }>('/networks', {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  remove: (id: string) =>
    request<void>(`/networks/${id}`, { method: 'DELETE' }),

  connect: (id: string, container: string) =>
    request<void>(`/networks/${id}/connect`, {
      method: 'POST',
      body: JSON.stringify({ container }),
    }),

  disconnect: (id: string, container: string, force = false) =>
    request<void>(`/networks/${id}/disconnect`, {
      method: 'POST',
      body: JSON.stringify({ container, force }),
    }),

  prune: () =>
    request<{ networksDeleted: string[] }>('/networks/prune', {
      method: 'POST',
    }),
};

// System API
export const systemApi = {
  info: () =>
    request<SystemInfo>('/system/info'),

  version: () =>
    request<Version>('/system/version'),

  diskUsage: () =>
    request<DiskUsage>('/system/df'),

  prune: () =>
    request<PruneReport>('/system/prune', { method: 'POST' }),

  ping: () =>
    request<{ status: string }>('/system/ping'),
};

// Registry API
export const registryApi = {
  login: (credentials: { username: string; password: string; serverAddress?: string }) =>
    request<{ status: string; identityToken?: string }>('/registry/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: (serverAddress?: string) =>
    request<{ status: string }>('/registry/logout', {
      method: 'POST',
      body: JSON.stringify({ serverAddress }),
    }),
};

// Settings API
export const settingsApi = {
  get: () =>
    request<{
      registries: Array<{ serverAddress: string; username: string; isLoggedIn: boolean }>;
      proxy: { httpProxy: string; httpsProxy: string; noProxy: string; ftpProxy?: string };
    }>('/settings'),

  getProxy: () =>
    request<{ httpProxy: string; httpsProxy: string; noProxy: string; ftpProxy?: string }>('/settings/proxy'),

  setProxy: (config: { httpProxy?: string; httpsProxy?: string; noProxy?: string; ftpProxy?: string }) =>
    request<{ status: string }>('/settings/proxy', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
};

// Metrics API
import type {
  ContainerMetricsResponse,
  AllContainerMetricsResponse,
  LatestMetricsResponse,
  SystemMetricsResponse,
  MetricsStoreStats,
} from '../types';

export const metricsApi = {
  getContainerMetrics: (containerId: string, start?: string, end?: string, resolution?: string) => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (resolution) params.set('resolution', resolution);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<ContainerMetricsResponse>(`/metrics/containers/${containerId}${query}`);
  },

  getAllContainerMetrics: (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<AllContainerMetricsResponse>(`/metrics/containers${query}`);
  },

  getLatestMetrics: () =>
    request<LatestMetricsResponse>('/metrics/latest'),

  getSystemMetrics: (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<SystemMetricsResponse>(`/metrics/system${query}`);
  },

  getStats: () =>
    request<MetricsStoreStats>('/metrics/stats'),
};
