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

const API_URL = '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || error.message || 'Request failed');
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

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
