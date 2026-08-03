import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { 
  FiTarget, FiShield, FiCheckSquare, FiEye, FiActivity, FiGift,
  FiUser, FiCalendar, FiAward, FiCheckCircle, FiClock, FiMail, FiPhone, FiMapPin,
  FiStar, FiTrendingUp
} from 'react-icons/fi';

export default function HomePage() {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const handleGetStarted = () => {
    if (currentUser) {
      navigate('/livefeed');
    } else {
      navigate('/login');
    }
  };

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.15
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        } else {
          entry.target.classList.remove('visible');
        }
      });
    }, observerOptions);

    const fadeElements = document.querySelectorAll('.fade-in');
    fadeElements.forEach(el => observer.observe(el));

    return () => {
      fadeElements.forEach(el => observer.unobserve(el));
    };
  }, []);

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>
      
      {/* Custom Styles for 3D Target, Floating Badges, and Spiral Notebook */}
      <style>{`
        /* Hero Section Grid */
        .hero-grid {
          display: grid;
          grid-template-columns: 1fr;
          align-items: center;
          gap: 2rem;
          padding: 5rem 2rem;
          max-width: 1250px;
          margin: 0 auto;
          min-height: 85vh;
          position: relative;
        }
        
        @media (min-width: 1024px) {
          .hero-grid {
            grid-template-columns: 280px 1fr 340px;
            gap: 3rem;
          }
        }

        /* 3D Target Elements */
        .target-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          width: 100%;
          height: 320px;
        }

        .target-container {
          position: relative;
          width: 230px;
          height: 230px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-style: preserve-3d;
          transform: perspective(800px) rotateY(-18deg) rotateX(12deg);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          background: linear-gradient(135deg, var(--bg-card), var(--border));
          padding: 8px;
        }

        .target-container:hover {
          transform: perspective(800px) rotateY(-8deg) rotateX(6deg) scale(1.05);
        }

        .target-ring-1 {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 4px solid var(--border);
          background: linear-gradient(135deg, var(--bg-card), var(--border));
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.15);
        }

        .target-ring-2 {
          width: 78%;
          height: 78%;
          border-radius: 50%;
          border: 3.5px solid var(--border);
          background: linear-gradient(135deg, var(--border), var(--bg-main));
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.15);
        }

        .target-ring-3 {
          width: 54%;
          height: 54%;
          border-radius: 50%;
          background: linear-gradient(135deg, #1e1b4b, #312e81);
          border: 1.5px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.4);
        }

        .target-bullseye {
          width: 32%;
          height: 32%;
          border-radius: 50%;
          background: radial-gradient(circle, #38bdf8 0%, #3b82f6 60%, #1d4ed8 100%);
          box-shadow: 0 0 22px rgba(56, 189, 248, 0.75), inset 0 2px 4px rgba(255, 255, 255, 0.4);
        }

        /* High-tech Arrow */
        .arrow-svg {
          position: absolute;
          width: 150px;
          height: 150px;
          top: -20px;
          right: -30px;
          transform: rotate(-5deg);
          pointer-events: none;
          z-index: 10;
        }

        /* Floating Badges */
        .badge-trophy {
          position: absolute;
          top: 15px;
          left: 10px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.15);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1.5px solid rgba(99, 102, 241, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6366f1;
          box-shadow: 0 10px 20px rgba(99, 102, 241, 0.15);
          animation: floatAnimation 4.2s ease-in-out infinite;
        }

        .badge-star {
          position: absolute;
          top: 60px;
          right: 15px;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(245, 158, 11, 0.15);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1.5px solid rgba(245, 158, 11, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f59e0b;
          box-shadow: 0 10px 20px rgba(245, 158, 11, 0.15);
          animation: floatAnimation 3.8s ease-in-out infinite 0.5s;
        }

        .badge-chart {
          position: absolute;
          bottom: 25px;
          left: 30px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.15);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1.5px solid rgba(16, 185, 129, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #10b981;
          box-shadow: 0 10px 20px rgba(16, 185, 129, 0.15);
          animation: floatAnimation 4.6s ease-in-out infinite 1s;
        }

        @keyframes floatAnimation {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(3deg); }
        }

        /* Right Column Graphic Elements */
        .right-graphics-wrapper {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        /* Spiral Planner Notebook */
        .notebook-container {
          position: relative;
          width: calc(100% - 30px);
          height: 180px;
          margin-left: 20px;
          transform-style: preserve-3d;
          transform: perspective(900px) rotateY(-14deg) rotateX(8deg);
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .notebook-container:hover {
          transform: perspective(900px) rotateY(-4deg) rotateX(4deg) scale(1.02);
        }

        .notebook-cover {
          width: 100%;
          height: 100%;
          border-radius: 4px 16px 16px 4px;
          background: linear-gradient(135deg, #1e1b4b, #0f172a);
          box-shadow: -6px 12px 28px rgba(0, 0, 0, 0.35);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border-left: 6px solid rgba(255, 255, 255, 0.05);
          position: relative;
        }

        [data-theme='light'] .notebook-cover {
          background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
          border-left: 6px solid rgba(0, 0, 0, 0.08);
          box-shadow: -6px 12px 28px rgba(0, 0, 0, 0.15);
        }

        .notebook-title {
          font-family: 'Inter', sans-serif;
          font-weight: 300;
          font-size: 1.15rem;
          letter-spacing: 6px;
          color: rgba(255, 255, 255, 0.7);
          text-transform: uppercase;
        }

        [data-theme='light'] .notebook-title {
          color: #475569;
          font-weight: 500;
        }

        .notebook-spiral {
          position: absolute;
          left: -11px;
          top: 15px;
          bottom: 15px;
          width: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          z-index: 10;
        }

        .spiral-ring {
          width: 16px;
          height: 7px;
          background: linear-gradient(to bottom, #cbd5e1, #f8fafc, #64748b);
          border-radius: 4px;
          box-shadow: 0 1.5px 3px rgba(0, 0, 0, 0.25);
        }

        .silver-pen {
          position: absolute;
          right: -15px;
          bottom: -5px;
          width: 8px;
          height: 140px;
          background: linear-gradient(to right, #94a3b8, #f1f5f9, #475569);
          border-radius: 4px;
          transform: rotate(20deg);
          box-shadow: 4px 6px 12px rgba(0, 0, 0, 0.3);
          pointer-events: none;
        }

        /* Custom glow text and hero alignments */
        .center-hero-text {
          text-align: center;
          z-index: 5;
        }

        .glow-button {
          padding: 0.9rem 2.5rem;
          font-size: 1.05rem;
          border-radius: 30px;
          font-weight: 700;
          letter-spacing: 0.5px;
          box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
          transition: all 0.3s ease;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border: none;
          color: white;
          cursor: pointer;
        }

        .glow-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(99, 102, 241, 0.55);
          background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
        }

        [data-theme='light'] .glow-button {
          box-shadow: 0 10px 25px rgba(79, 70, 229, 0.25);
        }

        [data-theme='light'] .glow-button:hover {
          box-shadow: 0 15px 30px rgba(79, 70, 229, 0.35);
        }
      `}</style>

      {/* Responsive Header Hero Block */}
      <section className="fade-in">
        <div className="hero-grid">
          
          {/* Left Column: 3D Target Graphic */}
          <div className="target-wrapper desktop-only">
            <div className="badge-trophy">
              <FiAward size={20} />
            </div>
            <div className="badge-star">
              <FiStar size={18} fill="currentColor" />
            </div>
            <div className="badge-chart">
              <FiTrendingUp size={18} />
            </div>
            
            <div className="target-container">
              <div className="target-ring-1">
                <div className="target-ring-2">
                  <div className="target-ring-3">
                    <div className="target-bullseye"></div>
                  </div>
                </div>
              </div>
              
              {/* Arrow SVG piercing target center */}
              <svg className="arrow-svg" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
                {/* Shaft */}
                <line x1="85" y1="15" x2="35" y2="65" stroke="url(#arrowGrad)" strokeWidth="4.5" strokeLinecap="round" />
                {/* Arrowhead */}
                <polygon points="32,68 44,65 35,56" fill="#38bdf8" />
                {/* Fletching (Feathers) */}
                <path d="M80,10 L92,15 L82,25 L75,20 Z" fill="#6366f1" opacity="0.85" />
                <path d="M83,7 L90,8 L87,17 L80,16 Z" fill="#3b82f6" opacity="0.8" />
              </svg>
            </div>
          </div>

          {/* Center Column: Typography & CTAs */}
          <div className="center-hero-text">
            <p style={{ 
              fontSize: '0.8rem', 
              textTransform: 'uppercase', 
              letterSpacing: '2.5px', 
              color: 'var(--primary)', 
              marginBottom: '1rem', 
              fontWeight: '700' 
            }}>
              Platform for Goal Management
            </p>
            <h1 className="hero-title" style={{ 
              fontWeight: '900', 
              marginBottom: '1rem', 
              background: 'linear-gradient(135deg, var(--text-main) 30%, var(--text-secondary) 100%)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-1px'
            }}>
              TEC Weekly
            </h1>
            <h3 style={{ 
              fontSize: '1.45rem', 
              fontWeight: '500', 
              color: 'var(--text-secondary)', 
              marginBottom: '2rem',
              letterSpacing: '0.2px'
            }}>
              Professional Admin & Rewards System
            </h3>
            <p style={{ 
              fontSize: '1.05rem', 
              color: 'var(--text-secondary)', 
              marginBottom: '2.8rem', 
              lineHeight: '1.65',
              maxWidth: '560px',
              margin: '0 auto 2.8rem'
            }}>
              Set goals, track progress, and earn rewards with our sophisticated weekly planning, strict point system, and transparent admin review process.
            </p>
            <button onClick={handleGetStarted} className="glow-button">
              Get Started
            </button>
          </div>

          {/* Right Column: Premium Visual Cards & Notebook */}
          <div className="right-graphics-wrapper desktop-only">
            
            {/* Glass Weekly Progress Card */}
            <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: '0.5px' }}>
                WEEKLY PROGRESS <FiActivity color="#38bdf8" />
              </div>
              <svg viewBox="0 0 300 95" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                {/* Horizontal grid guide */}
                <line x1="0" y1="20" x2="300" y2="20" stroke="var(--border)" strokeWidth="0.75" strokeDasharray="4 4" />
                <line x1="0" y1="60" x2="300" y2="60" stroke="var(--border)" strokeWidth="0.75" strokeDasharray="4 4" />
                {/* Area fill */}
                <path d="M0,80 Q40,30 85,55 T160,20 T235,50 T300,10 L300,95 L0,95 Z" fill="url(#chartGradient)" />
                {/* Main line */}
                <path d="M0,80 Q40,30 85,55 T160,20 T235,50 T300,10" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
                {/* Glow dot nodes */}
                <circle cx="85" cy="55" r="4.5" fill="var(--primary)" stroke="var(--bg-card)" strokeWidth="2" />
                <circle cx="160" cy="20" r="4.5" fill="var(--primary)" stroke="var(--bg-card)" strokeWidth="2" />
                <circle cx="300" cy="10" r="4.5" fill="#38bdf8" stroke="var(--bg-card)" strokeWidth="2" />
              </svg>
            </div>

            {/* Goals Overview Circular Card */}
            <div className="glass-panel" style={{ padding: '1.15rem', borderRadius: '16px', border: '1px solid var(--glass-border)', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
                <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--primary)" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="62.8" strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800' }}>75%</span>
                  <span style={{ fontSize: '0.45rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '600' }}>Done</span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div style={{ fontWeight: '700', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Goals Overview</div>
                {['Goal Setting', 'Progress Tracking', 'Weekly Review', 'Rewards'].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    <FiCheckCircle size={10} color="#3b82f6" fill="rgba(59, 130, 246, 0.1)" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3D Spiral Planner Notebook & Pen */}
            <div className="notebook-container">
              <div className="notebook-spiral">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="spiral-ring" />
                ))}
              </div>
              <div className="notebook-cover">
                <span className="notebook-title">Planning</span>
              </div>
              <div className="silver-pen" />
            </div>

          </div>

        </div>
      </section>

      {/* Stats Section */}
      <section style={{ display: 'flex', justifyContent: 'center', gap: '4rem', padding: '2rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
        {[
          { icon: <FiUser size={24} />, value: '30+', label: 'Active on Week', color: '#6b7280' },
          { icon: <FiCalendar size={24} />, value: '2', label: 'Weekly Deadlines', color: '#f97316' },
          { icon: <FiAward size={24} />, value: '+3', label: 'Weekly Bonus', color: '#06b6d4' },
          { icon: <FiCheckCircle size={24} />, value: '100%', label: 'Transparent', color: '#eab308' }
        ].map((stat, idx) => (
          <div key={idx} className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', transitionDelay: `${idx * 0.1}s` }}>
            <div style={{ color: stat.color, background: `${stat.color}15`, padding: '1rem', borderRadius: '50%' }}>
              {stat.icon}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stat.value}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Powerful Features */}
      <section id="features" style={{ padding: '6rem 2rem', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <h2 className="fade-in" style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem' }}>Powerful Features</h2>
        <p className="fade-in" style={{ color: 'var(--text-secondary)', marginBottom: '4rem', transitionDelay: '0.1s' }}>Everything you need to manage goals, track progress, and reward achievement.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', textAlign: 'left' }}>
          {[
            { title: 'Automated Goal Management', desc: 'Set and track weekly goals seamlessly. Users receive prompts to ensure goals are submitted on time for maximum accountability.', icon: <FiTarget />, color: '#f97316' },
            { title: 'Sophisticated Penalty System', desc: 'Automated minimum limits enforced. Wallet deductions automatically process underperforming accounts based on specific parameters.', icon: <FiShield />, color: '#06b6d4' },
            { title: 'Real-Time Reviews', desc: 'Fast feedback loop from admin. Real-time notifications update users as their tasks are reviewed and verified.', icon: <FiCheckSquare />, color: '#3b82f6' },
            { title: 'Transparent Admin Review', desc: 'A unified portal allowing administrators to view, verify, and approve goals securely across the entire user base.', icon: <FiEye />, color: '#eab308' },
            { title: 'Real-Time Accountability', desc: 'Live feed display of user progress across the system. See transparent updates on the community dashboard immediately.', icon: <FiActivity />, color: '#ef4444' },
            { title: 'Integrated Rewards', desc: 'Built-in point tracking and bonus systems automatically score users. Bonuses are calculated and awarded consistently.', icon: <FiGift />, color: '#8b5cf6' }
          ].map((feature, idx) => (
            <div key={idx} className="glass-panel fade-in" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.3s ease, opacity 0.8s ease-out', transitionDelay: `${idx * 0.1}s` }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${feature.color}20`, color: feature.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '1.5rem' }}>
                {feature.icon}
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem' }}>{feature.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Track Your Progress */}
      <section style={{ padding: '6rem 2rem', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
        <h2 className="fade-in" style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem' }}>Track Your Progress</h2>
        <p className="fade-in" style={{ color: 'var(--text-secondary)', marginBottom: '4rem', transitionDelay: '0.1s' }}>Real-time updates and transparent performance metrics</p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap', maxWidth: '1000px', margin: '0 auto' }}>
          {/* Mockup Card 1 */}
          <div className="glass-panel fade-in" style={{ padding: '1.5rem', borderRadius: '16px', width: '100%', maxWidth: '300px', textAlign: 'left', border: '1px solid rgba(255,255,255,0.05)', transitionDelay: '0s' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
              Weekly Goal Progress <FiActivity color="#10b981" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>U</div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>User Profile</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>7/10 tasks verified</div>
              </div>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: '70%', height: '100%', background: '#10b981' }}></div>
            </div>
          </div>
          
          {/* Mockup Card 2 */}
          <div className="glass-panel fade-in" style={{ padding: '1.5rem', borderRadius: '16px', width: '100%', maxWidth: '300px', textAlign: 'left', border: '1px solid var(--primary)', transitionDelay: '0.1s' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)' }}>Goal Deadline</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '0.5rem' }}>2d 14h</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Until goal setting closure</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Setting Target: Fri 11:59 PM</div>
          </div>

          {/* Mockup Card 3 */}
          <div className="glass-panel fade-in" style={{ padding: '1.5rem', borderRadius: '16px', width: '100%', maxWidth: '300px', textAlign: 'left', border: '1px solid rgba(255,255,255,0.05)', transitionDelay: '0.2s' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
              Weekly Progress <FiCheckCircle color="#10b981" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>7/10</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Tasks Completed</div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: '70%', height: '100%', background: '#10b981' }}></div>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>70% completed</div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" style={{ padding: '6rem 2rem', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <p className="fade-in" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 'bold' }}>Simple Process</p>
        <h2 className="fade-in" style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem', transitionDelay: '0.1s' }}>How It Works</h2>
        <p className="fade-in" style={{ color: 'var(--text-secondary)', marginBottom: '4rem', transitionDelay: '0.2s' }}>Four simple steps to goal achievement and rewards.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
          {[
            { step: 1, title: 'Set Your Goals', desc: 'Add tasks, establish solid indicators of success, set your deadline parameters in your dashboard, and monitor the tracking process.', icon: <FiTarget size={24} color="#f97316" />, bg: '#f9731615' },
            { step: 2, title: 'Submit Proof', desc: 'Upload proof of completion for every goal before the weekly cutoff window. Let the status progress in real time.', icon: <FiCheckSquare size={24} color="#06b6d4" />, bg: '#06b6d415' },
            { step: 3, title: 'Admin Review', desc: 'Admin reviews submissions and provides transparent feedback. Earn a point for every properly validated objective.', icon: <FiShield size={24} color="#3b82f6" />, bg: '#3b82f615' },
            { step: 4, title: 'Earn Rewards', desc: 'Accumulate points and compete for the weekly top performance bonus. Unlock your wallet and excel.', icon: <FiAward size={24} color="#eab308" />, bg: '#eab30815' }
          ].map((item, idx) => (
            <div key={idx} className="fade-in" style={{ position: 'relative', padding: '2.5rem 1.5rem', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', transitionDelay: `${idx * 0.1}s` }}>
              <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '30px', height: '30px', background: 'var(--bg-main)', border: '2px solid var(--text-main)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                {item.step}
              </div>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                {item.icon}
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem' }}>{item.title}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section style={{ padding: '0 2rem', marginBottom: '6rem' }}>
        <div className="fade-in" style={{ 
          maxWidth: '1000px', 
          margin: '0 auto', 
          background: 'linear-gradient(135deg, #1e1b4b, #312e81)', 
          borderRadius: '24px', 
          padding: '4rem 2rem', 
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle Grid pattern overlay */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '30px 30px', opacity: 0.5 }}></div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem', color: 'white' }}>Ready to Achieve Your Goals?</h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '2.5rem', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
              Join TEC Weekly and start tracking your progress with our professional goal management system.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '3rem' }}>
              <button onClick={handleGetStarted} style={{ padding: '0.8rem 2rem', background: 'white', color: '#1e1b4b', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Join For Free <FiAward />
              </button>
              <button style={{ padding: '0.8rem 2rem', background: 'transparent', color: 'white', fontWeight: 'bold', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer' }}>
                Learn More
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
              {[
                { icon: <FiShield />, label: 'Secure Environment' },
                { icon: <FiActivity />, label: 'Real-Time Updates' },
                { icon: <FiUser />, label: 'Admin Support' }
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
                  <div style={{ fontSize: '1.2rem', opacity: 0.8 }}>{item.icon}</div>
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Get In Touch */}
      <section id="contact" style={{ padding: '4rem 2rem', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="fade-in" style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1rem' }}>Get In Touch</h2>
          <p className="fade-in" style={{ color: 'var(--text-secondary)', marginBottom: '3rem', transitionDelay: '0.1s' }}>Have questions? We'd love to hear from you.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem', textAlign: 'left', alignItems: 'start' }}>
            {/* Form */}
            <div className="glass-panel fade-in" style={{ padding: '2.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', transitionDelay: '0.2s' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Send us a message</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Fill out the form below and we'll get back to you as soon as possible.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Name</label>
                  <input type="text" placeholder="Your Name" style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Email</label>
                  <input type="email" placeholder="you@email.com" style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)' }} />
                </div>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Subject</label>
                <input type="text" placeholder="How can we help?" style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)' }} />
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Message</label>
                <textarea placeholder="Your message..." rows="4" style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', resize: 'vertical' }}></textarea>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', padding: '1rem', borderRadius: '8px', fontWeight: 'bold' }}>Send Message</button>
            </div>

            {/* Contact Info Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass-panel fade-in" style={{ padding: '1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(255,255,255,0.05)', transitionDelay: '0.3s' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiMail />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Email</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>support@tecweekly.com</div>
                </div>
              </div>

              <div className="glass-panel fade-in" style={{ padding: '1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(255,255,255,0.05)', transitionDelay: '0.4s' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
                  <FiPhone />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Phone</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>+234 8164771958</div>
                </div>
              </div>

              <div className="glass-panel fade-in" style={{ padding: '1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(255,255,255,0.05)', transitionDelay: '0.5s' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
                  <FiMapPin />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Office</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Lagos, Nigeria</div>
                </div>
              </div>

              <div className="glass-panel fade-in" style={{ padding: '1.5rem', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.05)', transitionDelay: '0.6s' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Weekly Goal Meeting</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Every Wednesday @ 9:00 PM</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sundays @ 9:00 PM</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--primary)', fontWeight: 'bold' }}>Live Attendance Required</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
