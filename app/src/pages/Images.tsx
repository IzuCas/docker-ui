import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Trash2,
  RefreshCw,
  Search,
  Layers,
  X,
} from 'lucide-react';
import { imageApi } from '../services/api';
import type { ImageSummary, ImagePullOptions } from '../types';

export default function ImagesPage() {
  const [images, setImages] = useState<ImageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPullModal, setShowPullModal] = useState(false);
  const [searchModal, setSearchModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleRemove = async (id: string) => {
    if (!confirm('Are you sure you want to remove this image?')) return;
    try {
      await imageApi.remove(id, true, true);
      await loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove image');
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
                      className="p-1.5 rounded-lg hover:bg-accent-red/20 text-text-secondary hover:text-accent-red transition-colors"
                      onClick={() => handleRemove(image.id)}
                      title="Remove"
                    >
                      <Trash2 size={14} />
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
        <SearchImageModal onClose={() => setSearchModal(false)} />
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) {
      setError('Image name is required');
      return;
    }

    try {
      setLoading(true);
      const options: ImagePullOptions = { image, tag };
      if (platform) options.platform = platform;
      await imageApi.pull(options);
      onPulled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull image');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Pull Image</h2>
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
              <label className="block text-sm font-medium text-text-primary mb-1.5">Image *</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="nginx"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Tag</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="latest"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Platform (optional)</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-all"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="linux/amd64"
              />
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
              {loading ? 'Pulling...' : 'Pull'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SearchImageModal({ onClose }: { onClose: () => void }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Array<{
    name: string;
    description: string;
    starCount: number;
    isOfficial: boolean;
  }>>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term) return;

    try {
      setLoading(true);
      const data = await imageApi.search(term);
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Search Images</h2>
          <button className="p-1 rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-hidden flex flex-col">
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

          {results.length > 0 && (
            <div className="flex-1 overflow-y-auto -mx-6 px-6">
              <div className="space-y-1">
                {results.map((result) => (
                  <div
                    key={result.name}
                    className="p-3 rounded-lg hover:bg-bg-tertiary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">{result.name}</span>
                      {result.isOfficial && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-blue/20 text-accent-blue">Official</span>
                      )}
                      <span className="ml-auto text-sm text-accent-yellow flex items-center gap-1">
                        ⭐ {result.starCount.toLocaleString()}
                      </span>
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
