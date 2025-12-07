import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--gradient-primary)',
      padding: '24px'
    }}>
      {/* Login Card */}
      <div style={{
        background: 'white',
        borderRadius: 'var(--radius-2xl)',
        padding: '48px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: 'var(--shadow-xl)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '8px',
            letterSpacing: '-0.02em'
          }}>
            Chronosift
          </h1>
          <p style={{
            fontSize: '1rem',
            color: 'var(--gray-600)',
            margin: 0
          }}>
            Forensic Timeline Analysis Platform
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            padding: '16px',
            marginBottom: '24px',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid var(--error)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--error)',
            fontSize: '0.9375rem',
            fontWeight: 500
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--gray-900)'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '1rem',
                border: '1px solid var(--gray-300)',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-fast)',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-blue)';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--gray-300)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--gray-900)'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '1rem',
                border: '1px solid var(--gray-300)',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-fast)',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-blue)';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--gray-300)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading ? 'var(--gray-300)' : 'var(--accent-pink)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'var(--transition-base)',
              boxShadow: loading ? 'none' : 'var(--shadow-md)'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                e.currentTarget.style.background = 'var(--primary-magenta)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.background = 'var(--accent-pink)';
              }
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Register Link */}
        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid var(--gray-200)',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '0.9375rem',
            color: 'var(--gray-600)',
            margin: 0
          }}>
            Don't have an account?{' '}
            <Link
              to="/register"
              style={{
                color: 'var(--accent-blue)',
                textDecoration: 'none',
                fontWeight: 600,
                transition: 'var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-light-blue)';
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--accent-blue)';
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
