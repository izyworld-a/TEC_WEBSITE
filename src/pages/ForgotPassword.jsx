import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AuthContextPanel } from '../components/ProductUI';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset link sent! Please check your email.');
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else {
        setError('Failed to send password reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tec-auth-layout">
      <AuthContextPanel
        title="Recover your weekly board"
        subtitle="Reset your password, then return to your goals, proof submissions, and review progress."
      />

      <div className="glass-panel auth-card">
      <h2>Reset TEC Password</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Enter the email address associated with your account, and we'll send you a link to reset your password.
      </p>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>{error}</div>}
      {message && <div style={{ color: '#10b981', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>{message}</div>}

      <form onSubmit={handleReset}>
        <div className="input-group">
          <label>Email Address</label>
          <input 
            type="email" 
            className="input-field" 
            required 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%', marginTop: '1rem' }}
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
        <Link to="/login" style={{ color: 'var(--text-secondary)' }}>
          Back to <span style={{ color: 'var(--primary)', fontWeight: '500' }}>Login</span>
        </Link>
      </div>
      </div>
    </div>
  );
}
