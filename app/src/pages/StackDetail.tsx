import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
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
  Search,
  X,
  Settings,
  Copy,
  Check,
  BarChart3,
} from 'lucide-react';
import { containerApi, metricsApi } from '../services/api';
import type { Container, ContainerSummary, ContainerStats, HealthcheckConfig, HealthState, ContainerMetricPoint } from '../types';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'logs' | 'metrics'>('overview');
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFilter, setLogsFilter] = useState<string>('');
  const [healthcheckModal, setHealthcheckModal] = useState<{
    containerId: string;
    serviceName: string;
    config?: HealthcheckConfig;
    status?: HealthState;
  } | null>(null);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [metricsData, setMetricsData] = useState<Map<string, { name: string; metrics: ContainerMetricPoint[] }>>(new Map());
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsTimeRange, setMetricsTimeRange] = useState<{ label: string; value: number }>({ label: '30m', value: 30 * 60 * 1000 });

  const filteredLogs = useMemo(() => {
    if (!logsFilter.trim()) return logs;
    const lines = logs.split('\n');
    const filtered = lines.filter((line) => 
      line.toLowerCase().includes(logsFilter.toLowerCase()) ||
      line.startsWith('━━━') // Keep section headers
    );
    return filtered.join('\n');
  }, [logs, logsFilter]);

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

  // Load metrics for stack containers
  const loadMetrics = useCallback(async () => {
    if (containers.length === 0) return;
    setMetricsLoading(true);
    try {
      const end = new Date().toISOString();
      const start = new Date(Date.now() - metricsTimeRange.value).toISOString();

      const newMetricsData = new Map<string, { name: string; metrics: ContainerMetricPoint[] }>();

      await Promise.all(
        containers.map(async (container) => {
          try {
            const response = await metricsApi.getContainerMetrics(container.id, start, end);
            newMetricsData.set(container.id, {
              name: getServiceName(container),
              metrics: response.metrics,
            });
          } catch (err) {
            console.error(`Failed to load metrics for ${container.id}:`, err);
          }
        })
      );

      setMetricsData(newMetricsData);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setMetricsLoading(false);
    }
  }, [containers, metricsTimeRange]);

  // Auto-refresh metrics when on metrics tab
  useEffect(() => {
    if (activeTab === 'metrics') {
      loadMetrics();
      const interval = setInterval(loadMetrics, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadMetrics]);

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
        <button
          className={`tab ${activeTab === 'metrics' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          Metrics
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
                  const healthcheck = service?.details?.healthcheck;
                  const serviceName = getServiceName(container);

                  return (
                    <div
                      key={container.id}
                      className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg hover:bg-bg-secondary cursor-pointer transition-colors"
                      onClick={() => setHealthcheckModal({
                        containerId: container.id,
                        serviceName,
                        config: healthcheck,
                        status: health,
                      })}
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
                            <Settings size={14} className="text-text-secondary ml-1" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-text-secondary text-sm">
                            <HeartOff size={16} />
                            No health check
                            <Settings size={14} className="ml-1" />
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
            {selectedLogs && logs && (
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1" style={{ maxWidth: '400px' }}>
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    className="form-input w-full pl-9 pr-8"
                    placeholder="Filter logs..."
                    value={logsFilter}
                    onChange={(e) => setLogsFilter(e.target.value)}
                  />
                  {logsFilter && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                      onClick={() => setLogsFilter('')}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                {logsFilter && (
                  <span className="text-sm text-text-secondary">
                    {filteredLogs.split('\n').filter(line => line.trim()).length} lines matching
                  </span>
                )}
              </div>
            )}
            {logsLoading ? (
              <div className="loading">
                <div className="spinner" />
                Loading logs...
              </div>
            ) : logs ? (
              filteredLogs ? (
                <div className="logs-container">{filteredLogs}</div>
              ) : (
                <div className="text-center text-text-secondary py-8">
                  <Search size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                  <div>No logs matching "{logsFilter}"</div>
                </div>
              )
            ) : (
              <div className="text-center text-text-secondary py-8">
                <FileText size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                <div>Select a service to view logs</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metrics Tab */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {/* Time Range Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-text-secondary" />
              <span className="text-sm text-text-secondary">Time Range:</span>
              <div className="flex bg-bg-secondary rounded-lg p-1">
                {[
                  { label: '5m', value: 5 * 60 * 1000 },
                  { label: '15m', value: 15 * 60 * 1000 },
                  { label: '30m', value: 30 * 60 * 1000 },
                  { label: '1h', value: 60 * 60 * 1000 },
                  { label: '6h', value: 6 * 60 * 60 * 1000 },
                ].map((range) => (
                  <button
                    key={range.label}
                    onClick={() => setMetricsTimeRange(range)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      metricsTimeRange.label === range.label
                        ? 'bg-accent-blue text-white'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="btn btn-sm"
              onClick={loadMetrics}
              disabled={metricsLoading}
            >
              <RefreshCw size={14} className={metricsLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {metricsLoading && metricsData.size === 0 ? (
            <div className="loading">
              <div className="spinner" />
              Loading metrics...
            </div>
          ) : metricsData.size === 0 ? (
            <div className="card">
              <div className="card-body text-center py-8">
                <BarChart3 size={48} className="mx-auto mb-4 text-text-secondary" style={{ opacity: 0.5 }} />
                <div className="text-text-secondary">No metrics data available</div>
                <p className="text-sm text-text-secondary mt-2">
                  Metrics are collected for running containers only
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* CPU Chart */}
              <div className="card">
                <div className="card-body">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Cpu size={18} className="text-accent-blue" />
                    CPU Usage
                  </h3>
                  <div style={{ height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="time"
                          stroke="#9ca3af"
                          fontSize={12}
                          tickLine={false}
                          allowDuplicatedCategory={false}
                        />
                        <YAxis
                          stroke="#9ca3af"
                          fontSize={12}
                          tickLine={false}
                          tickFormatter={(value) => `${value}%`}
                          domain={[0, 'auto']}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => `${value.toFixed(1)}%`}
                        />
                        <Legend />
                        {Array.from(metricsData.entries()).map(([, { name, metrics }], idx) => (
                          <Line
                            key={name}
                            data={metrics.map((m) => ({
                              time: new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                              [name]: m.cpuPercent,
                            }))}
                            type="monotone"
                            dataKey={name}
                            name={name}
                            stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][idx % 6]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Memory Chart */}
              <div className="card">
                <div className="card-body">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <MemoryStick size={18} className="text-accent-green" />
                    Memory Usage
                  </h3>
                  <div style={{ height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="time"
                          stroke="#9ca3af"
                          fontSize={12}
                          tickLine={false}
                          allowDuplicatedCategory={false}
                        />
                        <YAxis
                          stroke="#9ca3af"
                          fontSize={12}
                          tickLine={false}
                          tickFormatter={(value) => `${value}%`}
                          domain={[0, 100]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => `${value.toFixed(1)}%`}
                        />
                        <Legend />
                        {Array.from(metricsData.entries()).map(([, { name, metrics }], idx) => (
                          <Area
                            key={name}
                            data={metrics.map((m) => ({
                              time: new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                              [name]: m.memoryPercent,
                            }))}
                            type="monotone"
                            dataKey={name}
                            name={name}
                            stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][idx % 6]}
                            fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][idx % 6]}
                            fillOpacity={0.2}
                            strokeWidth={2}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Network I/O Chart */}
              <div className="card">
                <div className="card-body">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Network size={18} className="text-accent-purple" />
                    Network I/O
                  </h3>
                  <div style={{ height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="time"
                          stroke="#9ca3af"
                          fontSize={12}
                          tickLine={false}
                          allowDuplicatedCategory={false}
                        />
                        <YAxis
                          stroke="#9ca3af"
                          fontSize={12}
                          tickLine={false}
                          tickFormatter={formatBytes}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => formatBytes(value)}
                        />
                        <Legend />
                        {Array.from(metricsData.entries()).map(([, { name, metrics }], idx) => (
                          <>
                            <Line
                              key={`${name}_rx`}
                              data={metrics.map((m) => ({
                                time: new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                                [`${name} RX`]: m.networkRxBytes,
                              }))}
                              type="monotone"
                              dataKey={`${name} RX`}
                              name={`${name} RX`}
                              stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][idx % 6]}
                              strokeWidth={2}
                              dot={false}
                            />
                            <Line
                              key={`${name}_tx`}
                              data={metrics.map((m) => ({
                                time: new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                                [`${name} TX`]: m.networkTxBytes,
                              }))}
                              type="monotone"
                              dataKey={`${name} TX`}
                              name={`${name} TX`}
                              stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][idx % 6]}
                              strokeDasharray="5 5"
                              strokeWidth={2}
                              dot={false}
                            />
                          </>
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Healthcheck Configuration Modal */}
      {healthcheckModal && (
        <div className="modal-overlay" onClick={() => setHealthcheckModal(null)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2">
                <Heart size={20} />
                Health Check - {healthcheckModal.serviceName}
              </h3>
              <button className="modal-close" onClick={() => setHealthcheckModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {healthcheckModal.config ? (
                <div className="space-y-4">
                  {/* Current Status */}
                  {healthcheckModal.status && (
                    <div className="p-3 rounded-lg bg-bg-tertiary">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-text-secondary">Current Status</span>
                        <div className="flex items-center gap-2">
                          {getHealthIcon(healthcheckModal.status)}
                          <span
                            className={`font-medium ${
                              healthcheckModal.status.status === 'healthy'
                                ? 'text-accent-green'
                                : healthcheckModal.status.status === 'unhealthy'
                                ? 'text-accent-red'
                                : 'text-accent-yellow'
                            }`}
                          >
                            {healthcheckModal.status.status}
                          </span>
                        </div>
                      </div>
                      {healthcheckModal.status.failingStreak > 0 && (
                        <div className="text-sm text-accent-red">
                          Failing streak: {healthcheckModal.status.failingStreak}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Configuration */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 text-text-secondary">Configuration</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start p-2 bg-bg-tertiary rounded">
                        <span className="text-sm text-text-secondary">Command</span>
                        <div className="flex items-center gap-2">
                          <code className="text-sm text-text-primary font-mono">
                            {healthcheckModal.config.test.slice(1).join(' ')}
                          </code>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(healthcheckModal.config!.test.slice(1).join(' '));
                              setCopiedCommand(true);
                              setTimeout(() => setCopiedCommand(false), 2000);
                            }}
                          >
                            {copiedCommand ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2 bg-bg-tertiary rounded">
                          <span className="text-xs text-text-secondary block">Interval</span>
                          <span className="text-sm">{healthcheckModal.config.interval}</span>
                        </div>
                        <div className="p-2 bg-bg-tertiary rounded">
                          <span className="text-xs text-text-secondary block">Timeout</span>
                          <span className="text-sm">{healthcheckModal.config.timeout}</span>
                        </div>
                        <div className="p-2 bg-bg-tertiary rounded">
                          <span className="text-xs text-text-secondary block">Start Period</span>
                          <span className="text-sm">{healthcheckModal.config.startPeriod}</span>
                        </div>
                        <div className="p-2 bg-bg-tertiary rounded">
                          <span className="text-xs text-text-secondary block">Retries</span>
                          <span className="text-sm">{healthcheckModal.config.retries}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Health Checks */}
                  {healthcheckModal.status?.log && healthcheckModal.status.log.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 text-text-secondary">Recent Health Checks</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {healthcheckModal.status.log.slice().reverse().map((log, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded text-sm ${
                              log.exitCode === 0 ? 'bg-accent-green/10' : 'bg-accent-red/10'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={log.exitCode === 0 ? 'text-accent-green' : 'text-accent-red'}>
                                {log.exitCode === 0 ? <CheckCircle size={14} className="inline mr-1" /> : <XCircle size={14} className="inline mr-1" />}
                                Exit code: {log.exitCode}
                              </span>
                              <span className="text-xs text-text-secondary">
                                {new Date(log.start).toLocaleTimeString()}
                              </span>
                            </div>
                            {log.output && (
                              <pre className="text-xs text-text-secondary mt-1 whitespace-pre-wrap font-mono">
                                {log.output.trim()}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Docker Compose Example */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-text-secondary">
                      To modify, update your docker-compose.yml:
                    </h4>
                    <pre className="p-3 bg-bg-tertiary rounded text-xs font-mono overflow-x-auto">
{`services:
  ${healthcheckModal.serviceName}:
    healthcheck:
      test: ${JSON.stringify(healthcheckModal.config.test.slice(1))}
      interval: ${healthcheckModal.config.interval}
      timeout: ${healthcheckModal.config.timeout}
      start_period: ${healthcheckModal.config.startPeriod}
      retries: ${healthcheckModal.config.retries}`}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <HeartOff size={48} className="mx-auto mb-4 text-text-secondary" style={{ opacity: 0.5 }} />
                  <h4 className="font-medium mb-2">No Health Check Configured</h4>
                  <p className="text-sm text-text-secondary mb-4">
                    Add a health check to monitor this service's status.
                  </p>
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-text-secondary text-left">
                      Add to your docker-compose.yml:
                    </h4>
                    <pre className="p-3 bg-bg-tertiary rounded text-xs font-mono overflow-x-auto text-left">
{`services:
  ${healthcheckModal.serviceName}:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      start_period: 5s
      retries: 3`}
                    </pre>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setHealthcheckModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
