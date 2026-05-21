import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, query, onSnapshot, doc, updateDoc,
  addDoc, serverTimestamp, setDoc, increment, where, deleteDoc, orderBy
} from 'firebase/firestore';
import { FiUsers, FiDollarSign, FiClock, FiCheckCircle, FiXCircle, FiFileText, FiSettings, FiTrash2, FiBell } from 'react-icons/fi';
import { getWeekId } from '../utils/weekUtils';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers]         = useState([]);
  const [sessions, setSessions]   = useState([]);
  const [goalDocs, setGoalDocs]   = useState([]);
  const [newCode, setNewCode]           = useState('');
  const [newSessionType, setNewSessionType] = useState('Wednesday');
  const [setupDeadline, setSetupDeadline] = useState('');
  const [completionDeadline, setCompletionDeadline] = useState('');
  const [weekSettings, setWeekSettings] = useState(null);

  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ message: '', type: 'General', assignedUserId: '' });

  // Grace period state
  const [graceDeadlines, setGraceDeadlines] = useState({}); // { [goalDocId_type]: datetime string }

  // Moderator state
  const [moderatorUserId, setModeratorUserId] = useState('');

  // System Wallet state
  const [systemWallet, setSystemWallet] = useState(0);
  
  // Get current weekId (Mon–Sun)
  const currentWeekId = getWeekId(new Date());


  useEffect(() => {
    // Listen to users
    const unsubUsers = onSnapshot(query(collection(db, 'users')), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to attendance sessions
    const unsubSessions = onSnapshot(query(collection(db, 'attendance_sessions')), (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to ALL weekly_goals submissions (pending review)
    const unsubGoals = onSnapshot(query(collection(db, 'weekly_goals')), (snap) => {
      setGoalDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to week settings
    const unsubSettings = onSnapshot(doc(db, 'week_settings', currentWeekId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setWeekSettings(data);
        setSetupDeadline(data.setupDeadline || '');
        setCompletionDeadline(data.completionDeadline || '');
        setModeratorUserId(data.moderatorUserId || '');
      } else {
        setWeekSettings(null);
      }
    });

    // Listen to system wallet
    const unsubSystemWallet = onSnapshot(doc(db, 'system_data', 'wallet'), (snap) => {
      if (snap.exists()) {
        setSystemWallet(snap.data().adminBalance || 0);
      }
    });

    // Listen to announcements
    const unsubAnnouncements = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')), (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { 
      unsubUsers(); 
      unsubSessions(); 
      unsubGoals(); 
      unsubSettings(); 
      unsubAnnouncements(); 
      unsubSystemWallet();
    };
  }, [currentWeekId]);


  // ── Grace Period Management ───────────────────────────────────────────────
  const handleGrantGrace = async (goalDoc, type) => {
    const key = `${goalDoc.id}_${type}`;
    const deadlineStr = graceDeadlines[key];
    if (!deadlineStr) {
      alert('Please select a grace period deadline first.');
      return;
    }
    try {
      const goalDocRef = doc(db, 'weekly_goals', goalDoc.id);
      await setDoc(goalDocRef, {
        graceRequest: {
          ...(goalDoc.graceRequest || {}),
          [type]: {
            ...(goalDoc.graceRequest?.[type] || {}),
            status: 'granted',
            graceDeadline: deadlineStr,
            grantedAt: new Date().toISOString()
          }
        }
      }, { merge: true });
      alert(`Grace period granted! User has until ${new Date(deadlineStr).toLocaleString()} to complete the ${type === 'setup' ? 'goal setting' : 'task submission'}.`);
    } catch (err) {
      console.error(err);
      alert('Error granting grace period.');
    }
  };

  const handleDenyGrace = async (goalDoc, type) => {
    if (!window.confirm(`Deny the ${type === 'setup' ? 'Goal Setting' : 'Task Submission'} grace request for ${goalDoc.userName}? Their penalty fee will NOT be refunded.`)) return;
    try {
      const goalDocRef = doc(db, 'weekly_goals', goalDoc.id);
      await setDoc(goalDocRef, {
        graceRequest: {
          ...(goalDoc.graceRequest || {}),
          [type]: {
            ...(goalDoc.graceRequest?.[type] || {}),
            status: 'denied',
            deniedAt: new Date().toISOString()
          }
        }
      }, { merge: true });
      alert('Grace request denied.');
    } catch (err) {
      console.error(err);
      alert('Error denying grace request.');
    }
  };

  // ── Moderator Management ─────────────────────────────────────────────────
  const handleAssignModerator = async (userId) => {
    const u = users.find(x => x.id === userId);
    if (!u) return;
    if (!window.confirm(`Assign ${u.name} as this week's moderator? They will be able to review and verify task proofs.`)) return;
    try {
      await setDoc(doc(db, 'week_settings', currentWeekId), {
        moderatorUserId: userId,
        moderatorName: u.name,
        moderatorProfilePic: u.profilePicUrl || '',
        updatedAt: serverTimestamp()
      }, { merge: true });
      await updateDoc(doc(db, 'users', userId), { isModerator: true, moderatorWeekId: currentWeekId });
      alert(`${u.name} has been assigned as moderator for this week.`);
    } catch (err) {
      console.error(err);
      alert('Error assigning moderator.');
    }
  };

  const handleRemoveModerator = async () => {
    const prevId = weekSettings?.moderatorUserId;
    if (!window.confirm('Remove the current moderator for this week?')) return;
    try {
      await setDoc(doc(db, 'week_settings', currentWeekId), {
        moderatorUserId: null,
        moderatorName: null,
        moderatorProfilePic: null,
        updatedAt: serverTimestamp()
      }, { merge: true });
      if (prevId) {
        await updateDoc(doc(db, 'users', prevId), { isModerator: false, moderatorWeekId: null });
      }
      alert('Moderator removed.');
    } catch (err) {
      console.error(err);
      alert('Error removing moderator.');
    }
  };

  // ── Announcements ─────────────────────────────────────────────────────────
  const handlePostAnnouncement = async () => {
    if (!newAnnouncement.message.trim()) return alert('Please enter an announcement message.');
    
    const data = {
      message: newAnnouncement.message.trim(),
      type: newAnnouncement.type,
      active: true,
      createdAt: serverTimestamp()
    };

    if (newAnnouncement.type === 'Moderator' && newAnnouncement.assignedUserId) {
      const u = users.find(x => x.id === newAnnouncement.assignedUserId);
      if (u) {
        data.moderator = {
          name: u.name,
          profession: u.profession || '',
          profilePicUrl: u.profilePicUrl || ''
        };
      }
    }

    await addDoc(collection(db, 'announcements'), data);
    setNewAnnouncement({ message: '', type: 'General', assignedUserId: '' });
  };

  const handleToggleAnnouncement = async (id, current) => {
    await updateDoc(doc(db, 'announcements', id), { active: !current });
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    await deleteDoc(doc(db, 'announcements', id));
  };

  // ── User Management ────────────────────────────────────────────────────────
  const handleApproveUser = async (userId, balance) => {
    if (balance < 1000) {
      alert('User must have at least ₦1,000 in their wallet to be approved.');
      return;
    }
    await updateDoc(doc(db, 'users', userId), { status: 'Active' });
  };

  const handleFundWallet = async (userId, currentBalance) => {
    const amount = prompt('Enter amount to ADD to wallet (₦):');
    if (!amount || isNaN(amount)) return;
    await updateDoc(doc(db, 'users', userId), {
      walletBalance: (currentBalance || 0) + parseInt(amount)
    });
  };

  const handleApproveBreak = async (userId) => {
    if (!window.confirm('Approve this 1-week break request?')) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'On Break',
        'breakRequest.status': 'granted',
        lastBreakApprovedAt: new Date().toISOString()
      });
      alert('Break approved! User is now on break for the rest of the week.');
    } catch (err) {
      console.error(err);
      alert('Error approving break.');
    }
  };

  const handleDenyBreak = async (userId) => {
    if (!window.confirm('Deny this break request?')) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        'breakRequest.status': 'denied',
        'breakRequest.deniedAt': new Date().toISOString()
      });
      alert('Break request denied.');
    } catch (err) {
      console.error(err);
      alert('Error denying break.');
    }
  };

  const handlePlaceOnHold = async (userId) => {
    if (!window.confirm('Place this account on EMERGENCY HOLD? User will be inactive and exempt from penalties until released.')) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'On Hold',
        onHold: true,
        holdAt: new Date().toISOString()
      });
      alert('Account placed on emergency hold.');
    } catch (err) {
      console.error(err);
      alert('Error placing hold.');
    }
  };

  const handleReleaseHold = async (userId) => {
    if (!window.confirm('Release this account from hold and set status to Active?')) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'Active',
        onHold: null,
        holdReleaseRequestedAt: null
      });
      alert('Account released from hold.');
    } catch (err) {
      console.error(err);
      alert('Error releasing hold.');
    }
  };

  const handleUpdateSetup = async () => {
    if (!setupDeadline) return alert('Please select a setup deadline.');
    await setDoc(doc(db, 'week_settings', currentWeekId), {
      setupDeadline,
      updatedAt: serverTimestamp()
    }, { merge: true });
    alert('Goal Setting Deadline updated.');
  };

  const handleUpdateCompletion = async () => {
    if (!completionDeadline) return alert('Please select a completion deadline.');
    await setDoc(doc(db, 'week_settings', currentWeekId), {
      completionDeadline,
      updatedAt: serverTimestamp()
    }, { merge: true });
    alert('Completion Deadline updated.');
  };

  const handleCancelSetup = async () => {
    if (!window.confirm('Cancel the Goal Setting deadline?')) return;
    await setDoc(doc(db, 'week_settings', currentWeekId), {
      setupDeadline: null,
      updatedAt: serverTimestamp()
    }, { merge: true });
    setSetupDeadline('');
    alert('Goal Setting Deadline cancelled.');
  };

  const handleCancelCompletion = async () => {
    if (!window.confirm('Cancel the Completion deadline?')) return;
    await setDoc(doc(db, 'week_settings', currentWeekId), {
      completionDeadline: null,
      updatedAt: serverTimestamp()
    }, { merge: true });
    setCompletionDeadline('');
    alert('Completion Deadline cancelled.');
  };

  const handleDeleteDeadlines = async () => {
    if (!window.confirm('Are you sure you want to delete all deadlines for this week? All locks will be removed.')) return;
    await deleteDoc(doc(db, 'week_settings', currentWeekId));
    setSetupDeadline('');
    setCompletionDeadline('');
    alert('Deadlines deleted.');
  };

  const handleAwardTopPerformer = async () => {
    if (weekSettings?.bonusAwarded) {
      alert('The weekly bonus has already been awarded for this week.');
      return;
    }

    // Find user with highest weeklyPoints in goalDocs
    if (goalDocs.length === 0) return alert('No participants yet this week.');
    
    let top = goalDocs[0];
    for (const g of goalDocs) {
      if ((g.weeklyPoints || 0) > (top.weeklyPoints || 0)) {
        top = g;
      }
    }

    if (!top || (top.weeklyPoints || 0) === 0) return alert('No points earned yet this week.');

    if (!window.confirm(`Award 3 bonus points to the Top Performer: ${top.userName}?`)) return;

    try {
      await updateDoc(doc(db, 'weekly_goals', top.id), {
        weeklyPoints: increment(3),
        awardedBonus: true
      });
      await updateDoc(doc(db, 'users', top.userId), {
        totalPoints: increment(3)
      });
      
      // Mark as awarded in week settings
      await setDoc(doc(db, 'week_settings', currentWeekId), {
        bonusAwarded: true
      }, { merge: true });

      alert(`Success! 3 bonus points awarded to ${top.userName}.`);
    } catch (err) {
      console.error(err);
      alert('Error awarding points.');
    }
  };




  const handleDeleteUser = async (userId, userName) => {
    const confirmed = window.confirm(
      `⚠️ PERMANENTLY DELETE "${userName}"?\n\nThis will remove all their data from Firestore including goals and profile. This action CANNOT be undone.`
    );
    if (!confirmed) return;

    // Double-confirm for safety
    const reconfirmed = window.confirm(`Are you absolutely sure you want to delete ${userName}'s account?`);
    if (!reconfirmed) return;

    try {
      // Delete user Firestore document
      await deleteDoc(doc(db, 'users', userId));

      // Delete their weekly goals for the current week
      const goalDocId = `${userId}_${currentWeekId}`;
      await deleteDoc(doc(db, 'weekly_goals', goalDocId));

      alert(`"${userName}" has been permanently deleted.`);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error deleting user. Please try again.');
    }
  };


  const handleResetUser = async (userId) => {
    if (!window.confirm('Are you sure you want to RESET this user? Their points will be set to 0, wallet to ₦0, and current weekly goals will be cleared.')) return;
    
    try {
      // 1. Reset user stats
      await updateDoc(doc(db, 'users', userId), {
        totalPoints: 0,
        walletBalance: 0,
        status: 'Active'
      });

      // 2. Clear current weekly goals
      const now = new Date();
      const weekId = getWeekId(now);
      const goalDocId = `${userId}_${weekId}`;
      const goalDocRef = doc(db, 'weekly_goals', goalDocId);
      
      // We set it to an empty state or delete it. Deleting is cleaner for a full reset.
      // But to avoid UI flickers or errors in Dashboard.jsx, let's just delete it.
      // Or set it back to the initial 3 empty tasks state.
      await setDoc(goalDocRef, {
        tasks: [],
        reviewStatus: 'none', // reset status
        progress: 0
      }, { merge: false }); // merge: false overwrites everything

      alert('User account and weekly goals have been reset.');
    } catch (err) {
      console.error('Reset error:', err);
      alert('Error resetting user.');
    }
  };


  // ── Attendance Sessions ────────────────────────────────────────────────────
  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newCode) return;
    await addDoc(collection(db, 'attendance_sessions'), {
      secretCode: newCode,
      dayOfWeek: newSessionType,
      isActive: true,
      createdAt: serverTimestamp()
    });
    setNewCode('');
  };

  const toggleSession = async (sessionId, currentStatus) => {
    await updateDoc(doc(db, 'attendance_sessions', sessionId), {
      isActive: !currentStatus
    });
  };

  // ── Goal Review: Approve (+1 pt) ───────────────────────────────────────────
  const handleApproveTask = async (goalDoc, taskIndex) => {
    const task = goalDoc.tasks[taskIndex];
    if (task.reviewed) return;

    const updatedTasks = goalDoc.tasks.map((t, i) =>
      i === taskIndex ? { ...t, reviewed: true, adminAction: 'approved' } : t
    );

    // Check if all tasks are now reviewed
    const allReviewed = updatedTasks.every(t => t.reviewed);

    const isCompulsory = taskIndex < 3;

    await updateDoc(doc(db, 'weekly_goals', goalDoc.id), {
      tasks: updatedTasks,
      reviewStatus: allReviewed ? 'reviewed' : 'in_review',
      ...(isCompulsory ? { weeklyPoints: increment(1) } : {})
    });

    // ── Check for Early Bird Completion ──
    if (allReviewed) {
      const isActuallyCompleted = updatedTasks.every(t => t.status === 'Completed' && t.adminAction === 'approved');
      if (isActuallyCompleted) {
        const goalsRef = collection(db, 'weekly_goals');
        const q = query(goalsRef, where('weekId', '==', goalDoc.weekId), where('isFirstToComplete', '==', true), limit(1));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          // This is the first person to complete all goals
          await updateDoc(doc(db, 'weekly_goals', goalDoc.id), {
            isFirstToComplete: true,
            weeklyPoints: increment(3)
          });
          await updateDoc(doc(db, 'users', goalDoc.userId), {
            totalPoints: increment(3)
          });
          alert(`Early Bird Completion! ${goalDoc.userName} is the first to finish all goals. +3 bonus points awarded.`);
        }
      }
    }

    // Award +1 point to the user (only if compulsory)
    if (isCompulsory) {
      await updateDoc(doc(db, 'users', goalDoc.userId), {
        totalPoints: increment(1)
      });
    }
  };

  // ── Goal Review: Reject (Keep editable for user) ──────────────────────────
  const handleRejectTask = async (goalDoc, taskIndex) => {
    const task = goalDoc.tasks[taskIndex];
    if (task.reviewed) return;

    const reason = prompt('Enter rejection reason (will be visible to the user):');
    if (reason === null) return; // user clicked cancel

    const newCount = (task.rejectionCount || 0) + 1;

    const updatedTasks = goalDoc.tasks.map((t, i) =>
      i === taskIndex ? { 
        ...t, 
        reviewed: false, 
        adminAction: 'rejected', 
        rejectionReason: reason || 'Proof insufficient or not accepted.',
        rejectionCount: newCount
      } : t
    );

    await updateDoc(doc(db, 'weekly_goals', goalDoc.id), {
      tasks: updatedTasks,
      reviewStatus: 'in_review'
    });

    if (newCount >= 3) {
      alert(`Warning: This goal has been rejected ${newCount} times. You can now permanently lock it if needed.`);
    }
  };

  const handlePermanentReject = async (goalDoc, taskIndex) => {
    const task = goalDoc.tasks[taskIndex];
    if (task.reviewed) return;
    if (!window.confirm('Permanently lock and reject this goal? User will not be able to edit it again, and 1 point will be deducted.')) return;

    const updatedTasks = goalDoc.tasks.map((t, i) =>
      i === taskIndex ? { 
        ...t, 
        reviewed: true, 
        adminAction: 'permanently_rejected', 
        rejectionReason: 'Permanently rejected after multiple failed attempts.'
      } : t
    );

    const allReviewed = updatedTasks.every(t => t.reviewed);

    const isCompulsory = taskIndex < 3;

    await updateDoc(doc(db, 'weekly_goals', goalDoc.id), {
      tasks: updatedTasks,
      reviewStatus: allReviewed ? 'reviewed' : 'in_review',
      ...(isCompulsory ? { weeklyPoints: increment(-1) } : {})
    });

    // Deduct -1 point for failure (only if compulsory)
    if (isCompulsory) {
      await updateDoc(doc(db, 'users', goalDoc.userId), {
        totalPoints: increment(-1)
      });
    }
  };

  // ── Goal Review: Deduct (-1 pt) ────────────────────────────────────────────
  const handleDeductTask = async (goalDoc, taskIndex) => {
    const task = goalDoc.tasks[taskIndex];
    if (task.reviewed) return;

    const updatedTasks = goalDoc.tasks.map((t, i) =>
      i === taskIndex ? { ...t, reviewed: true, adminAction: 'deducted' } : t
    );

    const allReviewed = updatedTasks.every(t => t.reviewed);

    const isCompulsory = taskIndex < 3;

    await updateDoc(doc(db, 'weekly_goals', goalDoc.id), {
      tasks: updatedTasks,
      reviewStatus: allReviewed ? 'reviewed' : 'in_review',
      ...(isCompulsory ? { weeklyPoints: increment(-1) } : {})
    });

    // Deduct -1 point from the user (only if compulsory)
    if (isCompulsory) {
      await updateDoc(doc(db, 'users', goalDoc.userId), {
        totalPoints: increment(-1)
      });
    }
  };


  // ── Weekly Evaluation ──────────────────────────────────────────────────────
  const handleEvaluateWeek = async () => {
    if (!window.confirm('Run the weekly evaluation? This will suspend users for performance/balance and collect penalties.')) return;

    let totalDeducted = 0;
    
    // Calculate previous week ID
    const prevWeekDate = new Date(nowForWeek);
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    const startPrevYear = new Date(prevWeekDate.getFullYear(), 0, 1);
    const prevWeekNumber = Math.ceil(((prevWeekDate - startPrevYear) / 86400000 + startPrevYear.getDay() + 1) / 7);
    const prevWeekId = `${prevWeekDate.getFullYear()}-W${String(prevWeekNumber).padStart(2, '0')}`;

    for (const u of users) {
      // ── Skip users on Emergency Hold ──
      if (u.status === 'On Hold') continue;

      // ── Handle users on 1-Week Break ──
      if (u.status === 'On Break') {
        // Break ends at evaluation, user returns to Active for next week
        await updateDoc(doc(db, 'users', u.id), { status: 'Active' });
        continue;
      }

      if (u.status !== 'Active' && u.status !== 'Warning') continue;

      let newStatus = u.status;
      let newWallet = u.walletBalance || 0;
      let pointsDelta = 0;
      let punishedThisWeek = false;

      // Rule 1: Wallet Balance
      if (u.walletBalance < 1000) {
        newStatus = 'Suspended';
        punishedThisWeek = true;
      }

      // Rule 2: Performance
      const currentGoal = goalDocs.find(g => g.userId === u.id && g.weekId === currentWeekId);
      const ptsThisWeek = currentGoal?.weeklyPoints || 0;

      // ── Grace Period Failure Penalties ────────────────────────────────────
      const evalNow = new Date();
      if (currentGoal?.graceRequest) {
        const sg = currentGoal.graceRequest.setup;
        if (sg?.status === 'granted' && sg.graceDeadline) {
          const sgEnd = new Date(sg.graceDeadline);
          if (evalNow > sgEnd && (!currentGoal.tasks || currentGoal.tasks.length === 0)) {
            const userPts = (u.totalPoints || 0) + pointsDelta;
            if (userPts >= 20) { pointsDelta -= 20; }
            else { newWallet = Math.max(0, newWallet - 200); totalDeducted += 200; }
            punishedThisWeek = true;
          }
        }
        const cg = currentGoal.graceRequest.completion;
        if (cg?.status === 'granted' && cg.graceDeadline) {
          const cgEnd = new Date(cg.graceDeadline);
          if (evalNow > cgEnd && currentGoal.reviewStatus === 'pending') {
            const userPts = (u.totalPoints || 0) + pointsDelta;
            if (userPts >= 20) { pointsDelta -= 20; }
            else { newWallet = Math.max(0, newWallet - 200); totalDeducted += 200; }
            punishedThisWeek = true;
          }
        }
      }

      // Evaluation Rules from Plan
      if (ptsThisWeek < 2) {
        newStatus = 'Suspended';
        punishedThisWeek = true;
      } else if (ptsThisWeek < 5) {
        newStatus = 'Warning';
        punishedThisWeek = true;
      } else if (u.status === 'Warning' || u.status === 'Suspended') {
        newStatus = 'Active';
      }

      // Penalty: Deduct 1k if points < 5 (standard weekly penalty)
      if (ptsThisWeek < 5 && newWallet >= 1000) {
        newWallet -= 1000;
        totalDeducted += 1000;
        punishedThisWeek = true;
      }

      // ── Consistency Reward Logic ──
      let newConsecutive = (u.consecutiveGoodWeeks || 0);
      let newAchievementStars = (u.achievementStars || 0);

      if (!punishedThisWeek) {
        newConsecutive += 1;
        if (newConsecutive >= 4) {
          newConsecutive = 0;
          newAchievementStars += 1;
        }
      } else {
        newConsecutive = 0;
      }

      const updates = {};
      if (newStatus !== u.status) updates.status = newStatus;
      if (newWallet !== (u.walletBalance || 0)) updates.walletBalance = newWallet;
      if (pointsDelta !== 0) updates.totalPoints = increment(pointsDelta);
      if (newConsecutive !== (u.consecutiveGoodWeeks || 0)) updates.consecutiveGoodWeeks = newConsecutive;
      if (newAchievementStars !== (u.achievementStars || 0)) updates.achievementStars = newAchievementStars;
      
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', u.id), updates);
      }
    }

    if (totalDeducted > 0) {
      await setDoc(doc(db, 'system_data', 'wallet'), { adminBalance: increment(totalDeducted) }, { merge: true });
      alert(`Evaluation complete! ₦${totalDeducted} collected in penalties.`);
    } else {
      alert('Evaluation complete. No penalties applied.');
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this goal submission? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'weekly_goals', goalId));
      alert('Goal submission deleted successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to delete goal submission.');
    }
  };

  // Pending submissions count for badge
  const pendingCount = goalDocs.filter(g => g.reviewStatus === 'pending' || g.reviewStatus === 'in_review').length;

  // ── Platform-wide Stats ──
  const totalWalletBalance  = users.reduce((sum, u) => sum + (u.walletBalance  || 0), 0);
  const totalPoints         = users.reduce((sum, u) => sum + (u.totalPoints    || 0), 0);
  const totalWeeklyPoints   = goalDocs.filter(g => g.weekId === currentWeekId).reduce((sum, g) => sum + (g.weeklyPoints || 0), 0);
  const activeUsers         = users.filter(u => u.status === 'Active').length;
  const suspendedUsers      = users.filter(u => u.status === 'Suspended' || u.status === 'Warning').length;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

      {/* ── Platform Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {/* Total Wallet Balance */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.04)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: '1.4rem', display: 'flex' }}>💰</div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Wallet Funds</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981' }}>₦{totalWalletBalance.toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Across {users.length} accounts</div>
          </div>
        </div>

        {/* Total Points Generated */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.04)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(99,102,241,0.12)', fontSize: '1.4rem', display: 'flex' }}>⭐</div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Points (All Time)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)' }}>{totalPoints.toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Lifetime platform points</div>
          </div>
        </div>

        {/* This Week's Points */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(236,72,153,0.2)', background: 'rgba(236,72,153,0.04)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(236,72,153,0.12)', fontSize: '1.4rem', display: 'flex' }}>📈</div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Week's Points</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ec4899' }}>{totalWeeklyPoints.toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{currentWeekId}</div>
          </div>
        </div>

        {/* Active Members */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(245,158,11,0.12)', fontSize: '1.4rem', display: 'flex' }}>👥</div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Members</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--warning)' }}>{activeUsers} <span style={{ fontSize: '0.8rem', fontWeight: '400', color: 'var(--text-secondary)' }}>active</span></div>
            <div style={{ fontSize: '0.7rem', color: suspendedUsers > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
              {suspendedUsers > 0 ? `⚠ ${suspendedUsers} suspended/warning` : 'All in good standing'}
            </div>
          </div>
        </div>

        {/* System Revenue Wallet Card */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.05)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.12)', fontSize: '1.4rem', display: 'flex' }}>💎</div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>System Revenue</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--warning)' }}>₦{systemWallet.toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>From penalties & fees</div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>

        <button onClick={() => setActiveTab('users')} className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`} style={{ position: 'relative' }}>
          <FiUsers /> Manage Users
          {(() => {
            const pendingBreaks = users.filter(u => u.breakRequest?.status === 'pending').length;
            const pendingReleases = users.filter(u => u.holdReleaseRequestedAt).length;
            const total = pendingBreaks + pendingReleases;
            if (total === 0) return null;
            return (
              <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--danger)', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {total}
              </span>
            );
          })()}
        </button>
        <button onClick={() => setActiveTab('goals')} className={`btn ${activeTab === 'goals' ? 'btn-primary' : 'btn-secondary'}`} style={{ position: 'relative' }}>
          <FiFileText /> Review Goals
          {pendingCount > 0 && (
            <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--danger)', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {pendingCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('attendance')} className={`btn ${activeTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`}>
          <FiClock /> Attendance Control
        </button>
        <button onClick={() => setActiveTab('settings')} className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}>
          <FiSettings /> Weekly Settings
        </button>
        <button onClick={() => setActiveTab('announcements')} className={`btn ${activeTab === 'announcements' ? 'btn-primary' : 'btn-secondary'}`}>
          <FiBell /> Announcements
        </button>
        <button onClick={() => setActiveTab('grace')} className={`btn ${activeTab === 'grace' ? 'btn-primary' : 'btn-secondary'}`} style={{ position: 'relative' }}>
          ⏰ Grace Requests
          {goalDocs.filter(g => g.graceRequest && Object.values(g.graceRequest).some(r => r.status === 'pending')).length > 0 && (
            <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--danger)', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {goalDocs.filter(g => g.graceRequest && Object.values(g.graceRequest).some(r => r.status === 'pending')).length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('moderator')} className={`btn ${activeTab === 'moderator' ? 'btn-primary' : 'btn-secondary'}`} style={{ position: 'relative' }}>
          👤 Moderator
          {weekSettings?.moderatorUserId && <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '10px', height: '10px', background: '#10b981', borderRadius: '50%', border: '2px solid var(--bg-main)' }} />}
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={handleEvaluateWeek} className="btn btn-danger">
          Run Weekly Evaluation
        </button>
      </div>

      {/* ── Moderator Management ── */}
      {activeTab === 'moderator' && (() => {
        const currentMod = weekSettings?.moderatorUserId ? users.find(u => u.id === weekSettings.moderatorUserId) : null;
        const availableUsers = users.filter(u => u.status === 'Active' && !u.isAdmin);
        return (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>👤</div>
              <div>
                <h2 style={{ margin: 0 }}>Weekly Moderator</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Assign a member to moderate (verify) task proofs this week. They get access to the Moderator Review page.</p>
              </div>
            </div>

            {/* Current Moderator */}
            {currentMod ? (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                {currentMod.profilePicUrl ? (
                  <img src={currentMod.profilePicUrl} alt={currentMod.name} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #10b981' }} />
                ) : (
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
                    {currentMod.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{currentMod.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{currentMod.profession || currentMod.email}</div>
                  <div style={{ marginTop: '0.25rem' }}><span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.15rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700' }}>✅ ACTIVE MODERATOR — {currentWeekId}</span></div>
                </div>
                <button onClick={handleRemoveModerator} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', color: 'var(--danger)', borderColor: 'var(--danger)', whiteSpace: 'nowrap' }}>
                  🗑 Remove Moderator
                </button>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No moderator assigned for this week.
              </div>
            )}

            {/* Assign Moderator */}
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '1rem' }}>Assign a New Moderator</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
              {availableUsers.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', border: `1px solid ${weekSettings?.moderatorUserId === u.id ? '#10b981' : 'var(--border)'}`, borderRadius: '12px', background: weekSettings?.moderatorUserId === u.id ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)' }}>
                  {u.profilePicUrl ? (
                    <img src={u.profilePicUrl} alt={u.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary)', flexShrink: 0 }}>
                      {u.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.totalPoints || 0} pts</div>
                  </div>
                  {weekSettings?.moderatorUserId === u.id ? (
                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '700' }}>Current</span>
                  ) : (
                    <button onClick={() => handleAssignModerator(u.id)} className="btn btn-primary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Assign</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Grace Requests ── */}
      {activeTab === 'grace' && (() => {
        const graceGoals = goalDocs.filter(g => g.graceRequest && Object.values(g.graceRequest).some(r => r));
        return (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #ef4444, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>⏰</div>
              <div>
                <h2 style={{ margin: 0 }}>Grace Period Requests</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Review and set custom deadlines for users who missed the weekly deadline.</p>
              </div>
            </div>

            {graceGoals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No grace period requests yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {graceGoals.map(g => {
                  const types = ['setup', 'completion'].filter(t => g.graceRequest?.[t]);
                  return types.map(type => {
                    const req = g.graceRequest[type];
                    const key = `${g.id}_${type}`;
                    const label = type === 'setup' ? 'Goal Setting' : 'Task Submission';
                    const statusColor = req.status === 'pending' ? 'var(--warning)' : req.status === 'granted' ? '#10b981' : 'var(--danger)';
                    return (
                      <div key={key} style={{ border: `1px solid ${statusColor}33`, borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ background: `${statusColor}11`, padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <strong>{g.userName || g.userId}</strong>
                            <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', padding: '0.15rem 0.5rem', borderRadius: '10px', background: `${statusColor}22`, color: statusColor, fontWeight: '700' }}>{label}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '20px', background: `${statusColor}22`, color: statusColor, fontWeight: '700', textTransform: 'uppercase' }}>
                            {req.status}
                          </span>
                        </div>
                        <div style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            <span>📅 Requested: <strong>{req.requestedAt ? new Date(req.requestedAt).toLocaleString() : '—'}</strong></span>
                            <span>💳 Paid: <strong>{req.penaltyPaid || '—'}</strong></span>
                            {req.graceDeadline && <span>⏱ Grace Until: <strong>{new Date(req.graceDeadline).toLocaleString()}</strong></span>}
                          </div>

                          {req.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: '200px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Set Grace Deadline</label>
                                <input
                                  type="datetime-local"
                                  className="input-field"
                                  value={graceDeadlines[key] || ''}
                                  onChange={e => setGraceDeadlines(prev => ({ ...prev, [key]: e.target.value }))}
                                  style={{ padding: '0.6rem 0.75rem', fontSize: '0.875rem' }}
                                />
                              </div>
                              <button className="btn btn-primary" onClick={() => handleGrantGrace(g, type)} style={{ padding: '0.6rem 1.25rem', whiteSpace: 'nowrap' }}>
                                ✅ Grant Grace
                              </button>
                              <button className="btn btn-secondary" onClick={() => handleDenyGrace(g, type)} style={{ padding: '0.6rem 1rem', color: 'var(--danger)', borderColor: 'var(--danger)', whiteSpace: 'nowrap' }}>
                                ✗ Deny
                              </button>
                            </div>
                          )}
                          {req.status === 'granted' && (
                            <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '600' }}>✅ Grace period granted. Expires: {req.graceDeadline ? new Date(req.graceDeadline).toLocaleString() : '—'}</div>
                          )}
                          {req.status === 'denied' && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: '600' }}>✗ Grace request denied.</div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Announcements ── */}
      {activeTab === 'announcements' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>📢</div>
            <div>
              <h2 style={{ margin: 0 }}>Announcements</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Post scrolling announcements visible to all users on every page.</p>
            </div>
          </div>

          {/* Create New Announcement */}
          <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '700' }}>📝 Post New Announcement</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Category</label>
                <select
                  className="input-field"
                  value={newAnnouncement.type}
                  onChange={(e) => setNewAnnouncement(prev => ({ ...prev, type: e.target.value }))}
                  style={{ padding: '0.6rem 0.75rem', fontSize: '0.875rem' }}
                >
                  {['General', 'Moderator', 'Seminar', 'Training', 'Event', 'Urgent'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {newAnnouncement.type === 'Moderator' && (
                <div style={{ flex: '1 1 180px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Assign User</label>
                  <select
                    className="input-field"
                    value={newAnnouncement.assignedUserId}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, assignedUserId: e.target.value }))}
                    style={{ padding: '0.6rem 0.75rem', fontSize: '0.875rem' }}
                  >
                    <option value="">Select User...</option>
                    {users.filter(u => u.status === 'Active').map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ flex: '3 1 200px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Message</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. This week's moderator is John Doe — Wednesday 7PM"
                  value={newAnnouncement.message}
                  onChange={(e) => setNewAnnouncement(prev => ({ ...prev, message: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handlePostAnnouncement()}
                  style={{ padding: '0.6rem 0.75rem', fontSize: '0.875rem' }}
                />
              </div>
              <button className="btn btn-primary" onClick={handlePostAnnouncement} style={{ padding: '0.6rem 1.25rem', whiteSpace: 'nowrap', flex: '1 1 auto' }}>
                <FiBell /> Post
              </button>
            </div>
          </div>

          {/* Existing Announcements */}
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '700' }}>All Announcements</h3>
          {announcements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              No announcements yet. Post one above to get started!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {announcements.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: a.active ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${a.active ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`, borderRadius: '12px', transition: 'all 0.2s' }}>
                  {/* Type badge */}
                  <span style={{ flexShrink: 0, padding: '0.2rem 0.65rem', background: a.active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)', color: a.active ? 'var(--primary)' : 'var(--text-secondary)', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{a.type}</span>
                  {/* Message */}
                  <span style={{ flex: 1, fontSize: '0.9rem', color: a.active ? 'var(--text-main)' : 'var(--text-secondary)', textDecoration: a.active ? 'none' : 'line-through' }}>{a.message}</span>
                  {/* Status pill */}
                  <span style={{ flexShrink: 0, fontSize: '0.7rem', fontWeight: '700', padding: '0.2rem 0.6rem', borderRadius: '20px', background: a.active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)', color: a.active ? '#10b981' : '#ef4444' }}>
                    {a.active ? 'LIVE' : 'HIDDEN'}
                  </span>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      onClick={() => handleToggleAnnouncement(a.id, a.active)}
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
                      title={a.active ? 'Hide from ticker' : 'Show in ticker'}
                    >
                      {a.active ? '⏸ Hide' : '▶ Show'}
                    </button>
                    <button
                      onClick={() => handleDeleteAnnouncement(a.id)}
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    >
                      <FiTrash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Manage Users ── */}
      {activeTab === 'users' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2>User Management</h2>
          <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '1rem' }}>Name / Email</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                  <th style={{ padding: '1rem' }}>Wallet (₦)</th>
                  <th style={{ padding: '1rem' }}>Points</th>
                  <th style={{ padding: '1rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem' }}>
                      <strong>{u.name || 'No Name'}</strong><br />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.email}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', background: u.status === 'Active' ? 'var(--secondary)' : (u.status === 'Pending' ? 'var(--warning)' : 'var(--danger)'), color: 'white' }}>
                        {u.status || 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>₦{u.walletBalance || 0}</td>
                    <td style={{ padding: '1rem' }}>{u.totalPoints || 0}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary" onClick={() => handleFundWallet(u.id, u.walletBalance)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                          <FiDollarSign /> Fund
                        </button>

                        {/* Break Request */}
                        {u.breakRequest?.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button className="btn btn-primary" onClick={() => handleApproveBreak(u.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#10b981' }}>
                              Grant Break
                            </button>
                            <button className="btn btn-secondary" onClick={() => handleDenyBreak(u.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                              Deny
                            </button>
                          </div>
                        )}

                        {/* Hold / Release */}
                        {u.status === 'On Hold' || u.holdReleaseRequestedAt ? (
                          <button className="btn btn-primary" onClick={() => handleReleaseHold(u.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#10b981' }}>
                            Release Hold {u.holdReleaseRequestedAt && ' (Requested)'}
                          </button>
                        ) : (
                          <button className="btn btn-secondary" onClick={() => handlePlaceOnHold(u.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--warning)', borderColor: 'var(--warning)' }}>
                            Hold Account
                          </button>
                        )}

                        {u.status !== 'Active' && (
                          <button className="btn btn-primary" onClick={() => handleApproveUser(u.id, u.walletBalance || 0)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                            <FiCheckCircle /> Activate
                          </button>
                        )}
                        {(u.status === 'Active' || u.status === 'Warning') && (
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => updateDoc(doc(db, 'users', u.id), { status: 'Suspended' })} 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                          >
                            <FiXCircle /> Suspend
                          </button>
                        )}
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => handleResetUser(u.id)} 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                        >
                          Reset
                        </button>
                        <button 
                          className="btn btn-danger" 
                          onClick={() => handleDeleteUser(u.id, u.name || u.email)} 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          title="Permanently delete this user"
                        >
                          <FiTrash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Review Goals ── */}
      {activeTab === 'goals' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2>Review Weekly Goals</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Approve completed goals with proof <strong>(+1 pt)</strong> or confirm not-completed goals <strong>(-1 pt)</strong>.
            Already reviewed tasks are locked.
          </p>

          {goalDocs.length === 0 && (
            <p style={{ color: 'var(--text-secondary)' }}>No goal submissions yet.</p>
          )}

          {goalDocs.map(g => (
            <div key={g.id} style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              {/* Submission Header */}
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong style={{ fontSize: '1rem' }}>{g.userName || g.userId}</strong>
                  <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Week: {g.weekId}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{
                    padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                    background: g.reviewStatus === 'reviewed' ? 'var(--secondary)' : 'var(--warning)',
                    color: 'white'
                  }}>
                    {g.reviewStatus === 'reviewed' ? '✓ Fully Reviewed' : g.reviewStatus === 'in_review' ? 'In Review' : '⏳ Pending Review'}
                  </span>
                  <button 
                    onClick={() => handleDeleteGoal(g.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Delete this submission"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Tasks */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Task</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Proof</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Admin Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(g.tasks || []).map((task, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)', opacity: task.reviewed ? 0.6 : 1 }}>
                        <td style={{ padding: '0.75rem 1rem', maxWidth: '260px' }}>
                          <span style={{ fontSize: '0.9rem' }}>{task.description || '—'}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 'bold',
                            background: task.status === 'Completed' ? 'rgba(16,185,129,0.2)' : task.status === 'Not Completed' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                            color: task.status === 'Completed' ? 'var(--secondary)' : task.status === 'Not Completed' ? 'var(--danger)' : 'var(--warning)'
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
                            <span style={{
                              padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 'bold',
                              background: task.adminAction === 'approved' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                              color: task.adminAction === 'approved' ? 'var(--secondary)' : 'var(--danger)'
                            }}>
                              {task.adminAction === 'approved' ? `✓ Approved (${idx < 3 ? '+1' : '0'} pt)` : `✗ Deducted (${idx < 3 ? '−1' : '0'} pt)`}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {/* Only show Approve for Completed tasks with proof */}
                              {task.status === 'Completed' && (task.proofImage || task.proofText) && (
                                <>
                                  <button
                                    className="btn btn-primary"
                                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                                    onClick={() => handleApproveTask(g, idx)}
                                  >
                                    <FiCheckCircle /> {idx < 3 ? '+1' : '0'} pt
                                  </button>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: 'var(--warning)', color: 'white' }}
                                    onClick={() => handleRejectTask(g, idx)}
                                  >
                                    <FiXCircle /> Reject {(task.rejectionCount || 0) > 0 && `(${task.rejectionCount})`}
                                  </button>
                                  {(task.rejectionCount >= 3) && (
                                    <button
                                      className="btn btn-danger"
                                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                                      onClick={() => handlePermanentReject(g, idx)}
                                    >
                                      <FiXCircle /> Lock Goal
                                    </button>
                                  )}
                                </>
                              )}
                              {/* Only show Deduct for Not Completed tasks */}
                              {task.status === 'Not Completed' && (
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                                  onClick={() => handleDeductTask(g, idx)}
                                >
                                  <FiXCircle /> {idx < 3 ? '−1' : '0'} pt
                                </button>
                              )}
                              {/* Pending/Partially completed — no action */}
                              {task.status !== 'Completed' && task.status !== 'Not Completed' && (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No action</span>
                              )}
                              {task.status === 'Completed' && !task.proofImage && !task.proofText && (
                                <span style={{ color: 'var(--warning)', fontSize: '0.8rem' }}>No proof — cannot approve</span>
                              )}
                            </div>
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

      {/* ── Attendance Sessions ── */}
      {activeTab === 'attendance' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2>Attendance Sessions</h2>

          <form onSubmit={handleCreateSession} style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', marginBottom: '2rem', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Day</label>
              <select className="input-field" value={newSessionType} onChange={(e) => setNewSessionType(e.target.value)}>
                <option value="Wednesday">Wednesday</option>
                <option value="Sunday">Sunday</option>
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Secret Code</label>
              <input type="text" className="input-field" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. WEDS-9921" required />
            </div>
            <button type="submit" className="btn btn-primary">Create Session</button>
          </form>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '1rem' }}>Code</th>
                <th style={{ padding: '1rem' }}>Day</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>{s.secretCode}</td>
                  <td style={{ padding: '1rem' }}>{s.dayOfWeek}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ color: s.isActive ? 'var(--secondary)' : 'var(--danger)', fontWeight: 'bold' }}>
                      {s.isActive ? 'Active' : 'Closed'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button className="btn btn-secondary" onClick={() => toggleSession(s.id, s.isActive)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                      {s.isActive ? 'Close Session' : 'Reopen Session'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* ── Weekly Settings ── */}
      {activeTab === 'settings' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2>Weekly Settings ({currentWeekId})</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Set the deadlines for this week. Users will be locked out after these times.</p>
          
          <div style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ background: 'var(--bg-main)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Goal Setting Deadline</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="datetime-local" 
                  className="input-field" 
                  value={setupDeadline} 
                  onChange={(e) => setSetupDeadline(e.target.value)} 
                />
                <button className="btn btn-primary" onClick={handleUpdateSetup} style={{ whiteSpace: 'nowrap' }}>Update</button>
                {weekSettings?.setupDeadline && (
                  <button className="btn btn-secondary" onClick={handleCancelSetup} style={{ whiteSpace: 'nowrap', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>Cancel</button>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>Users cannot set their initial goals after this time.</p>
            </div>

            <div style={{ background: 'var(--bg-main)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Completion/Submission Deadline</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="datetime-local" 
                  className="input-field" 
                  value={completionDeadline} 
                  onChange={(e) => setCompletionDeadline(e.target.value)} 
                />
                <button className="btn btn-primary" onClick={handleUpdateCompletion} style={{ whiteSpace: 'nowrap' }}>Update</button>
                {weekSettings?.completionDeadline && (
                  <button className="btn btn-secondary" onClick={handleCancelCompletion} style={{ whiteSpace: 'nowrap', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>Cancel</button>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>Users cannot update status or upload proof after this time.</p>
            </div>

            <button className="btn btn-secondary" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }} onClick={handleDeleteDeadlines}>Delete All Deadlines</button>

            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
              <h3>Weekly Rewards</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Recognize the community leader with a bonus.</p>
              <button 
                className="btn btn-primary" 
                onClick={handleAwardTopPerformer}
                disabled={weekSettings?.bonusAwarded}
                style={{ 
                  background: weekSettings?.bonusAwarded ? 'var(--border)' : 'linear-gradient(to right, var(--warning), #f59e0b)', 
                  border: 'none', 
                  color: weekSettings?.bonusAwarded ? 'var(--text-secondary)' : 'white',
                  cursor: weekSettings?.bonusAwarded ? 'not-allowed' : 'pointer'
                }}
              >
                {weekSettings?.bonusAwarded ? 'Bonus Already Awarded' : 'Award Top Performer +3 Points'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
