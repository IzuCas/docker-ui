// Container types
export interface Container {
  id: string;
  name: string;
  image: string;
  imageId: string;
  command: string;
  created: string;
  state: ContainerState;
  mounts: Mount[];
  env: string[];
  labels: Record<string, string>;
}

export interface ContainerState {
  status: string;
  running: boolean;
  paused: boolean;
  restarting: boolean;
  dead: boolean;
  pid: number;
  exitCode: number;
  startedAt: string;
  finishedAt: string;
}

export interface ContainerSummary {
  id: string;
  names: string[];
  image: string;
  imageId: string;
  command: string;
  created: string;
  state: string;
  status: string;
  ports?: PortMapping[];
}

export interface PortMapping {
  ip?: string;
  privatePort: number;
  publicPort?: number;
  type: string;
}

export interface Mount {
  type: string;
  source: string;
  destination: string;
  mode: string;
  rw: boolean;
}

export interface ContainerCreateConfig {
  name: string;
  image: string;
  cmd?: string[];
  env?: string[];
  labels?: Record<string, string>;
  workingDir?: string;
  user?: string;
  exposedPorts?: Record<string, object>;
  portBindings?: Record<string, PortBinding[]>;
  mounts?: MountConfig[];
  networkMode?: string;
  restartPolicy?: string;
  autoRemove?: boolean;
  publishAllPorts?: boolean;
  privileged?: boolean;
  memory?: number;
  cpuShares?: number;
}

export interface PortBinding {
  hostIp: string;
  hostPort: string;
}

export interface MountConfig {
  type: string;
  source: string;
  destination: string;
}

export interface ContainerStats {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRx: number;
  networkTx: number;
  blockRead: number;
  blockWrite: number;
  pids: number;
}

export interface ExecConfig {
  cmd: string[];
  env?: string[];
  workingDir?: string;
  user?: string;
  privileged?: boolean;
  tty?: boolean;
}

export interface ExecResult {
  exitCode: number;
  output: string;
}

// Image types
export interface ImageSummary {
  id: string;
  repoTags: string[];
  repoDigests: string[];
  created: string;
  size: number;
  labels: Record<string, string>;
}

export interface ImageInspect {
  id: string;
  repoTags: string[];
  repoDigests: string[];
  parent: string;
  comment: string;
  created: string;
  dockerVersion: string;
  author: string;
  architecture: string;
  os: string;
  size: number;
  virtualSize: number;
  config: ImageConfig;
}

export interface ImageConfig {
  hostname: string;
  user: string;
  exposedPorts: Record<string, object>;
  env: string[];
  cmd: string[];
  volumes: Record<string, object>;
  workingDir: string;
  entrypoint: string[];
  labels: Record<string, string>;
}

export interface ImageHistory {
  id: string;
  created: string;
  createdBy: string;
  tags: string[];
  size: number;
  comment: string;
}

export interface ImagePullOptions {
  image: string;
  tag?: string;
  platform?: string;
}

// Volume types
export interface Volume {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt: string;
  labels: Record<string, string>;
  scope: string;
  options: Record<string, string>;
  usageData?: VolumeUsageData;
}

export interface VolumeUsageData {
  size: number;
  refCount: number;
}

export interface VolumeCreateOptions {
  name?: string;
  driver?: string;
  driverOpts?: Record<string, string>;
  labels?: Record<string, string>;
}

// Network types
export interface Network {
  id: string;
  name: string;
  created: string;
  scope: string;
  driver: string;
  enableIPv6: boolean;
  internal: boolean;
  attachable: boolean;
  ingress: boolean;
  ipam: IPAM;
  options: Record<string, string>;
  labels: Record<string, string>;
  containers: Record<string, EndpointResource>;
}

export interface NetworkSummary {
  id: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  attachable: boolean;
  ingress: boolean;
  ipam: IPAM;
}

export interface IPAM {
  driver?: string;
  config?: IPAMConfig[];
  options?: Record<string, string>;
}

export interface IPAMConfig {
  subnet?: string;
  ipRange?: string;
  gateway?: string;
  auxAddress?: Record<string, string>;
}

export interface EndpointResource {
  name: string;
  endpointId: string;
  macAddress: string;
  ipv4Address: string;
  ipv6Address: string;
}

export interface NetworkCreateOptions {
  name: string;
  driver?: string;
  internal?: boolean;
  attachable?: boolean;
  ingress?: boolean;
  enableIPv6?: boolean;
  ipam?: IPAM;
  options?: Record<string, string>;
  labels?: Record<string, string>;
}

// System types
export interface SystemInfo {
  id: string;
  containers: number;
  containersRunning: number;
  containersPaused: number;
  containersStopped: number;
  images: number;
  driver: string;
  driverStatus: string[][];
  memoryLimit: boolean;
  swapLimit: boolean;
  kernelMemory: boolean;
  cpuCfsPeriod: boolean;
  cpuCfsQuota: boolean;
  cpuShares: boolean;
  cpuSet: boolean;
  ipv4Forwarding: boolean;
  bridgeNfIptables: boolean;
  bridgeNfIp6tables: boolean;
  debug: boolean;
  nfd: number;
  oomKillDisable: boolean;
  nGoroutines: number;
  systemTime: string;
  loggingDriver: string;
  cgroupDriver: string;
  nEventsListener: number;
  kernelVersion: string;
  operatingSystem: string;
  osType: string;
  architecture: string;
  ncpu: number;
  memTotal: number;
  dockerRootDir: string;
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
  name: string;
  labels: string[];
  serverVersion: string;
}

export interface DiskUsage {
  layersSize: number;
  images: ImageDiskUsage[];
  containers: ContainerDiskUsage[];
  volumes: VolumeDiskUsage[];
  buildCache: BuildCacheDiskUsage[];
}

export interface ImageDiskUsage {
  id: string;
  repoTags: string[];
  size: number;
  sharedSize: number;
  containers: number;
}

export interface ContainerDiskUsage {
  id: string;
  names: string[];
  image: string;
  sizeRw: number;
  sizeRootFs: number;
}

export interface VolumeDiskUsage {
  name: string;
  size: number;
  refCount: number;
}

export interface BuildCacheDiskUsage {
  id: string;
  type: string;
  size: number;
  shared: boolean;
  inUse: boolean;
}

export interface Version {
  version: string;
  apiVersion: string;
  minApiVersion: string;
  gitCommit: string;
  goVersion: string;
  os: string;
  arch: string;
  kernelVersion: string;
  buildTime: string;
}

export interface PruneReport {
  containersDeleted: string[];
  imagesDeleted: string[];
  volumesDeleted: string[];
  networksDeleted: string[];
  spaceReclaimed: number;
}
