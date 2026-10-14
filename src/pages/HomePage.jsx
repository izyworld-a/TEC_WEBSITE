import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import HeroProductDemo from '../components/HeroProductDemo';
import logoImg from '../assets/Logo.png';
import {
  LuArrowRight,
  LuBriefcase,
  LuCheck,
  LuClock,
  LuFileCheck,
  LuGlobe,
  LuMapPin,
  LuPhone,
  LuScale,
  LuSend,
  LuShieldCheck,
  LuTarget,
  LuUsers,
  LuWallet,
} from 'react-icons/lu';

const workflowSteps = [
  {
    number: '01',
    title: 'Declare',
    icon: <LuTarget />,
    text: 'Members set at least three weekly goals before the setup deadline.',
  },
  {
    number: '02',
    title: 'Execute',
    icon: <LuClock />,
    text: 'The week is tracked around check-ins, partner pressure, and visible progress.',
  },
  {
    number: '03',
    title: 'Prove',
    icon: <LuFileCheck />,
    text: 'Every completed goal needs proof through a link, image, or clear evidence.',
  },
  {
    number: '04',
    title: 'Review',
    icon: <LuShieldCheck />,
    text: 'Moderators and admins verify submissions before points or penalties move.',
  },
  {
    number: '05',
    title: 'Reward',
    icon: <LuWallet />,
    text: 'Points, wallet status, and team rewards make execution feel concrete.',
  },
];

