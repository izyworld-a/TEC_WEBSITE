import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, signOut, sendEmailVerification } from 'firebase/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (!userCredential.user.emailVerified) {
        // Automatically resend verification email in case they missed it or signed up before the feature was added
        try {
          await sendEmailVerification(userCredential.user);
        } catch (e) {
          console.error("Error resending verification email:", e);
        }
        await signOut(auth);
        throw new Error("Please verify your email address before logging in. A new verification link has just been sent to your inbox. Please also check your spam/junk folder.");
      }
      
      // App.jsx routing logic handles redirect based on user role/status
      navigate('/dashboard'); 
    } catch (err) {
      setError(err.message.includes("Please verify your email") 
        ? err.message 
        : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel auth-card">
      <h2>Welcome Back</h2>
      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>{error}</div>}
      
      <form onSubmit={handleLogin}>
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
        
        <div className="input-group">
          <label style={{ margin: 0 }}>Password</label>
          <div style={{ position: 'relative', marginTop: '0.5rem' }}>
            <input 
              type={showPassword ? "text" : "password"}
              className="input-field" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', paddingRight: '2.5rem' }}
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Link to="/forgot-password" style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: '500' }}>Forgot Password?</Link>
          </div>
        </div>
        
        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%', marginTop: '1.5rem' }}
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Sign In'}
        </button>
      </form>
      
      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
        <Link to="/register" style={{ color: 'var(--text-secondary)' }}>
          Don't have an account? <span style={{ color: 'var(--primary)', fontWeight: '500' }}>Sign up</span>
        </Link>
      </div>
    </div>
  );
}
