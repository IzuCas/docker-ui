import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Play,
  Square,
  RotateCw,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Box,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { containerApi } from '../services/api';
import type { ContainerSummary } from '../types';

interface Stack {
  name: string;
  workingDir?: string;
  configFile?: string;
  containers: ContainerSummary[];
  runningCount: number;
  stoppedCount: number;
}

export default function StacksPage() {
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadContainers();
  }, []);

  const loadContainers = async () => {
    try {
      setLoading(true);
      const data = await containerApi.list(true);
      setContainers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load containers');
    } finally {
      setLoading(false);
    }
  };

  const stacks = useMemo(() => {
    const stackMap = new Map<string, Stack>();

    containers.forEach((container) => {
      const projectName = container.labels?.['com.docker.compose.project'];
      if (!projectName) return;

      if (!stackMap.has(projectName)) {
        stackMap.set(projectName, {
          name: projectName,
          workingDir: container.labels?.['com.docker.compose.project.working_dir'],
          configFile: container.labels?.['com.docker.compose.project.config_files'],
          containers: [],
          runningCount: 0,
          stoppedCount: 0,
        });
      }

      const stack = stackMap.get(projectName)!;
      stack.containers.push(container);
      if (container.state === 'running') {
        stack.runningCount++;
      } else {
        stack.stoppedCount++;
      }
    });

    return Array.from(stackMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [containers]);

  const standaloneContainers = useMemo(() => {
    return containers.filter((c) => !c.labels?.['com.docker.compose.project']);
  }, [containers]);

  const toggleStack = (name: string) => {
    setExpandedStacks((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleStackAction = async (stack: Stack, action: 'start' | 'stop' | 'restart') => {
    try {
      const promises = stack.containers.map((c) => {
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

  const handleRemoveStack = async (stack: Stack) => {
    if (!confirm(`Remove all containers in stack "${stack.name}"? This will also stop running containers.`)) return;
    try {
      // Stop running containers first
      const stopPromises = stack.containers
        .filter((c) => c.state === 'running')
        .map((c) => containerApi.stop(c.id));
      await Promise.all(stopPromises);

      // Then remove all containers
      const removePromises = stack.containers.map((c) => containerApi.remove(c.id, true));
      await Promise.all(removePromises);
      loadContainers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove stack');
    }
  };

  const getServiceName = (container: ContainerSummary) => {
    return container.labels?.['com.docker.compose.service'] || container.names[0]?.replace(/^\//, '');
  };

  const getContainerNumber = (container: ContainerSummary) => {
    return container.labels?.['com.docker.compose.container-number'] || '1';
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading stacks...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <Layers size={24} />
          Stacks
          <span className="badge badge-secondary">
            {stacks.length}
          </span>
        </h1>
        <div className="page-actions">
          <button className="btn" onClick={loadContainers}>
            <RefreshCw size={16} />
            Refresh
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

      {stacks.length > 0 ? (
        <div className="space-y-4">
          {stacks.map((stack) => (
            <div key={stack.name} className="card">
              <div
                className="card-body flex items-center justify-between cursor-pointer hover:bg-bg-tertiary transition-colors"
                onClick={() => toggleStack(stack.name)}
              >
                <div className="flex items-center gap-3">
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); toggleStack(stack.name); }}>
                    {expandedStacks.has(stack.name) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>
                  <Layers size={20} className="text-accent-purple" />
                  <div>
                    <div className="font-semibold text-text-primary">{stack.name}</div>
                    {stack.workingDir && (
                      <div className="text-xs text-text-secondary truncate" style={{ maxWidth: '400px' }}>
                        {stack.workingDir}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-success">{stack.runningCount} running</span>
                    {stack.stoppedCount > 0 && (
                      <span className="badge badge-secondary">{stack.stoppedCount} stopped</span>
                    )}
                  </div>

                  <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                    <Link
                      to={`/stacks/${encodeURIComponent(stack.name)}`}
                      className="btn btn-sm"
                      title="View Details"
                    >
                      <ExternalLink size={14} />
                      Details
                    </Link>
                    <button
                      className="btn-icon"
                      onClick={() => handleStackAction(stack, 'start')}
                      title="Start All"
                      disabled={stack.runningCount === stack.containers.length}
                    >
                      <Play size={16} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleStackAction(stack, 'stop')}
                      title="Stop All"
                      disabled={stack.runningCount === 0}
                    >
                      <Square size={16} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleStackAction(stack, 'restart')}
                      title="Restart All"
                    >
                      <RotateCw size={16} />
                    </button>
                    <button
                      className="btn-icon-danger"
                      onClick={() => handleRemoveStack(stack)}
                      title="Remove Stack"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {expandedStacks.has(stack.name) && (
                <div className="border-t border-border">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Container</th>
                        <th>Image</th>
                        <th>Status</th>
                        <th>Ports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stack.containers
                        .sort((a, b) => getServiceName(a).localeCompare(getServiceName(b)))
                        .map((container) => (
                          <tr key={container.id}>
                            <td>
                              <div className="flex items-center gap-2">
                                <Box size={14} className="text-text-secondary" />
                                <span className="font-medium">{getServiceName(container)}</span>
                                {parseInt(getContainerNumber(container)) > 1 && (
                                  <span className="badge badge-secondary text-xs">
                                    #{getContainerNumber(container)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <Link
                                to={`/containers/${container.id}`}
                                className="code text-accent-blue hover:underline"
                                style={{ fontSize: '0.75rem' }}
                              >
                                {container.id.slice(0, 12)}
                              </Link>
                            </td>
                            <td className="text-text-secondary text-sm">
                              <span 
                                className="block truncate max-w-[200px]" 
                                title={container.image}
                              >
                                {container.image}
                              </span>
                            </td>
                            <td>
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
                            </td>
                            <td className="text-sm text-text-secondary">
                              {container.ports && container.ports.length > 0
                                ? container.ports
                                    .filter((p) => p.publicPort)
                                    .map((p) => `${p.publicPort}:${p.privatePort}`)
                                    .join(', ') || '-'
                                : '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <Layers size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <div style={{ marginBottom: '0.5rem' }}>No Docker Compose stacks found</div>
            <div className="text-sm">
              Containers created with docker-compose will appear here grouped by project
            </div>
          </div>
        </div>
      )}

      {standaloneContainers.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 className="text-lg font-semibold text-text-secondary mb-4">
            Standalone Containers
            <span className="badge badge-secondary ml-2">{standaloneContainers.length}</span>
          </h2>
          <div className="card">
            <div className="card-body">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Image</th>
                    <th>Status</th>
                    <th>Ports</th>
                  </tr>
                </thead>
                <tbody>
                  {standaloneContainers.map((container) => (
                    <tr key={container.id}>
                      <td>
                        <Link
                          to={`/containers/${container.id}`}
                          className="text-accent-blue hover:underline font-medium"
                        >
                          {container.names[0]?.replace(/^\//, '')}
                        </Link>
                        <div className="code text-xs text-text-secondary">{container.id.slice(0, 12)}</div>
                      </td>
                      <td className="text-text-secondary text-sm">
                        <span 
                          className="block truncate max-w-[200px]" 
                          title={container.image}
                        >
                          {container.image}
                        </span>
                      </td>
                      <td>
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
                      </td>
                      <td className="text-sm text-text-secondary">
                        {container.ports && container.ports.length > 0
                          ? container.ports
                              .filter((p) => p.publicPort)
                              .map((p) => `${p.publicPort}:${p.privatePort}`)
                              .join(', ') || '-'
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
