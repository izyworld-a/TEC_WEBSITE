import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, 
  FiExternalLink, 
  FiBriefcase, 
  FiCheckCircle, 
  FiTag, 
  FiUser, 
  FiLayers 
} from 'react-icons/fi';
import { isVideoUrl } from '../cloudinary';

export default function ProjectDetailModal({ 
  project, 
  creator, 
  isOpen, 
  onClose, 
  onHireForProject 
}) {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

  const handleHireClick = () => {
    onClose();
    if (onHireForProject) {
      onHireForProject(creator, project);
    }
  };

  return (
    <div className="tec-space-modal-overlay" onClick={onClose}>
      <motion.div 
        className="tec-space-modal project-detail-modal"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
      >
        {/* Modal Header */}
        <div className="tec-space-modal-header">
          <div className="tec-space-modal-title-wrap">
            <div className="tec-space-modal-icon">
              <FiLayers />
            </div>
            <div>
              <span className="project-category-chip">{project.category || 'Featured Work'}</span>
              <h2 id="project-modal-title">{project.title}</h2>
            </div>
          </div>
          <button 
            type="button" 
            className="tec-space-modal-close" 
            onClick={onClose}
            aria-label="Close modal"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="project-modal-body">
          {/* Cover Media Banner */}
          {project.coverImage && (
            <div className="project-modal-cover-wrap">
              {isVideoUrl(project.coverImage) ? (
                <video 
                  src={project.coverImage} 
                  controls 
                  playsInline 
                  autoPlay 
                  muted 
                  className="project-modal-cover"
                />
              ) : (
                <img 
                  src={project.coverImage} 
                  alt={project.title} 
                  className="project-modal-cover" 
                />
              )}
            </div>
          )}

          {/* Creator Attribution Strip */}
          {creator && (
            <div className="project-modal-creator-strip">
              <div className="creator-avatar-wrap">
                {creator.profilePicUrl ? (
                  <img 
                    src={creator.profilePicUrl} 
                    alt={creator.name} 
                    className="creator-avatar" 
                  />
                ) : (
                  <div className="creator-avatar-initial">
                    {creator.name ? creator.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
              <div className="creator-info">
                <div className="creator-name-row">
                  <h4>Created by {creator.name}</h4>
                  <FiCheckCircle className="verified-icon" size={15} title="Verified Operator" />
                </div>
                <p>{creator.profession || 'Specialist Operator'} • {creator.state ? `${creator.state}, ${creator.country || 'NG'}` : 'Remote'}</p>
              </div>
              <div className="creator-stats-chip">
                <span>⭐ {creator.achievementStars || 0} Stars</span>
                <span>•</span>
                <span>{creator.totalPoints || 0} pts</span>
              </div>
            </div>
          )}

          {/* Project Details Content */}
          <div className="project-modal-content">
            <h3>Overview & Deliverables</h3>
            <p className="project-description-text">
              {project.description || 'Verified production deliverable shipped in The Execution Circle.'}
            </p>

            {/* Tech Stack / Tools Tags */}
            {Array.isArray(project.tags) && project.tags.length > 0 && (
              <div className="project-modal-tags-section">
                <h4>Technologies & Tools Used</h4>
                <div className="project-tags-list">
                  {project.tags.map((tag, idx) => (
                    <span key={idx} className="project-tag-pill">
                      <FiTag size={12} />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="project-modal-footer">
          {project.liveUrl && (
            <a 
              href={project.liveUrl.startsWith('http') ? project.liveUrl : `https://${project.liveUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', textDecoration: 'none' }}
            >
              <FiExternalLink size={15} />
              <span>View Live Project</span>
            </a>
          )}

          <button
            type="button"
            className="tec-btn-primary"
            onClick={handleHireClick}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}
          >
            <FiBriefcase size={16} />
            <span>Hire {creator?.name?.split(' ')[0] || 'Operator'} for Similar Work</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
