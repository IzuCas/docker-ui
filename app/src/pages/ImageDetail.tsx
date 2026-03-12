import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Tag } from 'lucide-react';
import { imageApi } from '../services/api';
import type { ImageInspect, ImageHistory } from '../types';

export default function ImageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [image, setImage] = useState<ImageInspect | null>(null);
  const [history, setHistory] = useState<ImageHistory[]>([]);
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadImage();
  }, [id]);

  const loadImage = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await imageApi.inspect(decodeURIComponent(id));
      setImage(data);
      const hist = await imageApi.history(decodeURIComponent(id));
      setHistory(hist);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatId = (id: string) => id.replace('sha256:', '').slice(0, 12);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading image...
      </div>
    );
  }

  if (error || !image) {
    return (
      <div>
        <Link to="/images" className="btn" style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} />
          Back to Images
        </Link>
        <div className="card">
          <div className="card-body" style={{ color: 'var(--accent-red)' }}>
            {error || 'Image not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/images" className="btn-icon">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="page-title">
              {image.repoTags?.[0] || formatId(image.id)}
            </h1>
            <span className="code">{formatId(image.id)}</span>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Info
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
        <button
          className={`tab ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          Config
        </button>
      </div>

      {activeTab === 'info' && (
        <div className="card">
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">ID</span>
                <span className="detail-value code">{formatId(image.id)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Size</span>
                <span className="detail-value">{formatSize(image.size)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Created</span>
                <span className="detail-value">{new Date(image.created).toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Architecture</span>
                <span className="detail-value">{image.architecture}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">OS</span>
                <span className="detail-value">{image.os}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Author</span>
                <span className="detail-value">{image.author || '-'}</span>
              </div>
            </div>

            {image.repoTags && image.repoTags.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Tags</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {image.repoTags.map((tag) => (
                    <span key={tag} className="badge badge-info">
                      <Tag size={12} style={{ marginRight: '0.25rem' }} />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="card-body">
            {history.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Created</th>
                    <th>Created By</th>
                    <th>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td className="code">{h.id ? formatId(h.id) : '<missing>'}</td>
                      <td style={{ fontSize: '0.875rem' }}>
                        {new Date(h.created).toLocaleString()}
                      </td>
                      <td
                        className="truncate"
                        style={{ maxWidth: '400px', fontSize: '0.75rem' }}
                        title={h.createdBy}
                      >
                        {h.createdBy}
                      </td>
                      <td>{formatSize(h.size)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>No history available</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="card">
          <div className="card-body">
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Entrypoint</h3>
              <div className="code">
                {image.config.entrypoint?.join(' ') || '-'}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Cmd</h3>
              <div className="code">
                {image.config.cmd?.join(' ') || '-'}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Working Directory</h3>
              <div className="code">{image.config.workingDir || '/'}</div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Environment</h3>
              {image.config.env && image.config.env.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {image.config.env.map((env, i) => (
                    <div key={i} className="code" style={{ fontSize: '0.75rem' }}>
                      {env}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)' }}>-</div>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Exposed Ports</h3>
              {image.config.exposedPorts && Object.keys(image.config.exposedPorts).length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {Object.keys(image.config.exposedPorts).map((port) => (
                    <span key={port} className="badge badge-secondary">
                      {port}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)' }}>-</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
