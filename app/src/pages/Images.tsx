import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Trash2,
  RefreshCw,
  Search,
  Layers,
  X,
  CheckCircle,
} from 'lucide-react';
import { imageApi, getApiBaseUrl } from '../services/api';
import type { ImageSummary } from '../types';

export default function ImagesPage() {
  const [images, setImages] = useState<ImageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPullModal, setShowPullModal] = useState(false);
  const [searchModal, setSearchModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await imageApi.list();
      setImages(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleRemove = async (id: string, imageName: string) => {
    if (!confirm(`Are you sure you want to remove "${imageName}"?\n\nNote: If this image is used by any container, you must stop and remove the container first.`)) return;
    try {
      setDeleting(id);
      setError(null);
      await imageApi.remove(id, true, true);
      await loadImages();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove image';
      setError(`Failed to remove "${imageName}": ${errorMessage}`);
    } finally {
      setDeleting(null);
    }
  };

  const handlePrune = async () => {
    if (!confirm('Remove all dangling images?')) return;
    try {
      await imageApi.prune();
      await loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prune images');
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

  const getImageName = (image: ImageSummary) => {
    if (image.repoTags && image.repoTags.length > 0 && image.repoTags[0] !== '<none>:<none>') {
      return image.repoTags[0];
    }
    return formatId(image.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-text-primary">Images</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-bg-secondary text-text-primary hover:bg-bg-tertiary transition-colors"
            onClick={loadImages}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button 
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-bg-secondary text-text-primary hover:bg-bg-tertiary transition-colors"
            onClick={() => setSearchModal(true)}
          >
            <Search size={16} />
            Search
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
            onClick={() => setShowPullModal(true)}
          >
            <Download size={16} />
            Pull
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
            Loading images...
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Layers size={48} className="mb-4 opacity-50" />
            <p className="text-lg">No images found</p>
            <p className="text-sm mt-1">Pull an image to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bg-tertiary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Repository / Tag</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
              {images.map((image) => (
                <tr key={image.id} className="hover:bg-bg-tertiary/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/images/${encodeURIComponent(image.id)}`} className="font-medium text-accent-blue hover:underline">
                      {getImageName(image)}
                    </Link>
                    {image.repoTags && image.repoTags.length > 1 && (
                      <div className="text-xs text-text-secondary mt-1">
                        +{image.repoTags.length - 1} more tags
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-text-secondary bg-bg-tertiary px-1.5 py-0.5 rounded">{formatId(image.id)}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary">{formatSize(image.size)}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {new Date(image.created).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="p-1.5 rounded-lg hover:bg-accent-red/20 text-text-secondary hover:text-accent-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleRemove(image.id, getImageName(image))}
                      title="Remove"
                      disabled={deleting !== null}
                    >
                      {deleting === image.id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPullModal && (
        <PullImageModal
          onClose={() => setShowPullModal(false)}
          onPulled={() => {
            setShowPullModal(false);
            loadImages();
          }}
        />
      )}

      {searchModal && (
        <SearchImageModal 
          onClose={() => setSearchModal(false)} 
          onPull={() => {
            setSearchModal(false);
            loadImages();
          }}
        />
      )}
    </div>
  );
}

function PullImageModal({
  onClose,
  onPulled,
}: {
  onClose: () => void;
  onPulled: () => void;
}) {
  const [image, setImage] = useState('');
  const [tag, setTag] = useState('latest');
  const [platform, setPlatform] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) {
      setError('Image name is required');
      return;
    }

    setLoading(true);
    setError(null);
    setLogs([]);
    setCompleted(false);

    // Build the SSE URL
    const baseUrl = getApiBaseUrl();
    const params = new URLSearchParams({
      image: image,
      tag: tag || 'latest',
    });
    if (platform) {
      params.set('platform', platform);
    }

    const sseUrl = `${baseUrl}/images/pull/stream?${params.toString()}`;
    console.log('[Pull] Connecting to SSE:', sseUrl);

    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          setError(data.error);
          setLoading(false);
          eventSource.close();
          return;
        }

        if (data.status === 'complete') {
          setCompleted(true);
          setLoading(false);
          setLogs(prev => [...prev, `✓ ${data.message}`]);
          eventSource.close();
          // Auto close after 1.5 seconds on success
          setTimeout(() => {
            onPulled();
          }, 1500);
          return;
        }

        // Format the log line
        let logLine = '';
        if (data.id) {
          logLine = `${data.id}: ${data.status}`;
          if (data.progress) {
            logLine += ` ${data.progress}`;
          }
        } else {
          logLine = data.status;
        }

        // Update or append log line
        setLogs(prev => {
          // If this is a progress update for an existing layer, update it
          if (data.id) {
            const existingIndex = prev.findIndex(l => l.startsWith(`${data.id}:`));
            if (existingIndex !== -1) {
              const newLogs = [...prev];
              newLogs[existingIndex] = logLine;
              return newLogs;
            }
          }
          return [...prev, logLine];
        });

      } catch (err) {
        console.error('[Pull] Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        // Normal close
        if (!completed && !error) {
          setLoading(false);
        }
      } else {
        setError('Connection lost. Please try again.');
        setLoading(false);
      }
      eventSource.close();
    };
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={loading ? undefined : onClose}>
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Pull Image</h2>
          {!loading && (
            <button className="p-1 rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm">{error}</div>
            )}

            {completed && (
              <div className="p-3 rounded-lg bg-accent-green/10 border border-accent-green/30 text-accent-green text-sm flex items-center gap-2">
                <CheckCircle size={16} />
                Image pulled successfully!
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Image *</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="nginx"
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Tag</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="latest"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Platform</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  placeholder="linux/amd64"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Pull logs area */}
            {logs.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-text-primary mb-1.5">Pull Progress</label>
                <div
                  ref={logsRef}
                  className="bg-bg-primary border border-border rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs text-text-secondary"
                >
                  {logs.map((log, index) => (
                    <div key={index} className={log.startsWith('✓') ? 'text-accent-green' : ''}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-bg-tertiary/50 mt-auto">
            <button 
              type="button" 
              className="px-4 py-2 text-sm font-medium text-text-primary bg-bg-tertiary border border-border rounded-lg hover:bg-border transition-colors disabled:opacity-50"
              onClick={onClose} 
              disabled={loading}
            >
              {completed ? 'Close' : 'Cancel'}
            </button>
            {!completed && (
              <button 
                type="submit" 
                className="px-4 py-2 text-sm font-medium text-white bg-accent-green rounded-lg hover:bg-accent-green/80 transition-colors disabled:opacity-50 flex items-center gap-2"
                disabled={loading}
              >
                {loading && <RefreshCw size={14} className="animate-spin" />}
                {loading ? 'Pulling...' : 'Pull'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function SearchImageModal({ onClose, onPull }: { onClose: () => void; onPull: () => void }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Array<{
    name: string;
    description: string;
    starCount: number;
    isOfficial: boolean;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullLogs, setPullLogs] = useState<string[]>([]);
  const [pullCompleted, setPullCompleted] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [pullLogs]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term) return;

    try {
      setLoading(true);
      setPullError(null);
      const data = await imageApi.search(term);
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePull = (imageName: string) => {
    setPulling(imageName);
    setPullError(null);
    setPullLogs([]);
    setPullCompleted(false);

    const baseUrl = getApiBaseUrl();
    const params = new URLSearchParams({
      image: imageName,
      tag: 'latest',
    });

    const sseUrl = `${baseUrl}/images/pull/stream?${params.toString()}`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          setPullError(data.error);
          setPulling(null);
          eventSource.close();
          return;
        }

        if (data.status === 'complete') {
          setPullCompleted(true);
          setPullLogs(prev => [...prev, `✓ ${data.message}`]);
          eventSource.close();
          setTimeout(() => {
            onPull();
          }, 1500);
          return;
        }

        // Format the log line
        let logLine = '';
        if (data.id) {
          logLine = `${data.id}: ${data.status}`;
          if (data.progress) {
            logLine += ` ${data.progress}`;
          }
        } else {
          logLine = data.status;
        }

        // Update or append log line
        setPullLogs(prev => {
          if (data.id) {
            const existingIndex = prev.findIndex(l => l.startsWith(`${data.id}:`));
            if (existingIndex !== -1) {
              const newLogs = [...prev];
              newLogs[existingIndex] = logLine;
              return newLogs;
            }
          }
          return [...prev, logLine];
        });

      } catch (err) {
        console.error('[Pull] Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      if (!pullCompleted && !pullError) {
        setPullError('Connection lost. Please try again.');
      }
      setPulling(null);
      eventSource.close();
    };
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={pulling ? undefined : onClose}>
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">
            {pulling ? `Pulling ${pulling}` : 'Search Images'}
          </h2>
          {!pulling && (
            <button className="p-1 rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>
        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          {/* Search form - hidden when pulling */}
          {!pulling && (
            <form onSubmit={handleSearch} className="mb-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Search Docker Hub..."
                />
                <button 
                  type="submit" 
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent-blue rounded-lg hover:bg-accent-blue/80 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  <Search size={16} />
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>
          )}

          {pullError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {pullError}
            </div>
          )}

          {pullCompleted && (
            <div className="mb-4 p-3 bg-accent-green/10 border border-accent-green/30 rounded-lg text-accent-green text-sm flex items-center gap-2">
              <CheckCircle size={16} />
              Image pulled successfully!
            </div>
          )}

          {/* Pull logs */}
          {pulling && pullLogs.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <label className="block text-sm font-medium text-text-primary mb-1.5">Pull Progress</label>
              <div
                ref={logsRef}
                className="flex-1 bg-bg-primary border border-border rounded-lg p-3 overflow-y-auto font-mono text-xs text-text-secondary"
              >
                {pullLogs.map((log, index) => (
                  <div key={index} className={log.startsWith('✓') ? 'text-accent-green' : ''}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search results - hidden when pulling */}
          {!pulling && results.length > 0 && (
            <div className="flex-1 overflow-y-auto -mx-6 px-6">
              <div className="space-y-1">
                {results.map((result) => (
                  <div
                    key={result.name}
                    className="p-3 rounded-lg hover:bg-bg-tertiary/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">{result.name}</span>
                      {result.isOfficial && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-blue/20 text-accent-blue">Official</span>
                      )}
                      <span className="text-sm text-accent-yellow flex items-center gap-1">
                        ⭐ {result.starCount.toLocaleString()}
                      </span>
                      <button
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-green/20 text-accent-green hover:bg-accent-green/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handlePull(result.name)}
                        disabled={pulling !== null}
                      >
                        <Download size={14} />
                        Pull
                      </button>
                    </div>
                    <div className="text-sm text-text-secondary mt-1 line-clamp-2">
                      {result.description || 'No description'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
