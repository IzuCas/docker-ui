import { useState, useEffect, useRef } from 'react';
import { X, Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  purpose: string;
  onConfirm: (username: string, password: string) => void;
  onCancel: () => void;
}

export default function CredentialConfirmModal({ purpose, onConfirm, onCancel }: Props) {
  const { username: currentUser } = useAuth();
  const [username, setUsername] = useState(currentUser || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Username and password are required');
      triggerShake();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authApi.verify(username, password);
      onConfirm(username, password);
    } catch {
      setError('Invalid credentials. Please try again.');
      setPassword('');
      triggerShake();
      passwordRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 120ms ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes shake {
          0%, 100% { transform: translateX(0) }
          20% { transform: translateX(-6px) }
          40% { transform: translateX(6px) }
          60% { transform: translateX(-4px) }
          80% { transform: translateX(4px) }
        }
        .modal-card { animation: slideUp 150ms cubic-bezier(0.16,1,0.3,1) forwards; }
        .modal-card.shake { animation: shake 450ms ease; }
        .modal-input { 
          width: 100%; 
          background: #0d1117; 
          border: 1px solid #30363d; 
          border-radius: 6px; 
          color: #c9d1d9; 
          font-size: 0.875rem; 
          padding: 0.5rem 0.75rem;
          outline: none;
          transition: border-color 150ms;
          box-sizing: border-box;
        }
        .modal-input:focus { border-color: #58a6ff; box-shadow: 0 0 0 3px rgba(88,166,255,0.15); }
        .modal-input-wrap { position: relative; }
        .modal-input-wrap .toggle-pw {
          position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #8b949e; padding: 4px;
          display: flex; align-items: center;
          border-radius: 4px;
        }
        .modal-input-wrap .toggle-pw:hover { color: #c9d1d9; }
      `}</style>

      <div
        className={`modal-card${shake ? ' shake' : ''}`}
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Header stripe */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(88,166,255,0.08) 0%, rgba(163,113,247,0.06) 100%)',
          borderBottom: '1px solid #30363d',
          padding: '1.25rem 1.25rem 1rem',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36, height: 36,
              borderRadius: '8px',
              background: 'rgba(88,166,255,0.15)',
              border: '1px solid rgba(88,166,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Lock size={16} color="#58a6ff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#c9d1d9' }}>
                Confirm Identity
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#8b949e' }}>
                Authentication required
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8b949e', padding: '4px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', flexShrink: 0,
              transition: 'color 150ms, background 150ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#21262d'; (e.currentTarget as HTMLButtonElement).style.color = '#c9d1d9'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#8b949e'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Purpose banner */}
        <div style={{
          margin: '1rem 1.25rem 0',
          padding: '0.625rem 0.75rem',
          background: 'rgba(88,166,255,0.06)',
          border: '1px solid rgba(88,166,255,0.15)',
          borderRadius: '6px',
          fontSize: '0.8125rem',
          color: '#8b949e',
          lineHeight: 1.5,
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-start',
        }}>
          <ShieldCheck size={14} style={{ color: '#58a6ff', flexShrink: 0, marginTop: 1 }} />
          {purpose}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1rem 1.25rem 1.25rem' }}>
          <div style={{ marginBottom: '0.875rem' }}>
            <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#8b949e' }}>
              Username
            </label>
            <input
              type="text"
              className="modal-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              spellCheck={false}
            />
          </div>

          <div style={{ marginBottom: error ? '0.75rem' : '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: '#8b949e' }}>
              Password
            </label>
            <div className="modal-input-wrap">
              <input
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                className="modal-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight: '2.25rem' }}
              />
              <button
                type="button"
                className="toggle-pw"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#f85149',
              fontSize: '0.8125rem',
              marginBottom: '1rem',
              padding: '0.5rem 0.625rem',
              background: 'rgba(248,81,73,0.1)',
              border: '1px solid rgba(248,81,73,0.25)',
              borderRadius: '6px',
            }}>
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn"
              onClick={onCancel}
              disabled={loading}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !username || !password}
              style={{ flex: 1, justifyContent: 'center', gap: '0.375rem' }}
            >
              {loading
                ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Verifying…</>
                : <><ShieldCheck size={14} /> Confirm</>
              }
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

