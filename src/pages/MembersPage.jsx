import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, setDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { getWeekId } from '../utils/weekUtils';
import { FiUser, FiCheck, FiPlus, FiX, FiTarget, FiAlertCircle, FiAward } from 'react-icons/fi';
import './peerGoals.css';

export default function MembersPage({ user, userData }) {
  const [members, setMembers] = useState([]);
  const [mySuggestions, setMySuggestions] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentWeekId] = useState(() => getWeekId(new Date()));
  const [weekSettings, setWeekSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Form State
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [deliverable, setDeliverable] = useState('');

  // 0. Listen to current week settings to check peerGoalsEnabled
  useEffect(() => {
    if (!currentWeekId) return;
    const unsub = onSnapshot(doc(db, 'week_settings', currentWeekId), (snap) => {
      if (snap.exists()) {
        setWeekSettings(snap.data());
      } else {
        setWeekSettings(null);
      }
      setSettingsLoading(false);
    }, (err) => {
      console.error('Error fetching week settings:', err);
      setSettingsLoading(false);
    });
    return () => unsub();
  }, [currentWeekId]);

  // 1. Fetch all active members in the same Space
  useEffect(() => {
    if (!user) return;

    const unsubMembers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = [];
      snapshot.forEach((d) => {
        const data = d.data();
        // Exclude self from peer suggestion list and exclude pending
        if (d.id !== user.uid && data.status !== 'Pending') {
          list.push({ id: d.id, ...data });
        }
      });
      setMembers(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching members:', err);
      setLoading(false);
    });

    return () => unsubMembers();
  }, [user]);

  // 2. Fetch my submitted suggestions for the current week
  useEffect(() => {
    if (!user || !currentWeekId) return;

    const qSuggestions = query(
      collection(db, 'suggested_goals'),
      where('fromUserId', '==', user.uid),
      where('weekId', '==', currentWeekId)
    );

    const unsubSuggestions = onSnapshot(qSuggestions, (snapshot) => {
      const mapping = {};
      snapshot.forEach((d) => {
        const data = d.data();
        mapping[data.toUserId] = { id: d.id, ...data };
      });
      setMySuggestions(mapping);
    }, (err) => {
      console.error('Error fetching suggestions:', err);
    });

    return () => unsubSuggestions();
  }, [user, currentWeekId]);

  // Open modal for a member
  const handleOpenSuggestModal = (member) => {
    setSelectedMember(member);
    const existing = mySuggestions[member.id];
    if (existing) {
      setGoalTitle(existing.title || '');
      setGoalDescription(existing.description || '');
      setDeliverable(existing.deliverable || '');
    } else {
      setGoalTitle('');
      setGoalDescription('');
      setDeliverable('');
    }
    setStatusMsg('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedMember(null);
    setGoalTitle('');
    setGoalDescription('');
    setDeliverable('');
    setStatusMsg('');
  };

  // Submit / Update goal suggestion
  const handleSubmitSuggestion = async (e) => {
    e.preventDefault();
    if (!goalTitle.trim() || !deliverable.trim()) {
      setStatusMsg('Please provide a goal title and clear deliverables.');
      return;
    }

    setIsSubmitting(true);
    setStatusMsg('');

    try {
      const suggestionDocId = `${user.uid}_${selectedMember.id}_${currentWeekId}`;
      const payload = {
        id: suggestionDocId,
        weekId: currentWeekId,
        spaceId: userData?.spaceId || 'default',
        fromUserId: user.uid,
        fromUserName: userData?.name || 'A Peer',
        fromUserPhoto: userData?.profilePicUrl || '',
        toUserId: selectedMember.id,
        toUserName: selectedMember.name || 'Member',
        title: goalTitle.trim(),
        description: goalDescription.trim(),
        deliverable: deliverable.trim(),
        status: 'suggested',
        updatedAt: serverTimestamp(),
        createdAt: mySuggestions[selectedMember.id]?.createdAt || serverTimestamp()
      };

      await setDoc(doc(db, 'suggested_goals', suggestionDocId), payload, { merge: true });

      setIsSubmitting(false);
      handleCloseModal();
    } catch (err) {
      console.error('Error assigning goal:', err);
      setStatusMsg('Failed to save goal suggestion. Please try again.');
      setIsSubmitting(false);
    }
  };

  const totalPeers = members.length;
  const suggestedCount = Object.keys(mySuggestions).length;
  const isAllSuggested = totalPeers > 0 && suggestedCount >= totalPeers;
  const progressPercent = totalPeers > 0 ? Math.round((suggestedCount / totalPeers) * 100) : 0;

  if (!settingsLoading && !weekSettings?.peerGoalsEnabled) {
    return (
      <div className="peer-goals-container" style={{ paddingTop: '3rem' }}>
        <div className="glass-panel" style={{ padding: '3.5rem 2rem', textAlign: 'center', borderRadius: '16px', maxWidth: '640px', margin: '2rem auto' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ marginBottom: '0.75rem', fontSize: '1.6rem' }}>Peer Goals Feature Inactive</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '2rem' }}>
            Peer goal suggestions are currently disabled by the Admin for cycle <strong>{currentWeekId}</strong>. When activated, you will be able to view member skills and assign goals here.
          </p>
          <Link to="/dashboard" className="btn btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '10px' }}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="peer-goals-container">
      {/* Header */}
      <div className="peer-header">
        <div className="peer-title-wrap">
          <h1>Community Members & Goal Assignments</h1>
          <p className="peer-subtitle">
            Review your peers' specialized skills and assign 1 actionable goal for each member in your Space.
          </p>
        </div>
      </div>

      {/* Mandatory Suggestion Progress Banner */}
      <div className="peer-progress-banner">
        <div className="peer-progress-info">
          <div className="peer-progress-icon">
            <FiTarget />
          </div>
          <div className="peer-progress-text">
            <h4>
              Weekly Suggestion Tracker: {suggestedCount} of {totalPeers} Peers Assigned
            </h4>
            <p>
              {isAllSuggested ? (
                <span style={{ color: '#10b981', fontWeight: 600 }}>
                  ✓ Outstanding! You have suggested goals for every peer. Your Goals Inbox acceptance is unlocked!
                </span>
              ) : (
                <span>
                  You must assign 1 goal to <strong>every</strong> member in your Space before accepting your own goals.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="peer-progress-bar-wrap">
          <div className="peer-progress-bar-bg">
            <div
              className="peer-progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
            <span>{progressPercent}% Complete</span>
            <span>{Math.max(0, totalPeers - suggestedCount)} Remaining</span>
          </div>
        </div>
      </div>

      {/* Members Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading community members...
        </div>
      ) : members.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', borderRadius: '16px' }}>
          <FiAlertCircle size={36} style={{ color: 'var(--warning)', marginBottom: '1rem' }} />
          <h3>No Active Peers Found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            There are currently no other active members in your Space to assign goals to.
          </p>
        </div>
      ) : (
        <div className="members-grid">
          {members.map((member) => {
            const hasAssigned = !!mySuggestions[member.id];
            const memberSkills = Array.isArray(member.skills) ? member.skills : [];

            return (
              <div key={member.id} className="member-card">
                <div>
                  <div className="member-card-top">
                    {member.profilePicUrl ? (
                      <img src={member.profilePicUrl} alt={member.name} className="member-avatar" />
                    ) : (
                      <div className="member-avatar-placeholder">
                        {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
                      </div>
                    )}
                    <div className="member-info">
                      <h3>{member.name}</h3>
                      <p className="member-role">{member.profession || 'Circle Member'}</p>
                    </div>
                  </div>

                  {/* Skills Section */}
                  <div className="member-skills-wrap">
                    <span className="skills-label">Specializations & Skills</span>
                    {memberSkills.length > 0 ? (
                      <div className="skills-tags">
                        {memberSkills.map((skill, idx) => (
                          <span key={idx} className="skill-tag">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="no-skills-hint">No specific skills listed yet</div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="member-card-footer">
                  <button
                    onClick={() => handleOpenSuggestModal(member)}
                    className={`btn-suggest ${hasAssigned ? 'btn btn-secondary' : 'btn btn-primary'}`}
                    style={
                      hasAssigned
                        ? { background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }
                        : {}
                    }
                  >
                    {hasAssigned ? (
                      <>
                        <FiCheck size={16} /> Goal Assigned (Edit)
                      </>
                    ) : (
                      <>
                        <FiPlus size={16} /> Assign Goal
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Suggest Goal Modal */}
      {modalOpen && selectedMember && (
        <div className="peer-modal-overlay" onClick={handleCloseModal}>
          <div className="peer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="peer-modal-header">
              <h2>{mySuggestions[selectedMember.id] ? 'Edit Assigned Goal' : 'Suggest Goal for Member'}</h2>
              <button onClick={handleCloseModal} className="modal-close-btn" aria-label="Close">
                <FiX />
              </button>
            </div>

            {/* Target Member Banner */}
            <div className="modal-member-preview">
              {selectedMember.profilePicUrl ? (
                <img
                  src={selectedMember.profilePicUrl}
                  alt={selectedMember.name}
                  style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}
                >
                  {selectedMember.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{selectedMember.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Skills: {selectedMember.skills?.join(', ') || 'General execution'}
                </div>
              </div>
            </div>

            {statusMsg && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {statusMsg}
              </div>
            )}

            <form onSubmit={handleSubmitSuggestion}>
              <div className="input-group">
                <label>Goal Title *</label>
                <input
                  type="text"
                  className="input-field"
                  required
                  placeholder="e.g. Build interactive onboarding modal in React"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label>Goal Description</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="Explain why this goal is valuable and what key milestones should be hit..."
                  value={goalDescription}
                  onChange={(e) => setGoalDescription(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label>What They Should Deliver (Acceptance Criteria) *</label>
                <textarea
                  className="input-field"
                  rows={2}
                  required
                  placeholder="e.g. Live preview link or GitHub PR with responsive test video"
                  value={deliverable}
                  onChange={(e) => setDeliverable(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={handleCloseModal} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 2 }}>
                  {isSubmitting ? 'Saving...' : mySuggestions[selectedMember.id] ? 'Update Assignment' : 'Assign Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
