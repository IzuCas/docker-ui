import { useState, useEffect } from 'react';
import { Server, HardDrive, Cpu, MemoryStick, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { systemApi } from '../services/api';
import type { SystemInfo, DiskUsage, Version } from '../types';

export default function SystemPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [version, setVersion] = useState<Version | null>(null);
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pruning, setPruning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [infoData, versionData, diskData] = await Promise.all([
        systemApi.info(),
        systemApi.version(),
        systemApi.diskUsage()
      ]);
      setInfo(infoData);
      setVersion(versionData);
      setDiskUsage(diskData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system info');
    } finally {
      setLoading(false);
    }
  };

  const handlePrune = async () => {
    if (!confirm('This will remove all unused containers, networks, images and volumes. Continue?')) return;
    try {
      setPruning(true);
      const result = await systemApi.prune();
      alert(`
Pruned:
- Containers: ${result.containersDeleted?.length || 0}
- Networks: ${result.networksDeleted?.length || 0}
- Images: ${result.imagesDeleted?.length || 0}
- Space reclaimed: ${formatSize(result.spaceReclaimed)}
      `.trim());
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to prune system');
    } finally {
      setPruning(false);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-secondary">
        <div className="w-6 h-6 border-2 border-border border-t-accent-blue rounded-full animate-spin mr-3" />
        Loading system info...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          <Server size={24} className="text-accent-blue" />
          System
        </h1>
        <div className="flex items-center gap-3">
          <button 
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-bg-secondary text-text-primary hover:bg-bg-tertiary transition-colors"
            onClick={loadData}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button 
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-accent-red text-accent-red hover:bg-accent-red hover:text-white transition-colors disabled:opacity-50"
            onClick={handlePrune} 
            disabled={pruning}
          >
            <Trash2 size={16} />
            {pruning ? 'Pruning...' : 'Prune All'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg border border-accent-red/50 bg-accent-red/10 text-accent-red text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-blue/10">
            <Cpu size={24} className="text-accent-blue" />
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">{info?.ncpu || 0}</div>
            <div className="text-sm text-text-secondary">CPUs</div>
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-purple/10">
            <MemoryStick size={24} className="text-accent-purple" />
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">{formatSize(info?.memTotal)}</div>
            <div className="text-sm text-text-secondary">Memory</div>
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-green/10">
            <Server size={24} className="text-accent-green" />
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">{info?.containers || 0}</div>
            <div className="text-sm text-text-secondary">Containers</div>
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-yellow/10">
            <HardDrive size={24} className="text-accent-yellow" />
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">{info?.images || 0}</div>
            <div className="text-sm text-text-secondary">Images</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-bg-tertiary/50">
            <h2 className="font-semibold text-text-primary">Docker Info</h2>
          </div>
          <div className="p-5">
            {info && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">ID</span>
                  <div className="mt-1 text-sm font-mono text-text-primary bg-bg-tertiary px-2 py-1 rounded inline-block">{info.id?.slice(0, 12)}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Name</span>
                  <div className="mt-1 text-sm text-text-primary">{info.name}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">OS</span>
                  <div className="mt-1 text-sm text-text-primary">{info.operatingSystem}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">OS Type</span>
                  <div className="mt-1 text-sm text-text-primary">{info.osType}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Architecture</span>
                  <div className="mt-1 text-sm text-text-primary">{info.architecture}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Kernel</span>
                  <div className="mt-1 text-sm text-text-primary">{info.kernelVersion}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Docker Root Dir</span>
                  <div className="mt-1 text-xs font-mono text-text-primary bg-bg-tertiary px-2 py-1 rounded inline-block">{info.dockerRootDir}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Storage Driver</span>
                  <div className="mt-1 text-sm text-text-primary">{info.driver}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Containers Running</span>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-green/20 text-accent-green">{info.containersRunning}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Containers Paused</span>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-yellow/20 text-accent-yellow">{info.containersPaused}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Containers Stopped</span>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-bg-tertiary text-text-secondary">{info.containersStopped}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-bg-tertiary/50">
            <h2 className="font-semibold text-text-primary">Version</h2>
          </div>
          <div className="p-5">
            {version && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Version</span>
                  <div className="mt-1 text-sm text-text-primary">{version.version}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">API Version</span>
                  <div className="mt-1 text-sm text-text-primary">{version.apiVersion}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Min API Version</span>
                  <div className="mt-1 text-sm text-text-primary">{version.minApiVersion}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Git Commit</span>
                  <div className="mt-1 text-xs font-mono text-text-primary bg-bg-tertiary px-2 py-1 rounded inline-block">{version.gitCommit}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Go Version</span>
                  <div className="mt-1 text-sm text-text-primary">{version.goVersion}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">OS/Arch</span>
                  <div className="mt-1 text-sm text-text-primary">{version.os}/{version.arch}</div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Build Time</span>
                  <div className="mt-1 text-xs text-text-primary">{version.buildTime}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {diskUsage && (
        <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-bg-tertiary/50">
            <h2 className="font-semibold text-text-primary">Disk Usage</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-bg-tertiary rounded-xl p-5 text-center">
                <div className="text-3xl font-bold text-accent-blue">
                  {diskUsage.images?.length || 0}
                </div>
                <div className="text-sm text-text-secondary mt-1 mb-2">Images</div>
                <div className="text-sm font-mono text-text-primary bg-bg-primary px-2 py-1 rounded inline-block">
                  {formatSize(diskUsage.images?.reduce((acc, i) => acc + (i.size || 0), 0))}
                </div>
              </div>
              <div className="bg-bg-tertiary rounded-xl p-5 text-center">
                <div className="text-3xl font-bold text-accent-green">
                  {diskUsage.containers?.length || 0}
                </div>
                <div className="text-sm text-text-secondary mt-1 mb-2">Containers</div>
                <div className="text-sm font-mono text-text-primary bg-bg-primary px-2 py-1 rounded inline-block">
                  {formatSize(diskUsage.containers?.reduce((acc, c) => acc + (c.sizeRw || 0), 0))}
                </div>
              </div>
              <div className="bg-bg-tertiary rounded-xl p-5 text-center">
                <div className="text-3xl font-bold text-accent-purple">
                  {diskUsage.volumes?.length || 0}
                </div>
                <div className="text-sm text-text-secondary mt-1 mb-2">Volumes</div>
                <div className="text-sm font-mono text-text-primary bg-bg-primary px-2 py-1 rounded inline-block">
                  {formatSize(diskUsage.volumes?.reduce((acc, v) => acc + (v.size || 0), 0))}
                </div>
              </div>
              <div className="bg-bg-tertiary rounded-xl p-5 text-center">
                <div className="text-3xl font-bold text-accent-yellow">
                  {diskUsage.buildCache?.length || 0}
                </div>
                <div className="text-sm text-text-secondary mt-1 mb-2">Build Cache</div>
                <div className="text-sm font-mono text-text-primary bg-bg-primary px-2 py-1 rounded inline-block">
                  {formatSize(diskUsage.buildCache?.reduce((acc, b) => acc + (b.size || 0), 0))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
