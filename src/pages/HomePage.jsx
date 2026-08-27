import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import logoImg from '../assets/Logo.png';
import {
  FaArrowRight,
  FaBullseye,
  FaCheck,
  FaClock,
  FaFileCircleCheck,
  FaGlobe,
  FaLocationDot,
  FaPaperPlane,
  FaPhone,
  FaScaleUnbalanced,
  FaShieldHalved,
  FaUserGroup,
  FaWallet,
} from 'react-icons/fa6';

const workflowSteps = [
  {
    number: '01',
    title: 'Declare',
    icon: <FaBullseye />,
    text: 'Members set at least three weekly goals before the setup deadline.',
  },
  {
    number: '02',
    title: 'Execute',
    icon: <FaClock />,
    text: 'The week is tracked around check-ins, partner pressure, and visible progress.',
  },
  {
    number: '03',
    title: 'Prove',
    icon: <FaFileCircleCheck />,
    text: 'Every completed goal needs proof through a link, image, or clear evidence.',
  },
  {
    number: '04',
    title: 'Review',
    icon: <FaShieldHalved />,
    text: 'Moderators and admins verify submissions before points or penalties move.',
  },
  {
    number: '05',
    title: 'Reward',
    icon: <FaWallet />,
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

  const handleCtaClick = () => {
    navigate(currentUser ? '/dashboard' : '/login');
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormSubmitted(true);
    setTimeout(() => {
      setFormData({ name: '', email: '', subject: '', message: '' });
      setFormSubmitted(false);
    }, 4000);
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
                <FaArrowRight size={14} />
              </button>
              <a href="#system" className="tec-btn-secondary">See the system</a>
            </div>
            <div className="tec-hero-facts" aria-label="TEC Weekly operating rhythm">
              <span>3+ weekly goals</span>
              <span>Proof required</span>
              <span>Admin reviewed</span>
            </div>
          </div>

          <div className="tec-dashboard-preview" aria-label="TEC Weekly dashboard preview">
            <div className="tec-preview-topbar">
              <div>
                <span className="tec-preview-eyebrow">Current Week</span>
                <strong>Execution Board</strong>
              </div>
              <span className="tec-preview-badge">Live</span>
            </div>
            <div className="tec-preview-wallet">
              <span>Wallet balance</span>
              <strong>NGN 12,000</strong>
              <small>Active member</small>
            </div>
            <div className="tec-preview-goals">
              {['Ship portfolio update', 'Complete React module', 'Publish proof thread'].map((goal, index) => (
                <div className="tec-preview-goal" key={goal}>
                  <span>{index + 1}</span>
                  <p>{goal}</p>
                  <strong>{index === 2 ? 'Review' : 'Done'}</strong>
                </div>
              ))}
            </div>
            <div className="tec-preview-review">
              <span>Moderator note</span>
              <p>Proof accepted. Awaiting admin points.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="system" className="tec-section tec-workflow-section fade-in">
        <div className="tec-container">
          <div className="tec-section-header">
            <span className="tec-section-kicker">The System</span>
            <h2>Five steps. One weekly rhythm.</h2>
            <p>TEC Weekly feels different when the design shows the ritual: declaration, execution, proof, review, and reward.</p>
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
              The interface should keep reminding members that goals become real only when they are specific, visible, and reviewed.
            </p>
            <div className="tec-proof-list">
              <div>
                <FaCheck />
                <span>Goal descriptions lock after submission.</span>
              </div>
              <div>
                <FaCheck />
                <span>Proof links and images stay attached to each task.</span>
              </div>
              <div>
                <FaCheck />
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
            <p>Every major surface now points back to the product's real rules, not generic productivity language.</p>
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
              <p>Points, wallet balance, deadlines, rankings, partner pairing, and deductions all belong in the visual identity.</p>
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
          <FaScaleUnbalanced />
          <h2>Your word to the circle is binding.</h2>
          <p>That line is more ownable than abstract professionalism, so the design now lets the product's culture speak.</p>
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
                <FaCheck size={24} />
                Thank you. Your message has been received.
              </div>
            ) : (
              <form onSubmit={handleFormSubmit}>
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

                <button type="submit" className="tec-btn-primary tec-btn-full">
                  <span>Send Message</span>
                  <FaPaperPlane size={14} />
                </button>
              </form>
            )}
          </div>

          <div className="tec-contact-details">
            <div className="tec-info-card">
              <div className="tec-info-icon-box">
                <FaPhone />
              </div>
              <div>
                <span>Direct Line</span>
                <strong>0816 477 1958</strong>
              </div>
            </div>

            <div className="tec-info-card">
              <div className="tec-info-icon-box">
                <FaGlobe />
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
                <FaLocationDot />
              </div>
              <div>
                <span>Operations</span>
                <strong>Online - Enugu, NG</strong>
              </div>
            </div>

            <div className="tec-meeting-badge">
              <div>
                <FaUserGroup />
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
