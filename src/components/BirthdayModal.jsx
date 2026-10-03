import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import tecLogo from '../assets/Logo.png';
import './birthdayModal.css';

export default function BirthdayModal({
  isOpen = true,
  onClose,
  celebrationData = {},
  isPreview = false
}) {
  const {
    celebrantName = 'Buchi Mbam',
    celebrantRole = 'Nurse, Data Analyst',
    photoUrl = '',
    wishes = 'Wishing you a fantastic birthday filled with joy, success and happiness. Hope you have a great year ahead!'
  } = celebrationData || {};

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen || isPreview) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPreview, onClose]);

  // Trigger celebration confetti burst on modal open (skip if just inline preview)
  useEffect(() => {
    if (isOpen && !isPreview) {
      try {
        confetti({
          particleCount: 75,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#4f46e5', '#3b82f6', '#fbbf24', '#10b981', '#ef4444', '#a855f7']
        });

        const timer = setTimeout(() => {
          confetti({
            particleCount: 45,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#4338ca', '#f59e0b', '#ec4899']
          });
          confetti({
            particleCount: 45,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#4338ca', '#f59e0b', '#ec4899']
          });
        }, 280);

        return () => clearTimeout(timer);
      } catch (err) {
        console.warn('Confetti effect error:', err);
      }
    }
  }, [isOpen, isPreview]);

  if (!isOpen && !isPreview) return null;

  const handleCelebrateClick = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#4f46e5', '#eab308', '#ec4899', '#10b981']
      });
    } catch (_) {}
    if (onClose) onClose();
  };

  const cardContent = (
    <div className="birthday-flyer-card" onClick={(e) => e.stopPropagation()}>
      {/* Background watermark tech lines matching flyer */}
      <svg className="birthday-card-bg-mesh" viewBox="0 0 400 550" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="200" cy="270" r="180" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.05" strokeDasharray="5 5" />
        <circle cx="200" cy="270" r="260" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.04" />
        <path d="M-60 480 Q 180 380 440 450" stroke="#4f46e5" strokeWidth="1.5" strokeOpacity="0.06" />
        <circle cx="360" cy="80" r="70" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.04" />
      </svg>

      <div className="birthday-flyer-content">
        {/* Top Branding Bar */}
        <div className="birthday-header-bar">
          <div className="birthday-brand-badge">
            <img src={tecLogo} alt="TEC Logo" className="birthday-brand-logo" />
            <span className="birthday-brand-text">T E C &nbsp; S P A C E</span>
          </div>

          {!isPreview && onClose && (
            <button
              className="birthday-close-btn"
              onClick={onClose}
              title="Close (or press Esc)"
              aria-label="Close Birthday Card"
            >
              &times;
            </button>
          )}
        </div>

        {/* Happy Birthday Headlines */}
        <div className="birthday-title-group">
          <span className="birthday-title-happy">Happy</span>
          <span className="birthday-title-birthday">Birthday</span>
        </div>

        {/* Portrait Photo Container with Right-docked Celebrant Badge (Never covers face) */}
        <div className="birthday-showcase-container">
          <div className="birthday-photo-frame">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={celebrantName || 'Birthday Celebrant'}
                className="birthday-photo-img"
              />
            ) : (
              <div className="birthday-photo-placeholder">
                <span>{celebrantName?.charAt(0)?.toUpperCase() || '🎉'}</span>
              </div>
            )}
          </div>

          {/* Celebrant Name & Role Badge - positioned strictly on the right */}
          <div className="birthday-celebrant-badge">
            <div className="birthday-celebrant-name">
              {celebrantName || 'Celebrant'}
            </div>
            {celebrantRole && (
              <div className="birthday-celebrant-role">
                {celebrantRole}
              </div>
            )}
          </div>
        </div>

        {/* Divider Line */}
        <div className="birthday-divider" />

        {/* Birthday Wishes Paragraph */}
        <p className="birthday-wishes-text">
          {wishes || 'Wishing you a fantastic birthday filled with joy, success and happiness. Hope you have a great year ahead!'}
        </p>

        {/* Action Buttons (in modal mode) */}
        {!isPreview && (
          <div className="birthday-footer-actions">
            <button
              className="birthday-celebrate-btn"
              onClick={handleCelebrateClick}
            >
              <span>🎉</span>
              <span>Say Happy Birthday!</span>
            </button>
            {onClose && (
              <button
                className="birthday-dismiss-btn"
                onClick={onClose}
                title="Dismiss and view Live Feed"
              >
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // If in Preview mode (e.g. inside Admin Dashboard), render without backdrop
  if (isPreview) {
    return cardContent;
  }

  return (
    <div
      className="birthday-modal-backdrop"
      onClick={onClose}
      title="Click outside to close"
    >
      {cardContent}
    </div>
  );
}
