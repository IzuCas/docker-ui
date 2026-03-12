import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  ArrowLeft,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { containerApi } from '../services/api';
import type { Container, ContainerStats, ExecResult } from '../types';

export default function ContainerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [container, setContainer] = useState<Container | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [execCommand, setExecCommand] = useState('');
  const [execResult, setExecResult] = useState<ExecResult | null>(null);
  const [execLoading, setExecLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadContainer();
  }, [id]);

  useEffect(() => {
    if (!id || !container?.state.running) return;
    
    const loadStats = async () => {
      try {
        const s = await containerApi.stats(id);
        setStats(s);
      } catch {
        // Ignore stats errors
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, [id, container?.state.running]);

  const loadContainer = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await containerApi.inspect(id);
      setContainer(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load container');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    if (!id) return;
    try {
      const result = await containerApi.logs(id, { tail: '500' });
      setLogs(result.logs);
    } catch (err) {
      setLogs('Failed to load logs: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' && id) {
      loadLogs();
    }
  }, [activeTab, id]);

  const handleStart = async () => {
    if (!id) return;
    try {
      await containerApi.start(id);
      await loadContainer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start container');
    }
  };

  const handleStop = async () => {
    if (!id) return;
    try {
      await containerApi.stop(id);
      await loadContainer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop container');
    }
  };

  const handleRestart = async () => {
    if (!id) return;
    try {
      await containerApi.restart(id);
      await loadContainer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restart container');
    }
  };

  const handleRemove = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to remove this container?')) return;
    try {
      await containerApi.remove(id, true);
      navigate('/containers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove container');
    }
  };

  const handleExec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !execCommand) return;
    try {
      setExecLoading(true);
      const result = await containerApi.exec(id, {
        cmd: execCommand.split(' '),
        tty: true,
      });
      setExecResult(result);
    } catch (err) {
      setExecResult({
        exitCode: -1,
        output: err instanceof Error ? err.message : 'Command failed',
      });
    } finally {
      setExecLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading container...
      </div>
    );
  }

  if (error || !container) {
    return (
      <div>
        <Link to="/containers" className="btn" style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} />
          Back to Containers
        </Link>
        <div className="card">
          <div className="card-body" style={{ color: 'var(--accent-red)' }}>
            {error || 'Container not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/containers" className="btn-icon">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="page-title">{container.name.replace(/^\//, '')}</h1>
            <span className="code">{container.id.slice(0, 12)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {container.state.running ? (
            <button className="btn" onClick={handleStop}>
              <Square size={16} />
              Stop
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleStart}>
              <Play size={16} />
              Start
            </button>
          )}
          <button className="btn" onClick={handleRestart}>
            <RotateCw size={16} />
            Restart
          </button>
          <button className="btn btn-danger" onClick={handleRemove}>
            <Trash2 size={16} />
            Remove
          </button>
        </div>
      </div>

      {container.state.running && stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">CPU</div>
            <div className="stat-value">{stats.cpuPercent.toFixed(2)}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Memory</div>
            <div className="stat-value">
              {formatBytes(stats.memoryUsage)} / {formatBytes(stats.memoryLimit)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {stats.memoryPercent.toFixed(2)}%
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Network I/O</div>
            <div className="stat-value">
              {formatBytes(stats.networkRx)} / {formatBytes(stats.networkTx)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Block I/O</div>
            <div className="stat-value">
              {formatBytes(stats.blockRead)} / {formatBytes(stats.blockWrite)}
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Info
        </button>
        <button
          className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Logs
        </button>
        <button
          className={`tab ${activeTab === 'exec' ? 'active' : ''}`}
          onClick={() => setActiveTab('exec')}
        >
          Exec
        </button>
        <button
          className={`tab ${activeTab === 'env' ? 'active' : ''}`}
          onClick={() => setActiveTab('env')}
        >
          Environment
        </button>
        <button
          className={`tab ${activeTab === 'mounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('mounts')}
        >
          Mounts
        </button>
      </div>

      {activeTab === 'info' && (
        <div className="card">
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span className={`badge ${container.state.running ? 'badge-success' : 'badge-danger'}`}>
                  {container.state.status}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Image</span>
                <span className="detail-value">{container.image}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Created</span>
                <span className="detail-value">{new Date(container.created).toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Command</span>
                <span className="detail-value code">{container.command}</span>
              </div>
              {container.state.running && (
                <>
                  <div className="detail-item">
                    <span className="detail-label">Started At</span>
                    <span className="detail-value">
                      {new Date(container.state.startedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">PID</span>
                    <span className="detail-value">{container.state.pid}</span>
                  </div>
                </>
              )}
              {!container.state.running && container.state.finishedAt && (
                <>
                  <div className="detail-item">
                    <span className="detail-label">Finished At</span>
                    <span className="detail-value">
                      {new Date(container.state.finishedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Exit Code</span>
                    <span className="detail-value">{container.state.exitCode}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div>
          <div style={{ marginBottom: '0.5rem' }}>
            <button className="btn btn-sm" onClick={loadLogs}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
          <div className="logs-container">{logs || 'No logs available'}</div>
        </div>
      )}

      {activeTab === 'exec' && (
        <div className="card">
          <div className="card-body">
            {!container.state.running ? (
              <div style={{ color: 'var(--text-secondary)' }}>
                Container must be running to execute commands
              </div>
            ) : (
              <>
                <form onSubmit={handleExec} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={execCommand}
                      onChange={(e) => setExecCommand(e.target.value)}
                      placeholder="ls -la /app"
                      style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={execLoading}>
                      <Terminal size={16} />
                      {execLoading ? 'Running...' : 'Run'}
                    </button>
                  </div>
                </form>
                {execResult && (
                  <div>
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      Exit code: <span className="code">{execResult.exitCode}</span>
                    </div>
                    <div className="logs-container">{execResult.output || '(no output)'}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'env' && (
        <div className="card">
          <div className="card-body">
            {container.env && container.env.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {container.env.map((envVar, i) => {
                    const [key, ...valueParts] = envVar.split('=');
                    const value = valueParts.join('=');
                    return (
                      <tr key={i}>
                        <td className="code">{key}</td>
                        <td className="code truncate">{value}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>No environment variables</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'mounts' && (
        <div className="card">
          <div className="card-body">
            {container.mounts && container.mounts.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Destination</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {container.mounts.map((mount, i) => (
                    <tr key={i}>
                      <td>
                        <span className="badge badge-info">{mount.type}</span>
                      </td>
                      <td className="code truncate">{mount.source}</td>
                      <td className="code">{mount.destination}</td>
                      <td>
                        <span className={`badge ${mount.rw ? 'badge-success' : 'badge-warning'}`}>
                          {mount.rw ? 'RW' : 'RO'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>No mounts</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
