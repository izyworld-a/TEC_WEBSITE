import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { 
  FiSearch, 
  FiMapPin, 
  FiStar, 
  FiCheckCircle, 
  FiBriefcase, 
  FiAward, 
  FiUsers, 
  FiShield, 
  FiArrowRight, 
  FiX, 
  FiCode, 
  FiZap,
  FiFilter,
  FiLayers,
  FiPlay
} from 'react-icons/fi';
import { FaGithub, FaLinkedin, FaTwitter } from 'react-icons/fa';
import JobOfferModal from '../components/JobOfferModal';
import ProjectDetailModal from '../components/ProjectDetailModal';
import OperatorProfileModal from '../components/OperatorProfileModal';
import { isVideoUrl } from '../cloudinary';
import './tecSpace.css';

const CATEGORIES = [
  { id: 'all', label: 'All Specialties' },
  { id: 'engineering', label: 'Software & Web', keywords: ['developer', 'engineer', 'react', 'node', 'frontend', 'backend', 'fullstack', 'python', 'mobile', 'flutter', 'android', 'ios', 'web', 'javascript', 'typescript', 'software'] },
  { id: 'design', label: 'Product & Design', keywords: ['design', 'designer', 'ui', 'ux', 'product design', 'figma', 'graphic', 'brand'] },
  { id: 'marketing', label: 'Growth & Marketing', keywords: ['marketing', 'growth', 'seo', 'social media', 'ads', 'sales', 'community', 'strategy'] },
  { id: 'content', label: 'Content & Writing', keywords: ['content', 'writer', 'copywriter', 'copywriting', 'editor', 'technical writing', 'documentation'] },
  { id: 'data', label: 'Data & Operations', keywords: ['data', 'analyst', 'analytics', 'operations', 'project manager', 'scrum', 'sql', 'bi'] }
];

/**
 * Deliverable thumbnail box (4 max per operator row)
 * On hover: animates dark theme linear-gradient overlay from bottom to top (top 0%, bottom 90%).
 * If media is video: autoplays muted on hover and pauses on mouse leave.
 */
function WorkThumbnailBox({ work, onClick }) {
  const videoRef = React.useRef(null);
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
      className="operator-work-box" 
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
          className="work-box-media"
        />
      ) : (
        <img 
          src={work.coverImage || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=80'} 
          alt={work.title} 
          loading="lazy" 
          className="work-box-media"
        />
      )}

      {isVideo && (
        <span className="work-video-indicator" title="Video deliverable">
          <FiPlay size={10} />
        </span>
      )}

      {/* Animated Linear Gradient Bottom-to-Top Overlay (Dark theme, 0% top to 90% bottom) */}
      <div className="work-box-overlay">
        {work.category && <span className="work-overlay-category">{work.category}</span>}
        <h4 className="work-overlay-title">{work.title}</h4>
      </div>
    </div>
  );
}

