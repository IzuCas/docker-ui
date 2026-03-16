import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Square,
  RotateCw,
  Trash2,
  RefreshCw,
  Heart,
  HeartOff,
  Cpu,
  MemoryStick,
  Network,
  Activity,
  FileText,
  Box,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { containerApi } from '../services/api';
import type { Container, ContainerSummary, ContainerStats } from '../types';

interface ServiceInfo {
  container: ContainerSummary;
  details?: Container;
  stats?: ContainerStats;
  loading: boolean;
}

export default function StackDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [services, setServices] = useState<Map<string, ServiceInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'logs'>('overview');
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);

  const loadContainers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await containerApi.list(true);
      const stackContainers = data.filter(
        (c) => c.labels?.['com.docker.compose.project'] === name
      );
      setContainers(stackContainers);
      
      // Initialize services map
      const newServices = new Map<string, ServiceInfo>();
      stackContainers.forEach((c) => {
        newServices.set(c.id, { container: c, loading: false });
      });
      setServices(newServices);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stack');
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    loadContainers();
  }, [loadContainers]);

  // Load details and stats for running containers
  useEffect(() => {
    const loadServiceDetails = async () => {
      for (const container of containers) {
        if (container.state === 'running') {
          try {
            const [details, stats] = await Promise.all([
              containerApi.inspect(container.id),
              containerApi.stats(container.id).catch(() => null),
            ]);
            setServices((prev) => {
              const newMap = new Map(prev);
              const existing = newMap.get(container.id);
              if (existing) {
                newMap.set(container.id, { ...existing, details, stats: stats || undefined, loading: false });
              }
              return newMap;
            });
          } catch (err) {
            console.error(`Failed to load details for ${container.id}:`, err);
          }
        }
      }
    };

    if (containers.length > 0) {
      loadServiceDetails();
    }
  }, [containers]);

  // Auto-refresh stats every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      for (const container of containers) {
        if (container.state === 'running') {
          try {
            const stats = await containerApi.stats(container.id);
            setServices((prev) => {
              const newMap = new Map(prev);
              const existing = newMap.get(container.id);
              if (existing) {
                newMap.set(container.id, { ...existing, stats });
              }
              return newMap;
            });
          } catch (err) {
            // Ignore stats errors
          }
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [containers]);

  const stackInfo = useMemo(() => {
    if (containers.length === 0) return null;
    const firstContainer = containers[0];
    return {
      name: name || '',
      workingDir: firstContainer.labels?.['com.docker.compose.project.working_dir'],
      configFile: firstContainer.labels?.['com.docker.compose.project.config_files'],
      runningCount: containers.filter((c) => c.state === 'running').length,
      totalCount: containers.length,
    };
  }, [containers, name]);

  const aggregatedStats = useMemo(() => {
    let totalCpu = 0;
    let totalMemory = 0;
    let totalMemoryLimit = 0;
    let totalNetworkRx = 0;
    let totalNetworkTx = 0;

    services.forEach((service) => {
      if (service.stats) {
        totalCpu += service.stats.cpuPercent;
        totalMemory += service.stats.memoryUsage;
        totalMemoryLimit += service.stats.memoryLimit;
        totalNetworkRx += service.stats.networkRx;
        totalNetworkTx += service.stats.networkTx;
      }
    });

    return {
      cpu: totalCpu,
      memory: totalMemory,
      memoryLimit: totalMemoryLimit,
      memoryPercent: totalMemoryLimit > 0 ? (totalMemory / totalMemoryLimit) * 100 : 0,
      networkRx: totalNetworkRx,
      networkTx: totalNetworkTx,
    };
  }, [services]);

  const handleStackAction = async (action: 'start' | 'stop' | 'restart') => {
    try {
      const promises = containers.map((c) => {
        switch (action) {
          case 'start':
            return containerApi.start(c.id);
          case 'stop':
            return containerApi.stop(c.id);
          case 'restart':
            return containerApi.restart(c.id);
        }
      });
      await Promise.all(promises);
      loadContainers();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action} stack`);
    }
  };

  const handleRemoveStack = async () => {
    if (!confirm(`Remove all containers in stack "${name}"?`)) return;
    try {
      const stopPromises = containers
        .filter((c) => c.state === 'running')
        .map((c) => containerApi.stop(c.id));
      await Promise.all(stopPromises);

      const removePromises = containers.map((c) => containerApi.remove(c.id, true));
      await Promise.all(removePromises);
      navigate('/stacks');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove stack');
    }
  };

  const toggleService = (id: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const loadLogs = async (containerId: string) => {
    setSelectedLogs(containerId);
    setLogsLoading(true);
    try {
      if (containerId === '__all__') {
        // Load logs from all containers
        const allLogs: string[] = [];
        for (const container of containers) {
          if (container.state === 'running') {
            try {
              const result = await containerApi.logs(container.id, { tail: '50' });
              const serviceName = getServiceName(container);
              if (result.logs && result.logs.trim()) {
                allLogs.push(`\n━━━━━━━━━━━━━━━━ ${serviceName} ━━━━━━━━━━━━━━━━\n`);
                allLogs.push(result.logs);
              }
            } catch (err) {
              allLogs.push(`\n━━━━━━━━━━━━━━━━ ${getServiceName(container)} ━━━━━━━━━━━━━━━━\n`);
              allLogs.push(`Error loading logs: ${err instanceof Error ? err.message : 'Unknown error'}\n`);
            }
          }
        }
        setLogs(allLogs.join('') || 'No logs available from running containers');
      } else {
        const result = await containerApi.logs(containerId, { tail: '200' });
        setLogs(result.logs);
      }
    } catch (err) {
      setLogs(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getServiceName = (container: ContainerSummary) => {
    return container.labels?.['com.docker.compose.service'] || container.names[0]?.replace(/^\//, '');
  };

  const getHealthIcon = (health?: { status: string }) => {
    if (!health) return null;
    switch (health.status) {
      case 'healthy':
        return <CheckCircle size={16} className="text-accent-green" />;
      case 'unhealthy':
        return <XCircle size={16} className="text-accent-red" />;
      case 'starting':
        return <Clock size={16} className="text-accent-yellow" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading stack...
      </div>
    );
  }

  if (!stackInfo) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertTriangle size={48} className="text-accent-yellow" style={{ marginBottom: '1rem' }} />
          <div>Stack not found</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="btn-icon" onClick={() => navigate('/stacks')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">
              <Activity size={24} />
              {stackInfo.name}
            </h1>
            {stackInfo.workingDir && (
              <div className="text-sm text-text-secondary">{stackInfo.workingDir}</div>
            )}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={loadContainers}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            className="btn"
            onClick={() => handleStackAction('start')}
            disabled={stackInfo.runningCount === stackInfo.totalCount}
          >
            <Play size={16} />
            Start All
          </button>
          <button
            className="btn"
            onClick={() => handleStackAction('stop')}
            disabled={stackInfo.runningCount === 0}
          >
            <Square size={16} />
            Stop All
          </button>
          <button className="btn" onClick={() => handleStackAction('restart')}>
            <RotateCw size={16} />
            Restart All
          </button>
          <button className="btn btn-danger" onClick={handleRemoveStack}>
            <Trash2 size={16} />
            Remove
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--accent-red)' }}>
          <div className="card-body" style={{ color: 'var(--accent-red)' }}>
            <AlertTriangle size={16} style={{ marginRight: '0.5rem' }} />
            {error}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'services' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          Services ({stackInfo.totalCount})
        </button>
        <button
          className={`tab ${activeTab === 'logs' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Logs
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Status Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Services</div>
              <div className="stat-value">
                <span className="text-accent-green">{stackInfo.runningCount}</span>
                <span className="text-text-secondary text-lg"> / {stackInfo.totalCount}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label flex items-center gap-2">
                <Cpu size={14} />
                CPU Usage
              </div>
              <div className="stat-value">{aggregatedStats.cpu.toFixed(1)}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label flex items-center gap-2">
                <MemoryStick size={14} />
                Memory Usage
              </div>
              <div className="stat-value">
                {formatBytes(aggregatedStats.memory)}
                <span className="text-text-secondary text-sm ml-2">
                  ({aggregatedStats.memoryPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label flex items-center gap-2">
                <Network size={14} />
                Network I/O
              </div>
              <div className="stat-value text-base">
                <span className="text-accent-green">↓ {formatBytes(aggregatedStats.networkRx)}</span>
                <span className="text-text-secondary mx-2">/</span>
                <span className="text-accent-blue">↑ {formatBytes(aggregatedStats.networkTx)}</span>
              </div>
            </div>
          </div>

          {/* Health Status */}
          <div className="card">
            <div className="card-body">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Heart size={18} />
                Health Status
              </h3>
              <div className="space-y-3">
                {containers.map((container) => {
                  const service = services.get(container.id);
                  const health = service?.details?.state.health;
                  const serviceName = getServiceName(container);

                  return (
                    <div
                      key={container.id}
                      className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Box size={16} className="text-text-secondary" />
                        <span className="font-medium">{serviceName}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`badge ${
                            container.state === 'running'
                              ? 'badge-success'
                              : container.state === 'exited'
                              ? 'badge-danger'
                              : 'badge-warning'
                          }`}
                        >
                          {container.state}
                        </span>
                        {health ? (
                          <div className="flex items-center gap-2">
                            {getHealthIcon(health)}
                            <span
                              className={`text-sm ${
                                health.status === 'healthy'
                                  ? 'text-accent-green'
                                  : health.status === 'unhealthy'
                                  ? 'text-accent-red'
                                  : 'text-accent-yellow'
                              }`}
                            >
                              {health.status}
                            </span>
                            {health.failingStreak > 0 && (
                              <span className="text-xs text-text-secondary">
                                ({health.failingStreak} failures)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-text-secondary text-sm">
                            <HeartOff size={16} />
                            No health check
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Resources per Service */}
          <div className="card">
            <div className="card-body">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Activity size={18} />
                Resource Usage
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>CPU</th>
                    <th>Memory</th>
                    <th>Network RX</th>
                    <th>Network TX</th>
                    <th>PIDs</th>
                  </tr>
                </thead>
                <tbody>
                  {containers.map((container) => {
                    const service = services.get(container.id);
                    const stats = service?.stats;
                    const serviceName = getServiceName(container);

                    return (
                      <tr key={container.id}>
                        <td className="font-medium">{serviceName}</td>
                        <td>
                          {stats ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2 bg-accent-blue rounded"
                                style={{ width: `${Math.min(stats.cpuPercent, 100)}%`, minWidth: '4px' }}
                              />
                              <span className="text-sm">{stats.cpuPercent.toFixed(1)}%</span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          {stats ? (
                            <span className="text-sm">
                              {formatBytes(stats.memoryUsage)} / {formatBytes(stats.memoryLimit)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="text-sm">{stats ? formatBytes(stats.networkRx) : '-'}</td>
                        <td className="text-sm">{stats ? formatBytes(stats.networkTx) : '-'}</td>
                        <td className="text-sm">{stats?.pids || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          {containers
            .sort((a, b) => getServiceName(a).localeCompare(getServiceName(b)))
            .map((container) => {
              const service = services.get(container.id);
              const serviceName = getServiceName(container);
              const isExpanded = expandedServices.has(container.id);

              return (
                <div key={container.id} className="card">
                  <div
                    className="card-body flex items-center justify-between cursor-pointer hover:bg-bg-tertiary transition-colors"
                    onClick={() => toggleService(container.id)}
                  >
                    <div className="flex items-center gap-3">
                      <button className="btn-icon">
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                      <Box size={20} className="text-accent-blue" />
                      <div>
                        <div className="font-semibold">{serviceName}</div>
                        <div className="text-xs text-text-secondary">{container.image}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {service?.details?.state.health && (
                        <div className="flex items-center gap-1">
                          {getHealthIcon(service.details.state.health)}
                        </div>
                      )}
                      <span
                        className={`badge ${
                          container.state === 'running'
                            ? 'badge-success'
                            : container.state === 'exited'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                      >
                        {container.state}
                      </span>
                      <Link
                        to={`/containers/${container.id}`}
                        className="btn btn-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Details
                      </Link>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border p-4 bg-bg-tertiary/50">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Left Column - Info */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">
                              Container Info
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-text-secondary">ID:</span>
                                <span className="code">{container.id.slice(0, 12)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Image:</span>
                                <span>{container.image}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Status:</span>
                                <span>{container.status}</span>
                              </div>
                              {container.ports && container.ports.length > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-text-secondary">Ports:</span>
                                  <span>
                                    {container.ports
                                      .filter((p) => p.publicPort)
                                      .map((p) => `${p.publicPort}:${p.privatePort}`)
                                      .join(', ') || '-'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Health Check Info */}
                          {service?.details?.state.health && (
                            <div>
                              <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">
                                Health Check
                              </h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  {getHealthIcon(service.details.state.health)}
                                  <span
                                    className={`font-medium ${
                                      service.details.state.health.status === 'healthy'
                                        ? 'text-accent-green'
                                        : service.details.state.health.status === 'unhealthy'
                                        ? 'text-accent-red'
                                        : 'text-accent-yellow'
                                    }`}
                                  >
                                    {service.details.state.health.status}
                                  </span>
                                </div>
                                {service.details.state.health.log &&
                                  service.details.state.health.log.length > 0 && (
                                    <div className="bg-bg-primary p-2 rounded text-xs font-mono max-h-32 overflow-auto">
                                      {service.details.state.health.log
                                        .slice(-3)
                                        .reverse()
                                        .map((log, i) => (
                                          <div
                                            key={i}
                                            className={`mb-1 ${
                                              log.exitCode === 0
                                                ? 'text-accent-green'
                                                : 'text-accent-red'
                                            }`}
                                          >
                                            [{log.exitCode === 0 ? 'OK' : 'FAIL'}] {log.output.trim()}
                                          </div>
                                        ))}
                                    </div>
                                  )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right Column - Stats */}
                        <div>
                          <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">
                            Resource Usage
                          </h4>
                          {service?.stats ? (
                            <div className="space-y-3">
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-text-secondary">CPU</span>
                                  <span>{service.stats.cpuPercent.toFixed(2)}%</span>
                                </div>
                                <div className="h-2 bg-bg-primary rounded overflow-hidden">
                                  <div
                                    className="h-full bg-accent-blue transition-all"
                                    style={{ width: `${Math.min(service.stats.cpuPercent, 100)}%` }}
                                  />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-text-secondary">Memory</span>
                                  <span>
                                    {formatBytes(service.stats.memoryUsage)} /{' '}
                                    {formatBytes(service.stats.memoryLimit)}
                                  </span>
                                </div>
                                <div className="h-2 bg-bg-primary rounded overflow-hidden">
                                  <div
                                    className="h-full bg-accent-purple transition-all"
                                    style={{ width: `${service.stats.memoryPercent}%` }}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-text-secondary">Network RX:</span>{' '}
                                  {formatBytes(service.stats.networkRx)}
                                </div>
                                <div>
                                  <span className="text-text-secondary">Network TX:</span>{' '}
                                  {formatBytes(service.stats.networkTx)}
                                </div>
                                <div>
                                  <span className="text-text-secondary">Block Read:</span>{' '}
                                  {formatBytes(service.stats.blockRead)}
                                </div>
                                <div>
                                  <span className="text-text-secondary">Block Write:</span>{' '}
                                  {formatBytes(service.stats.blockWrite)}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-text-secondary text-sm">
                              {container.state === 'running' ? 'Loading...' : 'Container not running'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-4 mb-4">
              <label className="text-sm font-medium">Select Service:</label>
              <select
                className="form-input"
                style={{ width: 'auto' }}
                value={selectedLogs || ''}
                onChange={(e) => loadLogs(e.target.value)}
              >
                <option value="">-- Select a service --</option>
                <option value="__all__">📋 All Services</option>
                {containers.map((container) => (
                  <option key={container.id} value={container.id}>
                    {getServiceName(container)}
                  </option>
                ))}
              </select>
              {selectedLogs && (
                <button className="btn btn-sm" onClick={() => loadLogs(selectedLogs)}>
                  <RefreshCw size={14} />
                  Refresh
                </button>
              )}
            </div>
            {logsLoading ? (
              <div className="loading">
                <div className="spinner" />
                Loading logs...
              </div>
            ) : logs ? (
              <div className="logs-container">{logs}</div>
            ) : (
              <div className="text-center text-text-secondary py-8">
                <FileText size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                <div>Select a service to view logs</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
