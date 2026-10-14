import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { uploadToCloudinary } from '../cloudinary';
import { 
  FiPlus, 
  FiTrash2, 
  FiEdit2, 
  FiExternalLink, 
  FiUploadCloud, 
  FiCheckCircle, 
  FiAlertCircle, 
  FiTag, 
  FiX, 
  FiLayers,
  FiImage,
  FiDownload
} from 'react-icons/fi';
import { isVideoUrl } from '../cloudinary';

const MAX_WORKS = 6;

const CATEGORIES = [
  'Software & Web',
  'Product & Design',
  'Growth & Marketing',
  'Content & Writing',
  'Data & Operations',
  'Other'
];

export default function PortfolioManager({ user, userData }) {
  const [works, setWorks] = useState(userData?.portfolioWorks || []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkId, setEditingWorkId] = useState(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Software & Web');
  const [description, setDescription] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  // Upload & UI State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Goal Proofs Import State
  const [goalProofs, setGoalProofs] = useState([]);
  const [loadingProofs, setLoadingProofs] = useState(false);
  const [showProofImporter, setShowProofImporter] = useState(false);

  useEffect(() => {
    if (userData?.portfolioWorks) {
      setWorks(userData.portfolioWorks);
    }
  }, [userData?.portfolioWorks]);

  // Fetch past weekly goal proofs that the user can import
  const handleFetchGoalProofs = async () => {
    if (!user) return;
    setLoadingProofs(true);
    setShowProofImporter(true);
    try {
      const q = query(collection(db, 'weekly_goals'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const proofs = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (Array.isArray(data.tasks)) {
          data.tasks.forEach(t => {
            if (t.proofImage || t.proofText) {
              proofs.push({
                weekId: data.weekId || 'Weekly Goal',
                taskTitle: t.description || 'Goal Task',
                proofImage: t.proofImage || '',
                proofText: t.proofText || ''
              });
            }
          });
        }
      });
      setGoalProofs(proofs);
    } catch (e) {
      console.warn('Failed to load goal proofs:', e);
    } finally {
      setLoadingProofs(false);
    }
  };

  const handleSelectGoalProof = (proof) => {
    setTitle(proof.taskTitle);
    setDescription(proof.proofText ? `Verified goal deliverable: ${proof.proofText}` : 'Verified weekly goal deliverable.');
    if (proof.proofImage) {
      setCoverImage(proof.proofImage);
    }
    if (proof.proofText && proof.proofText.startsWith('http')) {
      setLiveUrl(proof.proofText);
    }
    setShowProofImporter(false);
  };

  const handleOpenAddModal = () => {
    if (works.length >= MAX_WORKS) {
      setStatusMsg({ text: `Maximum limit of ${MAX_WORKS} featured works reached. Delete an existing work to add a new one.`, type: 'error' });
      return;
    }
    setEditingWorkId(null);
    setTitle('');
    setCategory('Software & Web');
    setDescription('');
    setLiveUrl('');
    setCoverImage('');
    setTags([]);
    setTagInput('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (work) => {
    setEditingWorkId(work.id);
    setTitle(work.title || '');
    setCategory(work.category || 'Software & Web');
    setDescription(work.description || '');
    setLiveUrl(work.liveUrl || '');
    setCoverImage(work.coverImage || '');
    setTags(work.tags || []);
    setTagInput('');
    setIsModalOpen(true);
  };

  const handleAddTag = (e) => {
    if (e) e.preventDefault();
    const trimmed = tagInput.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadPercent(0);
    try {
      const url = await uploadToCloudinary(file, 'portfolio', (percent) => {
        setUploadPercent(percent);
      });
      setCoverImage(url);
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image. Please try again or provide an image URL.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveWork = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please provide a project title.');
      return;
    }

    if (!coverImage.trim()) {
      alert('Please upload a cover thumbnail image or provide an image link.');
      return;
    }

    setIsSaving(true);
    try {
      let updatedWorks = [];

      if (editingWorkId) {
        // Edit existing
        updatedWorks = works.map(w => w.id === editingWorkId ? {
          ...w,
          title: title.trim(),
          category,
          description: description.trim(),
          liveUrl: liveUrl.trim(),
          coverImage: coverImage.trim(),
          tags,
          updatedAt: Date.now()
        } : w);
      } else {
        // Add new
        const newWork = {
          id: `work_${Date.now()}`,
          title: title.trim(),
          category,
          description: description.trim(),
          liveUrl: liveUrl.trim(),
          coverImage: coverImage.trim(),
          tags,
          createdAt: Date.now()
        };
        updatedWorks = [newWork, ...works].slice(0, MAX_WORKS);
      }

      await updateDoc(doc(db, 'users', user.uid), {
        portfolioWorks: updatedWorks
      });

      setWorks(updatedWorks);
      setIsModalOpen(false);
      setStatusMsg({ text: 'Portfolio works updated successfully!', type: 'success' });
    } catch (err) {
      console.error('Failed to save portfolio work:', err);
      setStatusMsg({ text: 'Failed to update portfolio works. Try again.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWork = async (workId) => {
    if (!window.confirm('Are you sure you want to remove this project from your portfolio?')) return;
    const updatedWorks = works.filter(w => w.id !== workId);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        portfolioWorks: updatedWorks
      });
      setWorks(updatedWorks);
      setStatusMsg({ text: 'Project removed.', type: 'success' });
    } catch (err) {
      console.error('Failed to delete work:', err);
    }
  };

  return (
    <div className="portfolio-manager-container glass-panel" style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 style={{ margin: 0 }}>Featured Portfolio & Works</h2>
            <span style={{ 
              background: 'rgba(79, 70, 229, 0.12)', 
              color: 'var(--primary)', 
              padding: '2px 10px', 
              borderRadius: '999px', 
              fontSize: '0.8rem', 
              fontWeight: 700 
            }}>
              {works.length} of {MAX_WORKS} Works
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.35rem 0 0', maxWidth: '620px' }}>
            Curate up to {MAX_WORKS} standout deliverables. These are displayed as visual thumbnails on your TEC Space profile card so clients can immediately see the quality of what you ship.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="btn btn-primary"
          disabled={works.length >= MAX_WORKS}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
        >
          <FiPlus size={16} />
          <span>Add Featured Work</span>
        </button>
      </div>

      {statusMsg.text && (
        <div style={{ 
          padding: '0.75rem 1rem', 
          borderRadius: '10px', 
          marginBottom: '1.5rem',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(15, 118, 110, 0.1)',
          color: statusMsg.type === 'error' ? 'var(--danger)' : '#0f766e',
          border: `1px solid ${statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(15, 118, 110, 0.25)'}`
        }}>
          {statusMsg.type === 'error' ? <FiAlertCircle /> : <FiCheckCircle />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Works Grid */}
      {works.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3.5rem 1.5rem', 
          background: 'var(--bg-main)', 
          border: '1px dashed var(--border)', 
          borderRadius: '16px' 
        }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.5rem' }}>
            <FiLayers />
          </div>
          <h3 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem' }}>No portfolio works uploaded yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
            Upload web apps, design prototypes, marketing case studies, or writing samples to build instant trust with prospective clients.
          </p>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleOpenAddModal}
          >
            <FiPlus size={16} /> Add Your First Work
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {works.map((work) => (
            <div 
              key={work.id}
              style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              {/* Cover Image Thumbnail */}
              <div style={{ height: '160px', width: '100%', position: 'relative', overflow: 'hidden', background: '#000000' }}>
                <img 
                  src={work.coverImage} 
                  alt={work.title} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <span style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(6px)',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  {work.category}
                </span>
              </div>

              {/* Work Details */}
              <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: 700 }}>
                  {work.title}
                </h4>
                <p style={{ 
                  margin: '0 0 1rem', 
                  fontSize: '0.82rem', 
                  color: 'var(--text-secondary)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.5
                }}>
                  {work.description}
                </p>

                {/* Tags */}
                {Array.isArray(work.tags) && work.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
                    {work.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} style={{
                        fontSize: '0.7rem',
                        background: 'rgba(79, 70, 229, 0.08)',
                        color: 'var(--primary)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}>
                        {tag}
                      </span>
                    ))}
                    {work.tags.length > 3 && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                        +{work.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Card Actions */}
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <div>
                    {work.liveUrl && (
                      <a 
                        href={work.liveUrl.startsWith('http') ? work.liveUrl : `https://${work.liveUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', fontWeight: 600 }}
                      >
                        <FiExternalLink size={13} /> Demo
                      </a>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(work)}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                      title="Edit Work"
                    >
                      <FiEdit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteWork(work.id)}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', color: 'var(--danger)' }}
                      title="Delete Work"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Work Modal */}
      {isModalOpen && (
        <div className="tec-space-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div 
            className="tec-space-modal" 
            style={{ maxWidth: '600px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tec-space-modal-header">
              <div className="tec-space-modal-title-wrap">
                <div className="tec-space-modal-icon">
                  <FiLayers />
                </div>
                <div>
                  <h2>{editingWorkId ? 'Edit Featured Work' : 'Add Featured Work'}</h2>
                  <p>Displayed on your public TEC Space operator card</p>
                </div>
              </div>
              <button 
                type="button" 
                className="tec-space-modal-close" 
                onClick={() => setIsModalOpen(false)}
              >
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveWork} className="tec-space-modal-form">
              {/* Optional Import Button */}
              <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleFetchGoalProofs}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <FiDownload size={13} />
                  <span>Import from Weekly Goal Proofs</span>
                </button>
              </div>

              {/* Goal Proofs Quick-Picker Drawer */}
              {showProofImporter && (
                <div style={{ 
                  background: 'var(--bg-main)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '12px', 
                  padding: '1rem', 
                  marginBottom: '1.25rem',
                  maxHeight: '180px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Select a Weekly Goal Proof to Import:
                    </span>
                    <button type="button" onClick={() => setShowProofImporter(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                      <FiX size={14} />
                    </button>
                  </div>
                  {loadingProofs ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading goal proofs...</div>
                  ) : goalProofs.length === 0 ? (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No completed weekly goals with attached proof found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {goalProofs.map((p, i) => (
                        <div 
                          key={i} 
                          onClick={() => handleSelectGoalProof(p)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{p.taskTitle}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Select →</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Title & Category */}
              <div className="form-group">
                <label>Project Title <span className="req">*</span></label>
                <input 
                  type="text"
                  placeholder="e.g. Fintech SaaS Payment Flow"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Discipline / Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Live Demo or Repo URL</label>
                  <input 
                    type="url"
                    placeholder="https://..."
                    value={liveUrl}
                    onChange={(e) => setLiveUrl(e.target.value)}
                  />
                </div>
              </div>

              {/* Cover Thumbnail Media */}
              <div className="form-group">
                <label>Cover Media (Image or Short Video) <span className="req">*</span></label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <label 
                    className="btn btn-secondary" 
                    style={{ 
                      cursor: 'pointer', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.45rem',
                      padding: '0.55rem 0.9rem',
                      fontSize: '0.85rem'
                    }}
                  >
                    <FiUploadCloud size={16} />
                    <span>{isUploading ? `Uploading ${uploadPercent}%...` : 'Upload Media (Image / Video)'}</span>
                    <input 
                      type="file" 
                      accept="image/*,video/*" 
                      style={{ display: 'none' }} 
                      onChange={handleImageFileChange}
                      disabled={isUploading}
                    />
                  </label>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>or paste media URL below:</span>
                </div>

                <input 
                  type="text"
                  placeholder="https://... or uploaded image/video URL"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  required
                />

                {coverImage && (
                  <div style={{ marginTop: '0.5rem', height: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: '#0c0b1f' }}>
                    {isVideoUrl(coverImage) ? (
                      <video 
                        src={coverImage} 
                        controls 
                        muted 
                        playsInline 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <img 
                        src={coverImage} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="form-group">
                <label>Project Overview & Deliverables <span className="req">*</span></label>
                <textarea 
                  rows={3}
                  placeholder="Briefly describe what you built, problem solved, and key features..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              {/* Tech Stack Tags */}
              <div className="form-group">
                <label>Tools & Technologies (press Enter to add)</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input 
                    type="text"
                    placeholder="e.g. Next.js, Figma, Tailwind, Claude API"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag(e);
                      }
                    }}
                  />
                  <button type="button" onClick={handleAddTag} className="btn btn-secondary">
                    Add
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {tags.map((tag, idx) => (
                    <span 
                      key={idx}
                      style={{
                        background: 'rgba(79, 70, 229, 0.1)',
                        color: 'var(--primary)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      {tag}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveTag(tag)}
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="tec-space-modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="tec-btn-primary"
                  disabled={isSaving || isUploading}
                >
                  <span>{isSaving ? 'Saving...' : editingWorkId ? 'Save Changes' : 'Publish to Portfolio'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
