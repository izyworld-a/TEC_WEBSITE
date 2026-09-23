import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { uploadToCloudinary } from '../cloudinary';
import {
  FiClock,
  FiPlay,
  FiUploadCloud,
  FiCheckCircle,
  FiExternalLink,
  FiImage,
  FiFileText,
  FiAlertCircle,
  FiUserCheck,
  FiCheck
} from 'react-icons/fi';
import '../pages/peerGoals.css';

export default function ActiveGoalsKanban({ user, userData, currentWeekId, weeklyGoalsDoc, weekSettings, onGoalsUpdated }) {
  const [tasks, setTasks] = useState(weeklyGoalsDoc?.tasks || []);
  const [timeLeft, setTimeLeft] = useState({ days: 7, hours: 0, minutes: 0, seconds: 0 });
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Proof form state
  const [proofType, setProofType] = useState('image'); // 'image' | 'link' | 'file'
  const [proofUrl, setProofUrl] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync tasks when doc updates
  useEffect(() => {
    if (weeklyGoalsDoc?.tasks) {
      setTasks(weeklyGoalsDoc.tasks);
    }
  }, [weeklyGoalsDoc?.tasks]);

  // 7-Day Countdown Timer
  useEffect(() => {
    const calculateCountdown = () => {
      let targetTime;
      if (weekSettings?.completionDeadline) {
        targetTime = new Date(weekSettings.completionDeadline).getTime();
      } else if (weeklyGoalsDoc?.goalsSubmittedAt) {
        const submittedDate = weeklyGoalsDoc.goalsSubmittedAt?.toDate
          ? weeklyGoalsDoc.goalsSubmittedAt.toDate()
          : new Date(weeklyGoalsDoc.goalsSubmittedAt);
        targetTime = submittedDate.getTime() + 7 * 24 * 60 * 60 * 1000;
      } else {
        // Fallback: 7 days from now
        targetTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
      }

      const diff = targetTime - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, expired: false });
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [weekSettings?.completionDeadline, weeklyGoalsDoc?.goalsSubmittedAt]);

  // Save updated tasks array to Firestore
  const saveTasksToFirestore = async (newTasks) => {
    try {
      const goalDocRef = doc(db, 'weekly_goals', `${user.uid}_${currentWeekId}`);
      await updateDoc(goalDocRef, {
        tasks: newTasks,
        updatedAt: serverTimestamp()
      });
      setTasks(newTasks);
      if (onGoalsUpdated) onGoalsUpdated(newTasks);
    } catch (err) {
      console.error('Error updating tasks in Kanban:', err);
      alert('Failed to update goal status. Please try again.');
    }
  };

  // Move goal from To Do to In Progress
  const handleStartTask = (taskId) => {
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, status: 'in_progress' };
      }
      return t;
    });
    saveTasksToFirestore(updated);
  };

  // Open Proof Modal
  const handleOpenProofModal = (task) => {
    setSelectedTask(task);
    setProofType(task.proofType || 'image');
    setProofUrl(task.proofUrl || task.proofImage || '');
    setProofNotes(task.proofText || '');
    setErrorMsg('');
    setUploadProgress(0);
    setProofModalOpen(true);
  };

  // Handle File Upload to Cloudinary
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');
    try {
      const secureUrl = await uploadToCloudinary(file, 'tec-weekly/proofs', (pct) => {
        setUploadProgress(pct);
      });
      setProofUrl(secureUrl);
    } catch (err) {
      console.error('Cloudinary upload failed:', err);
      setErrorMsg(err.message || 'File upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  // Submit Proof
  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!proofUrl.trim()) {
      setErrorMsg('Please upload an image/file or provide a valid proof link.');
      return;
    }

    const updated = tasks.map((t) => {
      if (t.id === selectedTask.id) {
        return {
          ...t,
          status: 'submitted',
          proofType,
          proofUrl: proofUrl.trim(),
          proofImage: proofType === 'image' ? proofUrl.trim() : '',
          proofText: proofNotes.trim(),
          submittedAt: new Date().toISOString(),
          revisionNotes: '' // clear any previous revision notes
        };
      }
      return t;
    });

    await saveTasksToFirestore(updated);

    // Also update executionStatus in suggested_goals if id matches
    if (selectedTask.suggestedGoalId) {
      try {
        await updateDoc(doc(db, 'suggested_goals', selectedTask.suggestedGoalId), {
          executionStatus: 'submitted',
          proofUrl: proofUrl.trim(),
          proofNotes: proofNotes.trim()
        });
      } catch (_) {}
    }

    setProofModalOpen(false);
    setSelectedTask(null);
  };

  // Categorize tasks into columns
  const todoTasks = tasks.filter((t) => !t.status || t.status === 'todo');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const submittedTasks = tasks.filter((t) => t.status === 'submitted');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Kanban Header Bar with 7-Day Countdown */}
      <div className="kanban-header-bar">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Active Goals Execution Board</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Track your weekly committed goals across each stage of review and verification.
          </p>
        </div>

        <div className="kanban-timer">
          <FiClock size={18} />
          <span>
            {timeLeft.expired ? (
              <span style={{ color: 'var(--danger)' }}>CYCLE EXPIRED</span>
            ) : (
              `${timeLeft.days}d ${String(timeLeft.hours).padStart(2, '0')}h ${String(timeLeft.minutes).padStart(
                2,
                '0'
              )}m ${String(timeLeft.seconds).padStart(2, '0')}s`
            )}
          </span>
        </div>
      </div>

      {/* 4-Column Board */}
      <div className="kanban-board">
        {/* COLUMN 1: TO DO */}
        <div className="kanban-column">
          <div className="kanban-column-header">
            <div className="kanban-column-title">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8' }}></span>
              To Do
            </div>
            <span className="kanban-column-count">{todoTasks.length}</span>
          </div>

          <div className="kanban-cards-list">
            {todoTasks.map((task) => (
              <div key={task.id} className="kanban-card">
                <h4 className="kanban-card-title">{task.title}</h4>
                {task.description && <p className="kanban-card-desc">{task.description}</p>}

                {task.deliverable && (
                  <div className="kanban-card-deliverable">
                    <strong>Deliverable:</strong> {task.deliverable}
                  </div>
                )}

                <div className="kanban-card-meta">
                  <span>From: {task.suggestedBy?.name || 'Peer'}</span>
                </div>

                <button
                  onClick={() => handleStartTask(task.id)}
                  className="btn btn-secondary"
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.45rem',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <FiPlay size={13} /> Start Working
                </button>
              </div>
            ))}
            {todoTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No goals in To Do
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: IN PROGRESS */}
        <div className="kanban-column">
          <div className="kanban-column-header">
            <div className="kanban-column-title">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }}></span>
              In Progress
            </div>
            <span className="kanban-column-count">{inProgressTasks.length}</span>
          </div>

          <div className="kanban-cards-list">
            {inProgressTasks.map((task) => (
              <div key={task.id} className="kanban-card">
                {/* Revision alert banner if sent back */}
                {task.revisionNotes && (
                  <div className="revision-alert-box">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                      <FiAlertCircle /> Revision Requested:
                    </div>
                    <div>"{task.revisionNotes}"</div>
                  </div>
                )}

                <h4 className="kanban-card-title">{task.title}</h4>
                {task.description && <p className="kanban-card-desc">{task.description}</p>}

                {task.deliverable && (
                  <div className="kanban-card-deliverable">
                    <strong>Deliverable:</strong> {task.deliverable}
                  </div>
                )}

                <div className="kanban-card-meta">
                  <span>From: {task.suggestedBy?.name || 'Peer'}</span>
                </div>

                <button
                  onClick={() => handleOpenProofModal(task)}
                  className="btn btn-primary"
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.45rem',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <FiUploadCloud size={14} /> Submit Proof
                </button>
              </div>
            ))}
            {inProgressTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No active tasks in progress
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: SUBMITTED */}
        <div className="kanban-column">
          <div className="kanban-column-header">
            <div className="kanban-column-title">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
              Submitted
            </div>
            <span className="kanban-column-count">{submittedTasks.length}</span>
          </div>

          <div className="kanban-cards-list">
            {submittedTasks.map((task) => (
              <div key={task.id} className="kanban-card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                <h4 className="kanban-card-title">{task.title}</h4>

                {/* Proof preview */}
                <div className="proof-attached-badge">
                  <FiCheckCircle /> Proof Evidence Attached
                </div>

                {task.proofType === 'image' && task.proofUrl && (
                  <a href={task.proofUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={task.proofUrl}
                      alt="Proof"
                      style={{
                        width: '100%',
                        maxHeight: '140px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        marginBottom: '0.6rem'
                      }}
                    />
                  </a>
                )}

                {task.proofType === 'link' && task.proofUrl && (
                  <a
                    href={task.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      marginBottom: '0.6rem',
                      width: 'fit-content'
                    }}
                  >
                    <FiExternalLink size={12} /> View Proof Link
                  </a>
                )}

                {task.proofText && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0 0 0.6rem' }}>
                    "{task.proofText}"
                  </p>
                )}

                <div className="kanban-card-meta">
                  <span>Awaiting review from {task.suggestedBy?.name || 'Suggester'}</span>
                </div>

                <div
                  style={{
                    marginTop: '0.6rem',
                    padding: '0.3rem 0.6rem',
                    background: 'rgba(245, 158, 11, 0.1)',
                    borderRadius: '6px',
                    color: 'var(--warning)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textAlign: 'center'
                  }}
                >
                  ⏳ Pending Peer Approval
                </div>
              </div>
            ))}
            {submittedTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No submissions waiting
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 4: COMPLETED */}
        <div className="kanban-column">
          <div className="kanban-column-header">
            <div className="kanban-column-title">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
              Completed
            </div>
            <span className="kanban-column-count">{completedTasks.length}</span>
          </div>

          <div className="kanban-cards-list">
            {completedTasks.map((task) => (
              <div key={task.id} className="kanban-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                <h4 className="kanban-card-title">{task.title}</h4>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: '#10b981',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    margin: '0.4rem 0'
                  }}
                >
                  <FiCheck size={16} /> Approved & Verified
                </div>

                {task.proofUrl && (
                  <a
                    href={task.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'underline' }}
                  >
                    View Verified Proof
                  </a>
                )}

                <div className="kanban-card-meta">
                  <span>Assigned by: {task.suggestedBy?.name || 'Peer'}</span>
                </div>
              </div>
            ))}
            {completedTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No completed goals yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Proof Submission Modal */}
      {proofModalOpen && selectedTask && (
        <div className="peer-modal-overlay" onClick={() => setProofModalOpen(false)}>
          <div className="peer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="peer-modal-header">
              <h2>Submit Proof of Work</h2>
              <button onClick={() => setProofModalOpen(false)} className="modal-close-btn">
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Goal: <strong>{selectedTask.title}</strong>
            </p>

            {errorMsg && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitProof}>
              {/* Proof Type Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setProofType('image')}
                  className={`btn ${proofType === 'image' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <FiImage /> Image / Screenshot
                </button>
                <button
                  type="button"
                  onClick={() => setProofType('link')}
                  className={`btn ${proofType === 'link' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <FiExternalLink /> Live Link / URL
                </button>
                <button
                  type="button"
                  onClick={() => setProofType('file')}
                  className={`btn ${proofType === 'file' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <FiFileText /> Document / File
                </button>
              </div>

              {/* Upload or Link Input */}
              {proofType === 'link' ? (
                <div className="input-group">
                  <label>Proof URL (GitHub, Figma, Google Drive, Loom, YouTube) *</label>
                  <input
                    type="url"
                    className="input-field"
                    required
                    placeholder="https://..."
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                  />
                </div>
              ) : (
                <div className="input-group">
                  <label>Upload File / Image (Cloudinary) *</label>
                  <input
                    type="file"
                    className="input-field"
                    accept={proofType === 'image' ? 'image/*' : '*/*'}
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  {isUploading && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.4rem' }}>
                      Uploading to cloud... {uploadProgress}%
                    </div>
                  )}
                  {proofUrl && !isUploading && (
                    <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '0.4rem' }}>
                      ✓ File successfully uploaded and attached!
                    </div>
                  )}
                </div>
              )}

              <div className="input-group">
                <label>Summary / Notes (Optional)</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Describe your execution or mention any key milestones..."
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setProofModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  Submit for Peer Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
