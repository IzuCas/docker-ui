import { useState, useEffect } from 'react';
import { Key, Globe, Server, Eye, EyeOff, LogIn, LogOut, Save, RefreshCw } from 'lucide-react';
import { registryApi, settingsApi } from '../services/api';

interface RegistryInfo {
  serverAddress: string;
  username: string;
  isLoggedIn: boolean;
}

interface ProxyConfig {
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
  ftpProxy?: string;
}

export default function SettingsPage() {
  const [registries, setRegistries] = useState<RegistryInfo[]>([]);
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>({
    httpProxy: '',
    httpsProxy: '',
    noProxy: '',
    ftpProxy: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
    serverAddress: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const settings = await settingsApi.get();
      setRegistries(settings.registries);
      setProxyConfig({
        httpProxy: settings.proxy.httpProxy || '',
        httpsProxy: settings.proxy.httpsProxy || '',
        noProxy: settings.proxy.noProxy || '',
        ftpProxy: settings.proxy.ftpProxy || '',
      });
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await registryApi.login({
        username: loginForm.username,
        password: loginForm.password,
        serverAddress: loginForm.serverAddress || undefined,
      });
      setSuccess('Successfully logged in to registry');
      setShowLoginModal(false);
      setLoginForm({ username: '', password: '', serverAddress: '' });
      loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout(serverAddress: string) {
    try {
      await registryApi.logout(serverAddress);
      setSuccess('Successfully logged out from registry');
      loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
    }
  }

  async function handleSaveProxy(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await settingsApi.setProxy({
        httpProxy: proxyConfig.httpProxy || undefined,
        httpsProxy: proxyConfig.httpsProxy || undefined,
        noProxy: proxyConfig.noProxy || undefined,
        ftpProxy: proxyConfig.ftpProxy || undefined,
      });
      setSuccess('Proxy configuration saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save proxy configuration');
    } finally {
      setSaving(false);
    }
  }

  // Auto-dismiss messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <button onClick={loadSettings} className="btn">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-accent-red/10 border border-accent-red/30 text-accent-red px-4 py-3 rounded-lg flex items-center gap-2">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}
      {success && (
        <div className="bg-accent-green/10 border border-accent-green/30 text-accent-green px-4 py-3 rounded-lg flex items-center gap-2">
          <span className="font-medium">Success:</span> {success}
        </div>
      )}

      {/* Registry Authentication */}
      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-border bg-bg-tertiary">
          <div className="flex items-center gap-3">
            <Key size={20} className="text-accent-blue" />
            <h2 className="text-lg font-semibold">Registry Authentication</h2>
          </div>
          <button onClick={() => setShowLoginModal(true)} className="btn btn-primary">
            <LogIn size={16} />
            Login to Registry
          </button>
        </div>
        <div className="card-body">
          {registries.length === 0 ? (
            <p className="text-text-secondary text-center py-8">
              No registries configured. Click "Login to Registry" to add one.
            </p>
          ) : (
            <div className="space-y-3">
              {registries.map((registry) => (
                <div
                  key={registry.serverAddress}
                  className="flex items-center justify-between p-4 bg-bg-tertiary rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Server size={20} className="text-text-secondary" />
                    <div>
                      <div className="font-medium">{registry.serverAddress}</div>
                      {registry.isLoggedIn && (
                        <div className="text-sm text-text-secondary">
                          Logged in as <span className="text-accent-blue">{registry.username}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {registry.isLoggedIn ? (
                      <>
                        <span className="badge badge-success">Connected</span>
                        <button
                          onClick={() => handleLogout(registry.serverAddress)}
                          className="btn btn-danger btn-sm"
                        >
                          <LogOut size={14} />
                          Logout
                        </button>
                      </>
                    ) : (
                      <span className="badge badge-secondary">Not connected</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Proxy Configuration */}
      <div className="card">
        <div className="flex items-center gap-3 p-4 border-b border-border bg-bg-tertiary">
          <Globe size={20} className="text-accent-purple" />
          <h2 className="text-lg font-semibold">Proxy Configuration</h2>
        </div>
        <form onSubmit={handleSaveProxy} className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">HTTP Proxy</label>
              <input
                type="text"
                className="form-input"
                placeholder="http://proxy.example.com:8080"
                value={proxyConfig.httpProxy}
                onChange={(e) => setProxyConfig({ ...proxyConfig, httpProxy: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">HTTPS Proxy</label>
              <input
                type="text"
                className="form-input"
                placeholder="https://proxy.example.com:8443"
                value={proxyConfig.httpsProxy}
                onChange={(e) => setProxyConfig({ ...proxyConfig, httpsProxy: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">FTP Proxy</label>
              <input
                type="text"
                className="form-input"
                placeholder="ftp://proxy.example.com:21"
                value={proxyConfig.ftpProxy}
                onChange={(e) => setProxyConfig({ ...proxyConfig, ftpProxy: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">No Proxy</label>
              <input
                type="text"
                className="form-input"
                placeholder="localhost,127.0.0.1,.example.com"
                value={proxyConfig.noProxy}
                onChange={(e) => setProxyConfig({ ...proxyConfig, noProxy: e.target.value })}
              />
              <p className="text-xs text-text-secondary mt-1">
                Comma-separated list of hosts to bypass proxy
              </p>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Proxy Configuration'}
            </button>
          </div>
        </form>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-semibold">Login to Registry</h3>
              <button onClick={() => setShowLoginModal(false)} className="btn-icon text-text-secondary hover:text-text-primary">
                ×
              </button>
            </div>
            <form onSubmit={handleLogin} className="modal-body">
              <div className="form-group">
                <label className="form-label">Registry Server</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="docker.io (leave empty for Docker Hub)"
                  value={loginForm.serverAddress}
                  onChange={(e) => setLoginForm({ ...loginForm, serverAddress: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter username"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input pr-10"
                    placeholder="Enter password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </form>
            <div className="modal-footer">
              <button type="button" onClick={() => setShowLoginModal(false)} className="btn">
                Cancel
              </button>
              <button onClick={handleLogin} className="btn btn-primary" disabled={saving}>
                <LogIn size={16} />
                {saving ? 'Logging in...' : 'Login'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