const featureCards = [
  {
    title: 'Weekly Goal Board',
    text: 'Submit goals, update status, attach proof, and download reports from one focused surface.',
  },
  {
    title: 'Moderator Review Flow',
    text: 'Proofs move through a visible review path before final admin approval.',
  },
  {
    title: 'Wallet Accountability',
    text: 'Members keep a minimum balance, and penalties are handled as part of the system.',
  },
  {
    title: 'Live Execution Feed',
    text: 'The community can see who submitted, who is progressing, and who is leading the week.',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleCtaClick = () => {
    navigate(currentUser ? '/dashboard' : '/login');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    const name = formData.name.trim();
    const email = formData.email.trim();
    const subject = formData.subject.trim();
    const message = formData.message.trim();

    if (!name || !email || !subject || !message) {
      setSubmitError('Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'contact_messages'), {
        name,
        email,
        subject,
        message,
        status: 'unread',
        createdAt: serverTimestamp(),
        source: 'landing_page',
        userId: currentUser?.uid || null,
      });

      setFormSubmitted(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error('Failed to submit contact message:', err);
      setSubmitError('Could not send message. Please try again or reach out directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { root: null, rootMargin: '0px', threshold: 0.15 }
    );

    const fadeElements = document.querySelectorAll('.fade-in');
    fadeElements.forEach((el) => observer.observe(el));

    return () => fadeElements.forEach((el) => observer.unobserve(el));
  }, []);

  return (
    <div className="tec-landing">
      <section id="overview" className="tec-hero fade-in">
        <div className="tec-container tec-hero-grid">
          <div className="tec-hero-content">
            <div className="tec-kicker">
              <img src={logoImg} alt="" />
              <span>TEC Weekly</span>
            </div>
            <h1>The Execution Circle</h1>
            <p className="tec-hero-lead">
              Declare your weekly goals. Submit proof. Get reviewed. Earn your place in a circle where accountability has receipts.
            </p>
            <div className="tec-hero-actions">
              <button onClick={handleCtaClick} className="tec-btn-primary">
                <span>{currentUser ? 'Open my dashboard' : 'Enter this week'}</span>
                <LuArrowRight size={14} />
              </button>
              <Link to="/space" className="tec-btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
                <LuBriefcase size={14} />
                <span>Hire Talent</span>
              </Link>
              <a href="#system" className="tec-btn-secondary">See the system</a>
            </div>
            <div className="tec-hero-facts" aria-label="TEC Weekly operating rhythm">
              <span>3+ weekly goals</span>
              <span>Proof required</span>
              <span>Admin reviewed</span>
            </div>
          </div>

                    <HeroProductDemo />
        </div>
      </section>

      <section id="system" className="tec-section tec-workflow-section fade-in">
        <div className="tec-container">
          <div className="tec-section-header">
            <span className="tec-section-kicker">The System</span>
            <h2>Five steps. One weekly rhythm.</h2>
            <p>A high-discipline weekly cadence engineered to turn ambitious targets into verified results.</p>
          </div>

          <div className="tec-workflow-grid">
            {workflowSteps.map((step) => (
              <article className="tec-workflow-card" key={step.title}>
                <span className="tec-workflow-number">{step.number}</span>
                <div className="tec-workflow-icon">{step.icon}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="tec-section tec-proof-section fade-in">
        <div className="tec-container tec-proof-grid">
          <div>
            <span className="tec-section-kicker">Verified Progress</span>
            <h2>Not a task list. A proof-backed operating system.</h2>
            <p>
              Goals are locked upon declaration. Clear evidence is reviewed by peers and moderators before any points or rewards are issued.
            </p>
            <div className="tec-proof-list">
              <div>
                <LuCheck />
                <span>Goal descriptions lock after submission.</span>
              </div>
              <div>
                <LuCheck />
                <span>Proof links and images stay attached to each task.</span>
              </div>
              <div>
                <LuCheck />
                <span>Moderators flag weak evidence before admin approval.</span>
              </div>
            </div>
          </div>

          <div className="tec-review-panel">
            <div className="tec-review-header">
              <span>Review Queue</span>
              <strong>3 proofs waiting</strong>
            </div>
            <div className="tec-review-row">
              <span>Task</span>
              <strong>Portfolio update</strong>
            </div>
            <div className="tec-review-row">
              <span>Evidence</span>
              <strong>Screenshot + live link</strong>
            </div>
            <div className="tec-review-actions">
              <span>Reject</span>
              <strong>Approve</strong>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="tec-section tec-features-section fade-in">
        <div className="tec-container">
          <div className="tec-section-header tec-section-header-left">
            <span className="tec-section-kicker">Platform Features</span>
            <h2>Built around the weekly commitment.</h2>
            <p>Every surface is designed for actionable clarity—eliminating fluff so you can focus entirely on executing your commitments.</p>
          </div>

          <div className="tec-feature-grid">
            {featureCards.map((feature) => (
              <article className="tec-feature-card" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>

          <div className="tec-reward-band">
            <div>
              <span className="tec-section-kicker">Rewards & Penalties</span>
              <h2>Accountability you can see.</h2>
              <p>Pair up with accountability partners, climb the leaderboard, and unlock real peer rewards when both of you deliver.</p>
            </div>
            <div className="tec-reward-metrics">
              <span>Top 3 pairs</span>
              <strong>NGN 1,000</strong>
              <small>Team reward when both qualify</small>
            </div>
          </div>
        </div>
      </section>

      <section className="tec-statement-band fade-in">
        <div className="tec-container">
          <LuScale />
          <h2>Your word to the circle is binding.</h2>
          <p>No excuses, no hidden backdoors. When you declare a goal to the circle, you commit to showing up and proving it.</p>
        </div>
      </section>

      <section className="tec-section tec-space-banner-section fade-in" style={{
        background: 'linear-gradient(180deg, rgba(23, 21, 63, 0.03) 0%, rgba(79, 70, 229, 0.07) 100%)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '5rem 1.5rem',
        textAlign: 'center'
      }}>
        <div className="tec-container" style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div className="tec-kicker" style={{ margin: '0 auto 1.25rem' }}>
            <LuBriefcase size={14} />
            <span>Client & Partner Portal</span>
          </div>
          <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-main)' }}>
            Looking to Hire Proven Builders & Operators?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '2.25rem', maxWidth: '680px', margin: '0 auto 2.25rem' }}>
            Discover vetted software engineers, UI/UX designers, and growth specialists from The Execution Circle. Browse their verified proof of execution and extend direct job offers with zero middleman fees.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/space" className="tec-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
              <span>Explore TEC Space Directory</span>
              <LuArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section id="contact" className="tec-contact-section fade-in">
        <div className="tec-container tec-contact-grid">
          <div className="tec-contact-form-card">
            <span className="tec-section-kicker">Contact</span>
            <h3>Ask about joining the circle</h3>
            <p>Send a message and the TEC team will respond with next steps.</p>

            {formSubmitted ? (
              <div className="tec-success-message">
                <LuCheck size={28} />
                <div>
                  <strong>Inquiry received!</strong>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.875rem', opacity: 0.9, fontWeight: 500 }}>
                    Thank you for reaching out. The TEC leadership team will review your message and reply via email shortly.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit}>
                {submitError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      marginBottom: '1rem',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    {submitError}
                  </div>
                )}
                <div className="tec-input-row">
                  <div className="tec-input-group">
                    <label htmlFor="name">Your Name</label>
                    <input
                      id="name"
                      type="text"
                      required
                      className="tec-input"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="tec-input-group">
                    <label htmlFor="email">Email Address</label>
                    <input
                      id="email"
                      type="email"
                      required
                      className="tec-input"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="tec-input-group">
                  <label htmlFor="subject">Subject</label>
                  <input
                    id="subject"
                    type="text"
                    required
                    className="tec-input"
                    placeholder="Membership request"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>

                <div className="tec-input-group">
                  <label htmlFor="message">Message</label>
                  <textarea
                    id="message"
                    rows="4"
                    required
                    className="tec-input"
                    placeholder="Tell us what you are working toward..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <button type="submit" className="tec-btn-primary tec-btn-full" disabled={isSubmitting}>
                  <span>{isSubmitting ? 'Sending...' : 'Send Message'}</span>
                  <LuSend size={14} />
                </button>
              </form>
            )}
          </div>

          <div className="tec-contact-details">
            <div className="tec-info-card">
              <div className="tec-info-icon-box">
                <LuPhone />
              </div>
              <div>
                <span>Direct Line</span>
                <strong>0816 477 1958</strong>
              </div>
            </div>

            <div className="tec-info-card">
              <div className="tec-info-icon-box">
                <LuGlobe />
              </div>
              <div>
                <span>Web Application</span>
                <a href="https://tec-weekly-goals.web.app/" target="_blank" rel="noopener noreferrer">
                  tec-weekly-goals.web.app
                </a>
              </div>
            </div>

            <div className="tec-info-card">
              <div className="tec-info-icon-box">
                <LuMapPin />
              </div>
              <div>
                <span>Operations</span>
                <strong>Online - Enugu, NG</strong>
              </div>
            </div>

            <div className="tec-meeting-badge">
              <div>
                <LuUsers />
                <span>Live attendance required</span>
              </div>
              <h4>Weekly Goal Meetings</h4>
              <p>Wednesday @ 9:00 PM</p>
              <p>Sunday @ 9:00 PM</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="tec-footer">
        <div className="tec-container tec-footer-grid">
          <div>
            <div className="tec-footer-brand">
              <img src={logoImg} alt="" />
              <span>TEC Weekly</span>
            </div>
            <p>Declare. Execute. Prove. Review. Reward.</p>
          </div>
          <div>
            <h4>Quick Links</h4>
            <p><Link to="/space" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>TEC Space Talent</Link></p>
            <p><Link to="/livefeed" style={{ color: 'inherit', textDecoration: 'none' }}>Live Feed</Link></p>
          </div>
          <div>
            <h4>Contact Info</h4>
            <p>0816 477 1958</p>
            <p>tec-weekly-goals.web.app</p>
          </div>
          <div>
            <h4>Operating Hours</h4>
            <p>Monday - Sunday</p>
            <p>Open 24 hours</p>
          </div>
        </div>
        <div className="tec-footer-bottom">
          &copy; {new Date().getFullYear()} TEC Weekly. Izyworld Global Limited.
        </div>
      </footer>
    </div>
  );
}
