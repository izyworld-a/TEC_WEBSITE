import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getWeekId } from '../utils/weekUtils';
import { FiInbox, FiSend, FiCheckSquare, FiSquare, FiCheck, FiRefreshCw, FiAlertTriangle, FiArrowRight, FiExternalLink, FiClock } from 'react-icons/fi';
import './peerGoals.css';

export default function GoalsInboxPage({ user, userData }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('received'); // 'received' | 'sent'
  const [receivedGoals, setReceivedGoals] = useState([]);
  const [sentGoals, setSentGoals] = useState([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [currentWeekId] = useState(() => getWeekId(new Date()));
  const [weekSettings, setWeekSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  
  // Mandatory Suggestion Lock State
  const [allPeersCount, setAllPeersCount] = useState(0);
  const [mySuggestionsCount, setMySuggestionsCount] = useState(0);

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

  // Review Modal State (for tab 'sent')
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingGoal, setReviewingGoal] = useState(null);
  const [reviewVerdict, setReviewVerdict] = useState('approved');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // 1. Fetch total peers in space to enforce suggestion lock
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      let count = 0;
      snap.forEach((d) => {
        const data = d.data();
        if (d.id !== user.uid && data.status !== 'Pending') count++;
      });
      setAllPeersCount(count);
    }, (err) => {
      console.error('Error fetching peers count:', err);
    });
    return () => unsub();
  }, [user]);

  // 2. Fetch how many suggestions user has made this week
  useEffect(() => {
    if (!user || !currentWeekId) return;
    const qMySuggestions = query(
      collection(db, 'suggested_goals'),
      where('fromUserId', '==', user.uid),
      where('weekId', '==', currentWeekId)
    );
    const unsub = onSnapshot(qMySuggestions, (snap) => {
      setMySuggestionsCount(snap.size);
    }, (err) => {
      console.error('Error fetching my suggestions count:', err);
    });
    return () => unsub();
  }, [user, currentWeekId]);

  // 3. Fetch goals suggested TO me for the current week
  useEffect(() => {
    if (!user || !currentWeekId) return;
    const qReceived = query(
      collection(db, 'suggested_goals'),
      where('toUserId', '==', user.uid),
      where('weekId', '==', currentWeekId)
    );

    const unsub = onSnapshot(qReceived, (snap) => {
      const list = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setReceivedGoals(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching received goals:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [user, currentWeekId]);

  // 4. Fetch goals I suggested to others for current week
  useEffect(() => {
    if (!user || !currentWeekId) return;
    const qSent = query(
      collection(db, 'suggested_goals'),
      where('fromUserId', '==', user.uid),
      where('weekId', '==', currentWeekId)
    );

    const unsub = onSnapshot(qSent, (snap) => {
      const list = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setSentGoals(list);
    }, (err) => {
      console.error('Error fetching sent goals:', err);
    });

    return () => unsub();
  }, [user, currentWeekId]);

  // Toggle selection
  const handleToggleSelect = (goalId) => {
    const updated = new Set(selectedGoalIds);
    if (updated.has(goalId)) {
      updated.delete(goalId);
    } else {
      updated.add(goalId);
    }
    setSelectedGoalIds(updated);
  };

  const isSuggestionObligationFulfilled = allPeersCount === 0 || mySuggestionsCount >= allPeersCount;
  const hasMinimumSelection = selectedGoalIds.size >= 2;

  // Accept Selected Goals
  const handleAcceptGoals = async () => {
    if (!isSuggestionObligationFulfilled) {
      alert(`You must suggest 1 goal for each peer in your space first (${mySuggestionsCount}/${allPeersCount} completed).`);
      return;
    }

    if (!hasMinimumSelection) {
      alert('Please select a minimum of 2 goals to commit to for this week.');
      return;
    }

    setAccepting(true);

    try {
      const selectedList = receivedGoals.filter((g) => selectedGoalIds.has(g.id));

      // Construct tasks array for weekly_goals
      const tasks = selectedList.map((g, index) => ({
        id: index + 1,
        suggestedGoalId: g.id,
        title: g.title,
        description: g.description || '',
        deliverable: g.deliverable || '',
        suggestedBy: {
          uid: g.fromUserId,
          name: g.fromUserName,
          photo: g.fromUserPhoto || ''
        },
        status: 'todo', // 'todo' | 'in_progress' | 'submitted' | 'completed'
        proofText: '',
        proofImage: '',
        proofType: 'image',
        revisionNotes: '',
        reviews: []
      }));

      const weeklyGoalDocRef = doc(db, 'weekly_goals', `${user.uid}_${currentWeekId}`);

      await setDoc(
        weeklyGoalDocRef,
        {
          userId: user.uid,
          userName: userData?.name || 'Member',
          userEmail: user.email,
          weekId: currentWeekId,
          isPeerGoalWeek: true,
          tasks,
          weeklyPoints: 0,
          status: 'Active',
          goalsSubmittedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      // Update suggested_goals statuses to 'accepted'
      for (const g of selectedList) {
        await updateDoc(doc(db, 'suggested_goals', g.id), {
          status: 'accepted',
          acceptedAt: serverTimestamp()
        });
      }

      alert('🎉 Goals accepted! Your Active Goals Kanban board is now ready.');
      navigate('/dashboard');
    } catch (err) {
      console.error('Error accepting goals:', err);
      alert('Failed to accept goals: ' + (err.message || 'Unknown error'));
    } finally {
      setAccepting(false);
    }
  };

  // Peer Review Handlers (for goals I suggested to others)
  const handleOpenReviewModal = (goal, verdict) => {
    setReviewingGoal(goal);
    setReviewVerdict(verdict);
    setReviewComment('');
    setReviewModalOpen(true);
  };

  const handleSubmitPeerReview = async (e) => {
    e.preventDefault();
    if (!reviewingGoal) return;

    setSubmittingReview(true);
    try {
      const targetUserId = reviewingGoal.toUserId;
      const targetWeeklyGoalRef = doc(db, 'weekly_goals', `${targetUserId}_${currentWeekId}`);
      const snap = await getDoc(targetWeeklyGoalRef);

      if (snap.exists()) {
        const data = snap.data();
        const updatedTasks = (data.tasks || []).map((t) => {
          if (t.suggestedGoalId === reviewingGoal.id || t.title === reviewingGoal.title) {
            return {
              ...t,
              status: reviewVerdict === 'approved' ? 'completed' : 'in_progress',
              revisionNotes: reviewVerdict === 'revision_requested' ? reviewComment.trim() : '',
              reviews: [
                ...(t.reviews || []),
                {
                  reviewerUid: user.uid,
                  reviewerName: userData?.name || 'Suggester',
                  verdict: reviewVerdict,
                  comment: reviewComment.trim(),
                  reviewedAt: new Date().toISOString()
                }
              ]
            };
          }
          return t;
        });

        await updateDoc(targetWeeklyGoalRef, {
          tasks: updatedTasks,
          updatedAt: serverTimestamp()
        });
      }

      // Also update suggested_goals doc
      await updateDoc(doc(db, 'suggested_goals', reviewingGoal.id), {
        executionStatus: reviewVerdict === 'approved' ? 'completed' : 'in_progress',
        lastReview: {
          verdict: reviewVerdict,
          comment: reviewComment.trim(),
          reviewedAt: new Date().toISOString()
        }
      });

      alert(
        reviewVerdict === 'approved'
          ? '✓ Goal approved successfully!'
          : '↺ Revision requested. The goal has been sent back to In Progress.'
      );

      setReviewModalOpen(false);
      setReviewingGoal(null);
    } catch (err) {
      console.error('Error submitting review:', err);
      alert('Error submitting review: ' + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!settingsLoading && !weekSettings?.peerGoalsEnabled) {
    return (
      <div className="peer-goals-container" style={{ paddingTop: '3rem' }}>
        <div className="glass-panel" style={{ padding: '3.5rem 2rem', textAlign: 'center', borderRadius: '16px', maxWidth: '640px', margin: '2rem auto' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📬</div>
          <h2 style={{ marginBottom: '0.75rem', fontSize: '1.6rem' }}>Goals Inbox Inactive</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '2rem' }}>
            Peer goal suggestions are currently disabled by the Admin for cycle <strong>{currentWeekId}</strong>. Your regular weekly goals are active on your Dashboard.
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
          <h1>Goals Inbox & Peer Reviews</h1>
          <p className="peer-subtitle">
            Review the goals assigned to you, commit to your weekly tasks, and verify deliverables for goals you suggested to peers.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="inbox-tabs">
        <button
          onClick={() => setActiveTab('received')}
          className={`inbox-tab-btn ${activeTab === 'received' ? 'active' : ''}`}
        >
          <FiInbox size={18} />
          Goals Suggested TO Me ({receivedGoals.length})
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`inbox-tab-btn ${activeTab === 'sent' ? 'active' : ''}`}
        >
          <FiSend size={18} />
          Goals I Suggested to Others ({sentGoals.length})
        </button>
      </div>

      {/* TAB 1: RECEIVED GOALS */}
      {activeTab === 'received' && (
        <>
          {/* Lockout Warning if Suggestions Incomplete */}
          {!isSuggestionObligationFulfilled && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '14px',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                color: 'var(--warning)'
              }}
            >
              <FiAlertTriangle size={24} style={{ flexShrink: 0 }} />
              <div>
                <strong>Mandatory Suggestion Requirement:</strong> You have assigned goals to{' '}
                <strong>{mySuggestionsCount} of {allPeersCount}</strong> peers. You must assign 1 goal to every member in
                your Space on the{' '}
                <a href="/members" style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 'bold' }}>
                  Members Page
                </a>{' '}
                before you can accept your active goals.
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Loading suggested goals...
            </div>
          ) : receivedGoals.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', borderRadius: '16px' }}>
              <FiInbox size={40} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
              <h3>No Goals In Your Inbox Yet</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Peers have not suggested any goals for you yet for this cycle ({currentWeekId}).
              </p>
            </div>
          ) : (
            <>
              <div className="inbox-grid">
                {receivedGoals.map((goal) => {
                  const isSelected = selectedGoalIds.has(goal.id);
                  return (
                    <div
                      key={goal.id}
                      className={`inbox-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleSelect(goal.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="inbox-card-top">
                        <div className="suggester-info">
                          {goal.fromUserPhoto ? (
                            <img src={goal.fromUserPhoto} alt={goal.fromUserName} className="suggester-avatar" />
                          ) : (
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'var(--primary)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.8rem',
                                fontWeight: 'bold'
                              }}
                            >
                              {goal.fromUserName?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="suggester-name">{goal.fromUserName}</div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Assigned to you</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '1.3rem', color: isSelected ? 'var(--primary)' : 'var(--text-secondary)' }}>
                          {isSelected ? <FiCheckSquare /> : <FiSquare />}
                        </div>
                      </div>

                      <h3 className="inbox-goal-title">{goal.title}</h3>
                      {goal.description && <p className="inbox-goal-desc">{goal.description}</p>}

                      <div className="inbox-deliverable-box">
                        <span className="inbox-deliverable-label">What You Must Deliver:</span>
                        <p className="inbox-deliverable-content">{goal.deliverable}</p>
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            background: isSelected ? 'rgba(79, 70, 229, 0.15)' : 'rgba(0,0,0,0.05)',
                            color: isSelected ? 'var(--primary)' : 'var(--text-secondary)'
                          }}
                        >
                          {isSelected ? '✓ Selected for Week' : 'Click to select'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sticky Acceptance Bar */}
              <div className="inbox-sticky-footer">
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>
                    Selected: {selectedGoalIds.size} Goal{selectedGoalIds.size === 1 ? '' : 's'} (Minimum 2 required)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {!hasMinimumSelection
                      ? `Select at least ${2 - selectedGoalIds.size} more goal(s)`
                      : 'Ready to commit for this weekly cycle'}
                  </div>
                </div>

                <button
                  onClick={handleAcceptGoals}
                  disabled={!hasMinimumSelection || !isSuggestionObligationFulfilled || accepting}
                  className="btn btn-primary"
                  style={{
                    padding: '0.75rem 1.75rem',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: !hasMinimumSelection || !isSuggestionObligationFulfilled ? 0.5 : 1
                  }}
                >
                  {accepting ? (
                    'Accepting...'
                  ) : (
                    <>
                      Accept Selected Goals <FiArrowRight />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* TAB 2: SENT GOALS & PEER REVIEW */}
      {activeTab === 'sent' && (
        <>
          {sentGoals.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', borderRadius: '16px' }}>
              <FiSend size={40} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
              <h3>No Goals Assigned Yet</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                You have not assigned any goals to peers yet this cycle. Visit the{' '}
                <a href="/members" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                  Members Page
                </a>{' '}
                to get started.
              </p>
            </div>
          ) : (
            <div className="inbox-grid">
              {sentGoals.map((goal) => {
                const executionStatus = goal.executionStatus || (goal.status === 'accepted' ? 'in_progress' : 'suggested');
                return (
                  <div key={goal.id} className="inbox-card">
                    <div className="inbox-card-top">
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Assigned to:</span>
                        <h4 style={{ margin: '0.1rem 0 0', fontSize: '0.95rem', fontWeight: '700' }}>
                          {goal.toUserName}
                        </h4>
                      </div>

                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '20px',
                          textTransform: 'uppercase',
                          background:
                            executionStatus === 'completed'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : executionStatus === 'submitted'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(99, 102, 241, 0.15)',
                          color:
                            executionStatus === 'completed'
                              ? '#10b981'
                              : executionStatus === 'submitted'
                              ? 'var(--warning)'
                              : 'var(--primary)'
                        }}
                      >
                        {executionStatus.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="inbox-goal-title">{goal.title}</h3>
                    {goal.description && <p className="inbox-goal-desc">{goal.description}</p>}

                    <div className="inbox-deliverable-box">
                      <span className="inbox-deliverable-label">Deliverable Expected:</span>
                      <p className="inbox-deliverable-content">{goal.deliverable}</p>
                    </div>

                    {/* Review Actions if Submitted */}
                    {executionStatus === 'submitted' && (
                      <div
                        style={{
                          marginTop: 'auto',
                          paddingTop: '0.85rem',
                          borderTop: '1px solid var(--border)',
                          display: 'flex',
                          gap: '0.5rem'
                        }}
                      >
                        <button
                          onClick={() => handleOpenReviewModal(goal, 'approved')}
                          className="btn btn-secondary"
                          style={{
                            flex: 1,
                            background: 'rgba(16, 185, 129, 0.15)',
                            borderColor: '#10b981',
                            color: '#10b981',
                            fontSize: '0.8rem',
                            padding: '0.5rem'
                          }}
                        >
                          <FiCheck /> Approve
                        </button>
                        <button
                          onClick={() => handleOpenReviewModal(goal, 'revision_requested')}
                          className="btn btn-secondary"
                          style={{
                            flex: 1,
                            background: 'rgba(239, 68, 68, 0.15)',
                            borderColor: 'var(--danger)',
                            color: 'var(--danger)',
                            fontSize: '0.8rem',
                            padding: '0.5rem'
                          }}
                        >
                          <FiRefreshCw /> Request Revision
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Review Modal */}
      {reviewModalOpen && reviewingGoal && (
        <div className="peer-modal-overlay" onClick={() => setReviewModalOpen(false)}>
          <div className="peer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="peer-modal-header">
              <h2>{reviewVerdict === 'approved' ? 'Approve Deliverable' : 'Request Revision'}</h2>
              <button onClick={() => setReviewModalOpen(false)} className="modal-close-btn">
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Goal: <strong>{reviewingGoal.title}</strong> (submitted by {reviewingGoal.toUserName})
            </p>

            <form onSubmit={handleSubmitPeerReview}>
              <div className="input-group">
                <label>{reviewVerdict === 'approved' ? 'Approval Comments (Optional)' : 'What needs to be revised? *'}</label>
                <textarea
                  className="input-field"
                  rows={3}
                  required={reviewVerdict === 'revision_requested'}
                  placeholder={
                    reviewVerdict === 'approved'
                      ? 'Great execution, delivered as expected!'
                      : 'Please fix the responsive view and provide the updated link...'
                  }
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="btn btn-primary"
                  style={{
                    flex: 2,
                    background: reviewVerdict === 'approved' ? '#10b981' : 'var(--danger)',
                    borderColor: reviewVerdict === 'approved' ? '#10b981' : 'var(--danger)'
                  }}
                >
                  {submittingReview
                    ? 'Submitting...'
                    : reviewVerdict === 'approved'
                    ? 'Confirm Approval'
                    : 'Send Revision Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
