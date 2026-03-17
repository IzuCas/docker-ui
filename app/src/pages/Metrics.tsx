import { useState, useEffect, useCallback } from 'react';
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
  Activity,
  Cpu,
  MemoryStick,
  Network,
  HardDrive,
  RefreshCw,
  Clock,
  Database,
} from 'lucide-react';
import { metricsApi } from '../services/api';
import type {
  LatestMetricsResponse,
  ContainerMetricPoint,
  SystemMetricPoint,
  MetricsStoreStats,
} from '../types';

// Time range options
const timeRanges = [
  { label: '5m', value: 5 * 60 * 1000 },
  { label: '15m', value: 15 * 60 * 1000 },
  { label: '30m', value: 30 * 60 * 1000 },
  { label: '1h', value: 60 * 60 * 1000 },
  { label: '6h', value: 6 * 60 * 60 * 1000 },
  { label: '24h', value: 24 * 60 * 60 * 1000 },
  { label: '3d', value: 3 * 24 * 60 * 60 * 1000 },
];

// Chart colors
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '0.0%';
  return value.toFixed(1) + '%';
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface ContainerChartData {
  name: string;
  data: Array<{
    time: string;
    timestamp: number;
    cpu: number;
    memory: number;
    memoryPercent: number;
    networkRx: number;
    networkTx: number;
    blockRead: number;
    blockWrite: number;
  }>;
}

