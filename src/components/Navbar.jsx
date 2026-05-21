import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { FiSun, FiMoon, FiLogOut, FiUser, FiSearch, FiBell, FiClock, FiMenu, FiX } from 'react-icons/fi';
import { getWeekId } from '../utils/weekUtils';

export default function Navbar({ user, userData }) {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [weekSettings, setWeekSettings] = useState(null);
  const [timeLeft, setTimeLeft] = useState({ setup: null, completion: null });
  const [announcements, setAnnouncements] = useState([]);
  const notifRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const weekId = getWeekId(new Date());

    const unsubscribeSettings = onSnapshot(doc(db, 'week_settings', weekId), (snap) => {
      if (snap.exists()) setWeekSettings(snap.data());
    });

    // Listen to active announcements
    const unsubAnnouncements = onSnapshot(
      query(collection(db, 'announcements'), orderBy('createdAt', 'desc')),
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.active === true);
        setAnnouncements(docs);
      }
    );

    return () => { unsubscribeSettings(); unsubAnnouncements(); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const setup = weekSettings?.setupDeadline ? new Date(weekSettings.setupDeadline) : null;
      const completion = weekSettings?.completionDeadline ? new Date(weekSettings.completionDeadline) : null;

      const calculateTimeLeft = (targetDate, now) => {
        const diff = targetDate - now;
        if (diff <= 0) return 'EXPIRED';
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        return `${d > 0 ? d+'d ' : ''}${h}h ${m}m ${s}s`;
      };

      setTimeLeft({
        setup: setup ? calculateTimeLeft(setup, now) : null,
        completion: completion ? calculateTimeLeft(completion, now) : null
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [weekSettings]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Error logging out", error);
    }
  };

  return (
    <header style={{ 
      position: 'sticky', 
      top: 0, 
      zIndex: 1000, 
      paddingTop: '1rem',
      paddingBottom: '0.5rem',
      backgroundColor: 'var(--bg-main)', // Solid background so scrolling content doesn't show behind margins
      transition: 'background-color 0.3s ease'
    }}>
    <nav className="navbar glass-panel" style={{ 
      margin: '0 1rem', 
      borderRadius: '16px', 
      padding: '0.75rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ flexShrink: 0 }}>
        <Link to="/" className="nav-brand" style={{ fontSize: '1.5rem', fontWeight: '800', textDecoration: 'none' }}>TEC Weekly</Link>
      </div>
        
      {/* Desktop Centered Nav Links */}
      {isHome && (
        <div className="home-nav-links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#contact">Contact</a>
        </div>
      )}
      
      <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
        <div ref={notifRef} style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setShowNotifications(!showNotifications)}>
          <FiBell size={20} />
          {(timeLeft.setup !== 'EXPIRED' || timeLeft.completion !== 'EXPIRED') && (timeLeft.setup || timeLeft.completion) && (
            <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%', border: '2px solid var(--bg-main)' }}></span>
          )}

          {showNotifications && (
            <div className="glass-panel notification-dropdown" style={{ 
              position: 'absolute', 
              top: '100%', 
              right: '-10px', 
              marginTop: '1rem', 
              width: '320px',
              padding: '1.5rem', 
              zIndex: 1001,
              backgroundColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              boxShadow: '0 15px 50px rgba(0,0,0,0.3)',
              cursor: 'default',
              overflowY: 'auto',
              maxHeight: '80vh'
            }} onClick={(e) => e.stopPropagation()}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 'bold' }}>Active Deadlines</h4>
              
              {!timeLeft.setup && !timeLeft.completion ? (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>No active deadlines for this week.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {timeLeft.setup && (
                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>
                        <FiClock size={16} />
                        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Goal Setting</span>
                      </div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'monospace', color: timeLeft.setup === 'EXPIRED' ? '#f43f5e' : 'white' }}>{timeLeft.setup}</div>
                    </div>
                  )}
                  {timeLeft.completion && (
                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--secondary)' }}>
                        <FiClock size={16} />
                        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weekly Completion</span>
                      </div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'monospace', color: timeLeft.completion === 'EXPIRED' ? '#f43f5e' : 'white' }}>{timeLeft.completion}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Theme" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
        </button>

        {user ? (
          <div className="desktop-only" style={{ gap: '0.75rem', alignItems: 'center' }}>
            {!isHome && userData?.isAdmin && (
              <Link to="/admin" className="btn btn-secondary">Admin</Link>
            )}
            {!isHome && (userData?.isModerator || userData?.isAdmin) && (
              <Link to="/moderator" className="btn btn-secondary" style={{ background: 'rgba(168,85,247,0.15)', borderColor: '#a855f7', color: '#a855f7' }}>👤 Moderator</Link>
            )}
            {!isHome && userData?.status !== 'Pending' && (
              <Link to="/dashboard" className="btn btn-secondary">Dashboard</Link>
            )}
            
            {/* Profile-integrated Logout Button */}
            <button 
              onClick={handleLogout} 
              className="btn btn-primary" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem', 
                padding: '0.5rem 1rem',
                borderRadius: '12px'
              }}
            >
              {userData?.profilePicUrl ? (
                <img src={userData.profilePicUrl} alt="User" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                  {userData?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <span>Logout</span>
              <FiLogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="desktop-only" style={{ gap: '0.75rem' }}>
            <Link to="/login" className="btn btn-secondary">Login</Link>
            <Link to="/register" className="btn btn-primary">Sign Up</Link>
          </div>
        )}
        
        {/* Mobile Menu Toggle */}
        <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="mobile-nav-dropdown glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          {isHome && (
            <>
              <a href="#home" onClick={() => setIsMobileMenuOpen(false)}>Home</a>
              <a href="#features" onClick={() => setIsMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)}>How It Works</a>
              <a href="#contact" onClick={() => setIsMobileMenuOpen(false)}>Contact</a>
            </>
          )}
          {user ? (
            <>
              {userData?.isAdmin && <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}>Admin</Link>}
              {(userData?.isModerator || userData?.isAdmin) && <Link to="/moderator" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: '#a855f7', fontWeight: 'bold' }}>👤 Moderator</Link>}
              {userData?.status !== 'Pending' && <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}>Dashboard</Link>}
              <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiLogOut size={18} /> Logout
              </button>
            </>
          ) : (
            <>
              {!isHome && <Link to="/" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}>Home</Link>}
              <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}>Login</Link>
              <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: 'var(--primary)', fontWeight: 'bold' }}>Sign Up</Link>
            </>
          )}
        </div>
      )}
    </nav>

    {/* ── Announcement Marquee Ticker ── */}
    {location.pathname.toLowerCase().includes('/livefeed') && announcements.length > 0 && (
      <div style={{
        margin: '1rem 1rem 0 1rem',
        borderRadius: '10px',
        overflow: 'hidden',
        background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #6366f1)',
        backgroundSize: '200% 100%',
        animation: 'gradientShift 4s linear infinite',
        padding: '0.5rem 0',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(99,102,241,0.3)'
      }}>
        {/* Label Badge */}
        <div style={{ flexShrink: 0, padding: '0 1rem 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ background: 'rgba(255,255,255,0.25)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>📢 Announcements</span>
        </div>
        {/* Marquee */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div className="marquee-track">
            {[...announcements, ...announcements].map((a, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', color: 'white', fontWeight: '600', fontSize: '0.875rem', whiteSpace: 'nowrap', padding: '0 3rem' }}>
                {a.type && <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '10px', padding: '1px 8px', fontSize: '0.7rem', marginRight: '0.5rem' }}>{a.type}</span>}
                {a.moderator && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '2px 8px 2px 2px', borderRadius: '20px' }}>
                    {a.moderator.profilePicUrl ? (
                      <img src={a.moderator.profilePicUrl} alt={a.moderator.name} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 'bold' }}>
                        {a.moderator.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>{a.moderator.name}</span>
                  </span>
                )}
                {a.message}
              </span>
            ))}
          </div>
        </div>
      </div>
    )}
    </header>
  );
}
