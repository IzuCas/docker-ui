import { useState, useEffect } from 'react';
import { HardDrive, Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { volumeApi } from '../services/api';
import type { Volume } from '../types';

export default function VolumesPage() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadVolumes();
  }, []);

  const loadVolumes = async () => {
    try {
      setLoading(true);
      const data = await volumeApi.list();
      setVolumes(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load volumes');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (name: string) => {
    if (!confirm(`Remove volume "${name}"?`)) return;
    try {
      await volumeApi.remove(name);
      loadVolumes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove volume');
    }
  };

  const handlePrune = async () => {
    if (!confirm('Remove all unused volumes?')) return;
    try {
      const result = await volumeApi.prune();
      alert(`Reclaimed ${formatSize(result.spaceReclaimed)} from ${result.volumesDeleted?.length || 0} volumes`);
      loadVolumes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to prune volumes');
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading volumes...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <HardDrive size={24} />
          Volumes
          <span className="badge badge-secondary">
            {volumes.length}
          </span>
        </h1>
        <div className="page-actions">
          <button className="btn" onClick={loadVolumes}>
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
          {volumes.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Driver</th>
                  <th>Scope</th>
                  <th>Mount Point</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {volumes.map((volume) => (
                  <tr key={volume.name}>
                    <td>
                      <span className="code">{volume.name}</span>
                    </td>
                    <td>
                      <span className="badge badge-info">{volume.driver}</span>
                    </td>
                    <td>{volume.scope}</td>
                    <td
                      className="truncate code"
                      style={{ maxWidth: '300px', fontSize: '0.75rem' }}
                      title={volume.mountpoint}
                    >
                      {volume.mountpoint}
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>
                      {new Date(volume.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon"
                          onClick={() => handleRemove(volume.name)}
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <HardDrive size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <div>No volumes found</div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateVolumeModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadVolumes();
          }}
        />
      )}
    </div>
  );
}

interface CreateVolumeModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateVolumeModal({ onClose, onCreated }: CreateVolumeModalProps) {
  const [name, setName] = useState('');
  const [driver, setDriver] = useState('local');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await volumeApi.create({ name: name || undefined, driver });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create volume');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Volume</h2>
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
              <label className="form-label">Name (optional)</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Leave empty for auto-generated name"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Driver</label>
              <select
                className="form-input"
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
              >
                <option value="local">local</option>
              </select>
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
