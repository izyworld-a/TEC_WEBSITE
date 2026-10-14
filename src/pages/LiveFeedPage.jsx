import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, where, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FiTarget, FiAward, FiTrendingUp, FiClock, FiAlertCircle, FiUsers, FiActivity, FiPieChart, FiZap, FiSearch, FiBell, FiSun, FiMenu, FiStar, FiCheckCircle, FiShield, FiUser, FiDollarSign, FiTrash2, FiGift, FiExternalLink, FiX, FiMaximize2 } from 'react-icons/fi';
import { getWeekId } from '../utils/weekUtils';
import { CircleStatusChip, LiveMetricCard, WeekIdentityChip } from '../components/ProductUI';
import BirthdayModal from '../components/BirthdayModal';
import './liveFeed.css';

export default function LiveFeedPage({ user, userData }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [liveFeed, setLiveFeed] = useState([]);
  const [allGoals, setAllGoals] = useState([]);
  const [userCount, setUserCount] = useState(0);
  const [topPerformer, setTopPerformer] = useState(null);
  const [usersMap, setUsersMap] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeProofPreview, setActiveProofPreview] = useState(null);
  const [birthdayData, setBirthdayData] = useState(null);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  
  const [pairings, setPairings] = useState([]);
  const [myPairing, setMyPairing] = useState(null);
  const [systemWallet, setSystemWallet] = useState(0);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [partnerDismissed, setPartnerDismissed] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const currentWeekId = getWeekId(new Date());
  const selectedWeekId = getWeekId(selectedDate);

  const [weekSettings, setWeekSettings] = useState(null);
  const [timeLeft, setTimeLeft] = useState({ setup: null, completion: null });

  // Navigation handlers
  const handlePrevWeek = () => {
    const prevDate = new Date(selectedDate);
    prevDate.setDate(prevDate.getDate() - 7);
    setSelectedDate(prevDate);
  };

  const handleNextWeek = () => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 7);
    setSelectedDate(nextDate);
  };

  const handleCurrentWeek = () => {
    setSelectedDate(new Date());
  };

  // Listen to weekly goals and settings for the selected week
  useEffect(() => {
    const goalsRef = collection(db, 'weekly_goals');
    const isCurrentWeek = selectedWeekId === currentWeekId;
    const prevWeekId = getWeekId(new Date(Date.now() - 7 * 86400000));
    const q = isCurrentWeek
      ? query(goalsRef, where('weekId', 'in', [currentWeekId, prevWeekId]))
      : query(goalsRef, where('weekId', '==', selectedWeekId));
    
    const unsubscribeGoals = onSnapshot(q, (snapshot) => {
      const goalsByUser = new Map();
      snapshot.forEach(doc => {
        const d = { id: doc.id, ...doc.data() };
        if (!d.tasks || d.tasks.length === 0) return;

        if (isCurrentWeek) {
          if (!goalsByUser.has(d.userId)) {
            goalsByUser.set(d.userId, d);
          } else {
            const existing = goalsByUser.get(d.userId);
            if (d.weekId === currentWeekId && existing.weekId !== currentWeekId) {
              goalsByUser.set(d.userId, d);
            }
          }
        } else {
          goalsByUser.set(d.id, d);
        }
      });

      const goals = Array.from(goalsByUser.values());

      const getTime = (ts) => {
        if (!ts) return 0;
        if (typeof ts.toDate === 'function') return ts.toDate().getTime();
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        return new Date(ts).getTime() || 0;
      };

      // Sort by updatedAt descending in memory
      goals.sort((a, b) => getTime(b.updatedAt) - getTime(a.updatedAt));

      setLiveFeed(goals);
      setAllGoals(goals);

      // Find top performer for this selected week (client-side)
      if (goals.length > 0) {
        const top = goals.reduce((prev, current) => ((prev.weeklyPoints || 0) > (current.weeklyPoints || 0)) ? prev : current, goals[0]);
        if ((top.weeklyPoints || 0) > 0) {
          setTopPerformer(top);
        } else {
          setTopPerformer(null);
        }
      } else {
        setTopPerformer(null);
      }
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'week_settings', selectedWeekId), (snap) => {
      if (snap.exists()) {
        setWeekSettings(snap.data());
      } else {
        setWeekSettings(null);
      }
    });

    return () => {
      unsubscribeGoals();
      unsubscribeSettings();
    };
  }, [selectedWeekId]);

  // Keep users directory listener separate
  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUserCount(snapshot.size);
      const map = {};
      snapshot.forEach(d => { map[d.id] = d.data(); });
      setUsersMap(map);
    });
    return () => unsubscribeUsers();
  }, []);

  // Listen to active birthday celebration
  useEffect(() => {
    const unsubBirthday = onSnapshot(doc(db, 'system_data', 'birthday'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBirthdayData(data);
        const bdayKey = 'tec_bday_seen_' + (data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.celebrantName || 'active'));
        if (data.enabled && !sessionStorage.getItem(bdayKey)) {
          setShowBirthdayModal(true);
        } else if (!data.enabled) {
          setShowBirthdayModal(false);
        }
      } else {
        setBirthdayData(null);
        setShowBirthdayModal(false);
      }
    });
    return () => unsubBirthday();
  }, []);

  const handleCloseBirthday = () => {
    setShowBirthdayModal(false);
    if (birthdayData) {
      const bdayKey = 'tec_bday_seen_' + (birthdayData.updatedAt?.toMillis ? birthdayData.updatedAt.toMillis() : (birthdayData.celebrantName || 'active'));
      sessionStorage.setItem(bdayKey, 'true');
    }
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (activeProofPreview) setActiveProofPreview(null);
        else if (selectedUser) setSelectedUser(null);
        else if (showPartnerModal) setShowPartnerModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProofPreview, selectedUser, showPartnerModal]);

  // Listen to current user's pairing for this week
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'weekly_pairings'),
      where('weekId', '==', currentWeekId),
      where('userIds', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const doc = snap.docs[0];
        setMyPairing({ id: doc.id, ...doc.data() });
        // Show partner notification once (if not dismissed)
        if (!snap.docs[0].data().teamRewarded) {
          setShowPartnerModal(true);
        }
      } else {
        setMyPairing(null);
      }
    });
    return () => unsub();
  }, [user?.uid, currentWeekId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const setup = weekSettings?.setupDeadline ? new Date(String(weekSettings.setupDeadline).replace(' ', 'T')) : null;
      const completion = weekSettings?.completionDeadline ? new Date(String(weekSettings.completionDeadline).replace(' ', 'T')) : null;

      setTimeLeft({
        setup: setup ? calculateTimeLeft(setup, now) : null,
        completion: completion ? calculateTimeLeft(completion, now) : null
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [weekSettings]);

  const calculateTimeLeft = (targetDate, now) => {
    const diff = targetDate - now;
    if (diff <= 0) return 'EXPIRED';
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);
    return `${d > 0 ? d+'d ' : ''}${h}h ${m}m ${s}s`;
  };

  // Calculate Stats
  const activeTasks = allGoals.reduce((acc, goal) => acc + (goal.tasks ? goal.tasks.length : 0), 0);
  
  const totalTasks = allGoals.reduce((acc, goal) => acc + (goal.tasks ? goal.tasks.length : 0), 0);
  const completedTasks = allGoals.reduce((acc, goal) => {
    return acc + (goal.tasks ? goal.tasks.filter(t => (t.status === 'Completed' && t.reviewed) || t.status === 'completed').length : 0);
  }, 0);
  
  const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  // Calculate Avg Time
  const reviewedGoals = allGoals.filter(g => g.reviewStatus === 'reviewed');
  const avgTime = reviewedGoals.length === 0 ? 0 : (reviewedGoals.reduce((acc, g) => {
    const start = g.submittedAt?.toDate() || new Date();
    const end = g.updatedAt?.toDate() || new Date();
    return acc + (end - start);
  }, 0) / reviewedGoals.length / (1000 * 60 * 60)).toFixed(1);

  const calculateStars = (pts) => {
    if (pts >= 100) return 5;
    if (pts >= 50) return 4;
    if (pts >= 25) return 3;
    if (pts >= 10) return 2;
    if (pts >= 1) return 1;
    return 0;
  };

  // Filter Feed by Search
  const filteredFeed = liveFeed.filter(goal => {
    const name = goal.userName || usersMap[goal.userId]?.name || goal.userEmail || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const pendingReviewCount = allGoals.filter(g =>
    g.reviewStatus === 'pending' ||
    g.reviewStatus === 'in_review' ||
    g.tasks?.some(t => ((t.status === 'Completed' && (t.proofImage || t.proofText)) || t.status === 'submitted') && !t.reviewed)
  ).length;

  const fullyVerifiedCount = allGoals.filter(g =>
    g.tasks?.length >= 3 &&
    g.tasks.slice(0, 3).every(t => (t.reviewed && t.adminAction === 'approved' && t.status === 'Completed') || t.status === 'completed')
  ).length;

  const nextDeadline = timeLeft.setup && timeLeft.setup !== 'EXPIRED'
    ? timeLeft.setup
    : timeLeft.completion && timeLeft.completion !== 'EXPIRED'
      ? timeLeft.completion
      : 'No active deadline';

  const nextDeadlineLabel = timeLeft.setup && timeLeft.setup !== 'EXPIRED'
    ? 'Setup closes in'
    : timeLeft.completion && timeLeft.completion !== 'EXPIRED'
      ? 'Completion closes in'
      : 'Week is open';

  const isAdminUser = Boolean(
    userData?.isAdmin ||
    userData?.role === 'admin' ||
    usersMap[user?.uid]?.isAdmin ||
    usersMap[user?.uid]?.role === 'admin'
  );

  const handleAdminDeleteTask = async (goal, taskIndex) => {
    const task = goal.tasks?.[taskIndex];
    const desc = task?.description || `Goal #${taskIndex + 1}`;
    const memberName = goal.userName || usersMap[goal.userId]?.name || 'this member';

    if (!window.confirm(`Delete individual goal for ${memberName}?\n\n"${desc}"\n\nThis will remove only this specific goal and keep their other goals.`)) {
      return;
    }

    try {
      const updatedTasks = (goal.tasks || []).filter((_, i) => i !== taskIndex);
      if (updatedTasks.length === 0) {
        await deleteDoc(doc(db, 'weekly_goals', goal.id));
        alert(`Goal deleted. Since all goals for ${memberName} were deleted, their weekly declaration has been reset.`);
      } else {
        const allReviewed = updatedTasks.every(t => t.reviewed);
        await updateDoc(doc(db, 'weekly_goals', goal.id), {
          tasks: updatedTasks,
          reviewStatus: allReviewed ? 'reviewed' : 'in_review',
          updatedAt: serverTimestamp()
        });
        alert(`Goal "${desc}" deleted successfully.`);
      }
    } catch (err) {
      console.error('Error deleting individual goal:', err);
      alert('Failed to delete goal: ' + err.message);
    }
  };

  return (
    <div className="tec-live-page tec-live-page-responsive">
      {/* Main Title Area */}
      <div className="tec-live-heading">
        <div className="tec-live-heading-chips">
          <CircleStatusChip>Live Execution Board</CircleStatusChip>
          <WeekIdentityChip weekId={selectedWeekId} mode="live" />
        </div>
        <h2 className="tec-live-title">This week's receipts</h2>
        <p className="tec-live-subtitle">See who declared, who submitted proof, and what still needs review.</p>
      </div>

      {/* ── Active Birthday Celebration Banner ── */}
      {birthdayData?.enabled && (
        <div 
          className="birthday-feed-banner" 
          onClick={() => setShowBirthdayModal(true)}
          title="Click to view birthday card"
        >
          <div className="birthday-banner-left">
            {birthdayData.photoUrl ? (
              <img src={birthdayData.photoUrl} alt={birthdayData.celebrantName} className="birthday-banner-avatar" />
            ) : (
              <div className="birthday-banner-avatar-placeholder">🎂</div>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🎉</span>
                <span>Celebrating <strong>{birthdayData.celebrantName || 'Celebrant'}</strong>'s Birthday today!</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {birthdayData.celebrantRole ? `${birthdayData.celebrantRole} • ` : ''}Click to open the birthday card &amp; send wishes!
              </div>
            </div>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
          >
            <span>View Card</span>
            <span>🎈</span>
          </button>
        </div>
      )}

      {/* Stats Section */}
      <div className="tec-live-metrics-grid tec-live-metrics-grid-wrap">
        <LiveMetricCard
          label="Goals submitted"
          value={allGoals.length}
          detail={`${userCount} members`}
          icon={<FiTarget />}
        />
        <LiveMetricCard
          label="Active tasks"
          value={activeTasks}
          detail={`${completionRate}% verified`}
          icon={<FiZap />}
          tone="green"
        />
        <LiveMetricCard
          label="Awaiting review"
          value={pendingReviewCount}
          detail={`${fullyVerifiedCount} fully verified`}
          icon={<FiShield />}
          tone="amber"
        />
        <LiveMetricCard
          label={nextDeadlineLabel}
          value={nextDeadline}
          detail="Deadline"
          icon={<FiClock />}
          tone="slate"
        />
      </div>
      {/* ── Partner Assignment Popup ── */}
      <AnimatePresence>
        {myPairing && showPartnerModal && !partnerDismissed && !myPairing.teamRewarded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
              zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
            }}
            onClick={() => { setShowPartnerModal(false); setPartnerDismissed(true); }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={e => e.stopPropagation()}
              className="glass-panel"
              style={{
                background: 'var(--bg-card)',
                maxWidth: '440px', width: '100%', padding: '2.5rem 2rem',
                borderRadius: '24px', textAlign: 'center', position: 'relative',
                border: '1px solid rgba(99,102,241,0.4)',
                boxShadow: '0 0 60px rgba(99,102,241,0.2)'
              }}
            >
              <button
                onClick={() => { setShowPartnerModal(false); setPartnerDismissed(true); }}
                style={{ position: 'absolute', top: '1rem', right: '1.25rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
                aria-label="Close"
              >&times;</button>

              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤝</div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.5rem' }}>You've Been Paired!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                Your accountability partner{myPairing.userIds?.length > 2 ? 's are' : ' is'}:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                {myPairing.userIds?.filter(id => id !== user?.uid).map((partnerId, i) => {
                  const partnerInfo = usersMap[partnerId];
                  const partnerName = myPairing.userNames?.[myPairing.userIds.indexOf(partnerId)] || partnerInfo?.name || 'Teammate';
                  return (
                    <div key={partnerId} style={{
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      background: 'rgba(99,102,241,0.1)', borderRadius: '14px',
                      padding: '0.875rem 1.25rem', border: '1px solid rgba(99,102,241,0.2)'
                    }}>
                      {partnerInfo?.profilePicUrl ? (
                        <img src={partnerInfo.profilePicUrl} alt={partnerName} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                      ) : (
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold', flexShrink: 0 }}>
                          {partnerName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: '700', fontSize: '1rem' }}>{partnerName}</div>
                        {partnerInfo?.profession && <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>{partnerInfo.profession}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '12px', padding: '0.875rem 1rem', fontSize: '0.85rem', color: 'rgba(234,179,8,0.9)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                🏆 If you <strong>both</strong> rank in the <strong>Top 3</strong> to set and complete your goals this week, you each earn <strong>₦1,000!</strong>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setShowPartnerModal(false); setPartnerDismissed(true); }}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.875rem', fontWeight: '700', fontSize: '1rem', cursor: 'pointer' }}
              >
                Got it — Let's Go! 🚀
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Team Rank & Reward Banner ── */}
      {(() => {
        if (!user?.uid || !myPairing) return null;

        // Build sorted completion ranking from live feed
        const getTime = (ts) => {
          if (!ts) return Infinity;
          if (typeof ts.toMillis === 'function') return ts.toMillis();
          return new Date(ts).getTime();
        };

        const fullyCompleted = allGoals
          .filter(g => {
            if (!g.tasks || g.tasks.length < 3) return false;
            return g.tasks.every(t => t.reviewed && t.adminAction === 'approved' && t.status === 'Completed');
          })
          .sort((a, b) => getTime(a.submittedAt) - getTime(b.submittedAt));

        const myRank = fullyCompleted.findIndex(g => g.userId === user.uid) + 1; // 0 = not yet
        const partnerIds = myPairing.userIds?.filter(id => id !== user.uid) || [];
        const partnerRanks = partnerIds.map(pid => fullyCompleted.findIndex(g => g.userId === pid) + 1);
        const allTop3 = myRank >= 1 && myRank <= 3 && partnerRanks.every(r => r >= 1 && r <= 3);

        if (myPairing.teamRewarded) {
          return (
            <div style={{
              background: 'linear-gradient(135deg, rgba(234,179,8,0.15), rgba(245,158,11,0.08))',
              border: '1px solid rgba(234,179,8,0.5)', borderRadius: '20px',
              padding: '1.25rem 1.75rem', marginBottom: '2rem',
              display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap'
            }}>
              <div style={{ fontSize: '2.5rem' }}>🏆</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#eab308' }}>Team Reward Earned!</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  You and your partner each received <strong style={{ color: '#eab308' }}>₦{(myPairing.rewardAmount || 1000).toLocaleString()}</strong> for being in the Top 3 this week. 🎉
                </div>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#eab308' }}>+₦{(myPairing.rewardAmount || 1000).toLocaleString()}</div>
            </div>
          );
        }

        // Show rank progress if user has submitted goals
        const myGoal = allGoals.find(g => g.userId === user.uid);
        if (!myGoal) return null;

        const rankColors = ['#eab308','#94a3b8','#f97316'];
        const rankLabel = myRank > 0 ? `#${myRank}` : 'Unranked';
        const isQualified = myRank >= 1 && myRank <= 3;
        const partnerQualified = partnerRanks.every(r => r >= 1 && r <= 3);

        return (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              background: allTop3 ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
              border: allTop3 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px', padding: '1rem 1.5rem', marginBottom: '2rem',
              display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap'
            }}
          >
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
              background: isQualified ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', fontWeight: '900',
              color: isQualified ? (rankColors[myRank-1] || '#eab308') : 'var(--text-secondary)'
            }}>
              {myRank > 0 ? rankLabel : '?'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                {allTop3 ? '🎯 Your team qualifies for the ₦1,000 reward! Waiting for admin approval.' :
                  isQualified ? `You're ranked ${rankLabel} — ${partnerQualified ? '✅ Partner also qualifies!' : '⏳ Waiting for your partner to complete their goals.'}` :
                  myRank > 3 ? `You're ranked #${myRank} — outside Top 3. Keep pushing!` :
                  '⏳ Complete all your goals to get ranked.'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Top 3 pairs who set AND complete goals first each earn ₦1,000 🏆
              </div>
            </div>
            {myRank > 0 && (
              <div style={{ fontSize: '0.85rem', fontWeight: '800', padding: '0.4rem 1rem', borderRadius: '20px',
                background: isQualified ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)',
                color: isQualified ? '#eab308' : 'var(--text-secondary)',
                border: `1px solid ${isQualified ? 'rgba(234,179,8,0.3)' : 'rgba(255,255,255,0.08)'}`
              }}>
                {isQualified ? '🏅 Top 3' : `#${myRank}`}
              </div>
            )}
          </motion.div>
        );
      })()}

      {/* Deadlines Section (If Active) */}
      {(timeLeft.setup !== 'EXPIRED' || timeLeft.completion !== 'EXPIRED') && (
        <div className="tec-live-deadlines-wrap">
          {timeLeft.setup && timeLeft.setup !== 'EXPIRED' && (
            <div className="glass-panel" style={{ flex: '1 1 260px', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--primary)', minWidth: 0 }}>
              <FiClock size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Goal Setting Deadline</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'monospace' }}>{timeLeft.setup}</div>
              </div>
            </div>
          )}
          {timeLeft.completion && timeLeft.completion !== 'EXPIRED' && (
            <div className="glass-panel" style={{ flex: '1 1 260px', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--secondary)', minWidth: 0 }}>
              <FiClock size={20} color="var(--secondary)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Weekly Completion Deadline</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'monospace' }}>{timeLeft.completion}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="live-feed-layout live-feed-layout-responsive">
        
        {/* Left Column: Activity Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          <div className="live-feed-controls-bar">
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '0.25rem' }}>Live Activity Feed</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>Real-time updates from your team</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
              <div className="live-feed-search-wrap">
                <FiSearch style={{ color: 'var(--text-secondary)', marginRight: '0.75rem', flexShrink: 0 }} />
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="tec-live-week-nav">
                <button 
                  onClick={handlePrevWeek} 
                  className="btn btn-secondary week-nav-btn"
                >
                  ← Prev
                </button>
                
                <div className="week-nav-label">
                  {selectedWeekId === currentWeekId ? 'Current Week' : selectedWeekId}
                </div>
                
                <button 
                  onClick={handleNextWeek} 
                  disabled={selectedWeekId === currentWeekId}
                  className="btn btn-secondary week-nav-btn"
                  style={{ 
                    opacity: selectedWeekId === currentWeekId ? 0.4 : 1,
                    cursor: selectedWeekId === currentWeekId ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next →
                </button>
                
                {selectedWeekId !== currentWeekId && (
                  <button 
                    onClick={handleCurrentWeek} 
                    className="btn btn-primary week-nav-btn"
                  >
                    Current
                  </button>
                )}
              </div>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            {filteredFeed.length > 0 ? filteredFeed.map((goal, idx) => {
              const userProfile = usersMap[goal.userId] || {};
              return (
              <motion.div 
                key={goal.id} 
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.3) }}
                whileHover={{ y: -2, transition: { duration: 0.15 } }}
                className="glass-panel live-feed-item-card" 
              >
                <div className="feed-card-header">
                  {/* Clickable Avatar */}
                  <div onClick={() => setSelectedUser({ ...userProfile, userName: goal.userName || userProfile.name || 'Member', userId: goal.userId, profilePicUrl: goal.profilePicUrl || userProfile.profilePicUrl, totalPoints: userProfile.totalPoints })} style={{ cursor: 'pointer', flexShrink: 0 }}>
                    {goal.profilePicUrl || userProfile.profilePicUrl ? (
                      <img src={goal.profilePicUrl || userProfile.profilePicUrl} alt={goal.userName || userProfile.name} style={{ width: '50px', height: '50px', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                    ) : (
                      <div style={{ width: '50px', height: '50px', borderRadius: '12px', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                        {(goal.userName || userProfile.name || 'M')?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="feed-card-user-row">
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span onClick={() => setSelectedUser({ ...userProfile, userName: goal.userName || userProfile.name || 'Member', userId: goal.userId, profilePicUrl: goal.profilePicUrl || userProfile.profilePicUrl, totalPoints: userProfile.totalPoints })} style={{ fontWeight: '700', fontSize: '1.05rem', cursor: 'pointer', color: 'var(--text-main)' }}>{goal.userName || userProfile.name || 'Member'}</span>
                          {userProfile.isAdmin ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }} title="Admin"><FiShield size={14} /></span>
                          ) : userProfile.isModerator ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }} title="Moderator"><FiCheckCircle size={14} /></span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--secondary)', border: '1px solid rgba(16, 185, 129, 0.3)' }} title="User"><FiUser size={14} /></span>
                          )}
                          {userProfile.status === 'On Break' && <span className="tec-status-badge info" style={{ fontSize: '0.65rem', padding: '1px 7px' }}>🏖️ ON BREAK</span>}
                          {userProfile.status === 'On Hold' && <span className="tec-status-badge warning" style={{ fontSize: '0.65rem', padding: '1px 7px' }}>⏸️ ON HOLD</span>}
                        </div>
                        {userProfile.profession && <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: '600', marginTop: '1px' }}>{userProfile.profession}</span>}
                        {userProfile.bio && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.4', maxWidth: '320px' }}>{userProfile.bio}</span>}
                        <div className="stars" style={{ marginTop: '4px' }}>
                          {[...Array(5)].map((_, i) => (
                            <FiStar key={i} size={12} fill={i < calculateStars(userProfile.totalPoints || 0) ? 'var(--star-color)' : 'none'} className={i < calculateStars(userProfile.totalPoints || 0) ? 'star-filled' : 'star-empty'} />
                          ))}
                        </div>
                      </div>

                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <FiClock size={12} /> {goal.updatedAt ? new Date(goal.updatedAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                        </span>



                      </div>

                    {(() => {
                      const reviewedCompleted = goal.tasks ? goal.tasks.filter(t => (t.reviewed && t.status === 'Completed') || t.status === 'completed').length : 0;
                      const totalTasks = goal.tasks ? goal.tasks.length : 1;
                      const displayProgress = Math.round((reviewedCompleted / totalTasks) * 100);
                      return (
                        <div style={{ marginTop: '0.5rem' }}>
                          <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${displayProgress}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.5s ease' }}></div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginTop: '0.4rem', color: 'var(--text-secondary)' }}>
                            <span>{displayProgress}% Verified Progress</span>
                            <span>Week: {goal.weekId}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Task Grid in Feed Card */}
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {goal.tasks?.map((task, idx) => {
                    const isCompleted = task.status === 'completed' || task.status === 'Completed';
                    const isSubmitted = task.status === 'submitted';
                    const isInProgress = task.status === 'in_progress';
                    const isTodo = task.status === 'todo';

                    const statusBadgeText = isCompleted
                      ? (task.reviewed ? '✓ Verified Complete' : '✓ Completed')
                      : isSubmitted
                      ? '⏳ Submitted (Pending Review)'
                      : isInProgress
                      ? '● In Progress'
                      : isTodo
                      ? '○ To Do'
                      : (task.status || 'Pending');

                    const statusBadgeColor = isCompleted
                      ? '#10b981'
                      : isSubmitted
                      ? '#f59e0b'
                      : isInProgress
                      ? '#6366f1'
                      : 'var(--text-secondary)';

                    const statusBadgeBg = isCompleted
                      ? 'rgba(16, 185, 129, 0.12)'
                      : isSubmitted
                      ? 'rgba(245, 158, 11, 0.12)'
                      : isInProgress
                      ? 'rgba(99, 102, 241, 0.12)'
                      : 'rgba(255, 255, 255, 0.05)';

                    return (
                      <div key={idx} className="feed-task-item-box">
                        <div className="feed-task-header-row">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-main)', marginBottom: '0.2rem', wordBreak: 'break-word' }}>
                              {task.title || task.description || `Goal #${idx + 1}`}
                            </div>
                            {task.title && task.description && (
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.45', marginBottom: '0.35rem', wordBreak: 'break-word' }}>
                                {task.description}
                              </div>
                            )}
                            {task.deliverable && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.25rem', wordBreak: 'break-word' }}>
                                <strong>Deliverable:</strong> {task.deliverable}
                              </div>
                            )}
                            {task.suggestedBy?.name && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                Assigned by: <strong>{task.suggestedBy.name}</strong>
                              </div>
                            )}
                          </div>

                          <div className="feed-task-badges-wrap">
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: statusBadgeColor,
                              background: statusBadgeBg,
                              padding: '0.25rem 0.6rem',
                              borderRadius: '20px',
                              whiteSpace: 'nowrap'
                            }}>
                              {statusBadgeText}
                            </span>
                            {isAdminUser && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdminDeleteTask(goal, idx);
                                }}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#ef4444',
                                  borderRadius: '6px',
                                  padding: '0.2rem 0.45rem',
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                title={`Admin: Delete this goal`}
                              >
                                <FiTrash2 size={11} />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Proof details */}
                        {(task.proofUrl || task.proofImage || task.proofText) && (
                          <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.78rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Proof:</span>
                            {(task.proofUrl || task.proofImage) && (
                              (task.proofType === 'link' || (!task.proofImage && task.proofUrl && !task.proofUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) && !task.proofUrl.includes('res.cloudinary.com'))) ? (
                                <a
                                  href={task.proofUrl || task.proofImage}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    color: 'var(--primary)',
                                    fontWeight: 600,
                                    textDecoration: 'underline',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}
                                >
                                  <FiExternalLink size={12} /> View Link
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActiveProofPreview({
                                    url: task.proofImage || task.proofUrl,
                                    taskTitle: task.title || task.description || 'Goal Proof',
                                    userName: goal.userName || userProfile.name || 'Member',
                                    proofText: task.proofText
                                  })}
                                  style={{
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                    color: 'var(--primary)',
                                    fontWeight: 600,
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <FiMaximize2 size={12} /> View Image
                                </button>
                              )
                            )}
                            {task.proofText && (
                              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                "{task.proofText}"
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
              );
            }) : (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <FiActivity size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p>Waiting for the first activity of the week...</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column: Sidebar */}
        <div className="live-feed-sidebar-column">
          
          {/* Top Performer Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            whileHover={{ y: -3, transition: { duration: 0.15 } }}
            style={{ 
              background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
              borderRadius: '24px', 
              padding: '2.25rem 1.75rem', 
              textAlign: 'center', 
              color: 'white',
              boxShadow: '0 20px 40px rgba(168, 85, 247, 0.25)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '1.25rem', letterSpacing: '1.5px', opacity: 0.9 }}>
              👑 Weekly MVP
            </div>
            
            {topPerformer ? (
              <>
                <div 
                  onClick={() => {
                    const prof = usersMap[topPerformer.userId] || {};
                    setSelectedUser({ ...prof, userName: topPerformer.userName || prof.name || 'Member', userId: topPerformer.userId, profilePicUrl: topPerformer.profilePicUrl || prof.profilePicUrl, totalPoints: prof.totalPoints });
                  }}
                  style={{ position: 'relative', display: 'inline-block', marginBottom: '1.25rem', cursor: 'pointer' }}
                >
                  {topPerformer.profilePicUrl || usersMap[topPerformer.userId]?.profilePicUrl ? (
                    <img src={topPerformer.profilePicUrl || usersMap[topPerformer.userId]?.profilePicUrl} alt={topPerformer.userName} style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(255,255,255,0.3)', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }} />
                  ) : (
                    <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold' }}>
                      {topPerformer.userName?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <motion.div 
                    animate={{ rotate: [0, -10, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 3, repeatDelay: 4 }}
                    style={{ position: 'absolute', bottom: '0', right: '0', background: '#eab308', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #ffffff', color: '#78350f', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}
                  >
                    <FiAward size={16} />
                  </motion.div>
                </div>

                <div 
                  onClick={() => {
                    const prof = usersMap[topPerformer.userId] || {};
                    setSelectedUser({ ...prof, userName: topPerformer.userName || prof.name || 'Member', userId: topPerformer.userId, profilePicUrl: topPerformer.profilePicUrl || prof.profilePicUrl, totalPoints: prof.totalPoints });
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.4rem', cursor: 'pointer' }}
                >
                  <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>{topPerformer.userName}</h4>
                  {usersMap[topPerformer.userId]?.isAdmin ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.25)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.4)' }} title="Admin"><FiShield size={14} /></span>
                  ) : usersMap[topPerformer.userId]?.isModerator ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.25)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.4)' }} title="Moderator"><FiCheckCircle size={14} /></span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.3)' }} title="User"><FiUser size={14} /></span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '1rem' }}>
                  {[...Array(5)].map((_, i) => (
                    <FiStar 
                      key={i} 
                      size={18} 
                      fill={i < calculateStars(usersMap[topPerformer.userId]?.totalPoints || 0) ? '#fbbf24' : 'none'} 
                      stroke={i < calculateStars(usersMap[topPerformer.userId]?.totalPoints || 0) ? '#fbbf24' : 'rgba(255,255,255,0.4)'}
                    />
                  ))}
                </div>

                <div style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)', padding: '0.5rem 1.1rem', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', fontWeight: '700', marginBottom: '0.85rem' }}>
                  <span>🌟</span>
                  <span>{topPerformer.weeklyPoints || 0} Points this week</span>
                </div>

                <div style={{ fontSize: '0.8rem', opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <FiCheckCircle size={14} /> Verified Top Score
                </div>
              </>
            ) : (
              <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>Competition is heating up!</p>
            )}
          </motion.div>

          {/* Top 3 Setters & Gamified Podium */}
          <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🏆</span> Top 3 This Week
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 600 }}>
                First to Finish
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {(() => {
                const getTime = (ts) => {
                  if (!ts) return Infinity;
                  if (typeof ts.toMillis === 'function') return ts.toMillis();
                  return new Date(ts).getTime();
                };
                const top3 = [...allGoals]
                  .filter(g => g.submittedAt)
                  .sort((a, b) => getTime(a.submittedAt) - getTime(b.submittedAt))
                  .slice(0, 3);
                
                if (top3.length === 0) {
                  return <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', textAlign: 'center', margin: '1rem 0' }}>Waiting for users to set goals...</p>;
                }

                const rankMeta = [
                  { medal: '🥇', label: '#1 Gold', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.3)' },
                  { medal: '🥈', label: '#2 Silver', color: '#cbd5e1', bg: 'rgba(203, 213, 225, 0.1)', border: 'rgba(203, 213, 225, 0.25)' },
                  { medal: '🥉', label: '#3 Bronze', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.25)' }
                ];

                return top3.map((g, i) => {
                  const progress = g.progress || 0;
                  const meta = rankMeta[i] || rankMeta[2];
                  const userProfile = usersMap[g.userId] || {};

                  return (
                    <motion.div 
                      key={g.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      whileHover={{ scale: 1.01, transition: { duration: 0.15 } }}
                      style={{ 
                        padding: '0.9rem 1rem', 
                        background: meta.bg, 
                        borderRadius: '16px', 
                        border: `1px solid ${meta.border}`,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
                        <div style={{ fontSize: '1.25rem', lineHeight: 1 }} title={meta.label}>{meta.medal}</div>
                        
                        <div 
                          onClick={() => setSelectedUser({ ...userProfile, userName: g.userName || userProfile.name || 'Member', userId: g.userId, profilePicUrl: g.profilePicUrl || userProfile.profilePicUrl, totalPoints: userProfile.totalPoints })}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}
                        >
                          {g.profilePicUrl ? (
                            <img src={g.profilePicUrl} alt={g.userName} style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${meta.color}` }} />
                          ) : (
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem' }}>
                              {g.userName?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {g.userName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              {g.weeklyPoints || 0} pts earned
                            </div>
                          </div>
                        </div>

                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 700, 
                          color: progress === 100 ? '#10b981' : meta.color,
                          background: progress === 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '10px'
                        }}>
                          {progress}%
                        </span>
                      </div>

                      <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          style={{ 
                            height: '100%', 
                            background: progress === 100 ? '#10b981' : 'linear-gradient(90deg, var(--primary), #a855f7)', 
                            borderRadius: '3px' 
                          }}
                        />
                      </div>
                    </motion.div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Profile Modal ── */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedUser(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={e => e.stopPropagation()}
              className="glass-panel"
              style={{
                width: '100%',
                maxWidth: '420px',
                padding: '2rem',
                borderRadius: '24px',
                position: 'relative',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
              }}
            >
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'background 0.2s'
                }}
              >
                <FiX size={18} />
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.5rem' }}>
                {selectedUser.profilePicUrl ? (
                  <img src={selectedUser.profilePicUrl} alt={selectedUser.userName} style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', marginBottom: '1rem' }} />
                ) : (
                  <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                    {selectedUser.userName?.charAt(0).toUpperCase()}
                  </div>
                )}
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.3rem' }}>{selectedUser.userName}</h3>
                {selectedUser.profession && <div style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: '600', marginBottom: '0.5rem' }}>{selectedUser.profession}</div>}
                {selectedUser.bio && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 1rem' }}>{selectedUser.bio}</p>}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '0.5rem' }}>
                  {[...Array(5)].map((_, i) => (
                    <FiStar key={i} size={16} fill={i < calculateStars(selectedUser.totalPoints || 0) ? 'var(--star-color)' : 'none'} className={i < calculateStars(selectedUser.totalPoints || 0) ? 'star-filled' : 'star-empty'} />
                  ))}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#10b981' }}>
                  {selectedUser.totalPoints || 0} Total Points
                </div>
              </div>

              {selectedUser.socials && Object.values(selectedUser.socials).some(v => v) && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Connect</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {[
                      { key: 'twitter', label: '𝕏 Twitter / X', prefix: 'https://twitter.com/' },
                      { key: 'instagram', label: '📸 Instagram', prefix: 'https://instagram.com/' },
                      { key: 'linkedin', label: '💼 LinkedIn', prefix: 'https://' },
                      { key: 'github', label: '🐙 GitHub', prefix: 'https://' }
                    ].map(s => selectedUser.socials[s.key] ? (
                      <a key={s.key} href={selectedUser.socials[s.key].startsWith('http') ? selectedUser.socials[s.key] : `${s.prefix}${selectedUser.socials[s.key].replace('@','')}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', textDecoration: 'none', color: 'var(--text-main)', fontSize: '0.9rem', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.2s', fontWeight: '500' }}>
                        <span>{s.label}</span>
                        <span style={{ marginLeft: 'auto', color: 'var(--primary)', opacity: 0.8 }}>Visit &rarr;</span>
                      </a>
                    ) : null)}
                  </div>
                </div>
              )}
              {!selectedUser.socials || !Object.values(selectedUser.socials || {}).some(v => v) ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>No social links added yet.</p>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active Proof Lightbox Modal ── */}
      <AnimatePresence>
        {activeProofPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveProofPreview(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="glass-panel"
              style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '24px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    {activeProofPreview.taskTitle}
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Submitted by <strong>{activeProofPreview.userName}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <a
                    href={activeProofPreview.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-main)',
                      borderRadius: '8px',
                      padding: '0.45rem 0.75rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                    title="Open in new tab"
                  >
                    <FiExternalLink size={13} /> Full Size
                  </a>
                  <button
                    onClick={() => setActiveProofPreview(null)}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      transition: 'background 0.2s'
                    }}
                  >
                    <FiX size={18} />
                  </button>
                </div>
              </div>

              {/* Image Container */}
              <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.3)', overflow: 'hidden', minHeight: '240px', maxHeight: '58vh' }}>
                <img
                  src={activeProofPreview.url}
                  alt={activeProofPreview.taskTitle}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '56vh',
                    objectFit: 'contain',
                    borderRadius: '12px'
                  }}
                />
              </div>

              {/* Caption / Note if any */}
              {activeProofPreview.proofText && (
                <div style={{ padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  "{activeProofPreview.proofText}"
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── Birthday Celebration Modal ── */}
      <BirthdayModal
        isOpen={showBirthdayModal}
        onClose={handleCloseBirthday}
        celebrationData={birthdayData}
      />
    </div>
  );
}
