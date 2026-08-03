import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, where, doc } from 'firebase/firestore';
import { FiTarget, FiAward, FiTrendingUp, FiClock, FiAlertCircle, FiUsers, FiActivity, FiPieChart, FiZap, FiSearch, FiBell, FiSun, FiMenu, FiStar, FiCheckCircle, FiShield, FiUser, FiDollarSign } from 'react-icons/fi';
import { getWeekId } from '../utils/weekUtils';

export default function LiveFeedPage({ user, userData }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [liveFeed, setLiveFeed] = useState([]);
  const [allGoals, setAllGoals] = useState([]);
  const [userCount, setUserCount] = useState(0);
  const [topPerformer, setTopPerformer] = useState(null);
  const [usersMap, setUsersMap] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  
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
    const q = query(goalsRef, where('weekId', '==', selectedWeekId));
    
    const unsubscribeGoals = onSnapshot(q, (snapshot) => {
      const goals = [];
      snapshot.forEach(doc => goals.push({ id: doc.id, ...doc.data() }));
      
      // Sort by updatedAt descending in memory
      goals.sort((a, b) => {
        const dateA = a.updatedAt?.toDate() || 0;
        const dateB = b.updatedAt?.toDate() || 0;
        return dateB - dateA;
      });

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
    return acc + (goal.tasks ? goal.tasks.filter(t => t.status === 'Completed' && t.reviewed).length : 0);
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
    return goal.userName?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100%', padding: '0 2rem 4rem' }}>
      
      {/* Blurred Background Elements */}
      <div style={{ position: 'fixed', top: '10%', left: '5%', width: '300px', height: '300px', background: 'var(--primary)', filter: 'blur(150px)', opacity: 0.1, zIndex: -1 }}></div>
      <div style={{ position: 'fixed', bottom: '10%', right: '5%', width: '400px', height: '400px', background: 'var(--secondary)', filter: 'blur(150px)', opacity: 0.1, zIndex: -1 }}></div>

      {/* Main Title Area */}
      <div style={{ marginBottom: '3rem', marginTop: '2rem' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>TEC Accountability</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Track, Execute, Complete: Watch the community grow in real time.</p>
      </div>

      {/* Stats Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        {[
          { label: 'Active Tasks', value: activeTasks, icon: <FiZap />, trend: '+12%', color: '#6366f1' },
          { label: 'Team Members', value: userCount, icon: <FiUsers />, trend: '+2', color: '#a855f7' },
          { label: 'Completion Rate', value: `${completionRate}%`, icon: <FiTrendingUp />, trend: '+5%', color: '#ec4899' },
          { label: 'Avg. Time', value: `${avgTime}h`, icon: <FiClock />, trend: '-15%', color: '#3b82f6' }
        ].map((stat, idx) => (
          <div key={idx} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${stat.color}22`, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                {stat.icon}
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: stat.trend.startsWith('+') ? '#10b981' : '#f43f5e' }}>{stat.trend}</span>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.25rem' }}>{stat.value}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>
      {/* ── Partner Assignment Popup ── */}
      {myPairing && showPartnerModal && !partnerDismissed && !myPairing.teamRewarded && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            background: 'var(--bg-card)',
            maxWidth: '440px', width: '100%', padding: '2.5rem 2rem',
            borderRadius: '24px', textAlign: 'center', position: 'relative',
            border: '1px solid rgba(99,102,241,0.4)',
            boxShadow: '0 0 60px rgba(99,102,241,0.2)'
          }}>
            <button
              onClick={() => { setShowPartnerModal(false); setPartnerDismissed(true); }}
              style={{ position: 'absolute', top: '1rem', right: '1.25rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
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

            <button
              onClick={() => { setShowPartnerModal(false); setPartnerDismissed(true); }}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.875rem', fontWeight: '700', fontSize: '1rem' }}
            >
              Got it — Let's Go! 🚀
            </button>
          </div>
        </div>
      )}

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
          <div style={{
            background: allTop3 ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
            border: allTop3 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '1rem 1.5rem', marginBottom: '2rem',
            display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap'
          }}>
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
          </div>
        );
      })()}

      {/* Deadlines Section (If Active) */}
      {(timeLeft.setup !== 'EXPIRED' || timeLeft.completion !== 'EXPIRED') && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '3rem' }}>
          {timeLeft.setup && timeLeft.setup !== 'EXPIRED' && (
            <div className="glass-panel" style={{ flex: 1, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--primary)' }}>
              <FiClock size={20} color="var(--primary)" />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Goal Setting Deadline</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'monospace' }}>{timeLeft.setup}</div>
              </div>
            </div>
          )}
          {timeLeft.completion && timeLeft.completion !== 'EXPIRED' && (
            <div className="glass-panel" style={{ flex: 1, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--secondary)' }}>
              <FiClock size={20} color="var(--secondary)" />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Weekly Completion Deadline</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'monospace' }}>{timeLeft.completion}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="live-feed-layout">
        
        {/* Left Column: Activity Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.25rem' }}>Live Activity Feed</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Real-time updates from your team</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                background: 'rgba(255,255,255,0.05)', 
                borderRadius: '12px', 
                padding: '0.5rem 1rem', 
                border: '1px solid rgba(255,255,255,0.1)', 
                minWidth: '250px' 
              }}>
                <FiSearch style={{ color: 'var(--text-secondary)', marginRight: '0.75rem' }} />
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-main)', outline: 'none', width: '100%' }} 
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <button 
                  onClick={handlePrevWeek} 
                  className="btn btn-secondary" 
                  style={{ padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.9rem' }}
                >
                  ← Previous Week
                </button>
                
                <div style={{ padding: '0 1rem', fontWeight: '700', fontSize: '0.95rem', minWidth: '130px', textAlign: 'center' }}>
                  {selectedWeekId === currentWeekId ? 'Current Week' : selectedWeekId}
                </div>
                
                <button 
                  onClick={handleNextWeek} 
                  disabled={selectedWeekId === currentWeekId}
                  className="btn btn-secondary" 
                  style={{ 
                    padding: '0.5rem 1rem', 
                    borderRadius: '10px', 
                    fontSize: '0.9rem',
                    opacity: selectedWeekId === currentWeekId ? 0.4 : 1,
                    cursor: selectedWeekId === currentWeekId ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next Week →
                </button>
                
                {selectedWeekId !== currentWeekId && (
                  <button 
                    onClick={handleCurrentWeek} 
                    className="btn btn-primary" 
                    style={{ padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.9rem' }}
                  >
                    Current
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {filteredFeed.length > 0 ? filteredFeed.map(goal => {
              const userProfile = usersMap[goal.userId] || {};
              return (
              <div key={goal.id} className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
                  {/* Clickable Avatar */}
                  <div onClick={() => setSelectedUser({ ...userProfile, userName: goal.userName, userId: goal.userId, profilePicUrl: goal.profilePicUrl || userProfile.profilePicUrl, totalPoints: userProfile.totalPoints })} style={{ cursor: 'pointer', flexShrink: 0 }}>
                    {goal.profilePicUrl || userProfile.profilePicUrl ? (
                      <img src={goal.profilePicUrl || userProfile.profilePicUrl} alt={goal.userName} style={{ width: '52px', height: '52px', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                    ) : (
                      <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                        {goal.userName?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span onClick={() => setSelectedUser({ ...userProfile, userName: goal.userName, userId: goal.userId, profilePicUrl: goal.profilePicUrl || userProfile.profilePicUrl, totalPoints: userProfile.totalPoints })} style={{ fontWeight: '700', fontSize: '1.05rem', cursor: 'pointer', color: 'var(--text-main)' }}>{goal.userName}</span>
                          {userProfile.isAdmin ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }} title="Admin"><FiShield size={14} /></span>
                          ) : userProfile.isModerator ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }} title="Moderator"><FiCheckCircle size={14} /></span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--secondary)', border: '1px solid rgba(16, 185, 129, 0.3)' }} title="User"><FiUser size={14} /></span>
                          )}
                          {userProfile.status === 'On Break' && <span style={{ fontSize: '0.65rem', background: '#10b981', color: 'white', padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold' }}>🏖️ ON BREAK</span>}
                          {userProfile.status === 'On Hold' && <span style={{ fontSize: '0.65rem', background: 'var(--warning)', color: 'black', padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold' }}>⏸️ ON HOLD</span>}
                        </div>
                        {userProfile.profession && <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: '600', marginTop: '1px' }}>{userProfile.profession}</span>}
                        {userProfile.bio && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.4', maxWidth: '320px' }}>{userProfile.bio}</span>}
                        <div className="stars" style={{ marginTop: '4px' }}>
                          {[...Array(5)].map((_, i) => (
                            <FiStar key={i} size={12} fill={i < calculateStars(userProfile.totalPoints || 0) ? 'var(--star-color)' : 'none'} className={i < calculateStars(userProfile.totalPoints || 0) ? 'star-filled' : 'star-empty'} />
                          ))}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                        <FiClock size={12} /> {goal.updatedAt ? new Date(goal.updatedAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                      </span>
                    </div>
                    {(() => {
                      const reviewedCompleted = goal.tasks ? goal.tasks.filter(t => t.reviewed && t.status === 'Completed').length : 0;
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
                  {goal.tasks?.map((task, idx) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{task.description}</span>
                        <span style={{ fontSize: '0.7rem', color: (task.reviewed && task.status === 'Completed') ? '#10b981' : 'var(--text-secondary)', fontWeight: 'bold' }}>
                          {task.status || 'Pending'}
                        </span>
                      </div>
                      {(task.proofText || task.proofImage) && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span>Proof:</span>
                          {task.proofImage && task.proofImage.trim() !== '' && (
                            <a href={task.proofImage} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}>View Image</a>
                          )}
                          {task.proofText && task.proofText.trim() !== '' && (
                            <a href={task.proofText.startsWith('http') ? task.proofText : `https://${task.proofText}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}>View Link</a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              );
            }) : (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <FiActivity size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p>Waiting for the first activity of the week...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: '2rem' }}>
          
          {/* Top Performer Card */}
          <div style={{ 
            background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
            borderRadius: '24px', 
            padding: '2.5rem 2rem', 
            textAlign: 'center', 
            color: 'white',
            boxShadow: '0 20px 40px rgba(168, 85, 247, 0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
            <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem', letterSpacing: '1px' }}>Top Performer</div>
            
            {topPerformer ? (
              <>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1.5rem' }}>
                  {topPerformer.profilePicUrl || usersMap[topPerformer.userId]?.profilePicUrl ? (
                    <img src={topPerformer.profilePicUrl || usersMap[topPerformer.userId]?.profilePicUrl} alt={topPerformer.userName} style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(255,255,255,0.2)' }} />
                  ) : (
                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold' }}>
                      {topPerformer.userName?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: '0', right: '0', background: '#eab308', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #a855f7' }}>
                    <FiAward size={14} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0 }}>{topPerformer.userName}</h4>
                  {usersMap[topPerformer.userId]?.isAdmin ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.3rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }} title="Admin"><FiShield size={18} /></span>
                  ) : usersMap[topPerformer.userId]?.isModerator ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.3rem', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }} title="Moderator"><FiCheckCircle size={18} /></span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.3rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--secondary)', border: '1px solid rgba(16, 185, 129, 0.3)' }} title="User"><FiUser size={18} /></span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '1rem' }}>
                  {[...Array(5)].map((_, i) => (
                    <FiStar 
                      key={i} 
                      size={20} 
                      fill={i < calculateStars(usersMap[topPerformer.userId]?.totalPoints || 0) ? '#fff' : 'none'} 
                      stroke={i < calculateStars(usersMap[topPerformer.userId]?.totalPoints || 0) ? 'none' : 'rgba(255,255,255,0.4)'}
                    />
                  ))}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.6rem 1.2rem', borderRadius: '12px', display: 'inline-block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '1rem' }}>
                  🌟 {topPerformer.weeklyPoints || 0} Points this week
                </div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <FiCheckCircle size={14} /> Verified Achievement
                </div>
              </>
            ) : (
              <p style={{ opacity: 0.7 }}>Competition is heating up!</p>
            )}
          </div>

          {/* Top 3 Setters */}
          <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.5rem' }}>Top 3 for the week</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                  return <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Waiting for users to set goals...</p>;
                }

                return top3.map((g, i) => {
                  const progress = g.progress || 0;
                  return (
                    <div key={g.id} style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : '#b45309' }}>#{i + 1}</div>
                        {g.profilePicUrl ? (
                          <img src={g.profilePicUrl} alt={g.userName} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                            {g.userName?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.userName}</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? 'var(--secondary)' : 'var(--primary)', transition: 'width 0.3s ease' }}></div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {progress}% Completed
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Profile Modal ── */}
      {selectedUser && (
        <div onClick={() => setSelectedUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '2rem', borderRadius: '20px', position: 'relative' }}>
            <button onClick={() => setSelectedUser(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>

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
          </div>
        </div>
      )}
    </div>
  );
}