export default function MetricsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestMetrics, setLatestMetrics] = useState<LatestMetricsResponse | null>(null);
  const [containerData, setContainerData] = useState<ContainerChartData[]>([]);
  const [systemData, setSystemData] = useState<Array<SystemMetricPoint & { time: string }>>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRanges[2]); // 30m default
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval] = useState(5000);
  const [storeStats, setStoreStats] = useState<MetricsStoreStats | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const end = new Date().toISOString();
      const start = new Date(Date.now() - selectedTimeRange.value).toISOString();

      // Fetch all data in parallel
      const [latest, allContainers, system, stats] = await Promise.all([
        metricsApi.getLatestMetrics(),
        metricsApi.getAllContainerMetrics(start, end),
        metricsApi.getSystemMetrics(start, end),
        metricsApi.getStats(),
      ]);

      setLatestMetrics(latest);
      setStoreStats(stats);

      // Process container metrics for charts
      const chartData: ContainerChartData[] = [];
      if (allContainers.containers) {
        for (const [containerId, containerMetrics] of Object.entries(allContainers.containers)) {
          chartData.push({
            name: containerMetrics.containerName || containerId.substring(0, 12),
            data: containerMetrics.metrics.map((m: ContainerMetricPoint) => ({
              time: formatTime(m.timestamp),
              timestamp: new Date(m.timestamp).getTime(),
              cpu: m.cpuPercent,
              memory: m.memoryUsage,
              memoryPercent: m.memoryPercent,
              networkRx: m.networkRxBytes,
              networkTx: m.networkTxBytes,
              blockRead: m.blockRead,
              blockWrite: m.blockWrite,
            })),
          });
        }
      }
      setContainerData(chartData);

      // Process system metrics
      if (system.metrics) {
        setSystemData(
          system.metrics.map((m: SystemMetricPoint) => ({
            ...m,
            time: formatTime(m.timestamp),
          }))
        );
      }

      setError(null);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [selectedTimeRange]);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh, refreshInterval]);

  // Merge all container data for multi-line charts
  const mergedCpuData = containerData.length > 0
    ? containerData[0].data.map((_, idx) => {
        const point: Record<string, unknown> = {
          time: containerData[0].data[idx].time,
          timestamp: containerData[0].data[idx].timestamp,
        };
        containerData.forEach((container) => {
          if (container.data[idx]) {
            point[container.name] = container.data[idx].cpu;
          }
        });
        return point;
      })
    : [];

  const mergedMemoryData = containerData.length > 0
    ? containerData[0].data.map((_, idx) => {
        const point: Record<string, unknown> = {
          time: containerData[0].data[idx].time,
        };
        containerData.forEach((container) => {
          if (container.data[idx]) {
            point[container.name] = container.data[idx].memoryPercent;
          }
        });
        return point;
      })
    : [];

  const mergedNetworkData = containerData.length > 0
    ? containerData[0].data.map((_, idx) => {
        const point: Record<string, unknown> = {
          time: containerData[0].data[idx].time,
        };
        containerData.forEach((container) => {
          if (container.data[idx]) {
            point[`${container.name}_rx`] = container.data[idx].networkRx;
            point[`${container.name}_tx`] = container.data[idx].networkTx;
          }
        });
        return point;
      })
    : [];

  if (loading && !latestMetrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Activity className="w-7 h-7 text-accent-blue" />
            Metrics Dashboard
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Real-time monitoring with 3-day retention
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-secondary" />
            <div className="flex bg-bg-secondary rounded-lg p-1">
              {timeRanges.map((range) => (
                <button
                  key={range.label}
                  onClick={() => setSelectedTimeRange(range)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    selectedTimeRange.label === range.label
                      ? 'bg-accent-blue text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              autoRefresh
                ? 'bg-accent-green/20 text-accent-green'
                : 'bg-bg-secondary text-text-secondary'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto' : 'Paused'}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Store Stats */}
      {storeStats && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-bg-secondary rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
              <Database className="w-4 h-4" />
              Containers Tracked
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {storeStats.containers_tracked}
            </div>
          </div>
          <div className="bg-bg-secondary rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
              <Activity className="w-4 h-4" />
              Container Metrics
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {storeStats.container_metric_points.toLocaleString()}
            </div>
          </div>
          <div className="bg-bg-secondary rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
              <Cpu className="w-4 h-4" />
              System Metrics
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {storeStats.system_metric_points.toLocaleString()}
            </div>
          </div>
          <div className="bg-bg-secondary rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
              <HardDrive className="w-4 h-4" />
              Log Entries
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {storeStats.log_entries.toLocaleString()}
            </div>
          </div>
          <div className="bg-bg-secondary rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
              <Clock className="w-4 h-4" />
              Retention
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {storeStats.retention_period}
            </div>
          </div>
        </div>
      )}

      {/* CPU Chart */}
      <div className="bg-bg-secondary rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-accent-blue" />
          CPU Usage
        </h2>
        <div className="h-72">
          {mergedCpuData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedCpuData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
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
                  formatter={(value: number) => formatPercent(value)}
                />
                <Legend />
                {containerData.map((container, idx) => (
                  <Line
                    key={container.name}
                    type="monotone"
                    dataKey={container.name}
                    stroke={COLORS[idx % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-text-secondary">
              No CPU data available
            </div>
          )}
        </div>
      </div>

      {/* Memory Chart */}
      <div className="bg-bg-secondary rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <MemoryStick className="w-5 h-5 text-accent-green" />
          Memory Usage
        </h2>
        <div className="h-72">
          {mergedMemoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mergedMemoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
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
                  formatter={(value: number) => formatPercent(value)}
                />
                <Legend />
                {containerData.map((container, idx) => (
                  <Area
                    key={container.name}
                    type="monotone"
                    dataKey={container.name}
                    stroke={COLORS[idx % COLORS.length]}
                    fill={COLORS[idx % COLORS.length]}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-text-secondary">
              No memory data available
            </div>
          )}
        </div>
      </div>

      {/* Network I/O Chart */}
      <div className="bg-bg-secondary rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Network className="w-5 h-5 text-accent-purple" />
          Network I/O
        </h2>
        <div className="h-72">
          {mergedNetworkData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedNetworkData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
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
                {containerData.map((container, idx) => (
                  <g key={container.name}>
                    <Line
                      type="monotone"
                      dataKey={`${container.name}_rx`}
                      name={`${container.name} RX`}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey={`${container.name}_tx`}
                      name={`${container.name} TX`}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                    />
                  </g>
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-text-secondary">
              No network data available
            </div>
          )}
        </div>
      </div>

      {/* System Metrics Chart */}
      <div className="bg-bg-secondary rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent-amber" />
          System Overview
        </h2>
        <div className="h-72">
          {systemData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={systemData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="containersRunning"
                  name="Running"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                  stackId="1"
                />
                <Area
                  type="monotone"
                  dataKey="containersPaused"
                  name="Paused"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.3}
                  stackId="1"
                />
                <Area
                  type="monotone"
                  dataKey="containersStopped"
                  name="Stopped"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.3}
                  stackId="1"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-text-secondary">
              No system data available
            </div>
          )}
        </div>
      </div>

      {/* Latest Container Stats */}
      {latestMetrics && Object.keys(latestMetrics.containers || {}).length > 0 && (
        <div className="bg-bg-secondary rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Current Container Stats
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-text-secondary text-sm border-b border-border">
                  <th className="pb-3 font-medium">Container</th>
                  <th className="pb-3 font-medium">CPU</th>
                  <th className="pb-3 font-medium">Memory</th>
                  <th className="pb-3 font-medium">Memory %</th>
                  <th className="pb-3 font-medium">Network RX</th>
                  <th className="pb-3 font-medium">Network TX</th>
                  <th className="pb-3 font-medium">Block Read</th>
                  <th className="pb-3 font-medium">Block Write</th>
                  <th className="pb-3 font-medium">PIDs</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(latestMetrics.containers || {}).map(([containerId, metrics]) => (
                  <tr key={containerId} className="border-b border-border/50 text-sm">
                    <td className="py-3 text-text-primary font-medium">
                      {containerId.substring(0, 12)}
                    </td>
                    <td className="py-3">
                      <span className="text-accent-blue">{formatPercent(metrics.cpuPercent)}</span>
                    </td>
                    <td className="py-3 text-text-primary">
                      {formatBytes(metrics.memoryUsage)} / {formatBytes(metrics.memoryLimit)}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-green rounded-full"
                            style={{ width: `${Math.min(metrics.memoryPercent, 100)}%` }}
                          />
                        </div>
                        <span className="text-text-secondary">
                          {formatPercent(metrics.memoryPercent)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-text-primary">{formatBytes(metrics.networkRxBytes)}</td>
                    <td className="py-3 text-text-primary">{formatBytes(metrics.networkTxBytes)}</td>
                    <td className="py-3 text-text-primary">{formatBytes(metrics.blockRead)}</td>
                    <td className="py-3 text-text-primary">{formatBytes(metrics.blockWrite)}</td>
                    <td className="py-3 text-text-primary">{metrics.pids}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
