import { useState, useEffect } from 'react';
import { Network, Plus, Trash2, RefreshCw, AlertTriangle, Link, Unlink } from 'lucide-react';
import { networkApi } from '../services/api';
import type { NetworkSummary } from '../types';

export default function NetworksPage() {
  const [networks, setNetworks] = useState<NetworkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [connectModal, setConnectModal] = useState<{ network: string; action: 'connect' | 'disconnect' } | null>(null);

  useEffect(() => {
    loadNetworks();
  }, []);

  const loadNetworks = async () => {
    try {
      setLoading(true);
      const data = await networkApi.list();
      setNetworks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load networks');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remove network "${name}"?`)) return;
    try {
      await networkApi.remove(id);
      loadNetworks();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove network');
    }
  };

  const handlePrune = async () => {
    if (!confirm('Remove all unused networks?')) return;
    try {
      const result = await networkApi.prune();
      alert(`Removed ${result.networksDeleted?.length || 0} networks`);
      loadNetworks();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to prune networks');
    }
  };

  const isSystemNetwork = (name: string) => {
    return ['bridge', 'host', 'none'].includes(name);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading networks...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <Network size={24} />
          Networks
          <span className="badge badge-secondary" style={{ marginLeft: '0.5rem' }}>
            {networks.length}
          </span>
        </h1>
        <div className="page-actions">
          <button className="btn" onClick={loadNetworks}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="btn btn-danger" onClick={handlePrune}>
            <Trash2 size={16} />
            Prune
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            Create
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

      <div className="card">
        <div className="card-body">
          {networks.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Driver</th>
                  <th>Scope</th>
                  <th>Subnet</th>
                  <th>Gateway</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((network) => (
                  <tr key={network.id}>
                    <td>
                      <span className="code">{network.name}</span>
                      {isSystemNetwork(network.name) && (
                        <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>
                          system
                        </span>
                      )}
                    </td>
                    <td className="code" style={{ fontSize: '0.75rem' }}>
                      {network.id.slice(0, 12)}
                    </td>
                    <td>
                      <span className="badge badge-info">{network.driver}</span>
                    </td>
                    <td>{network.scope}</td>
                    <td className="code" style={{ fontSize: '0.75rem' }}>
                      {network.ipam?.config?.[0]?.subnet || '-'}
                    </td>
                    <td className="code" style={{ fontSize: '0.75rem' }}>
                      {network.ipam?.config?.[0]?.gateway || '-'}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon"
                          onClick={() => setConnectModal({ network: network.id, action: 'connect' })}
                          title="Connect Container"
                        >
                          <Link size={16} />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => setConnectModal({ network: network.id, action: 'disconnect' })}
                          title="Disconnect Container"
                        >
                          <Unlink size={16} />
                        </button>
                        {!isSystemNetwork(network.name) && (
                          <button
                            className="btn-icon"
                            onClick={() => handleRemove(network.id, network.name)}
                            title="Remove"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <Network size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <div>No networks found</div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateNetworkModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadNetworks();
          }}
        />
      )}

      {connectModal && (
        <ConnectContainerModal
          networkId={connectModal.network}
          action={connectModal.action}
          onClose={() => setConnectModal(null)}
          onSuccess={() => {
            setConnectModal(null);
            loadNetworks();
          }}
        />
      )}
    </div>
  );
}

interface CreateNetworkModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateNetworkModal({ onClose, onCreated }: CreateNetworkModalProps) {
  const [name, setName] = useState('');
  const [driver, setDriver] = useState('bridge');
  const [subnet, setSubnet] = useState('');
  const [gateway, setGateway] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await networkApi.create({
        name,
        driver,
        ipam: subnet ? {
          config: [{ subnet, gateway: gateway || undefined }]
        } : undefined
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create network');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Network</h2>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>
                {error}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-network"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Driver</label>
              <select
                className="form-input"
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
              >
                <option value="bridge">bridge</option>
                <option value="host">host</option>
                <option value="overlay">overlay</option>
                <option value="macvlan">macvlan</option>
                <option value="none">none</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subnet (optional)</label>
              <input
                type="text"
                className="form-input"
                value={subnet}
                onChange={(e) => setSubnet(e.target.value)}
                placeholder="172.20.0.0/16"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Gateway (optional)</label>
              <input
                type="text"
                className="form-input"
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
                placeholder="172.20.0.1"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ConnectContainerModalProps {
  networkId: string;
  action: 'connect' | 'disconnect';
  onClose: () => void;
  onSuccess: () => void;
}

function ConnectContainerModal({ networkId, action, onClose, onSuccess }: ConnectContainerModalProps) {
  const [containerId, setContainerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!containerId.trim()) {
      setError('Container ID is required');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      if (action === 'connect') {
        await networkApi.connect(networkId, containerId);
      } else {
        await networkApi.disconnect(networkId, containerId);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} container`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{action === 'connect' ? 'Connect' : 'Disconnect'} Container</h2>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>
                {error}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Container ID or Name *</label>
              <input
                type="text"
                className="form-input"
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
                placeholder="container-id or container-name"
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : action === 'connect' ? 'Connect' : 'Disconnect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
