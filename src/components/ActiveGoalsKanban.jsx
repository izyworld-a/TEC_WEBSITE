import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Drag and drop interaction state
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

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

  // Accessible Escape key listener for proof modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && proofModalOpen) {
        setProofModalOpen(false);
        setSelectedTask(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [proofModalOpen]);

  // Save updated tasks array to Firestore
  const saveTasksToFirestore = async (newTasks) => {
    try {
      const docId = weeklyGoalsDoc?.id || `${user.uid}_${currentWeekId}`;
      const goalDocRef = doc(db, 'weekly_goals', docId);
      await setDoc(goalDocRef, {
        tasks: newTasks,
        userId: user?.uid,
        userName: userData?.name || user?.displayName || user?.email || 'Member',
        profilePicUrl: userData?.profilePicUrl || user?.photoURL || '',
        updatedAt: serverTimestamp()
      }, { merge: true });
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

  // Drag and drop handlers
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== columnId) {
      setDragOverCol(columnId);
    }
  };

  const handleDragLeave = (e, columnId) => {
    if (dragOverCol === columnId) {
      setDragOverCol(null);
    }
  };

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentStatus = task.status || 'todo';
    if (currentStatus === targetColumnId) return;

    if (targetColumnId === 'todo') {
      if (currentStatus === 'in_progress') {
        const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: 'todo' } : t));
        saveTasksToFirestore(updated);
      }
    } else if (targetColumnId === 'in_progress') {
      handleStartTask(taskId);
    } else if (targetColumnId === 'submitted') {
      handleOpenProofModal(task);
    } else if (targetColumnId === 'completed') {
      alert('Goals are marked as Completed once verified by your peer or admin reviewer.');
    }
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

    // Trigger subtle celebratory confetti on proof submission
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (_) {}

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
      {/* Kanban Header Bar */}
      <div className="kanban-header-bar">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Active Goals Execution Board</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Drag cards or click action buttons to progress your weekly committed goals across each stage.
          </p>
        </div>

        <div className="kanban-timer" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}>
          <FiCheckCircle size={17} />
          <span>Active Goal Cycle</span>
        </div>
      </div>

      {/* 4-Column Board */}
      <div className="kanban-board">
        {/* COLUMN 1: TO DO */}
        <div
          className={`kanban-column ${dragOverCol === 'todo' ? 'is-dragging-over' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'todo')}
          onDragLeave={(e) => handleDragLeave(e, 'todo')}
          onDrop={(e) => handleDrop(e, 'todo')}
        >
          <div className="kanban-column-header">
            <div className="kanban-column-title">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8' }}></span>
              To Do
            </div>
            <span className="kanban-column-count">{todoTasks.length}</span>
          </div>

          <div className="kanban-cards-list">
            <AnimatePresence mode="popLayout">
              {todoTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ y: -2 }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className="kanban-card"
                >
                  <h4 className="kanban-card-title">{task.title || task.description || 'Untitled Goal'}</h4>
                  {task.title && task.description && <p className="kanban-card-desc">{task.description}</p>}

                  {task.deliverable && (
                    <div className="kanban-card-deliverable">
                      <strong>Deliverable:</strong> {task.deliverable}
                    </div>
                  )}

                  <div className="kanban-card-meta">
                    <span>From: {task.suggestedBy?.name || 'Peer'}</span>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleStartTask(task.id)}
                    className="btn btn-secondary"
                    style={{
                      marginTop: '0.85rem',
                      minHeight: '40px',
                      padding: '0.5rem',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer'
                    }}
                  >
                    <FiPlay size={13} /> Start Working
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
            {todoTasks.length === 0 && (
              <div className="kanban-empty-state">
                <FiCheckCircle size={22} style={{ opacity: 0.4, color: '#94a3b8' }} />
                <span>No goals in To Do</span>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: IN PROGRESS */}
        <div
          className={`kanban-column ${dragOverCol === 'in_progress' ? 'is-dragging-over' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'in_progress')}
          onDragLeave={(e) => handleDragLeave(e, 'in_progress')}
          onDrop={(e) => handleDrop(e, 'in_progress')}
        >
          <div className="kanban-column-header">
            <div className="kanban-column-title">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }}></span>
              In Progress
            </div>
            <span className="kanban-column-count">{inProgressTasks.length}</span>
          </div>

          <div className="kanban-cards-list">
            <AnimatePresence mode="popLayout">
              {inProgressTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ y: -2 }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className="kanban-card"
                >
                  {/* Revision alert banner if sent back */}
                  {task.revisionNotes && (
                    <div className="revision-alert-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                        <FiAlertCircle /> Revision Requested:
                      </div>
                      <div>"{task.revisionNotes}"</div>
                    </div>
                  )}

                  <h4 className="kanban-card-title">{task.title || task.description || 'Untitled Goal'}</h4>
                  {task.title && task.description && <p className="kanban-card-desc">{task.description}</p>}

                  {task.deliverable && (
                    <div className="kanban-card-deliverable">
                      <strong>Deliverable:</strong> {task.deliverable}
                    </div>
                  )}

                  <div className="kanban-card-meta">
                    <span>From: {task.suggestedBy?.name || 'Peer'}</span>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOpenProofModal(task)}
                    className="btn btn-primary"
                    style={{
                      marginTop: '0.85rem',
                      minHeight: '40px',
                      padding: '0.5rem',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer'
                    }}
                  >
                    <FiUploadCloud size={14} /> Submit Proof
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
            {inProgressTasks.length === 0 && (
              <div className="kanban-empty-state">
                <FiPlay size={22} style={{ opacity: 0.4, color: '#6366f1' }} />
                <span>No active tasks in progress</span>
                <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Drag or click "Start Working" to begin</span>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: SUBMITTED */}
        <div
          className={`kanban-column ${dragOverCol === 'submitted' ? 'is-dragging-over' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'submitted')}
          onDragLeave={(e) => handleDragLeave(e, 'submitted')}
          onDrop={(e) => handleDrop(e, 'submitted')}
        >
          <div className="kanban-column-header">
            <div className="kanban-column-title">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
              Submitted
            </div>
            <span className="kanban-column-count">{submittedTasks.length}</span>
          </div>

          <div className="kanban-cards-list">
            <AnimatePresence mode="popLayout">
              {submittedTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ y: -2 }}
                  className="kanban-card"
                  style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}
                >
                  <h4 className="kanban-card-title">{task.title || task.description || 'Untitled Goal'}</h4>

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
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.78rem',
                        marginBottom: '0.6rem',
                        width: 'fit-content',
                        minHeight: '36px'
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
                      padding: '0.35rem 0.6rem',
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
                </motion.div>
              ))}
            </AnimatePresence>
            {submittedTasks.length === 0 && (
              <div className="kanban-empty-state">
                <FiUploadCloud size={22} style={{ opacity: 0.4, color: '#f59e0b' }} />
                <span>No submissions waiting</span>
                <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Submit proof once a task is complete</span>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 4: COMPLETED */}
        <div
          className={`kanban-column ${dragOverCol === 'completed' ? 'is-dragging-over' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'completed')}
          onDragLeave={(e) => handleDragLeave(e, 'completed')}
          onDrop={(e) => handleDrop(e, 'completed')}
        >
          <div className="kanban-column-header">
            <div className="kanban-column-title">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
              Completed
            </div>
            <span className="kanban-column-count">{completedTasks.length}</span>
          </div>

          <div className="kanban-cards-list">
            <AnimatePresence mode="popLayout">
              {completedTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ y: -2 }}
                  className="kanban-card"
                  style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}
                >
                  <h4 className="kanban-card-title">{task.title || task.description || 'Untitled Goal'}</h4>

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
                </motion.div>
              ))}
            </AnimatePresence>
            {completedTasks.length === 0 && (
              <div className="kanban-empty-state">
                <FiCheck size={22} style={{ opacity: 0.4, color: '#10b981' }} />
                <span>No completed goals yet</span>
                <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Verified goals will appear here</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Proof Submission Modal with Spring Animation */}
      <AnimatePresence>
        {proofModalOpen && selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="peer-modal-overlay"
            onClick={() => setProofModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="peer-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="peer-modal-header">
                <h2>Submit Proof of Work</h2>
                <button
                  onClick={() => setProofModalOpen(false)}
                  className="modal-close-btn"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Goal: <strong>{selectedTask.title || selectedTask.description || 'Goal'}</strong>
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
                    style={{ flex: 1, minHeight: '44px', padding: '0.5rem', fontSize: '0.85rem' }}
                  >
                    <FiImage /> Image / Screenshot
                  </button>
                  <button
                    type="button"
                    onClick={() => setProofType('link')}
                    className={`btn ${proofType === 'link' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, minHeight: '44px', padding: '0.5rem', fontSize: '0.85rem' }}
                  >
                    <FiExternalLink /> Live Link / URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setProofType('file')}
                    className={`btn ${proofType === 'file' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, minHeight: '44px', padding: '0.5rem', fontSize: '0.85rem' }}
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
                    style={{ flex: 1, minHeight: '44px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="btn btn-primary"
                    style={{ flex: 2, minHeight: '44px' }}
                  >
                    Submit for Peer Review
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
