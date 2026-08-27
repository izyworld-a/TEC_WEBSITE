import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { FiSun, FiMoon, FiLogOut, FiBell, FiClock, FiMenu, FiX, FiDownload } from 'react-icons/fi';
import { getWeekId } from '../utils/weekUtils';
import { CircleStatusChip, WeekIdentityChip } from './ProductUI';

export default function Navbar({ user, userData }) {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [weekSettings, setWeekSettings] = useState(null);
  const [timeLeft, setTimeLeft] = useState({ setup: null, completion: null });
  const [announcements, setAnnouncements] = useState([]);
  const notifRef = useRef(null);
  const currentWeekId = getWeekId(new Date());

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
    }
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
  };

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
      const setup = weekSettings?.setupDeadline ? new Date(String(weekSettings.setupDeadline).replace(' ', 'T')) : null;
      const completion = weekSettings?.completionDeadline ? new Date(String(weekSettings.completionDeadline).replace(' ', 'T')) : null;

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
    <header className="tec-app-header" style={{
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      paddingTop: '0',
      paddingBottom: '0',
      backgroundColor: 'var(--bg-main)',
      transition: 'background-color 0.3s ease'
    }}>
      <nav className="navbar tec-navbar" style={{
        margin: '0',
        borderRadius: '0',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative'
      }}>
        {/* Brand Logo & Name */}
        <div style={{ flexShrink: 0 }}>
          <Link
            to={user && !isHome ? "/dashboard" : "/"}
            className="nav-brand"
            style={{ fontSize: '1.5rem', fontWeight: '800', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
          >
            <img src="/icons/icon-57x57.png" alt="TEC Logo" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }} />
            TEC Weekly
          </Link>
        </div>

        <div className="tec-nav-meta desktop-only">
          <CircleStatusChip>{isHome ? 'The Execution Circle' : 'Member Board'}</CircleStatusChip>
          {!isHome && <WeekIdentityChip weekId={currentWeekId} mode="app" />}
        </div>

        {/* ── LANDING PAGE NAVIGATION (isHome === true) ── */}
        {isHome ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* Desktop Nav Links */}
            <div className="home-nav-links">
              <a href="#overview">Overview</a>
              <a href="#system">Workflow</a>
              <a href="#features">Features</a>
              <a href="#contact">Contact</a>
            </div>

            {/* Theme Toggle Icon (remains on landing page navbar) */}
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Theme">
              {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              className="mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        ) : (
          /* ── DASHBOARD & APP NAVIGATION (isHome === false) ── */
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>

            {/* Notification Bell (Inside Dashboard / App only) */}
            {user && (
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
                    backgroundColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
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
                            <div style={{ fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'monospace', color: timeLeft.setup === 'EXPIRED' ? '#f43f5e' : 'var(--text-main)' }}>{timeLeft.setup}</div>
                          </div>
                        )}
                        {timeLeft.completion && (
                          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--secondary)' }}>
                              <FiClock size={16} />
                              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weekly Completion</span>
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'monospace', color: timeLeft.completion === 'EXPIRED' ? '#f43f5e' : 'var(--text-main)' }}>{timeLeft.completion}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Theme Toggle Icon */}
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Theme">
              {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
            </button>

            {/* PWA Install Button - Desktop */}
            {installPrompt && !isInstalled && (
              <button
                onClick={handleInstall}
                className="desktop-only"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  border: 'none',
                  color: 'white',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(99,102,241,0.6)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(99,102,241,0.4)'; }}
              >
                <FiDownload size={14} />
                Install App
              </button>
            )}

            {/* Authenticated Links & Sign Out Button inside Dashboard */}
            {user ? (
              <div className="desktop-only" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {userData?.isAdmin && (
                  <Link to="/admin" className="btn btn-secondary">Admin</Link>
                )}
                {(userData?.isModerator || userData?.isAdmin) && (
                  <Link to="/moderator" className="btn btn-secondary" style={{ background: 'rgba(168,85,247,0.15)', borderColor: '#a855f7', color: '#a855f7' }}>Moderator</Link>
                )}
                {location.pathname !== '/dashboard' && userData?.status !== 'Pending' && (
                  <Link to="/dashboard" className="btn btn-secondary">Dashboard</Link>
                )}
                {location.pathname !== '/livefeed' && (
                  <Link to="/livefeed" className="btn btn-secondary">Live Feed</Link>
                )}

                {/* Profile-integrated Logout / Sign Out Button */}
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
                  title="Sign Out"
                >
                  {userData?.profilePicUrl ? (
                    <img src={userData.profilePicUrl} alt="User" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                      {userData?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <span>Sign Out</span>
                  <FiLogOut size={16} />
                </button>
              </div>
            ) : (
              /* Non-authenticated Auth Route Buttons (e.g. /login, /register) */
              <div className="desktop-only" style={{ display: 'flex', gap: '0.75rem' }}>
                <Link to="/" className="btn btn-secondary">Home</Link>
                {location.pathname !== '/login' && <Link to="/login" className="btn btn-secondary">Login</Link>}
                {location.pathname !== '/register' && <Link to="/register" className="btn btn-primary">Sign Up</Link>}
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle Menu">
              {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        )}

        {/* ── Mobile Menu Dropdown ── */}
        {isMobileMenuOpen && (
          <div className="mobile-nav-dropdown glass-panel">
            {isHome ? (
              <>
                <a href="#overview" onClick={() => setIsMobileMenuOpen(false)}>Overview</a>
                <a href="#system" onClick={() => setIsMobileMenuOpen(false)}>Workflow</a>
                <a href="#features" onClick={() => setIsMobileMenuOpen(false)}>Features</a>
                <a href="#contact" onClick={() => setIsMobileMenuOpen(false)}>Contact</a>
              </>
            ) : user ? (
              <>
                {userData?.status !== 'Pending' && <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}>Dashboard</Link>}
                <Link to="/livefeed" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}>Live Feed</Link>
                {userData?.isAdmin && <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}>Admin</Link>}
                {(userData?.isModerator || userData?.isAdmin) && <Link to="/moderator" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: '#a855f7', fontWeight: 'bold' }}>Moderator</Link>}
                {installPrompt && !isInstalled && (
                  <button
                    onClick={() => { handleInstall(); setIsMobileMenuOpen(false); }}
                    style={{
                      margin: '0.25rem 1rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                      border: 'none',
                      color: 'white',
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 2px 12px rgba(99,102,241,0.4)'
                    }}
                  >
                    <FiDownload size={18} /> Install App
                  </button>
                )}
                <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FiLogOut size={18} /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}>Home</Link>
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}>Login</Link>
                <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: 'var(--primary)', fontWeight: 'bold' }}>Sign Up</Link>
              </>
            )}
          </div>
        )}
      </nav>

      {/* ── Announcement Marquee Ticker (LiveFeed only) ── */}
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
