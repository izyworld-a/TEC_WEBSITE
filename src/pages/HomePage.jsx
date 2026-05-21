import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { 
  FiTarget, FiShield, FiCheckSquare, FiEye, FiActivity, FiGift,
  FiUser, FiCalendar, FiAward, FiCheckCircle, FiClock, FiMail, FiPhone, FiMapPin
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
    <div style={{ width: '100%', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Hero Section */}
      <section id="home" className="fade-in hero-section" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: 'bold' }}>
          Platform for Goal Management
        </p>
        <h1 className="hero-title" style={{ fontWeight: '900', marginBottom: '1rem', background: 'linear-gradient(to right, var(--text-main), var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        TEC Weekly
        </h1>
        <h3 style={{ fontSize: '1.5rem', fontWeight: '400', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Professional Admin & Rewards System
        </h3>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '3rem', lineHeight: '1.6' }}>
          Set goals, track progress, and earn rewards with our sophisticated weekly planning, strict point system, and transparent admin review process.
        </p>
        <button onClick={handleGetStarted} className="btn btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: '12px', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          Get Started
        </button>
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
