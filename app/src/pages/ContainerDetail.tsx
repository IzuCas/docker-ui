import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  ArrowLeft,
  Terminal,
  RefreshCw,
  Wifi,
  WifiOff,
  Edit2,
  Plus,
  Save,
  X,
  Trash,
  Search,
} from 'lucide-react';
import { containerApi } from '../services/api';
import { useContainerStats, useContainerLogs } from '../hooks/useWebSocket';
import type { Container, ContainerStats } from '../types';

interface EnvVariable {
  key: string;
  value: string;
}

interface TerminalEntry {
  id: number;
  command: string;
  output: string;
  exitCode: number;
  timestamp: Date;
  directory: string;
}

export default function ContainerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [container, setContainer] = useState<Container | null>(null);
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [execCommand, setExecCommand] = useState('');
  const [execLoading, setExecLoading] = useState(false);
  const [useRealtimeStats, setUseRealtimeStats] = useState(true);
  const [useRealtimeLogs, setUseRealtimeLogs] = useState(true);
  
  // Terminal state
  const [terminalHistory, setTerminalHistory] = useState<TerminalEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentDir, setCurrentDir] = useState('/');
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Environment editing state
  const [isEditingEnv, setIsEditingEnv] = useState(false);
  const [editedEnv, setEditedEnv] = useState<EnvVariable[]>([]);
  const [envSaving, setEnvSaving] = useState(false);

  // Real-time stats via WebSocket
  const { 
    stats: wsStats, 
    connected: statsConnected 
  } = useContainerStats(
    container?.state.running ? id || null : null,
    useRealtimeStats
  );

  // Real-time logs via WebSocket
  const {
    logs: wsLogs,
    connected: logsConnected,
    clearLogs,
  } = useContainerLogs(
    activeTab === 'logs' ? id || null : null,
    { tail: '500', enabled: useRealtimeLogs }
  );

  // Fallback HTTP stats
  const [httpStats, setHttpStats] = useState<ContainerStats | null>(null);
  const [httpLogs, setHttpLogs] = useState<string>('');
  const [logsFilter, setLogsFilter] = useState<string>('');

  const stats = useRealtimeStats ? wsStats : httpStats;
  const logs = useRealtimeLogs 
    ? wsLogs.map(l => `${l.timestamp} [${l.stream}] ${l.message}`).join('\n')
    : httpLogs;

  // Filtered logs based on search
  const filteredLogs = useMemo(() => {
    if (!logsFilter.trim() || !logs) return logs;
    const filter = logsFilter.toLowerCase();
    return logs
      .split('\n')
      .filter(line => line.toLowerCase().includes(filter))
      .join('\n');
  }, [logs, logsFilter]);

  useEffect(() => {
    if (!id) return;
    loadContainer();
  }, [id]);

  useEffect(() => {
    if (!id || !container?.state.running || useRealtimeStats) return;
    
    const loadStats = async () => {
      try {
        const s = await containerApi.stats(id);
        setHttpStats(s);
      } catch {
        // Ignore stats errors
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, [id, container?.state.running, useRealtimeStats]);

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
      setHttpLogs(result.logs);
    } catch (err) {
      setHttpLogs('Failed to load logs: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' && id && !useRealtimeLogs) {
      loadLogs();
    }
  }, [activeTab, id, useRealtimeLogs]);

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
    if (!id || !execCommand.trim()) return;
    
    const cmd = execCommand.trim();
    
    // Add to command history (avoid duplicates at the end)
    if (commandHistory[commandHistory.length - 1] !== cmd) {
      setCommandHistory(prev => [...prev, cmd]);
    }
    setHistoryIndex(-1);
    
    try {
      setExecLoading(true);
      
      // Check if it's a cd command
      const cdMatch = cmd.match(/^cd\s+(.+)$/);
      
      if (cdMatch) {
        // Handle cd command - change directory and get the new pwd
        const targetDir = cdMatch[1].trim();
        const cdCommand = `cd ${currentDir} && cd ${targetDir} && pwd`;
        
        const result = await containerApi.exec(id, {
          cmd: ['sh', '-c', cdCommand],
          tty: true,
        });
        
        const newDir = cleanOutput(result.output).trim();
        
        if (result.exitCode === 0 && newDir) {
          const entry: TerminalEntry = {
            id: Date.now(),
            command: cmd,
            output: '',
            exitCode: 0,
            timestamp: new Date(),
            directory: currentDir,
          };
          setTerminalHistory(prev => [...prev, entry]);
          setCurrentDir(newDir);
        } else {
          const entry: TerminalEntry = {
            id: Date.now(),
            command: cmd,
            output: result.output || 'Directory not found',
            exitCode: result.exitCode,
            timestamp: new Date(),
            directory: currentDir,
          };
          setTerminalHistory(prev => [...prev, entry]);
        }
      } else {
        // Regular command - execute in current directory
        const fullCommand = `cd ${currentDir} && ${cmd}`;
        
        const result = await containerApi.exec(id, {
          cmd: ['sh', '-c', fullCommand],
          tty: true,
        });
        
        // Add to terminal history
        const entry: TerminalEntry = {
          id: Date.now(),
          command: cmd,
          output: result.output,
          exitCode: result.exitCode,
          timestamp: new Date(),
          directory: currentDir,
        };
        setTerminalHistory(prev => [...prev, entry]);
      }
    } catch (err) {
      const errorOutput = err instanceof Error ? err.message : 'Command failed';
      const entry: TerminalEntry = {
        id: Date.now(),
        command: cmd,
        output: errorOutput,
        exitCode: -1,
        timestamp: new Date(),
        directory: currentDir,
      };
      setTerminalHistory(prev => [...prev, entry]);
    } finally {
      setExecLoading(false);
      setExecCommand('');
      // Scroll to bottom and refocus input
      setTimeout(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      
      const newIndex = historyIndex === -1 
        ? commandHistory.length - 1 
        : Math.max(0, historyIndex - 1);
      
      setHistoryIndex(newIndex);
      setExecCommand(commandHistory[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      
      const newIndex = historyIndex + 1;
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setExecCommand('');
      } else {
        setHistoryIndex(newIndex);
        setExecCommand(commandHistory[newIndex]);
      }
    }
  };

  const clearTerminal = () => {
    setTerminalHistory([]);
    setCurrentDir('/');
  };

  // Clean terminal output (remove control characters)
  const cleanOutput = (output: string) => {
    // Remove Docker multiplexed stream headers and control characters
    return output
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Environment variable editing functions
  const startEditingEnv = () => {
    if (container?.env) {
      setEditedEnv(
        container.env.map((envVar) => {
          const [key, ...valueParts] = envVar.split('=');
          return { key, value: valueParts.join('=') };
        })
      );
    } else {
      setEditedEnv([]);
    }
    setIsEditingEnv(true);
  };

  const cancelEditingEnv = () => {
    setIsEditingEnv(false);
    setEditedEnv([]);
  };

  const addEnvVariable = () => {
    setEditedEnv([...editedEnv, { key: '', value: '' }]);
  };

  const removeEnvVariable = (index: number) => {
    setEditedEnv(editedEnv.filter((_, i) => i !== index));
  };

  const updateEnvVariable = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...editedEnv];
    updated[index][field] = value;
    setEditedEnv(updated);
  };

  const saveEnvVariables = async () => {
    if (!id) return;
    
    // Validate - remove empty keys
    const validEnv = editedEnv.filter((e) => e.key.trim() !== '');
    const envStrings = validEnv.map((e) => `${e.key}=${e.value}`);
    
    try {
      setEnvSaving(true);
      const result = await containerApi.updateEnv(id, envStrings);
      // Navigate to the new container ID
      navigate(`/containers/${result.id}`, { replace: true });
      setIsEditingEnv(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update environment variables');
    } finally {
      setEnvSaving(false);
    }
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
        <div className="stats-section">
          <div className="stats-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 600 }}>Resource Usage</span>
              {useRealtimeStats && (
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  backgroundColor: statsConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                  color: statsConnected ? 'rgb(34, 197, 94)' : 'rgb(234, 179, 8)'
                }}>
                  {statsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {statsConnected ? 'Live' : 'Connecting...'}
                </span>
              )}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useRealtimeStats}
                onChange={(e) => setUseRealtimeStats(e.target.checked)}
              />
              Real-time
            </label>
          </div>
          <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">CPU</div>
            <div className="stat-value">{(stats.cpuPercent ?? 0).toFixed(2)}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Memory</div>
            <div className="stat-value">
              {formatBytes(stats.memoryUsage ?? 0)} / {formatBytes(stats.memoryLimit ?? 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {(stats.memoryPercent ?? 0).toFixed(2)}%
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Network I/O</div>
            <div className="stat-value">
              {formatBytes(stats.networkRx ?? 0)} / {formatBytes(stats.networkTx ?? 0)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Block I/O</div>
            <div className="stat-value">
              {formatBytes(stats.blockRead ?? 0)} / {formatBytes(stats.blockWrite ?? 0)}
            </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {useRealtimeLogs && (
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  backgroundColor: logsConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                  color: logsConnected ? 'rgb(34, 197, 94)' : 'rgb(234, 179, 8)'
                }}>
                  {logsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {logsConnected ? 'Live' : 'Connecting...'}
                </span>
              )}
              <button className="btn btn-sm" onClick={() => useRealtimeLogs ? clearLogs() : loadLogs()}>
                <RefreshCw size={14} />
                {useRealtimeLogs ? 'Clear' : 'Refresh'}
              </button>
            </div>
            {/* Search filter - centered */}
            <div className="flex items-center gap-2 flex-1 justify-center">
              <div className="relative" style={{ width: '300px' }}>
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
                <span className="text-sm text-text-secondary whitespace-nowrap">
                  {filteredLogs.split('\n').filter(line => line.trim()).length} lines
                </span>
              )}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useRealtimeLogs}
                onChange={(e) => setUseRealtimeLogs(e.target.checked)}
              />
              Real-time
            </label>
          </div>
          <div className="logs-container">
            {filteredLogs ? filteredLogs : (logsFilter ? `No logs matching "${logsFilter}"` : 'No logs available')}
          </div>
        </div>
      )}

      {activeTab === 'exec' && (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {!container.state.running ? (
              <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                Container must be running to execute commands
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '500px' }}>
                {/* Terminal header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '0.5rem 1rem',
                  borderBottom: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Terminal size={16} />
                    <span style={{ fontWeight: 500 }}>Terminal</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {container.name.replace(/^\//, '')}
                    </span>
                  </div>
                  <button 
                    className="btn btn-sm" 
                    onClick={clearTerminal}
                    title="Clear terminal"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    Clear
                  </button>
                </div>
                
                {/* Terminal output area */}
                <div 
                  ref={terminalRef}
                  onClick={() => inputRef.current?.focus()}
                  style={{ 
                    flex: 1, 
                    overflow: 'auto', 
                    padding: '1rem',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    background: '#0d1117',
                    color: '#c9d1d9',
                    cursor: 'text'
                  }}
                >
                  {/* Welcome message */}
                  {terminalHistory.length === 0 && (
                    <div style={{ color: '#8b949e', marginBottom: '1rem' }}>
                      <div>Welcome to container terminal.</div>
                      <div>Type commands and press Enter to execute.</div>
                      <div>Use ↑/↓ arrows to navigate command history.</div>
                    </div>
                  )}
                  
                  {/* Command history */}
                  {terminalHistory.map((entry) => (
                    <div key={entry.id} style={{ marginBottom: '0.75rem' }}>
                      {/* Command prompt */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span style={{ color: '#8b949e' }}>{entry.directory}</span>
                        <span style={{ color: '#58a6ff' }}>$</span>
                        <span style={{ color: '#c9d1d9' }}>{entry.command}</span>
                      </div>
                      {/* Output */}
                      {entry.output && (
                        <pre style={{ 
                          margin: '0.25rem 0 0 1rem', 
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          color: entry.exitCode === 0 ? '#c9d1d9' : '#f85149'
                        }}>
                          {cleanOutput(entry.output)}
                        </pre>
                      )}
                      {/* Exit code if non-zero */}
                      {entry.exitCode !== 0 && (
                        <div style={{ 
                          marginTop: '0.25rem', 
                          marginLeft: '1rem',
                          fontSize: '0.75rem', 
                          color: '#f85149' 
                        }}>
                          exit code: {entry.exitCode}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Current input line */}
                  <form onSubmit={handleExec} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: '#8b949e' }}>{currentDir}</span>
                    <span style={{ color: '#58a6ff' }}>$</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={execCommand}
                      onChange={(e) => setExecCommand(e.target.value)}
                      onKeyDown={handleTerminalKeyDown}
                      disabled={execLoading}
                      placeholder={execLoading ? 'Running...' : ''}
                      autoFocus
                      style={{ 
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#c9d1d9',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        padding: 0
                      }}
                    />
                    {execLoading && (
                      <div className="spinner" style={{ width: '14px', height: '14px' }} />
                    )}
                  </form>
                </div>
                
                {/* Status bar */}
                <div style={{ 
                  padding: '0.25rem 1rem',
                  borderTop: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>History: {commandHistory.length} commands</span>
                  <span>↑↓ Navigate history | Enter to run</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'env' && (
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Environment Variables</h3>
              {!isEditingEnv ? (
                <button className="btn btn-primary" onClick={startEditingEnv}>
                  <Edit2 size={16} />
                  Edit
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn" onClick={cancelEditingEnv} disabled={envSaving}>
                    <X size={16} />
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={saveEnvVariables} disabled={envSaving}>
                    <Save size={16} />
                    {envSaving ? 'Saving...' : 'Save & Restart'}
                  </button>
                </div>
              )}
            </div>

            {isEditingEnv ? (
              <div>
                <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  ⚠️ Saving will recreate the container with the new environment variables.
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>Variable</th>
                      <th>Value</th>
                      <th style={{ width: '60px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedEnv.map((env, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            type="text"
                            className="input"
                            value={env.key}
                            onChange={(e) => updateEnvVariable(i, 'key', e.target.value)}
                            placeholder="VARIABLE_NAME"
                            style={{ fontFamily: 'monospace' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input"
                            value={env.value}
                            onChange={(e) => updateEnvVariable(i, 'value', e.target.value)}
                            placeholder="value"
                            style={{ fontFamily: 'monospace' }}
                          />
                        </td>
                        <td>
                          <button
                            className="btn-icon"
                            onClick={() => removeEnvVariable(i)}
                            title="Remove variable"
                            style={{ color: 'var(--accent-red)' }}
                          >
                            <Trash size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="btn" onClick={addEnvVariable} style={{ marginTop: '0.5rem' }}>
                  <Plus size={16} />
                  Add Variable
                </button>
              </div>
            ) : container.env && container.env.length > 0 ? (
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
              <div style={{ color: 'var(--text-secondary)' }}>
                No environment variables defined.
                <button className="btn" onClick={startEditingEnv} style={{ marginLeft: '1rem' }}>
                  <Plus size={16} />
                  Add Variables
                </button>
              </div>
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
