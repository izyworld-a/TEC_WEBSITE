import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, 
  FiBriefcase, 
  FiDollarSign, 
  FiSend, 
  FiCheckCircle, 
  FiUser, 
  FiMail, 
  FiPhone, 
  FiClock, 
  FiFileText,
  FiGlobe
} from 'react-icons/fi';

const USD_BUDGETS = [
  '< $500',
  '$500 - $1,500',
  '$1,500 - $3,500',
  '$3,500 - $5,000',
  '$5,000+',
  'Custom'
];

const NGN_BUDGETS = [
  '< ₦350,000',
  '₦350,000 - ₦1,000,000',
  '₦1,000,000 - ₦2,500,000',
  '₦2,500,000 - ₦5,000,000',
  '₦5,000,000+',
  'Custom'
];

const OFFER_TYPES = [
  'Full-Time Contract',
  'Freelance / Part-Time',
  'One-Off Project',
  'Advisory & Consultation',
  'Internship / Junior Role'
];

const TIMELINES = [
  'Immediate (within 48h)',
  '1 - 2 Weeks',
  'Within 1 Month',
  'Flexible'
];

export default function JobOfferModal({ 
  member, 
  isOpen, 
  onClose,
  initialProjectTitle = '',
  initialScope = ''
}) {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [offerType, setOfferType] = useState('Freelance / Part-Time');
  const [projectTitle, setProjectTitle] = useState(initialProjectTitle || '');
  const [scope, setScope] = useState(initialScope || '');
  const [currency, setCurrency] = useState('USD'); // 'USD' | 'NGN'
  const [selectedBudget, setSelectedBudget] = useState('$500 - $1,500');
  const [customBudget, setCustomBudget] = useState('');
  const [timeline, setTimeline] = useState('1 - 2 Weeks');

  useEffect(() => {
    if (isOpen) {
      if (initialProjectTitle) setProjectTitle(initialProjectTitle);
      if (initialScope) setScope(initialScope);
    }
  }, [isOpen, initialProjectTitle, initialScope]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Sync default budget when currency switches
  const handleCurrencyChange = (newCurrency) => {
    setCurrency(newCurrency);
    if (newCurrency === 'USD') {
      setSelectedBudget('$500 - $1,500');
    } else {
      setSelectedBudget('₦350,000 - ₦1,000,000');
    }
  };

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!clientName.trim() || !clientEmail.trim() || !projectTitle.trim() || !scope.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    if (selectedBudget === 'Custom' && !customBudget.trim()) {
      setErrorMsg('Please specify your custom budget amount.');
      return;
    }

    const finalBudget = selectedBudget === 'Custom' 
      ? `${currency === 'USD' ? '$' : '₦'}${customBudget.trim()}` 
      : selectedBudget;

    setIsSubmitting(true);
    try {
      // 1. Write offer proposal into job_offers collection
      await addDoc(collection(db, 'job_offers'), {
        toUserId: member.id,
        toUserName: member.name || 'Member',
        toUserEmail: member.email || '',
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientPhone: clientPhone.trim(),
        clientCompany: clientCompany.trim(),
        offerType,
        projectTitle: projectTitle.trim(),
        scope: scope.trim(),
        currency,
        budget: finalBudget,
        timeline,
        status: 'pending', // 'pending' | 'accepted' | 'declined' | 'contacted'
        readByMember: false,
        createdAt: serverTimestamp()
      });

      // 2. Dispatch in-app notification to the target member
      await addDoc(collection(db, 'notifications'), {
        userId: member.id,
        title: `💼 New Job Offer: ${projectTitle.trim()}`,
        message: `${clientName.trim()} sent you a ${offerType} offer via TEC Space.`,
        type: 'job_offer',
        read: false,
        createdAt: serverTimestamp()
      });

      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit job offer:', err);
      setErrorMsg('Failed to submit offer. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setErrorMsg('');
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientCompany('');
    setProjectTitle('');
    setScope('');
    setCustomBudget('');
    onClose();
  };

  return (
    <div className="tec-space-modal-overlay" onClick={handleResetAndClose}>
      <motion.div 
        className="tec-space-modal"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-modal-title"
      >
        {/* Header */}
        <div className="tec-space-modal-header">
          <div className="tec-space-modal-title-wrap">
            <div className="tec-space-modal-icon">
              <FiBriefcase />
            </div>
            <div>
              <h2 id="offer-modal-title">Extend Job Offer</h2>
              <p>Direct contract & project proposal through TEC Space</p>
            </div>
          </div>
          <button 
            type="button" 
            className="tec-space-modal-close" 
            onClick={handleResetAndClose}
            aria-label="Close modal"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Candidate Banner */}
        <div className="tec-space-modal-candidate">
          {member.profilePicUrl ? (
            <img 
              src={member.profilePicUrl} 
              alt={member.name} 
              className="candidate-avatar" 
            />
          ) : (
            <div className="candidate-avatar-placeholder">
              {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
          <div className="candidate-info">
            <span className="candidate-tag">Candidate</span>
            <h3>{member.name}</h3>
            <p>{member.profession || 'Specialist Operator'}</p>
          </div>
          <div className="candidate-verified-chip">
            <span className="pulse-dot"></span>
            Verified TEC Operator
          </div>
        </div>

        {submitted ? (
          /* Confirmation State */
          <div className="tec-space-success-view">
            <div className="success-icon-badge">
              <FiCheckCircle size={44} />
            </div>
            <h3>Offer Successfully Dispatched!</h3>
            <p>
              Your proposal for <strong>{projectTitle}</strong> has been transmitted directly to <strong>{member.name}</strong>.
            </p>
            <div className="success-recap-box">
              <div className="recap-row">
                <span>Offered To</span>
                <strong>{member.name}</strong>
              </div>
              <div className="recap-row">
                <span>Engagement Type</span>
                <strong>{offerType}</strong>
              </div>
              <div className="recap-row">
                <span>Target Budget</span>
                <strong>
                  {selectedBudget === 'Custom' 
                    ? `${currency === 'USD' ? '$' : '₦'}${customBudget}` 
                    : selectedBudget}
                </strong>
              </div>
              <div className="recap-row">
                <span>Client Contact</span>
                <strong>{clientEmail}</strong>
              </div>
            </div>
            <p className="success-subtext">
              {member.name} has been notified and will review your project requirements. They will follow up via your provided email or phone.
            </p>
            <button 
              type="button" 
              className="tec-btn-primary full-width"
              onClick={handleResetAndClose}
            >
              Done & Return to Directory
            </button>
          </div>
        ) : (
          /* Submission Form */
          <form onSubmit={handleSubmit} className="tec-space-modal-form">
            {errorMsg && (
              <div className="tec-form-alert error">
                {errorMsg}
              </div>
            )}

            {/* Client Info Grid */}
            <div className="form-section-title">
              <FiUser size={15} />
              <span>Your Information (Client / Company)</span>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="client-name">Your Full Name <span className="req">*</span></label>
                <input
                  id="client-name"
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="client-email">Work Email <span className="req">*</span></label>
                <input
                  id="client-email"
                  type="email"
                  placeholder="alex@company.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="client-phone">WhatsApp / Phone Number</label>
                <input
                  id="client-phone"
                  type="tel"
                  placeholder="+234 or +1 ..."
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="client-company">Company / Project Name</label>
                <input
                  id="client-company"
                  type="text"
                  placeholder="e.g. Stripe, FinTech Lab"
                  value={clientCompany}
                  onChange={(e) => setClientCompany(e.target.value)}
                />
              </div>
            </div>

            {/* Project Details */}
            <div className="form-section-title" style={{ marginTop: '0.75rem' }}>
              <FiFileText size={15} />
              <span>Project Scope & Engagement</span>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="offer-type">Engagement Model</label>
                <select
                  id="offer-type"
                  value={offerType}
                  onChange={(e) => setOfferType(e.target.value)}
                >
                  {OFFER_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="project-timeline">Target Start / Timeline</label>
                <select
                  id="project-timeline"
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                >
                  {TIMELINES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="project-title">Role or Project Title <span className="req">*</span></label>
              <input
                id="project-title"
                type="text"
                placeholder="e.g. Build Mobile MVP / Lead UI Design Sprint"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="project-scope">Scope, Responsibilities & Key Deliverables <span className="req">*</span></label>
              <textarea
                id="project-scope"
                rows={4}
                placeholder="Describe what you want built or achieved, expected tech stack or tools, weekly commitment, and any specific outcomes..."
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                required
              />
            </div>

            {/* Currency & Budget Selector */}
            <div className="form-section-title" style={{ marginTop: '0.75rem' }}>
              <FiDollarSign size={15} />
              <span>Compensation & Budget</span>
            </div>

            <div className="budget-currency-row">
              <span className="currency-label">Select Currency:</span>
              <div className="currency-pills">
                <button
                  type="button"
                  className={`currency-pill ${currency === 'USD' ? 'active' : ''}`}
                  onClick={() => handleCurrencyChange('USD')}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  className={`currency-pill ${currency === 'NGN' ? 'active' : ''}`}
                  onClick={() => handleCurrencyChange('NGN')}
                >
                  NGN (₦)
                </button>
              </div>
            </div>

            <div className="budget-tiers-grid">
              {(currency === 'USD' ? USD_BUDGETS : NGN_BUDGETS).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className={`budget-tier-btn ${selectedBudget === tier ? 'active' : ''}`}
                  onClick={() => setSelectedBudget(tier)}
                >
                  {tier}
                </button>
              ))}
            </div>

            {selectedBudget === 'Custom' && (
              <div className="form-group custom-budget-input" style={{ marginTop: '0.5rem' }}>
                <label htmlFor="custom-budget">Enter Custom Budget ({currency})</label>
                <div className="input-with-prefix">
                  <span className="currency-prefix">{currency === 'USD' ? '$' : '₦'}</span>
                  <input
                    id="custom-budget"
                    type="text"
                    placeholder={currency === 'USD' ? 'e.g. 7500' : 'e.g. 6000000'}
                    value={customBudget}
                    onChange={(e) => setCustomBudget(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="tec-space-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetAndClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="tec-btn-primary"
                disabled={isSubmitting}
              >
                <FiSend size={15} />
                <span>{isSubmitting ? 'Transmitting Offer...' : `Dispatch Offer to ${member.name?.split(' ')[0] || 'Member'}`}</span>
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
