import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, 
  FiMapPin, 
  FiBriefcase, 
  FiCheckCircle, 
  FiShield, 
  FiExternalLink, 
  FiLayers, 
  FiPlay, 
  FiMaximize2,
  FiMail,
  FiGlobe
} from 'react-icons/fi';
import { FaGithub, FaLinkedin, FaTwitter } from 'react-icons/fa';
import { isVideoUrl } from '../cloudinary';

/**
 * Deliverable Thumbnail for Profile Works Grid
 * Borderless, sharp corners (no border-radius), dark theme linear gradient bottom-to-top on hover,
 * video autoplay on hover.
 */
function ProfileWorkThumbnail({ work, onClick }) {
  const videoRef = useRef(null);
  const isVideo = isVideoUrl(work.coverImage);

  const handleMouseEnter = () => {
    if (isVideo && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    if (isVideo && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div 
      className="profile-work-cell"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
      title={work.title}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {isVideo ? (
        <video 
          ref={videoRef}
          src={work.coverImage} 
          muted 
          loop 
          playsInline 
          preload="metadata"
          className="profile-work-media"
        />
      ) : (
        <img 
          src={work.coverImage || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=80'} 
          alt={work.title} 
          loading="lazy" 
          className="profile-work-media"
        />
      )}

      {isVideo && (
        <span className="profile-video-badge" title="Video deliverable">
          <FiPlay size={10} />
        </span>
      )}

      {/* Linear Gradient Bottom-to-Top Overlay: top 0% to bottom 90% */}
      <div className="profile-work-overlay">
        {work.category && <span className="profile-work-category">{work.category}</span>}
        <h4 className="profile-work-title">{work.title}</h4>
      </div>
    </div>
  );
}

export default function OperatorProfileModal({
  operator,
  isOpen,
  onClose,
  onHireOperator,
  onOpenProjectDetail
}) {
  const [activeTab, setActiveTab] = useState('works'); // 'works' | 'about'
  const [isAvatarZoomed, setIsAvatarZoomed] = useState(false);
  const billboardVideoRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isAvatarZoomed) {
          setIsAvatarZoomed(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAvatarZoomed, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setIsAvatarZoomed(false);
      setActiveTab('works');
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !operator) return null;

  const works = Array.isArray(operator.portfolioWorks) ? operator.portfolioWorks : [];
  const featuredWork = works.length > 0 ? works[0] : null;
  const isBillboardVideo = featuredWork ? isVideoUrl(featuredWork.coverImage) : false;

  const locationText = operator.state 
    ? `${operator.state}, ${operator.country || 'NG'}` 
    : (operator.country || 'Remote / Worldwide');

  const skills = Array.isArray(operator.skills) ? operator.skills : [];

  const handleHireClick = () => {
    onClose();
    if (onHireOperator) {
      onHireOperator(operator);
    }
  };

  const handleBillboardMouseEnter = () => {
    if (isBillboardVideo && billboardVideoRef.current) {
      billboardVideoRef.current.play().catch(() => {});
    }
  };

  const handleBillboardMouseLeave = () => {
    if (isBillboardVideo && billboardVideoRef.current) {
      billboardVideoRef.current.pause();
      billboardVideoRef.current.currentTime = 0;
    }
  };

  return (
    <div className="tec-space-modal-overlay operator-modal-overlay" onClick={onClose}>
      <motion.div 
        className="operator-profile-modal-container"
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="operator-profile-title"
      >
        {/* Floating Top Right Close Button */}
        <button 
          type="button" 
          className="operator-modal-close-floating" 
          onClick={onClose}
          aria-label="Close profile"
        >
          <FiX size={20} />
        </button>

        {/* Modal Scrollable Body */}
        <div className="operator-profile-modal-scroll">
          {/* ── 1. Split Header (Contra Style) ──────────────────────────────── */}
          <section className="profile-split-header">
            {/* Left Column: Operator Identity, Stats & Primary Action */}
            <div className="profile-info-column">
              <div className="profile-avatar-row">
                <button 
                  type="button"
                  className="profile-avatar-zoom-trigger"
                  onClick={() => setIsAvatarZoomed(true)}
                  title="Click to view full photo"
                  aria-label="View enlarged profile picture"
                >
                  {operator.profilePicUrl ? (
                    <img 
                      src={operator.profilePicUrl} 
                      alt={operator.name} 
                      className="profile-main-avatar" 
                    />
                  ) : (
                    <div className="profile-main-avatar-initial">
                      {operator.name ? operator.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <span 
                    className="profile-avatar-status-dot"
                    style={{ backgroundColor: operator.status === 'On Break' ? '#b45309' : '#0f766e' }}
                    title={operator.status === 'On Break' ? 'On Break' : 'Active'}
                  />
                  <div className="avatar-zoom-hint">
                    <FiMaximize2 size={13} />
                  </div>
                </button>

                <div className="profile-badge-pill">
                  <FiCheckCircle size={13} />
                  <span>TEC Verified Operator</span>
                </div>
              </div>

              <h1 id="operator-profile-title" className="profile-operator-name">
                {operator.name}
              </h1>

              <p className="profile-operator-profession">
                {operator.profession || 'Specialist Operator'}
              </p>

              {operator.bio && (
                <p className="profile-operator-short-bio">
                  {operator.bio}
                </p>
              )}

              {/* Action Buttons */}
              <div className="profile-actions-bar">
                <button 
                  type="button" 
                  className="profile-btn-primary"
                  onClick={handleHireClick}
                >
                  <FiBriefcase size={16} />
                  <span>Send Job Offer</span>
                </button>

                {operator.socials?.portfolio && (
                  <a 
                    href={operator.socials.portfolio.startsWith('http') ? operator.socials.portfolio : `https://${operator.socials.portfolio}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="profile-btn-secondary"
                    title="External Portfolio"
                  >
                    <FiGlobe size={15} />
                    <span>Website</span>
                  </a>
                )}
              </div>

              {/* Clean Typography Stats Row (No generic emojis) */}
              <div className="profile-tabular-stats-card">
                <div className="profile-stat-box">
                  <span className="profile-stat-number">{operator.achievementStars ? `${operator.achievementStars}w` : 'Active'}</span>
                  <span className="profile-stat-label">Streak</span>
                </div>
                <div className="profile-stat-box">
                  <span className="profile-stat-number">{works.length}</span>
                  <span className="profile-stat-label">Shipped</span>
                </div>
                <div className="profile-stat-box">
                  <span className="profile-stat-number">{operator.totalPoints || 0}</span>
                  <span className="profile-stat-label">Verified Pts</span>
                </div>
                <div className="profile-stat-box">
                  <span className="profile-stat-number">&lt; 24h</span>
                  <span className="profile-stat-label">Response</span>
                </div>
              </div>
            </div>

            {/* Right Column: Billboard Deliverable Showcase */}
            <div className="profile-billboard-column">
              {featuredWork ? (
                <div 
                  className="profile-billboard-card"
                  onClick={() => onOpenProjectDetail(featuredWork, operator)}
                  onMouseEnter={handleBillboardMouseEnter}
                  onMouseLeave={handleBillboardMouseLeave}
                  role="button"
                  tabIndex={0}
                  title={`View "${featuredWork.title}"`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenProjectDetail(featuredWork, operator);
                    }
                  }}
                >
                  {isBillboardVideo ? (
                    <video 
                      ref={billboardVideoRef}
                      src={featuredWork.coverImage} 
                      muted 
                      loop 
                      playsInline 
                      preload="metadata"
                      className="billboard-media"
                    />
                  ) : (
                    <img 
                      src={featuredWork.coverImage} 
                      alt={featuredWork.title} 
                      className="billboard-media" 
                    />
                  )}

                  <div className="billboard-overlay">
                    <span className="billboard-kicker">Featured Deliverable</span>
                    <h3 className="billboard-title">{featuredWork.title}</h3>
                    {featuredWork.category && (
                      <span className="billboard-category">{featuredWork.category}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="profile-billboard-empty">
                  <div className="billboard-empty-icon">
                    <FiShield size={32} />
                  </div>
                  <h3>Verified Execution Receipt</h3>
                  <p>
                    {operator.name} is a member of The Execution Circle with weekly accountability checkpoints, peer-reviewed production milestones, and zero platform markup.
                  </p>
                  <button 
                    type="button" 
                    className="btn-send-offer"
                    onClick={handleHireClick}
                    style={{ marginTop: '1rem', width: 'auto', padding: '0.6rem 1.4rem' }}
                  >
                    <FiBriefcase size={14} />
                    <span>Inquire for Custom Scope</span>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ── 2. Meta Navigation Bar (Tabs & Socials) ────────────────────── */}
          <div className="profile-meta-navbar">
            <div className="profile-nav-tabs">
              <button 
                type="button" 
                className={`profile-nav-tab ${activeTab === 'works' ? 'active' : ''}`}
                onClick={() => setActiveTab('works')}
              >
                Works ({works.length})
              </button>
              <button 
                type="button" 
                className={`profile-nav-tab ${activeTab === 'about' ? 'active' : ''}`}
                onClick={() => setActiveTab('about')}
              >
                About & Credentials
              </button>
            </div>

            <div className="profile-nav-meta-right">
              <span className="profile-meta-location">
                <FiMapPin size={13} />
                <span>{locationText}</span>
              </span>

              <div className="profile-meta-socials">
                {operator.socials?.github && (
                  <a 
                    href={operator.socials.github.startsWith('http') ? operator.socials.github : `https://${operator.socials.github}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="profile-social-link"
                    title="GitHub"
                  >
                    <FaGithub />
                  </a>
                )}
                {operator.socials?.linkedin && (
                  <a 
                    href={operator.socials.linkedin.startsWith('http') ? operator.socials.linkedin : `https://${operator.socials.linkedin}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="profile-social-link"
                    title="LinkedIn"
                  >
                    <FaLinkedin />
                  </a>
                )}
                {operator.socials?.twitter && (
                  <a 
                    href={operator.socials.twitter.startsWith('http') ? operator.socials.twitter : `https://${operator.socials.twitter}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="profile-social-link"
                    title="Twitter / X"
                  >
                    <FaTwitter />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* ── 3. Tab Contents ────────────────────────────────────────────── */}
          {activeTab === 'works' ? (
            <div className="profile-tab-works-section">
              {works.length === 0 ? (
                <div className="profile-works-empty-state">
                  <FiLayers size={36} />
                  <h3>No Deliverables Uploaded Yet</h3>
                  <p>This operator executes through weekly sprint milestones. Contact them directly with your project requirements.</p>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handleHireClick}
                    style={{ marginTop: '1rem' }}
                  >
                    Send Job Offer
                  </button>
                </div>
              ) : (
                /* Full Works Gallery: Shows ALL uploaded works, borderless and sharp-edged */
                <div className="profile-works-full-grid">
                  {works.map((work, idx) => (
                    <ProfileWorkThumbnail
                      key={work.id || idx}
                      work={work}
                      onClick={() => onOpenProjectDetail(work, operator)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="profile-tab-about-section">
              <div className="profile-about-card">
                <h3>About {operator.name}</h3>
                <p className="profile-about-full-text">
                  {operator.bio || 'Proven operator actively declaring, executing, and proving high-impact deliverables in The Execution Circle.'}
                </p>

                {skills.length > 0 && (
                  <div className="profile-about-skills-block">
                    <h4>Specializations & Skills</h4>
                    <div className="profile-about-skill-tags">
                      {skills.map((skill, sIdx) => (
                        <span key={sIdx} className="profile-skill-badge">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="profile-about-verification-block">
                  <div className="verification-icon-wrap">
                    <FiShield size={24} />
                  </div>
                  <div>
                    <h4>Verified Execution Circle Member</h4>
                    <p>
                      Milestones, delivery receipts, and consistency metrics are logged and audited on-chain / peer-reviewed within the TEC network.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── 4. Avatar Lightbox Overlay ────────────────────────────────────── */}
      <AnimatePresence>
        {isAvatarZoomed && (
          <motion.div 
            className="avatar-lightbox-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setIsAvatarZoomed(false)}
          >
            <motion.div 
              className="avatar-lightbox-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                type="button" 
                className="avatar-lightbox-close"
                onClick={() => setIsAvatarZoomed(false)}
                aria-label="Close photo preview"
              >
                <FiX size={22} />
              </button>

              {operator.profilePicUrl ? (
                <img 
                  src={operator.profilePicUrl} 
                  alt={operator.name} 
                  className="avatar-lightbox-img" 
                />
              ) : (
                <div className="avatar-lightbox-fallback-initial">
                  {operator.name ? operator.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}

              <div className="avatar-lightbox-caption">
                <h4>{operator.name}</h4>
                {operator.profession && <p>{operator.profession}</p>}
                <span className="avatar-lightbox-badge">✦ TEC Verified</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
