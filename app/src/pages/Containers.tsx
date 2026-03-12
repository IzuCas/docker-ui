import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Plus,
  RefreshCw,
  Terminal,
  FileText,
  MoreHorizontal,
  Pause,
  X,
} from 'lucide-react';
import { containerApi } from '../services/api';
import type { ContainerSummary, ContainerCreateConfig } from '../types';

export default function ContainersPage() {
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadContainers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await containerApi.list(showAll);
      setContainers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load containers');
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    loadContainers();
  }, [loadContainers]);

  const handleStart = async (id: string) => {
    try {
      await containerApi.start(id);
      await loadContainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start container');
    }
  };

  const handleStop = async (id: string) => {
    try {
      await containerApi.stop(id);
      await loadContainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop container');
    }
  };

  const handleRestart = async (id: string) => {
    try {
      await containerApi.restart(id);
      await loadContainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restart container');
    }
  };

  const handlePause = async (id: string) => {
    try {
      await containerApi.pause(id);
      await loadContainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause container');
    }
  };

  const handleUnpause = async (id: string) => {
    try {
      await containerApi.unpause(id);
      await loadContainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unpause container');
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Are you sure you want to remove this container?')) return;
    try {
      await containerApi.remove(id, true);
      await loadContainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove container');
    }
  };

  const handlePrune = async () => {
    if (!confirm('Remove all stopped containers?')) return;
    try {
      await containerApi.prune();
      await loadContainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prune containers');
    }
  };

  const getStatusBadge = (state: string) => {
    const badges: Record<string, string> = {
      running: 'bg-accent-green/20 text-accent-green',
      paused: 'bg-accent-yellow/20 text-accent-yellow',
      exited: 'bg-accent-red/20 text-accent-red',
      created: 'bg-accent-blue/20 text-accent-blue',
      restarting: 'bg-accent-yellow/20 text-accent-yellow',
      removing: 'bg-accent-red/20 text-accent-red',
      dead: 'bg-accent-red/20 text-accent-red',
    };
    return badges[state] || 'bg-bg-tertiary text-text-secondary';
  };

  const formatName = (names: string[]) => {
    return names[0]?.replace(/^\//, '') || 'unnamed';
  };

  const formatId = (id: string) => id.slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-text-primary">Containers</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-bg-tertiary text-accent-blue focus:ring-accent-blue focus:ring-offset-bg-primary"
            />
            Show all
          </label>
          <button 
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-bg-secondary text-text-primary hover:bg-bg-tertiary transition-colors"
            onClick={loadContainers}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button 
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-bg-secondary text-text-primary hover:bg-bg-tertiary transition-colors"
            onClick={handlePrune}
          >
            <Trash2 size={16} />
            Prune
          </button>
          <button 
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-accent-green text-white hover:bg-accent-green/80 transition-colors"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            Create
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-accent-red/50 bg-accent-red/10">
          <span className="text-accent-red text-sm">{error}</span>
          <button 
            className="p-1 rounded hover:bg-accent-red/20 transition-colors"
            onClick={() => setError(null)}
          >
            <X size={16} className="text-accent-red" />
          </button>
        </div>
      )}

      <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-text-secondary">
            <div className="w-6 h-6 border-2 border-border border-t-accent-blue rounded-full animate-spin mr-3" />
            Loading containers...
          </div>
        ) : containers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Terminal size={48} className="mb-4 opacity-50" />
            <p className="text-lg">No containers found</p>
            <p className="text-sm mt-1">Create a new container to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bg-tertiary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
              {containers.map((container) => (
                <tr key={container.id} className="hover:bg-bg-tertiary/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/containers/${container.id}`} className="font-medium text-accent-blue hover:underline">
                      {formatName(container.names)}
                    </Link>
                    <div className="mt-1">
                      <span className="text-xs font-mono text-text-secondary bg-bg-tertiary px-1.5 py-0.5 rounded">
                        {formatId(container.id)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary max-w-[200px] truncate">{container.image}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(container.state)}`}>
                      {container.state}
                    </span>
                    <div className="text-xs text-text-secondary mt-1">{container.status}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {new Date(container.created).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {container.state === 'running' ? (
                        <>
                          <button
                            className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-accent-red transition-colors"
                            onClick={() => handleStop(container.id)}
                            title="Stop"
                          >
                            <Square size={14} />
                          </button>
                          <button
                            className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-accent-yellow transition-colors"
                            onClick={() => handlePause(container.id)}
                            title="Pause"
                          >
                            <Pause size={14} />
                          </button>
                        </>
                      ) : container.state === 'paused' ? (
                        <button
                          className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-accent-green transition-colors"
                          onClick={() => handleUnpause(container.id)}
                          title="Unpause"
                        >
                          <Play size={14} />
                        </button>
                      ) : (
                        <button
                          className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-accent-green transition-colors"
                          onClick={() => handleStart(container.id)}
                          title="Start"
                        >
                          <Play size={14} />
                        </button>
                      )}
                      <button
                        className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-accent-blue transition-colors"
                        onClick={() => handleRestart(container.id)}
                        title="Restart"
                      >
                        <RotateCw size={14} />
                      </button>
                      <div className="relative">
                        <button
                          className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors"
                          onClick={() => setActionMenu(actionMenu === container.id ? null : container.id)}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {actionMenu === container.id && (
                          <div className="absolute right-0 top-full mt-1 bg-bg-secondary border border-border rounded-lg shadow-xl z-10 min-w-[140px] py-1">
                            <Link
                              to={`/containers/${container.id}`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
                              onClick={() => setActionMenu(null)}
                            >
                              <FileText size={14} />
                              Details
                            </Link>
                            <button
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-accent-red hover:bg-accent-red/10 transition-colors"
                              onClick={() => {
                                handleRemove(container.id);
                                setActionMenu(null);
                              }}
                            >
                              <Trash2 size={14} />
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateContainerModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadContainers();
          }}
        />
      )}
    </div>
  );
}

function CreateContainerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [command, setCommand] = useState('');
  const [env, setEnv] = useState('');
  const [ports, setPorts] = useState('');
  const [autoStart, setAutoStart] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) {
      setError('Image is required');
      return;
    }

    try {
      setLoading(true);

      const config: ContainerCreateConfig = {
        name: name,
        image,
      };

      if (command) {
        config.cmd = command.split(' ');
      }

      if (env) {
        config.env = env.split('\n').filter(Boolean);
      }

      if (ports) {
        const portBindings: Record<string, Array<{ hostIp: string; hostPort: string }>> = {};
        const exposedPorts: Record<string, object> = {};
        
        ports.split('\n').filter(Boolean).forEach((mapping) => {
          const [hostPort, containerPort] = mapping.split(':');
          if (hostPort && containerPort) {
            exposedPorts[`${containerPort}/tcp`] = {};
            portBindings[`${containerPort}/tcp`] = [{ hostIp: '0.0.0.0', hostPort }];
          }
        });
        
        config.exposedPorts = exposedPorts;
        config.portBindings = portBindings;
      }

      const result = await containerApi.create(config);

      if (autoStart) {
        await containerApi.start(result.id);
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create container');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Create Container</h2>
          <button className="p-1 rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Name (optional)</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-container"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Image *</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="nginx:latest"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Command (optional)</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="/bin/sh -c 'echo hello'"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Environment variables (one per line)</label>
              <textarea
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all resize-y"
                value={env}
                onChange={(e) => setEnv(e.target.value)}
                placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Port mappings (one per line, host:container)</label>
              <textarea
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all resize-y"
                value={ports}
                onChange={(e) => setPorts(e.target.value)}
                placeholder="8080:80&#10;443:443"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={(e) => setAutoStart(e.target.checked)}
                id="autoStart"
                className="w-4 h-4 rounded border-border bg-bg-tertiary text-accent-blue focus:ring-accent-blue"
              />
              <label htmlFor="autoStart" className="text-sm text-text-primary cursor-pointer">Start container after creation</label>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-bg-tertiary/50">
            <button 
              type="button" 
              className="px-4 py-2 text-sm font-medium text-text-primary bg-bg-tertiary border border-border rounded-lg hover:bg-border transition-colors disabled:opacity-50"
              onClick={onClose} 
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 text-sm font-medium text-white bg-accent-green rounded-lg hover:bg-accent-green/80 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