export default function TecSpacePage({ user, userData }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // View Switcher: 'people' (Operators) vs 'projects' (Works & Proofs)
  const [activeView, setActiveView] = useState('people');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Job Offer Modal State
  const [selectedMember, setSelectedMember] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [offerInitialTitle, setOfferInitialTitle] = useState('');
  const [offerInitialScope, setOfferInitialScope] = useState('');

  // Project Detail Lightbox Modal State
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedProjectCreator, setSelectedProjectCreator] = useState(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Operator Profile Modal State
  const [selectedProfileOperator, setSelectedProfileOperator] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // 1. Fetch public operators from users collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Exclude pending members and members who opted out of public directory
        if (data.status !== 'Pending' && data.availableForHire !== false) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      // Sort by stars / points or activity
      list.sort((a, b) => ((b.achievementStars || 0) * 10 + (b.totalPoints || 0)) - ((a.achievementStars || 0) * 10 + (a.totalPoints || 0)));
      setMembers(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching talent directory:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 2. Aggregate all member portfolio works into a community deliverables feed
  const allProjects = useMemo(() => {
    const list = [];
    members.forEach((member) => {
      if (Array.isArray(member.portfolioWorks) && member.portfolioWorks.length > 0) {
        member.portfolioWorks.forEach((work, idx) => {
          list.push({
            ...work,
            uniqueId: `${member.id}-${work.id || idx}`,
            creator: member
          });
        });
      }
    });
    return list;
  }, [members]);

  // 3. Real-time filtering logic for Operators
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Filter by search query
      const query = searchTerm.toLowerCase().trim();
      const name = (member.name || '').toLowerCase();
      const profession = (member.profession || '').toLowerCase();
      const bio = (member.bio || '').toLowerCase();
      const skills = Array.isArray(member.skills) 
        ? member.skills.map(s => s.toLowerCase()) 
        : [];

      const matchesSearch = !query || 
        name.includes(query) || 
        profession.includes(query) || 
        bio.includes(query) || 
        skills.some(s => s.includes(query));

      if (!matchesSearch) return false;

      // Filter by category
      if (activeCategory !== 'all') {
        const cat = CATEGORIES.find(c => c.id === activeCategory);
        if (cat) {
          const textToScan = `${profession} ${skills.join(' ')} ${bio}`.toLowerCase();
          const matchesCat = cat.keywords.some(k => textToScan.includes(k));
          if (!matchesCat) return false;
        }
      }

      // Filter by selected specific skill pill
      if (selectedSkill) {
        const hasSkill = skills.some(s => s.includes(selectedSkill.toLowerCase()));
        if (!hasSkill) return false;
      }

      // Filter by immediate availability toggle
      if (onlyAvailable) {
        if (member.status === 'On Break') return false;
      }

      return true;
    });
  }, [members, searchTerm, activeCategory, selectedSkill, onlyAvailable]);

  // 4. Real-time filtering logic for Projects & Proofs
  const filteredProjects = useMemo(() => {
    return allProjects.filter((item) => {
      const query = searchTerm.toLowerCase().trim();
      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const creatorName = (item.creator?.name || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      const tags = Array.isArray(item.tags) ? item.tags.map(t => t.toLowerCase()) : [];

      const matchesSearch = !query || 
        title.includes(query) || 
        desc.includes(query) || 
        creatorName.includes(query) || 
        category.includes(query) || 
        tags.some(t => t.includes(query));

      if (!matchesSearch) return false;

      if (activeCategory !== 'all') {
        const cat = CATEGORIES.find(c => c.id === activeCategory);
        if (cat) {
          const textToScan = `${title} ${desc} ${category} ${tags.join(' ')}`.toLowerCase();
          const matchesCat = cat.keywords.some(k => textToScan.includes(k));
          if (!matchesCat) return false;
        }
      }

      if (selectedSkill) {
        const hasSkill = tags.some(t => t.includes(selectedSkill.toLowerCase()));
        if (!hasSkill) return false;
      }

      if (onlyAvailable && item.creator?.status === 'On Break') {
        return false;
      }

      return true;
    });
  }, [allProjects, searchTerm, activeCategory, selectedSkill, onlyAvailable]);

  // Handler: Open Project Detail Lightbox Modal
  const handleOpenProjectModal = (project, creator) => {
    setSelectedProject(project);
    setSelectedProjectCreator(creator);
    setIsProjectModalOpen(true);
  };

  const handleCloseProjectModal = () => {
    setIsProjectModalOpen(false);
    setSelectedProject(null);
    setSelectedProjectCreator(null);
  };

  // Handler: Initiate direct hire directly from project lightbox
  const handleHireForProject = (creator, project) => {
    setIsProjectModalOpen(false);
    setOfferInitialTitle(`Inquiry regarding "${project.title}"`);
    setOfferInitialScope(`Hi ${creator.name},\n\nI saw your verified deliverable "${project.title}" on TEC Space and would like to hire you for a similar scope.\n\nProject Scope:\n- Core Objectives: \n- Deliverables Needed: \n- Target Timeline: `);
    setSelectedMember(creator);
    setIsModalOpen(true);
  };

  // Handler: Open standard job offer modal
  const handleOpenOfferModal = (member) => {
    setOfferInitialTitle('');
    setOfferInitialScope('');
    setSelectedMember(member);
    setIsModalOpen(true);
  };

  const handleCloseOfferModal = () => {
    setIsModalOpen(false);
    setSelectedMember(null);
    setOfferInitialTitle('');
    setOfferInitialScope('');
  };

  // Handler: Open Operator Profile Modal
  const handleOpenProfileModal = (operator) => {
    setSelectedProfileOperator(operator);
    setIsProfileModalOpen(true);
  };

  const handleCloseProfileModal = () => {
    setIsProfileModalOpen(false);
    setSelectedProfileOperator(null);
  };

  const handleSkillClick = (skill) => {
    if (selectedSkill === skill) {
      setSelectedSkill('');
    } else {
      setSelectedSkill(skill);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setActiveCategory('all');
    setSelectedSkill('');
    setOnlyAvailable(false);
  };

  return (
    <div className="tec-space-page">
      <div className="tec-space-container">
        {/* ── 1. Header (Unified in same container as operator rows) ── */}
        <header className="tec-space-header">
          <h1>Hire Proven Builders with Verifiable Execution Receipts</h1>
        </header>

        {/* ── 2. Filter & Discovery Bar ── */}
        <div className="tec-space-filter-bar">
          <div className="filter-bar-inner">
            <div className="search-and-controls">
              <div className="search-input-wrap">
                <FiSearch />
                <input
                  type="text"
                  placeholder="Search by skill (e.g. React, UI/UX, Python), role or member name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <button
                type="button"
                className={`availability-toggle-btn ${onlyAvailable ? 'active' : ''}`}
                onClick={() => setOnlyAvailable(!onlyAvailable)}
              >
                <span className="pulse-dot" style={{ display: onlyAvailable ? 'inline-block' : 'none' }}></span>
                Available for Immediate Work
              </button>
            </div>

            {/* Category Discipline Pills */}
            <div className="category-pills-scroll">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-pill ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Active Skill Filter Banner */}
            {selectedSkill && (
              <div className="active-skill-filter-banner">
                <span>Filtering by specialization: <strong>{selectedSkill}</strong></span>
                <button 
                  type="button" 
                  onClick={() => setSelectedSkill('')}
                  aria-label="Remove skill filter"
                >
                  <FiX size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Talent & Deliverables Showcase ── */}
        <div className="tec-space-showcase">
          <div className="showcase-header">
            <div>
              <h2>{activeView === 'people' ? 'Featured TEC Operators' : 'Community Deliverables & Proofs'}</h2>
              <span className="showcase-count-badge">
                {activeView === 'people' 
                  ? `Showing ${filteredMembers.length} ${filteredMembers.length === 1 ? 'specialist' : 'specialists'}`
                  : `Showing ${filteredProjects.length} ${filteredProjects.length === 1 ? 'deliverable' : 'deliverables'}`
                }
              </span>
            </div>

            {/* View Switcher: People vs Projects (Contra-elevated) */}
            <div className="tec-space-view-switcher">
              <button
                type="button"
                className={`view-switch-btn ${activeView === 'people' ? 'active' : ''}`}
                onClick={() => setActiveView('people')}
                title="View by Operators & Talent Bento Cards"
              >
                <FiUsers size={15} />
                <span>Operators ({filteredMembers.length})</span>
              </button>
              <button
                type="button"
                className={`view-switch-btn ${activeView === 'projects' ? 'active' : ''}`}
                onClick={() => setActiveView('projects')}
                title="View Proof-of-Work Deliverables & Projects"
              >
                <FiLayers size={15} />
                <span>Works & Proofs ({filteredProjects.length})</span>
              </button>
            </div>
          </div>

          {activeView === 'projects' ? (
            /* ── VIEW A: Community Projects & Proofs Feed ── */
            loading ? (
              <div className="loader-container" style={{ minHeight: '300px' }}>
                <div className="loader"></div>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="tec-space-empty">
                <div className="empty-icon-wrap">
                  <FiLayers />
                </div>
                <h3>No deliverables found matching your criteria</h3>
                <p>Try clearing active filters or exploring other specializations.</p>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleResetFilters}
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="projects-masonry-grid">
                {filteredProjects.map((item) => (
                  <div 
                    key={item.uniqueId} 
                    className="project-feed-card"
                    onClick={() => handleOpenProjectModal(item, item.creator)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenProjectModal(item, item.creator);
                      }
                    }}
                  >
                    <div 
                      className="project-feed-media"
                      onMouseEnter={(e) => {
                        const vid = e.currentTarget.querySelector('video');
                        if (vid) vid.play().catch(() => {});
                      }}
                      onMouseLeave={(e) => {
                        const vid = e.currentTarget.querySelector('video');
                        if (vid) { vid.pause(); vid.currentTime = 0; }
                      }}
                    >
                      {isVideoUrl(item.coverImage) ? (
                        <video
                          src={item.coverImage}
                          muted
                          loop
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img 
                          src={item.coverImage || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=80'} 
                          alt={item.title} 
                          loading="lazy"
                        />
                      )}
                      <span className="project-feed-badge">
                        {item.category || 'Deliverable'}
                      </span>
                    </div>

                    <div className="project-feed-body">
                      <h3 className="project-feed-title">{item.title}</h3>
                      <p className="project-feed-desc">{item.description}</p>

                      {Array.isArray(item.tags) && item.tags.length > 0 && (
                        <div className="project-feed-tags">
                          {item.tags.slice(0, 3).map((tag, tIdx) => (
                            <span key={tIdx} className="talent-skill-tag">
                              {tag}
                            </span>
                          ))}
                          {item.tags.length > 3 && (
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                              +{item.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="project-feed-creator-strip">
                        <div className="creator-mini-meta">
                          {item.creator?.profilePicUrl ? (
                            <img 
                              src={item.creator.profilePicUrl} 
                              alt={item.creator.name} 
                              className="creator-mini-avatar" 
                            />
                          ) : (
                            <div className="creator-mini-avatar-initial">
                              {item.creator?.name ? item.creator.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                          )}
                          <div>
                            <div className="creator-mini-name">{item.creator?.name}</div>
                            <div className="creator-mini-role">{item.creator?.profession || 'Specialist'}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn-send-offer"
                          style={{ flex: 'none', padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHireForProject(item.creator, item);
                          }}
                        >
                          <FiBriefcase size={13} />
                          <span>Hire</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* ── VIEW B: Operator Profiles Bento Cards ── */
            loading ? (
              <div className="loader-container" style={{ minHeight: '300px' }}>
                <div className="loader"></div>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="tec-space-empty">
                <div className="empty-icon-wrap">
                  <FiSearch />
                </div>
                <h3>No operators found matching your criteria</h3>
                <p>Try clearing active filters or adjusting your search keywords.</p>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleResetFilters}
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="operator-rows-list">
                {filteredMembers.map((member) => {
                  const memberSkills = Array.isArray(member.skills) ? member.skills : [];
                  const locationText = member.state 
                    ? `${member.state}, ${member.country || 'NG'}` 
                    : (member.country || 'Remote / Worldwide');
                  const displayWorks = Array.isArray(member.portfolioWorks) 
                    ? member.portfolioWorks.slice(0, 4) 
                    : [];

                  return (
                    <div key={member.id} className="operator-row-card">
                      {/* Top Bar: Identity & Actions */}
                      <div className="operator-row-header">
                        <div className="operator-row-identity">
                          <div 
                            className="operator-row-avatar-wrap clickable-profile-trigger"
                            onClick={() => handleOpenProfileModal(member)}
                            role="button"
                            tabIndex={0}
                            title={`View ${member.name}'s full profile & works`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleOpenProfileModal(member);
                              }
                            }}
                          >
                            {member.profilePicUrl ? (
                              <img 
                                src={member.profilePicUrl} 
                                alt={member.name} 
                                className="operator-row-avatar" 
                              />
                            ) : (
                              <div className="operator-row-avatar-initial">
                                {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                            )}
                            <span 
                              className="avatar-online-dot" 
                              title={member.status === 'On Break' ? 'On Scheduled Break' : 'Active Operator'}
                              style={{ backgroundColor: member.status === 'On Break' ? '#b45309' : '#0f766e' }}
                            ></span>
                          </div>

                          <div className="operator-row-name-meta">
                            <div 
                              className="operator-row-name-line clickable-profile-trigger"
                              onClick={() => handleOpenProfileModal(member)}
                              role="button"
                              tabIndex={0}
                              title={`View ${member.name}'s full profile & works`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleOpenProfileModal(member);
                                }
                              }}
                            >
                              <h3 className="operator-row-name">{member.name}</h3>
                              <FiCheckCircle className="verified-icon" size={16} title="Verified Circle Operator" />
                            </div>
                            <span className="operator-row-location">
                              <FiMapPin size={11} />
                              <span>{locationText}</span>
                            </span>
                          </div>

                          {/* Inline Stats & Badges (Clean Minimalist Typography) */}
                          <div className="operator-row-stats">
                            <span className="operator-stat-pill">
                              <strong>{member.achievementStars ? `${member.achievementStars}w` : 'Active'}</strong> streak
                            </span>
                            <span className="operator-stat-bullet">•</span>
                            <span className="operator-stat-pill">
                              <strong>{member.totalPoints || 0}</strong> pts
                            </span>
                            <span className="operator-stat-bullet">•</span>
                            <span className="operator-stat-pill">
                              <strong>{Array.isArray(member.portfolioWorks) ? member.portfolioWorks.length : 0}</strong> works
                            </span>
                            {member.status !== 'On Break' ? (
                              <span className="operator-stat-badge">✦ Available</span>
                            ) : (
                              <span className="operator-stat-badge on-break">⏸ On Break</span>
                            )}
                          </div>
                        </div>

                        {/* Actions: Social Links + Offer CTA */}
                        <div className="operator-row-actions">
                          <div className="talent-social-links">
                            {member.socials?.github && (
                              <a 
                                href={member.socials.github.startsWith('http') ? member.socials.github : `https://${member.socials.github}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="talent-social-btn"
                                title="GitHub Profile"
                              >
                                <FaGithub />
                              </a>
                            )}
                            {member.socials?.linkedin && (
                              <a 
                                href={member.socials.linkedin.startsWith('http') ? member.socials.linkedin : `https://${member.socials.linkedin}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="talent-social-btn"
                                title="LinkedIn Profile"
                              >
                                <FaLinkedin />
                              </a>
                            )}
                            {member.socials?.twitter && (
                              <a 
                                href={member.socials.twitter.startsWith('http') ? member.socials.twitter : `https://${member.socials.twitter}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="talent-social-btn"
                                title="Twitter / X Profile"
                              >
                                <FaTwitter />
                              </a>
                            )}
                          </div>

                          <button
                            type="button"
                            className="btn-send-offer"
                            onClick={() => handleOpenOfferModal(member)}
                          >
                            <FiBriefcase size={15} />
                            <span>Send Job Offer</span>
                          </button>
                        </div>
                      </div>

                      {/* Headline / Bio */}
                      <p className="operator-row-bio">
                        {member.profession ? <strong style={{ color: 'var(--text-main)', marginRight: '0.4rem' }}>{member.profession} —</strong> : null}
                        {member.bio || 'Proven operator actively declaring, executing, and proving high-impact deliverables in The Execution Circle.'}
                      </p>

                      {/* Visual Deliverables Strip: Up to 4 Boxes Max */}
                      {displayWorks.length > 0 ? (
                        <div className="operator-works-strip">
                          {displayWorks.map((work, wIdx) => (
                            <WorkThumbnailBox
                              key={work.id || wIdx}
                              work={work}
                              onClick={() => handleOpenProjectModal(work, member)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="operator-works-empty-strip">
                          <div className="operator-empty-receipt-badge">
                            <FiShield size={14} />
                            <span>Verified Execution Circle Operator</span>
                          </div>
                          <p>Weekly goals, production commits, and milestones peer-reviewed by TEC leadership</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── 4. Why Hire From TEC Section ── */}
      <section className="tec-space-trust-section">
        <div className="tec-space-container">
          <div className="trust-section-header">
            <h2>Why Hire From The Execution Circle?</h2>
            <p>
              Traditional freelance marketplaces rely on unverified claims and inflated reviews. TEC operators operate under weekly peer accountability and verifiable production standards.
            </p>
          </div>

          <div className="trust-pillars-grid">
            <div className="trust-pillar-card">
              <div className="pillar-icon-box">
                <FiCheckCircle />
              </div>
              <h3>Proof-Backed Competence</h3>
              <p>
                Every specialist in TEC sets public weekly milestones and attaches live production links, designs, or code commits before earning verified status.
              </p>
            </div>

            <div className="trust-pillar-card">
              <div className="pillar-icon-box">
                <FiShield />
              </div>
              <h3>Rigorous Accountability</h3>
              <p>
                Our members are accustomed to strict weekly deadlines, peer scrutiny, and moderator evaluations. You get teammates with disciplined execution habits.
              </p>
            </div>

            <div className="trust-pillar-card">
              <div className="pillar-icon-box">
                <FiZap />
              </div>
              <h3>Zero Platform Markup</h3>
              <p>
                Engage directly with talent without paying 20% marketplace commissions. Discuss scope, agree on budgets in USD or NGN, and collaborate directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Custom Match / Pod Banner ── */}
      <section className="tec-space-cta-banner">
        <div className="tec-space-container">
          <div className="cta-banner-content">
            <h2>Need a Cross-Functional Team?</h2>
            <p>
              Building an MVP or scaling an existing product? Let TEC leadership help you assemble a dedicated pod of engineers, designers, and growth leads.
            </p>
            <a 
              href="mailto:partnerships@izyworld.com?subject=TEC%20Space%20Talent%20Pod%20Inquiry" 
              className="tec-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
            >
              <span>Contact TEC Leadership</span>
              <FiArrowRight size={15} />
            </a>
          </div>
        </div>
      </section>

      {/* ── 6. Project Detail Lightbox Modal ── */}
      <ProjectDetailModal
        project={selectedProject}
        creator={selectedProjectCreator}
        isOpen={isProjectModalOpen}
        onClose={handleCloseProjectModal}
        onHireForProject={handleHireForProject}
      />

      {/* ── 7. Job Offer Modal ── */}
      <JobOfferModal
        member={selectedMember}
        isOpen={isModalOpen}
        onClose={handleCloseOfferModal}
        initialProjectTitle={offerInitialTitle}
        initialScope={offerInitialScope}
      />

      {/* ── 8. Operator Profile Modal (Contra-Style) ── */}
      <OperatorProfileModal
        operator={selectedProfileOperator}
        isOpen={isProfileModalOpen}
        onClose={handleCloseProfileModal}
        onHireOperator={handleOpenOfferModal}
        onOpenProjectDetail={handleOpenProjectModal}
      />
    </div>
  );
}
