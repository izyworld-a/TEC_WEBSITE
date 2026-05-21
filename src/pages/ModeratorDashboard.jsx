import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, query, onSnapshot, doc, updateDoc,
  setDoc, increment, where, getDoc
} from 'firebase/firestore';
import { FiCheckCircle, FiXCircle, FiAlertCircle } from 'react-icons/fi';
import { getWeekId } from '../utils/weekUtils';

export default function ModeratorDashboard({ user, userData }) {
  const [goalDocs, setGoalDocs] = useState([]);
  const [weekSettings, setWeekSettings] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get current weekId (Mon–Sun)
  const currentWeekId = getWeekId(new Date());

  // Check if this user is the current moderator
  useEffect(() => {
    if (!user) return;
    const unsubSettings = onSnapshot(doc(db, 'week_settings', currentWeekId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setWeekSettings(data);
        setIsAuthorized(data.moderatorUserId === user.uid || userData?.isAdmin === true);
      }
      setLoading(false);
    });
    return () => unsubSettings();
  }, [user, currentWeekId, userData]);

  // Fetch all goal docs
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'weekly_goals')), (snap) => {
      setGoalDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const pendingGoals = goalDocs.filter(
    g => g.weekId === currentWeekId && (g.reviewStatus === 'pending' || g.reviewStatus === 'in_review')
  );

  const handleModeratorApprove = async (goalDoc, taskIndex) => {
    const task = goalDoc.tasks[taskIndex];
    if (task.reviewed || task.moderatorReviewed) return;

    const updatedTasks = goalDoc.tasks.map((t, i) =>
      i === taskIndex
        ? { ...t, moderatorReviewed: true, moderatorAction: 'approved', moderatorId: user.uid, moderatorName: userData?.name || 'Moderator' }
        : t
    );

    const allModReviewed = updatedTasks.every(t => t.reviewed || t.moderatorReviewed);

    await updateDoc(doc(db, 'weekly_goals', goalDoc.id), {
      tasks: updatedTasks,
      reviewStatus: allModReviewed ? 'mod_reviewed' : 'in_review',
    });
  };

  const handleModeratorReject = async (goalDoc, taskIndex) => {
    const task = goalDoc.tasks[taskIndex];
    if (task.reviewed || task.moderatorReviewed) return;

    const reason = prompt('Enter rejection reason (visible to the user):');
    if (reason === null) return;

    const updatedTasks = goalDoc.tasks.map((t, i) =>
      i === taskIndex
        ? {
            ...t,
            moderatorReviewed: false,
            moderatorAction: 'rejected',
            moderatorId: user.uid,
            moderatorName: userData?.name || 'Moderator',
            rejectionReason: reason || 'Proof insufficient.',
            rejectionCount: (t.rejectionCount || 0) + 1
          }
        : t
    );

    await updateDoc(doc(db, 'weekly_goals', goalDoc.id), {
      tasks: updatedTasks,
      reviewStatus: 'in_review',
    });
  };

  if (loading) return <div className="loader-container"><div className="loader" /></div>;

  if (!isAuthorized) {
    return (
      <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h2>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            You are not assigned as the weekly moderator. Contact the admin if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '1.5rem 2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>👤</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>Moderator Review Panel</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            You are the moderator for <strong>{currentWeekId}</strong>. Review and verify task proofs below.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{pendingGoals.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pending Reviews</div>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '2rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
        <strong style={{ color: 'var(--primary)' }}>📋 Moderator Guidelines:</strong><br />
        • Review the task description and submitted proof (image or link).<br />
        • Click <strong>✓ Approve</strong> if proof is valid. Final point awards are done by the Admin.<br />
        • Click <strong>✗ Reject</strong> to flag a proof as insufficient — you'll be asked for a reason.<br />
        • Already admin-reviewed tasks (locked) cannot be changed.
      </div>

      {pendingGoals.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✅</div>
          <h3>All caught up!</h3>
          <p>No pending goal submissions to review for {currentWeekId}.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {pendingGoals.map(g => (
            <div key={g.id} className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {g.profilePicUrl ? (
                    <img src={g.profilePicUrl} alt={g.userName} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                      {g.userName?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <strong style={{ fontSize: '1rem' }}>{g.userName || g.userId}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Week: {g.weekId}</div>
                  </div>
                </div>
                <span style={{
                  padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                  background: g.reviewStatus === 'mod_reviewed' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                  color: g.reviewStatus === 'mod_reviewed' ? '#10b981' : 'var(--warning)'
                }}>
                  {g.reviewStatus === 'mod_reviewed' ? '✓ Mod Reviewed' : '⏳ In Review'}
                </span>
              </div>

              {/* Tasks */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Task</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Proof</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Mod Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(g.tasks || []).map((task, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)', opacity: task.reviewed ? 0.55 : 1 }}>
                        <td style={{ padding: '0.75rem 1rem', maxWidth: '260px', fontSize: '0.875rem' }}>{task.description || '—'}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                            background: task.status === 'Completed' ? 'rgba(16,185,129,0.15)' : task.status === 'Not Completed' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            color: task.status === 'Completed' ? '#10b981' : task.status === 'Not Completed' ? 'var(--danger)' : 'var(--warning)'
                          }}>
                            {task.status || 'Pending'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {task.proofImage
                            ? <a href={task.proofImage} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>📷 View Image</a>
                            : task.proofText
                              ? <a href={task.proofText.startsWith('http') ? task.proofText : `https://${task.proofText}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>🔗 View Link</a>
                              : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No proof</span>
                          }
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {task.reviewed ? (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Admin locked</span>
                          ) : task.moderatorReviewed || task.moderatorAction === 'approved' ? (
                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 'bold', background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                              ✓ Approved by {task.moderatorName || 'Mod'}
                            </span>
                          ) : task.moderatorAction === 'rejected' ? (
                            <div>
                              <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 'bold', background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', display: 'block', marginBottom: '0.3rem' }}>
                                ✗ Rejected
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{task.rejectionReason}</span>
                            </div>
                          ) : (
                            task.status === 'Completed' && (task.proofImage || task.proofText) ? (
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <button className="btn btn-primary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleModeratorApprove(g, idx)}>
                                  <FiCheckCircle size={12} /> Approve
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }} onClick={() => handleModeratorReject(g, idx)}>
                                  <FiXCircle size={12} /> Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                {task.status === 'Not Completed' ? 'Not applicable' : 'Awaiting proof'}
                              </span>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
