import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import {
  collection, query, onSnapshot, doc, updateDoc,
  addDoc, serverTimestamp, setDoc, increment, where, deleteDoc, orderBy, limit, getDocs
} from 'firebase/firestore';
import {
  FiUsers, FiDollarSign, FiClock, FiCheckCircle, FiXCircle, FiFileText,
  FiSettings, FiTrash2, FiBell, FiStar, FiGrid, FiTarget, FiCalendar,
  FiShield, FiMenu, FiX, FiLogOut, FiSearch, FiMoreHorizontal, FiEdit2,
  FiSlash, FiInfo, FiRefreshCw, FiZap, FiCreditCard, FiAward, FiSun, FiMoon
} from 'react-icons/fi';
import { getWeekId } from '../utils/weekUtils';
import './adminDashboard.css';

// ---- WhatsApp notifications via Base44 backend function ----
const NOTIFY_ENDPOINT = 'https://velo-af3ea2dd.base44.app/functions/tecNotifyEvent';

async function sendWhatsappNotification(payload) {
  try {
    const res = await fetch(NOTIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('WhatsApp notify failed:', err);
    return { ok: false, error: err.message };
  }
}

export default function AdminDashboard({ user, userData }) {
  const navigate = useNavigate();

  // Theme state (supports both dark and light modes, synchronized with localStorage)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Navigation tab state (default 'users' matching mockup)
  const [activeTab, setActiveTab] = useState('users');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Firestore Data State
  const [users, setUsers]                   = useState([]);
  const [sessions, setSessions]             = useState([]);
  const [goalDocs, setGoalDocs]             = useState([]);
  const [newCode, setNewCode]               = useState('');
  const [newSessionType, setNewSessionType] = useState('Wednesday');
  const [setupDeadline, setSetupDeadline]   = useState('');
  const [completionDeadline, setCompletionDeadline] = useState('');
  const [weekSettings, setWeekSettings]     = useState(null);

  // Announcements state
  const [announcements, setAnnouncements]   = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ message: '', type: 'General', assignedUserId: '' });

  // Grace period state
  const [graceDeadlines, setGraceDeadlines] = useState({});

  // Moderator state
  const [moderatorUserId, setModeratorUserId] = useState('');

  // Meeting reminder state
  const [meetingSending, setMeetingSending] = useState(null);

  // System Wallet state
  const [systemWallet, setSystemWallet]     = useState(0);

  // Accountability pairings state
  const [pairings, setPairings]             = useState([]);
  const [partnerAId, setPartnerAId]         = useState('');
  const [partnerBId, setPartnerBId]         = useState('');

  // Search & Filter state for User Management
  const [searchQuery, setSearchQuery]       = useState('');
  const [actionMenuUserId, setActionMenuUserId] = useState(null);

  // Modals state
  const [fundsModalUser, setFundsModalUser] = useState(null);
  const [fundsModalMode, setFundsModalMode] = useState('add');
  const [fundsModalAmount, setFundsModalAmount] = useState('');

  const [pointsModalUser, setPointsModalUser] = useState(null);
  const [pointsModalMode, setPointsModalMode] = useState('award');
  const [pointsModalAmount, setPointsModalAmount] = useState('');

  const [detailModalUser, setDetailModalUser] = useState(null);
  const [showClockModal, setShowClockModal] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Current week ID
  const currentWeekId = getWeekId(new Date());

  // Close action dropdown on outside click
  const actionMenuRef = useRef(null);
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setActionMenuUserId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ── Real-time Firestore Subscriptions ─────────────────────────────────────
  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, 'users')), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubSessions = onSnapshot(query(collection(db, 'attendance_sessions')), (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubGoals = onSnapshot(query(collection(db, 'weekly_goals')), (snap) => {
      setGoalDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

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

    const unsubSystemWallet = onSnapshot(doc(db, 'system_data', 'wallet'), (snap) => {
      if (snap.exists()) {
        setSystemWallet(snap.data().adminBalance || 0);
      }
    });

    const unsubAnnouncements = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')), (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubPairings = onSnapshot(query(collection(db, 'weekly_pairings'), where('weekId', '==', currentWeekId)), (snap) => {
      setPairings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubUsers();
      unsubSessions();
      unsubGoals();
      unsubSettings();
      unsubAnnouncements();
      unsubSystemWallet();
      unsubPairings();
    };
  }, [currentWeekId]);

  // ── Auth Handlers ──────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

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

  // ── Moderator Management ───────────────────────────────────────────────────
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
      const wa = await sendWhatsappNotification({ type: 'moderator_assigned', userId, weekId: currentWeekId });
      alert(`${u.name} has been assigned as moderator for this week.` + (wa?.ok ? ' WhatsApp notification sent.' : ' (WhatsApp notification pending \u2014 member may not have a number on file yet.)'));
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
    const wa = await sendWhatsappNotification({ type: 'announcement', message: data.message, category: data.type });
    setNewAnnouncement({ message: '', type: 'General', assignedUserId: '' });
    alert('Announcement posted.' + (wa?.ok ? ` WhatsApp sent to ${wa.sent ?? 0} member(s).` : ' (WhatsApp broadcast pending — no opted-in members found.)'));
  };

  const handleToggleAnnouncement = async (id, current) => {
    await updateDoc(doc(db, 'announcements', id), { active: !current });
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    await deleteDoc(doc(db, 'announcements', id));
  };

  // ── WhatsApp Meeting Reminders ─────────────────────────────────────────────
  const handleSendMeetingReminder = async (which) => {
    const when = which === 'wed' ? 'Wednesday 9:00 PM (Midweek Meeting)' : 'Sunday 9:00 PM (Weekly Review Meeting)';
    if (!window.confirm(`Send a WhatsApp meeting reminder to ALL opted-in members?\n\n${when}`)) return;
    setMeetingSending(which);
    try {
      const result = await sendWhatsappNotification({ type: 'meeting_reminder', when });
      if (result?.ok) {
        const channelInfo = result.channels?.template
          ? ` [${result.channels.template} via approved template]`
          : result.channels?.text
          ? ` [${result.channels.text} via text]`
          : '';
        alert(`Meeting reminder dispatched to ${result.sent ?? 0} member(s)${channelInfo}.` + (result.blocked ? ` (${result.blocked} failed)` : ''));
      } else {
        alert('Reminder failed: ' + (result?.error || 'unknown error'));
      }
    } finally {
      setMeetingSending(null);
    }
  };

  // ── User Management Handlers ───────────────────────────────────────────────
  const handleApproveUser = async (userId, balance) => {
    if (balance < 1000) {
      alert('User must have at least ₦1,000 in their wallet to be approved.');
      return;
    }
    await updateDoc(doc(db, 'users', userId), { status: 'Active' });
    setActionMenuUserId(null);
  };

  const handleToggleSuspendUser = async (u) => {
    setActionMenuUserId(null);
    const newStatus = u.status === 'Suspended' ? 'Active' : 'Suspended';
    const confirmMsg = newStatus === 'Suspended'
      ? `Suspend account for ${u.name || u.email}?`
      : `Re-activate account for ${u.name || u.email}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await updateDoc(doc(db, 'users', u.id), { status: newStatus });
    } catch (err) {
      console.error(err);
      alert('Failed to update user status.');
    }
  };

  // Modal Submit: Modify Funds
  const handleSubmitFundsModal = async (e) => {
    e.preventDefault();
    if (!fundsModalUser) return;
    const parsed = parseInt(fundsModalAmount, 10);
    if (isNaN(parsed) || parsed <= 0) {
      alert('Please enter a valid positive number.');
      return;
    }

    const currentBalance = fundsModalUser.walletBalance || 0;
    try {
      if (fundsModalMode === 'add') {
        await updateDoc(doc(db, 'users', fundsModalUser.id), {
          walletBalance: currentBalance + parsed
        });
        alert(`Added ₦${parsed.toLocaleString()} to ${fundsModalUser.name}'s wallet.`);
      } else {
        const newBalance = Math.max(0, currentBalance - parsed);
        const actualDeducted = currentBalance - newBalance;
        await updateDoc(doc(db, 'users', fundsModalUser.id), {
          walletBalance: newBalance
        });
        if (actualDeducted > 0) {
          await setDoc(doc(db, 'system_data', 'wallet'), { adminBalance: increment(actualDeducted) }, { merge: true });
        }
        alert(`Deducted ₦${actualDeducted.toLocaleString()} from ${fundsModalUser.name}'s wallet.`);
      }
      setFundsModalUser(null);
      setFundsModalAmount('');
    } catch (err) {
      console.error(err);
      alert('Failed to modify funds.');
    }
  };

  // Modal Submit: Adjust Points
  const handleSubmitPointsModal = async (e) => {
    e.preventDefault();
    if (!pointsModalUser) return;
    const parsed = parseInt(pointsModalAmount, 10);
    if (isNaN(parsed) || parsed <= 0) {
      alert('Please enter a valid positive number.');
      return;
    }

    const currentPoints = pointsModalUser.totalPoints || 0;
    try {
      if (pointsModalMode === 'award') {
        await updateDoc(doc(db, 'users', pointsModalUser.id), {
          totalPoints: currentPoints + parsed
        });
        alert(`Awarded ${parsed} points to ${pointsModalUser.name}.`);
      } else {
        const newPoints = Math.max(0, currentPoints - parsed);
        await updateDoc(doc(db, 'users', pointsModalUser.id), {
          totalPoints: newPoints
        });
        alert(`Deducted ${parsed} points from ${pointsModalUser.name}.`);
      }
      setPointsModalUser(null);
      setPointsModalAmount('');
    } catch (err) {
      console.error(err);
      alert('Failed to update points.');
    }
  };

  const handleApproveBreak = async (userId) => {
    setActionMenuUserId(null);
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
    setActionMenuUserId(null);
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
    setActionMenuUserId(null);
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
    setActionMenuUserId(null);
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

  const handleDeleteUser = async (userId, userName) => {
    setActionMenuUserId(null);
    const confirmed = window.confirm(
      `⚠️ PERMANENTLY DELETE "${userName}"?\n\nThis will remove all their data from Firestore including goals and profile. This action CANNOT be undone.`
    );
    if (!confirmed) return;
    const reconfirmed = window.confirm(`Are you absolutely sure you want to delete ${userName}'s account?`);
    if (!reconfirmed) return;

    try {
      await deleteDoc(doc(db, 'users', userId));
      const goalDocId = `${userId}_${currentWeekId}`;
      await deleteDoc(doc(db, 'weekly_goals', goalDocId));
      alert(`"${userName}" has been permanently deleted.`);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error deleting user. Please try again.');
    }
  };

  const handleResetUser = async (userId) => {
    setActionMenuUserId(null);
    if (!window.confirm('Are you sure you want to RESET this user? Their points will be set to 0, wallet to ₦0, and current weekly goals will be cleared.')) return;
    
    try {
      await updateDoc(doc(db, 'users', userId), {
        totalPoints: 0,
        walletBalance: 0,
        status: 'Active'
      });
      const goalDocId = `${userId}_${currentWeekId}`;
      const goalDocRef = doc(db, 'weekly_goals', goalDocId);
      await setDoc(goalDocRef, {
        tasks: [],
        reviewStatus: 'none',
        progress: 0
      }, { merge: false });
      alert('User account and weekly goals have been reset.');
    } catch (err) {
      console.error('Reset error:', err);
      alert('Error resetting user.');
    }
  };

  // ── Weekly Settings Handlers ───────────────────────────────────────────────
  const handleUpdateSetup = async () => {
    if (!setupDeadline) return alert('Please select a setup deadline.');
    await setDoc(doc(db, 'week_settings', currentWeekId), {
      setupDeadline,
      updatedAt: serverTimestamp()
    }, { merge: true });
    const wa = await sendWhatsappNotification({ type: 'deadline_update', weekId: currentWeekId, setupDeadline });
    alert('Goal Setting Deadline updated.' + (wa?.ok ? ` WhatsApp sent to ${wa.sent ?? 0} member(s).` : ' (WhatsApp pending — no opted-in members found.)'));
  };

  const handleUpdateCompletion = async () => {
    if (!completionDeadline) return alert('Please select a completion deadline.');
    await setDoc(doc(db, 'week_settings', currentWeekId), {
      completionDeadline,
      updatedAt: serverTimestamp()
    }, { merge: true });
    const wa = await sendWhatsappNotification({ type: 'deadline_update', weekId: currentWeekId, completionDeadline });
    alert('Completion Deadline updated.' + (wa?.ok ? ` WhatsApp sent to ${wa.sent ?? 0} member(s).` : ' (WhatsApp pending — no opted-in members found.)'));
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

  const handleTogglePeerGoals = async () => {
    const nextState = !weekSettings?.peerGoalsEnabled;
    try {
      await setDoc(doc(db, 'week_settings', currentWeekId), {
        peerGoalsEnabled: nextState,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert(`Peer Goal Suggestion feature is now ${nextState ? 'ENABLED' : 'DISABLED'} for ${currentWeekId}.`);
    } catch (err) {
      console.error('Error toggling peer goals:', err);
      alert('Failed to update peer goals setting.');
    }
  };

  const handleAwardTopPerformer = async () => {
    if (weekSettings?.bonusAwarded) {
      alert('The weekly bonus has already been awarded for this week.');
      return;
    }
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
      await setDoc(doc(db, 'week_settings', currentWeekId), {
        bonusAwarded: true
      }, { merge: true });
      alert(`Success! 3 bonus points awarded to ${top.userName}.`);
    } catch (err) {
      console.error(err);
      alert('Error awarding points.');
    }
  };

  // ── Accountability Partners Pairing ────────────────────────────────────────
  const handleManualPairing = async (e) => {
    e.preventDefault();
    if (!partnerAId || !partnerBId) {
      alert('Please select both members to pair.');
      return;
    }
    if (partnerAId === partnerBId) {
      alert('Cannot pair a member with themselves.');
      return;
    }
    const alreadyPairedA = pairings.some(p => p.userIds?.includes(partnerAId));
    const alreadyPairedB = pairings.some(p => p.userIds?.includes(partnerBId));
    if (alreadyPairedA || alreadyPairedB) {
      alert('One or both selected members are already paired. Please unpair them first.');
      return;
    }

    const userA = users.find(u => u.id === partnerAId);
    const userB = users.find(u => u.id === partnerBId);

    try {
      await addDoc(collection(db, 'weekly_pairings'), {
        weekId: currentWeekId,
        userIds: [partnerAId, partnerBId],
        userNames: [userA?.name || userA?.email || 'Anonymous A', userB?.name || userB?.email || 'Anonymous B'],
        createdAt: serverTimestamp()
      });
      setPartnerAId('');
      setPartnerBId('');
      alert('Accountability partners successfully paired!');
    } catch (err) {
      console.error(err);
      alert('Failed to create pairing.');
    }
  };

  const handleDeletePairing = async (pairingId) => {
    if (!window.confirm('Are you sure you want to delete this pairing?')) return;
    try {
      await deleteDoc(doc(db, 'weekly_pairings', pairingId));
      alert('Pairing deleted.');
    } catch (err) {
      console.error(err);
      alert('Failed to delete pairing.');
    }
  };

  const handleAutoPairing = async () => {
    const eligibleUsers = users.filter(u =>
      (u.status === 'Active' || u.status === 'Warning')
    );

    if (eligibleUsers.length < 2) {
      alert('Not enough active/warning members (need at least 2) to perform auto-pairing.');
      return;
    }

    if (!window.confirm(`Auto-pairing will randomly pair all ${eligibleUsers.length} eligible active members for week ${currentWeekId}. This will delete all existing pairings for this week. Proceed?`)) {
      return;
    }

    try {
      const currentWeekPairings = pairings.filter(p => p.weekId === currentWeekId);
      for (const p of currentWeekPairings) {
        await deleteDoc(doc(db, 'weekly_pairings', p.id));
      }

      const shuffled = [...eligibleUsers].sort(() => Math.random() - 0.5);
      const newPairings = [];
      let i = 0;
      while (i < shuffled.length) {
        const remaining = shuffled.length - i;
        if (remaining === 3) {
          newPairings.push(shuffled.slice(i, i + 3));
          break;
        } else if (remaining === 1) {
          if (newPairings.length > 0) {
            newPairings[newPairings.length - 1].push(shuffled[i]);
          } else {
            newPairings.push([shuffled[i]]);
          }
          break;
        } else {
          newPairings.push(shuffled.slice(i, i + 2));
          i += 2;
        }
      }

      for (const group of newPairings) {
        await addDoc(collection(db, 'weekly_pairings'), {
          weekId: currentWeekId,
          userIds: group.map(u => u.id),
          userNames: group.map(u => u.name || u.email || 'Anonymous'),
          createdAt: serverTimestamp()
        });
      }

      alert(`Successfully generated and saved ${newPairings.length} pairings!`);
    } catch (err) {
      console.error(err);
      alert('Failed during auto-pairing process.');
    }
  };

  const handleAwardAllTeamRewards = async () => {
    if (!window.confirm('Manually check and award ₦1,000 team rewards for all qualifying Top-3 pairs this week?')) return;

    const weekId = currentWeekId;
    const weekGoalsSnap = await getDocs(
      query(collection(db, 'weekly_goals'), where('weekId', '==', weekId))
    );

    const getTime = (ts) => {
      if (!ts) return Infinity;
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      return new Date(ts).getTime();
    };

    const fullyCompleted = weekGoalsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(g => {
        if (!g.tasks || g.tasks.length < 3) return false;
        return g.tasks.every(t => t.reviewed && t.adminAction === 'approved' && t.status === 'Completed');
      })
      .sort((a, b) => getTime(a.submittedAt) - getTime(b.submittedAt));

    const top3UserIds = new Set(fullyCompleted.slice(0, 3).map(g => g.userId));
    if (top3UserIds.size === 0) {
      alert('No fully-completed users this week yet.');
      return;
    }

    const pairSnap = await getDocs(
      query(collection(db, 'weekly_pairings'), where('weekId', '==', weekId))
    );

    const REWARD = 1000;
    let awarded = 0;
    let skipped = 0;

    for (const pDoc of pairSnap.docs) {
      const pairing = { id: pDoc.id, ...pDoc.data() };
      if (pairing.teamRewarded) { skipped++; continue; }

      const [idA, idB] = pairing.userIds || [];
      if (!idA || !idB) continue;

      if (top3UserIds.has(idA) && top3UserIds.has(idB)) {
        await updateDoc(doc(db, 'users', idA), { walletBalance: increment(REWARD) });
        await updateDoc(doc(db, 'users', idB), { walletBalance: increment(REWARD) });
        await setDoc(doc(db, 'system_data', 'wallet'), { adminBalance: increment(-(REWARD * 2)) }, { merge: true });
        await updateDoc(doc(db, 'weekly_pairings', pairing.id), {
          teamRewarded: true,
          rewardedAt: serverTimestamp(),
          rewardAmount: REWARD,
          rewardedUserIds: [idA, idB]
        });
        awarded++;
      }
    }

    alert(`Done! ${awarded} pair(s) rewarded (₦${(awarded * REWARD * 2).toLocaleString()} total paid out). ${skipped} pair(s) already rewarded.`);
  };

  // ── Attendance Sessions Handlers ───────────────────────────────────────────
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
    alert('Attendance session created successfully.');
  };

  const toggleSession = async (sessionId, currentStatus) => {
    await updateDoc(doc(db, 'attendance_sessions', sessionId), {
      isActive: !currentStatus
    });
  };

  // ── Goal Review Handlers ───────────────────────────────────────────────────
  const handleApproveTask = async (goalDoc, taskIndex) => {
    const task = goalDoc.tasks[taskIndex];
    if (task.reviewed) return;

    const updatedTasks = goalDoc.tasks.map((t, i) =>
      i === taskIndex ? { ...t, reviewed: true, adminAction: 'approved' } : t
    );
    const allReviewed = updatedTasks.every(t => t.reviewed);
    const isCompulsory = taskIndex < 3;

    await updateDoc(doc(db, 'weekly_goals', goalDoc.id), {
      tasks: updatedTasks,
      reviewStatus: allReviewed ? 'reviewed' : 'in_review',
      ...(isCompulsory ? { weeklyPoints: increment(1) } : {})
    });

    if (isCompulsory) {
      await updateDoc(doc(db, 'users', goalDoc.userId), {
        totalPoints: increment(1)
      });
    }

    if (allReviewed) {
      const isActuallyCompleted = updatedTasks.every(t => t.status === 'Completed' && t.adminAction === 'approved');
      if (isActuallyCompleted) {
        const goalsRef = collection(db, 'weekly_goals');
        const q = query(goalsRef, where('weekId', '==', goalDoc.weekId), where('isFirstToComplete', '==', true), limit(1));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
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
  };

  const handleRejectTask = async (goalDoc, taskIndex) => {
    const task = goalDoc.tasks[taskIndex];
    if (task.reviewed) return;

    const reason = prompt('Enter rejection reason (will be visible to the user):');
    if (reason === null) return;

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

    if (isCompulsory) {
      await updateDoc(doc(db, 'users', goalDoc.userId), {
        totalPoints: increment(-1)
      });
    }
  };

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

    if (isCompulsory) {
      await updateDoc(doc(db, 'users', goalDoc.userId), {
        totalPoints: increment(-1)
      });
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

  // ── Weekly Evaluation ──────────────────────────────────────────────────────
  const handleEvaluateWeek = async () => {
    if (!window.confirm('Run the weekly evaluation? This will evaluate user performance, apply penalties, update streaks, and suspend accounts below balance.')) return;

    setIsEvaluating(true);
    let totalDeducted = 0;
    
    // Calculate evaluation dates safely
    const now = new Date();
    const prevWeekDate = new Date(now);
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    const startPrevYear = new Date(prevWeekDate.getFullYear(), 0, 1);
    const prevWeekNumber = Math.ceil(((prevWeekDate - startPrevYear) / 86400000 + startPrevYear.getDay() + 1) / 7);
    const prevWeekId = `${prevWeekDate.getFullYear()}-W${String(prevWeekNumber).padStart(2, '0')}`;

    try {
      for (const u of users) {
        if (u.status === 'On Hold') continue;

        if (u.status === 'On Break') {
          await updateDoc(doc(db, 'users', u.id), { status: 'Active' });
          continue;
        }

        if (u.status !== 'Active' && u.status !== 'Warning') continue;

        let newStatus = u.status;
        let newWallet = u.walletBalance || 0;
        let pointsDelta = 0;
        let punishedThisWeek = false;

        if (u.walletBalance < 1000) {
          newStatus = 'Suspended';
          punishedThisWeek = true;
        }

        const currentGoal = goalDocs.find(g => g.userId === u.id && g.weekId === currentWeekId);
        const ptsThisWeek = currentGoal?.weeklyPoints || 0;

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

        if (ptsThisWeek < 2) {
          newStatus = 'Suspended';
          punishedThisWeek = true;
        } else if (ptsThisWeek < 5) {
          newStatus = 'Warning';
          punishedThisWeek = true;
        } else if (u.status === 'Warning' || u.status === 'Suspended') {
          newStatus = 'Active';
        }

        if (ptsThisWeek < 5 && newWallet >= 1000) {
          newWallet -= 1000;
          totalDeducted += 1000;
          punishedThisWeek = true;
        }

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
        alert(`Evaluation complete! ₦${totalDeducted.toLocaleString()} collected in penalties.`);
      } else {
        alert('Evaluation complete. No penalties applied.');
      }
    } catch (err) {
      console.error('Evaluation error:', err);
      alert('Error during evaluation: ' + err.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  // ── Filtered Users for Search ──────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter(u => 
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.profession && u.profession.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  // ── Metrics Calculations ───────────────────────────────────────────────────
  const pendingCount        = goalDocs.filter(g => g.reviewStatus === 'pending' || g.reviewStatus === 'in_review').length;
  const pendingBreaks       = users.filter(u => u.breakRequest?.status === 'pending').length;
  const pendingReleases     = users.filter(u => u.holdReleaseRequestedAt).length;
  const pendingGrace        = goalDocs.filter(g => g.graceRequest && Object.values(g.graceRequest).some(r => r?.status === 'pending')).length;
  
  const totalWalletBalance  = users.reduce((sum, u) => sum + (u.walletBalance  || 0), 0);
  const totalPoints         = users.reduce((sum, u) => sum + (u.totalPoints    || 0), 0);
  const totalWeeklyPoints   = goalDocs.filter(g => g.weekId === currentWeekId).reduce((sum, g) => sum + (g.weeklyPoints || 0), 0);
  const activeUsers         = users.filter(u => u.status === 'Active').length;
  const suspendedUsers      = users.filter(u => u.status === 'Suspended' || u.status === 'Warning').length;

  return (
    <div className="admin-shell">

      {/* ── TOPBAR ────────────────────────────────────────────────────────── */}
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          {/* Mobile hamburger menu toggle */}
          <button
            className="admin-menu-toggle"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {isSidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>

          {/* Logo brand */}
          <Link to="/admin" className="admin-brand">
            <img src="/icons/icon-57x57.png" alt="TEC Logo" className="admin-brand-icon" />
            <span>TEC Weekly</span>
          </Link>
        </div>

        <div className="admin-topbar-right">
          {/* Theme Toggle (Light / Dark) */}
          <button
            className="admin-icon-btn"
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <FiMoon size={17} /> : <FiSun size={17} />}
          </button>

          {/* Clock button with deadline info toggle */}
          <button
            className="admin-icon-btn"
            onClick={() => setShowClockModal(!showClockModal)}
            title="Active Week Deadlines & Time"
          >
            <FiClock size={17} />
            {(weekSettings?.setupDeadline || weekSettings?.completionDeadline) && (
              <span style={{ position: 'absolute', top: '6px', right: '6px', width: '7px', height: '7px', background: 'var(--tec-brand-violet)', borderRadius: '50%' }} />
            )}
          </button>

          {/* Admin role indicator pill */}
          <div className="admin-role-pill active">
            <FiSettings size={13} />
            <span>Admin</span>
          </div>

          {/* Moderator link pill */}
          <Link to="/moderator" className="admin-role-pill subtle">
            Moderator
          </Link>

          {/* Member View shortcut link */}
          <Link to="/dashboard" className="admin-role-pill subtle" title="View Member Dashboard">
            Member View
          </Link>

          {/* Sign out button */}
          <button onClick={handleSignOut} className="admin-signout-btn" title="Sign Out">
            <FiLogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── MAIN LAYOUT GRID ──────────────────────────────────────────────── */}
      <div className="admin-layout">

        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div className="admin-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div>
            <div className="admin-sidebar-header">Admin Control Panel</div>
            <nav className="admin-nav-list">
              <button
                className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }}
              >
                <span className="admin-nav-icon"><FiGrid /></span>
                <span>System Overview</span>
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }}
              >
                <span className="admin-nav-icon"><FiUsers /></span>
                <span>Manage Users</span>
                {(pendingBreaks + pendingReleases) > 0 && (
                  <span className="admin-badge">{pendingBreaks + pendingReleases}</span>
                )}
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'goals' ? 'active' : ''}`}
                onClick={() => { setActiveTab('goals'); setIsSidebarOpen(false); }}
              >
                <span className="admin-nav-icon"><FiTarget /></span>
                <span>Review Goals</span>
                {pendingCount > 0 && (
                  <span className="admin-badge">{pendingCount}</span>
                )}
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'attendance' ? 'active' : ''}`}
                onClick={() => { setActiveTab('attendance'); setIsSidebarOpen(false); }}
              >
                <span className="admin-nav-icon"><FiCalendar /></span>
                <span>Attendance Control</span>
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
              >
                <span className="admin-nav-icon"><FiSettings /></span>
                <span>System Settings</span>
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'announcements' ? 'active' : ''}`}
                onClick={() => { setActiveTab('announcements'); setIsSidebarOpen(false); }}
              >
                <span className="admin-nav-icon"><FiBell /></span>
                <span>Announcements</span>
                {announcements.filter(a => a.active).length > 0 && (
                  <span className="admin-badge success">{announcements.filter(a => a.active).length}</span>
                )}
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'grace' ? 'active' : ''}`}
                onClick={() => { setActiveTab('grace'); setIsSidebarOpen(false); }}
              >
                <span className="admin-nav-icon"><FiClock /></span>
                <span>Grace Requests</span>
                {pendingGrace > 0 && (
                  <span className="admin-badge">{pendingGrace}</span>
                )}
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'moderator' ? 'active' : ''}`}
                onClick={() => { setActiveTab('moderator'); setIsSidebarOpen(false); }}
              >
                <span className="admin-nav-icon"><FiShield /></span>
                <span>Moderator Hub</span>
                {weekSettings?.moderatorUserId && (
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--tec-brand-emerald)', marginLeft: 'auto' }} />
                )}
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'partners' ? 'active' : ''}`}
                onClick={() => { setActiveTab('partners'); setIsSidebarOpen(false); }}
              >
                <span className="admin-nav-icon"><FiUsers /></span>
                <span>Accountability Pairs</span>
                {pairings.length > 0 && (
                  <span className="admin-badge success">{pairings.length}</span>
                )}
              </button>
            </nav>
          </div>

          {/* System Status Run Box at bottom of Sidebar */}
          <div className="admin-status-box">
            <div className="admin-status-title">System Status</div>
            <div className="admin-status-row">
              <span className="admin-status-label">Weekly Evaluation</span>
              <button
                onClick={handleEvaluateWeek}
                disabled={isEvaluating}
                className="admin-btn-run"
                title="Run weekly evaluation rules, collect penalties, update statuses"
              >
                {isEvaluating ? 'Running…' : 'Run'}
              </button>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT AREA ───────────────────────────────────────────── */}
        <main className="admin-main">

          {/* ── 5 TOP STAT CARDS (Clean, Official TEC Brand, No Neon Glow) ── */}
          <section className="admin-stats-grid">
            {/* Card 1: Wallet Funds */}
            <div className="admin-stat-card card-wallet">
              <div className="admin-stat-icon-wrapper">
                <FiCreditCard />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-label">Wallet Funds</span>
                <span className="admin-stat-value">₦{totalWalletBalance.toLocaleString()}</span>
                <span className="admin-stat-sub">Across {users.length} Total accounts</span>
              </div>
            </div>

            {/* Card 2: Total Points */}
            <div className="admin-stat-card card-points">
              <div className="admin-stat-icon-wrapper">
                <FiAward />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-label">Total Points</span>
                <span className="admin-stat-value">{totalPoints.toLocaleString()}</span>
                <span className="admin-stat-sub">Lifetime platform points</span>
              </div>
            </div>

            {/* Card 3: This Week's Points */}
            <div className="admin-stat-card card-week">
              <div className="admin-stat-icon-wrapper">
                <FiCalendar />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-label">This Week's Points</span>
                <span className="admin-stat-value">{totalWeeklyPoints.toLocaleString()}</span>
                <span className="admin-stat-sub">{currentWeekId}</span>
              </div>
            </div>

            {/* Card 4: Members */}
            <div className="admin-stat-card card-members">
              <div className="admin-stat-icon-wrapper">
                <FiUsers />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-label">Members</span>
                <span className="admin-stat-value">
                  {activeUsers} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--admin-text-secondary)' }}>active</span>
                </span>
                <span className="admin-stat-sub">
                  {suspendedUsers > 0 ? `${suspendedUsers} suspended/warning` : 'All in good standing'}
                </span>
              </div>
            </div>

            {/* Card 5: System Revenue */}
            <div className="admin-stat-card card-revenue">
              <div className="admin-stat-icon-wrapper">
                <FiDollarSign />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-label">System Revenue</span>
                <span className="admin-stat-value">₦{systemWallet.toLocaleString()}</span>
                <span className="admin-stat-sub">From penalties & fees</span>
              </div>
            </div>
          </section>

          {/* ── TAB 1: MANAGE USERS (Default / Matching Screenshot) ───────── */}
          {activeTab === 'users' && (
            <div className="admin-card">
              <div className="admin-card-header">
                <h2 className="admin-card-title">User Management</h2>
                <div className="admin-search-wrapper">
                  <FiSearch className="admin-search-icon" />
                  <input
                    type="text"
                    className="admin-search-input"
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name / Member</th>
                      <th>Status</th>
                      <th>Wallet</th>
                      <th>Points</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)' }}>
                          {searchQuery ? `No members matching "${searchQuery}"` : 'No members found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isActionOpen = actionMenuUserId === u.id;
                        const statusClass = 
                          u.status === 'Active' ? 'active' :
                          u.status === 'Suspended' ? 'suspended' :
                          u.status === 'Warning' ? 'warning' :
                          u.status === 'On Break' ? 'break' :
                          u.status === 'On Hold' ? 'hold' : 'warning';

                        return (
                          <tr key={u.id}>
                            {/* Member Avatar, Name & Email */}
                            <td>
                              <div className="admin-user-cell">
                                {u.profilePicUrl ? (
                                  <img src={u.profilePicUrl} alt={u.name || 'Member'} className="admin-user-avatar" />
                                ) : (
                                  <div className="admin-user-avatar-placeholder">
                                    {(u.name || u.email || 'M').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="admin-user-name">{u.name || 'Anonymous Member'}</div>
                                  <div className="admin-user-email">{u.email}</div>
                                </div>
                              </div>
                            </td>

                            {/* Status Badge */}
                            <td>
                              <span className={`admin-status-pill ${statusClass}`}>
                                {u.status || 'Pending'}
                              </span>
                            </td>

                            {/* Wallet Balance */}
                            <td style={{ fontWeight: 600 }}>
                              ₦{(u.walletBalance || 0).toLocaleString()}
                            </td>

                            {/* Total Points */}
                            <td style={{ fontWeight: 600 }}>
                              {u.totalPoints || 0}
                            </td>

                            {/* Actions Dropdown Popover */}
                            <td className="admin-actions-cell">
                              <button
                                className={`admin-action-trigger ${isActionOpen ? 'open' : ''}`}
                                onClick={() => setActionMenuUserId(isActionOpen ? null : u.id)}
                                title="Actions"
                              >
                                <FiMoreHorizontal size={17} />
                              </button>

                              {isActionOpen && (
                                <div className="admin-dropdown-menu" ref={actionMenuRef}>
                                  {/* Modify Funds */}
                                  <button
                                    className="admin-dropdown-item"
                                    onClick={() => {
                                      setActionMenuUserId(null);
                                      setFundsModalUser(u);
                                      setFundsModalMode('add');
                                      setFundsModalAmount('');
                                    }}
                                  >
                                    <FiEdit2 size={13} />
                                    <span>Modify Funds</span>
                                  </button>

                                  {/* Award Points */}
                                  <button
                                    className="admin-dropdown-item"
                                    onClick={() => {
                                      setActionMenuUserId(null);
                                      setPointsModalUser(u);
                                      setPointsModalMode('award');
                                      setPointsModalAmount('');
                                    }}
                                  >
                                    <FiStar size={13} />
                                    <span>Award Points</span>
                                  </button>

                                  {/* Suspend / Activate Account */}
                                  <button
                                    className={`admin-dropdown-item ${u.status === 'Active' ? 'danger' : ''}`}
                                    onClick={() => handleToggleSuspendUser(u)}
                                  >
                                    {u.status === 'Suspended' ? (
                                      <>
                                        <FiCheckCircle size={13} color="var(--tec-brand-emerald)" />
                                        <span>Re-activate Account</span>
                                      </>
                                    ) : (
                                      <>
                                        <FiSlash size={13} />
                                        <span>Suspend Account</span>
                                      </>
                                    )}
                                  </button>

                                  {/* View Details */}
                                  <button
                                    className="admin-dropdown-item"
                                    onClick={() => {
                                      setActionMenuUserId(null);
                                      setDetailModalUser(u);
                                    }}
                                  >
                                    <FiInfo size={13} />
                                    <span>View Details</span>
                                  </button>

                                  <div className="admin-dropdown-divider" />

                                  {/* Break request quick action */}
                                  {u.breakRequest?.status === 'pending' && (
                                    <>
                                      <button className="admin-dropdown-item" onClick={() => handleApproveBreak(u.id)}>
                                        <FiCheckCircle size={13} color="var(--tec-brand-emerald)" />
                                        <span>Grant 1-Wk Break</span>
                                      </button>
                                      <button className="admin-dropdown-item danger" onClick={() => handleDenyBreak(u.id)}>
                                        <FiXCircle size={13} />
                                        <span>Deny Break</span>
                                      </button>
                                    </>
                                  )}

                                  {/* Hold quick actions */}
                                  {u.status === 'On Hold' || u.holdReleaseRequestedAt ? (
                                    <button className="admin-dropdown-item" onClick={() => handleReleaseHold(u.id)}>
                                      <FiCheckCircle size={13} color="var(--tec-brand-emerald)" />
                                      <span>Release Hold</span>
                                    </button>
                                  ) : (
                                    <button className="admin-dropdown-item" onClick={() => handlePlaceOnHold(u.id)}>
                                      <FiClock size={13} />
                                      <span>Emergency Hold</span>
                                    </button>
                                  )}

                                  {/* Reset User */}
                                  <button className="admin-dropdown-item" onClick={() => handleResetUser(u.id)}>
                                    <FiRefreshCw size={13} />
                                    <span>Reset User</span>
                                  </button>

                                  {/* Delete User */}
                                  <button className="admin-dropdown-item danger" onClick={() => handleDeleteUser(u.id, u.name || u.email)}>
                                    <FiTrash2 size={13} />
                                    <span>Delete Account</span>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 2: SYSTEM OVERVIEW ──────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="admin-card">
              <h2 className="admin-card-title" style={{ marginBottom: '1.5rem' }}>
                <FiGrid /> System Overview &amp; Platform Health
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                {/* Active Week Status */}
                <div className="admin-subcard">
                  <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Active Week Cycle
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--admin-text-main)', marginBottom: '0.75rem' }}>
                    {currentWeekId}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--admin-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div>Goal Setting: <strong>{weekSettings?.setupDeadline ? new Date(weekSettings.setupDeadline).toLocaleString() : 'Not Set'}</strong></div>
                    <div>Submission: <strong>{weekSettings?.completionDeadline ? new Date(weekSettings.completionDeadline).toLocaleString() : 'Not Set'}</strong></div>
                  </div>
                </div>

                {/* Moderator Status */}
                <div className="admin-subcard">
                  <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Assigned Moderator
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--admin-text-main)', marginBottom: '0.75rem' }}>
                    {weekSettings?.moderatorName || 'None Assigned'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--admin-text-secondary)' }}>
                    {weekSettings?.moderatorUserId ? 'Moderator permissions active for current week proofs.' : 'Assign a member from Moderator Hub.'}
                  </div>
                  <button
                    onClick={() => setActiveTab('moderator')}
                    style={{ marginTop: '0.75rem', background: 'transparent', border: '1px solid var(--admin-border-medium)', color: 'var(--admin-text-main)', padding: '0.3rem 0.75rem', borderRadius: '7px', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Manage Moderator →
                  </button>
                </div>

                {/* Review Queue Status */}
                <div className="admin-subcard">
                  <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Pending Reviews Queue
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: pendingCount > 0 ? 'var(--tec-brand-gold)' : 'var(--tec-brand-emerald)', marginBottom: '0.75rem' }}>
                    {pendingCount} Goal Submissions
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--admin-text-secondary)' }}>
                    {pendingCount > 0 ? 'Member tasks waiting for admin/moderator verification.' : 'All task proofs have been reviewed.'}
                  </div>
                  <button
                    onClick={() => setActiveTab('goals')}
                    style={{ marginTop: '0.75rem', background: 'transparent', border: '1px solid var(--admin-border-medium)', color: 'var(--admin-text-main)', padding: '0.3rem 0.75rem', borderRadius: '7px', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Open Review Board →
                  </button>
                </div>
              </div>

              {/* Quick Actions Shortcuts */}
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--admin-text-main)', marginBottom: '1rem' }}>Quick Actions</h3>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('partners')} className="admin-role-pill active">
                  ⚡ Auto-Pair Members
                </button>
                <button onClick={() => setActiveTab('announcements')} className="admin-role-pill subtle">
                  📢 Post Announcement
                </button>
                <button onClick={() => handleSendMeetingReminder('wed')} className="admin-role-pill subtle">
                  💬 Midweek WhatsApp Reminder
                </button>
                <button onClick={() => handleSendMeetingReminder('sun')} className="admin-role-pill subtle">
                  💬 Sunday Review Reminder
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 3: REVIEW GOALS ─────────────────────────────────────────── */}
          {activeTab === 'goals' && (
            <div className="admin-card">
              <h2 className="admin-card-title" style={{ marginBottom: '0.5rem' }}>Review Weekly Goals</h2>
              <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Verify completed tasks with proof (+1 pt) or record uncompleted tasks (-1 pt).
              </p>

              {goalDocs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)' }}>
                  No goal submissions recorded yet.
                </div>
              ) : (
                (() => {
                  const currentGoals = goalDocs.filter(g => g.weekId === currentWeekId);
                  const prevGoals = goalDocs.filter(g => g.weekId !== currentWeekId);

                  const renderGoalCard = (g) => (
                    <div key={g.id} className="admin-subcard" style={{ marginBottom: '1.5rem', overflow: 'hidden', padding: 0 }}>
                      <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--admin-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <strong style={{ color: 'var(--admin-text-main)' }}>{g.userName || g.userId}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', marginLeft: '0.75rem' }}>Week: {g.weekId}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span className={`admin-status-pill ${g.reviewStatus === 'reviewed' ? 'active' : 'warning'}`}>
                            {g.reviewStatus === 'reviewed' ? '✓ Fully Reviewed' : g.reviewStatus === 'in_review' ? 'In Review' : '⏳ Pending Review'}
                          </span>
                          <button
                            onClick={() => handleDeleteGoal(g.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                            title="Delete submission"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="admin-table-container" style={{ border: 'none', borderRadius: 0 }}>
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Task Description</th>
                              <th>Status</th>
                              <th>Proof</th>
                              <th>Admin Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(g.tasks || []).map((task, idx) => (
                              <tr key={idx}>
                                <td style={{ maxWidth: '300px' }}>{task.description || '—'}</td>
                                <td>
                                  <span className={`admin-status-pill ${task.status === 'Completed' ? 'active' : task.status === 'Not Completed' ? 'suspended' : 'warning'}`}>
                                    {task.status || 'Pending'}
                                  </span>
                                </td>
                                <td>
                                  {task.proofImage ? (
                                    <a href={task.proofImage} target="_blank" rel="noreferrer" style={{ color: 'var(--tec-brand-violet)', fontSize: '0.82rem', textDecoration: 'underline' }}>📷 View Image</a>
                                  ) : task.proofText ? (
                                    <a href={task.proofText.startsWith('http') ? task.proofText : `https://${task.proofText}`} target="_blank" rel="noreferrer" style={{ color: 'var(--tec-brand-violet)', fontSize: '0.82rem', textDecoration: 'underline' }}>🔗 View Link</a>
                                  ) : (
                                    <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.82rem' }}>No proof</span>
                                  )}
                                </td>
                                <td>
                                  {task.reviewed ? (
                                    <span style={{
                                      fontSize: '0.78rem', fontWeight: 600,
                                      color: task.adminAction === 'approved' ? 'var(--tec-brand-emerald)' : 'var(--tec-brand-coral)'
                                    }}>
                                      {task.adminAction === 'approved' ? `✓ Approved (${idx < 3 ? '+1' : '0'} pt)` : `✗ Deducted (${idx < 3 ? '−1' : '0'} pt)`}
                                    </span>
                                  ) : (
                                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                      {task.status === 'Completed' && (task.proofImage || task.proofText) && (
                                        <>
                                          <button
                                            className="admin-btn-run"
                                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', background: 'var(--tec-brand-emerald)' }}
                                            onClick={() => handleApproveTask(g, idx)}
                                          >
                                            <FiCheckCircle size={12} /> Approve {idx < 3 ? '(+1)' : ''}
                                          </button>
                                          <button
                                            className="admin-btn-run"
                                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', background: 'var(--tec-brand-gold)' }}
                                            onClick={() => handleRejectTask(g, idx)}
                                          >
                                            <FiXCircle size={12} /> Reject {(task.rejectionCount || 0) > 0 && `(${task.rejectionCount})`}
                                          </button>
                                          {(task.rejectionCount >= 3) && (
                                            <button
                                              className="admin-btn-run"
                                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', background: '#ef4444' }}
                                              onClick={() => handlePermanentReject(g, idx)}
                                            >
                                              Lock Goal
                                            </button>
                                          )}
                                        </>
                                      )}
                                      {task.status === 'Not Completed' && (
                                        <button
                                          className="admin-btn-run"
                                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', background: '#ef4444' }}
                                          onClick={() => handleDeductTask(g, idx)}
                                        >
                                          <FiXCircle size={12} /> Deduct {idx < 3 ? '(-1)' : ''}
                                        </button>
                                      )}
                                      {task.status !== 'Completed' && task.status !== 'Not Completed' && (
                                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.8rem' }}>In Progress</span>
                                      )}
                                      {task.status === 'Completed' && !task.proofImage && !task.proofText && (
                                        <span style={{ color: 'var(--tec-brand-gold)', fontSize: '0.8rem' }}>No proof attached</span>
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
                  );

                  return (
                    <div>
                      {currentGoals.length > 0 && (
                        <div>
                          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--tec-brand-violet)', marginBottom: '1rem' }}>
                            Current Week ({currentWeekId})
                          </h3>
                          {currentGoals.map(renderGoalCard)}
                        </div>
                      )}
                      {prevGoals.length > 0 && (
                        <div style={{ marginTop: '2rem' }}>
                          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--admin-text-secondary)', marginBottom: '1rem' }}>
                            Previous Weeks History
                          </h3>
                          {prevGoals.map(renderGoalCard)}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* ── TAB 4: ATTENDANCE CONTROL ───────────────────────────────────── */}
          {activeTab === 'attendance' && (
            <div className="admin-card">
              <h2 className="admin-card-title" style={{ marginBottom: '0.5rem' }}>Attendance Control</h2>
              <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Generate check-in secret codes for Wednesday &amp; Sunday live meetings.
              </p>

              <form onSubmit={handleCreateSession} className="admin-subcard" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.75rem' }}>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Meeting Day</label>
                  <select
                    className="admin-search-input"
                    value={newSessionType}
                    onChange={(e) => setNewSessionType(e.target.value)}
                  >
                    <option value="Wednesday">Wednesday Meeting</option>
                    <option value="Sunday">Sunday Meeting</option>
                  </select>
                </div>
                <div style={{ flex: '2 1 200px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Secret Passcode</label>
                  <input
                    type="text"
                    className="admin-search-input"
                    placeholder="e.g. WEDS-8821"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="admin-btn-run" style={{ height: '38px', padding: '0 1.25rem' }}>
                  Create Session
                </button>
              </form>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Secret Code</th>
                      <th>Day</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.length === 0 ? (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-muted)' }}>No attendance sessions yet.</td></tr>
                    ) : (
                      sessions.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 700, letterSpacing: '0.05em' }}>{s.secretCode}</td>
                          <td>{s.dayOfWeek}</td>
                          <td>
                            <span className={`admin-status-pill ${s.isActive ? 'active' : 'suspended'}`}>
                              {s.isActive ? 'Active' : 'Closed'}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => toggleSession(s.id, s.isActive)}
                              style={{ background: 'transparent', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-main)', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
                            >
                              {s.isActive ? 'Close Session' : 'Reopen'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 5: SYSTEM SETTINGS ──────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="admin-card">
              <h2 className="admin-card-title" style={{ marginBottom: '0.5rem' }}>System &amp; Weekly Settings ({currentWeekId})</h2>
              <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Configure deadlines and weekly top performer awards.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Setup Deadline */}
                <div className="admin-subcard">
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--admin-text-main)', display: 'block', marginBottom: '0.5rem' }}>
                    Goal Setting Deadline
                  </label>
                  <p style={{ fontSize: '0.78rem', color: 'var(--admin-text-secondary)', marginBottom: '0.75rem' }}>
                    Members cannot declare or adjust their 3 compulsory goals after this deadline.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="datetime-local"
                      className="admin-search-input"
                      value={setupDeadline}
                      onChange={(e) => setSetupDeadline(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button onClick={handleUpdateSetup} className="admin-btn-run">Save</button>
                    {weekSettings?.setupDeadline && (
                      <button onClick={handleCancelSetup} className="admin-btn-run" style={{ background: '#ef4444' }}>Clear</button>
                    )}
                  </div>
                </div>

                {/* Completion Deadline */}
                <div className="admin-subcard">
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--admin-text-main)', display: 'block', marginBottom: '0.5rem' }}>
                    Task Submission Deadline
                  </label>
                  <p style={{ fontSize: '0.78rem', color: 'var(--admin-text-secondary)', marginBottom: '0.75rem' }}>
                    Members cannot upload proofs or modify task status after this deadline.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="datetime-local"
                      className="admin-search-input"
                      value={completionDeadline}
                      onChange={(e) => setCompletionDeadline(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button onClick={handleUpdateCompletion} className="admin-btn-run">Save</button>
                    {weekSettings?.completionDeadline && (
                      <button onClick={handleCancelCompletion} className="admin-btn-run" style={{ background: '#ef4444' }}>Clear</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Weekly Bonus */}
              <div className="admin-subcard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <strong style={{ color: 'var(--admin-text-main)', fontSize: '0.95rem' }}>Weekly Top Performer Recognition</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>
                    Awards +3 bonus points to the member with highest weekly points.
                  </p>
                </div>
                <button
                  onClick={handleAwardTopPerformer}
                  disabled={weekSettings?.bonusAwarded}
                  className="admin-btn-run"
                  style={{ background: weekSettings?.bonusAwarded ? 'var(--admin-border-medium)' : 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  {weekSettings?.bonusAwarded ? '✓ Bonus Awarded' : '⭐ Award +3 Bonus'}
                </button>
              </div>

              {/* Peer Goal Suggestions Feature Toggle */}
              <div className="admin-subcard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <strong style={{ color: 'var(--admin-text-main)', fontSize: '0.95rem' }}>
                    Peer Goal Suggestion &amp; Collaborative Execution
                  </strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>
                    When enabled, members assign goals to each other based on skills and track them on the 4-stage Kanban board.
                  </p>
                </div>
                <button
                  onClick={handleTogglePeerGoals}
                  className="admin-btn-run"
                  style={{
                    background: weekSettings?.peerGoalsEnabled ? '#10b981' : 'var(--admin-border-medium)',
                    color: 'white',
                    minWidth: '120px'
                  }}
                >
                  {weekSettings?.peerGoalsEnabled ? '✓ Enabled' : 'Disabled (Click to Enable)'}
                </button>
              </div>

              <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                <button
                  onClick={handleDeleteDeadlines}
                  style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '0.4rem 0.85rem', borderRadius: '7px', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Delete All Deadlines for Week
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 6: ANNOUNCEMENTS ────────────────────────────────────────── */}
          {activeTab === 'announcements' && (
            <div className="admin-card">
              <h2 className="admin-card-title" style={{ marginBottom: '0.5rem' }}>Announcements Board</h2>
              <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Post marquee updates and dispatch WhatsApp broadcasts to opted-in members.
              </p>

              {/* Post Announcement */}
              <div className="admin-subcard" style={{ marginBottom: '1.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--admin-text-main)', marginBottom: '0.75rem' }}>
                  Create Announcement
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 130px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Category</label>
                    <select
                      className="admin-search-input"
                      value={newAnnouncement.type}
                      onChange={(e) => setNewAnnouncement(prev => ({ ...prev, type: e.target.value }))}
                    >
                      {['General', 'Moderator', 'Seminar', 'Training', 'Event', 'Urgent'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: '3 1 240px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Message Text</label>
                    <input
                      type="text"
                      className="admin-search-input"
                      placeholder="e.g. Wednesday meeting starts at 9:00 PM..."
                      value={newAnnouncement.message}
                      onChange={(e) => setNewAnnouncement(prev => ({ ...prev, message: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handlePostAnnouncement()}
                    />
                  </div>

                  <button onClick={handlePostAnnouncement} className="admin-btn-run" style={{ height: '38px', padding: '0 1.25rem' }}>
                    Post Ticker
                  </button>
                </div>
              </div>

              {/* Announcements List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {announcements.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--admin-text-muted)' }}>No announcements yet.</div>
                ) : (
                  announcements.map(a => (
                    <div key={a.id} className="admin-subcard" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem' }}>
                      <span className="admin-status-pill active" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                        {a.type}
                      </span>
                      <span style={{ flex: 1, fontSize: '0.875rem', color: a.active ? 'var(--admin-text-main)' : 'var(--admin-text-muted)', textDecoration: a.active ? 'none' : 'line-through' }}>
                        {a.message}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleToggleAnnouncement(a.id, a.active)}
                          style={{ background: 'transparent', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-main)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          {a.active ? 'Hide' : 'Show'}
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(a.id)}
                          style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          <FiTrash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── TAB 7: GRACE REQUESTS ───────────────────────────────────────── */}
          {activeTab === 'grace' && (
            <div className="admin-card">
              <h2 className="admin-card-title" style={{ marginBottom: '0.5rem' }}>Grace Period Requests</h2>
              <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Review extension requests from members who missed setup or submission deadlines.
              </p>

              {(() => {
                const graceGoals = goalDocs.filter(g => g.graceRequest && Object.values(g.graceRequest).some(r => r));
                if (graceGoals.length === 0) {
                  return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)' }}>No grace period requests pending.</div>;
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {graceGoals.map(g => {
                      const types = ['setup', 'completion'].filter(t => g.graceRequest?.[t]);
                      return types.map(type => {
                        const req = g.graceRequest[type];
                        const key = `${g.id}_${type}`;
                        const label = type === 'setup' ? 'Goal Setting' : 'Task Submission';
                        return (
                          <div key={key} className="admin-subcard">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <div>
                                <strong style={{ color: 'var(--admin-text-main)' }}>{g.userName || g.userId}</strong>
                                <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--tec-brand-violet)', fontWeight: 600 }}>{label}</span>
                              </div>
                              <span className={`admin-status-pill ${req.status === 'granted' ? 'active' : req.status === 'denied' ? 'suspended' : 'warning'}`}>
                                {req.status}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--admin-text-secondary)', marginBottom: '0.85rem' }}>
                              Requested: {req.requestedAt ? new Date(req.requestedAt).toLocaleString() : '—'}
                              {req.graceDeadline && ` | Extension Until: ${new Date(req.graceDeadline).toLocaleString()}`}
                            </div>

                            {req.status === 'pending' && (
                              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '220px' }}>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Set Extension Deadline</label>
                                  <input
                                    type="datetime-local"
                                    className="admin-search-input"
                                    value={graceDeadlines[key] || ''}
                                    onChange={e => setGraceDeadlines(prev => ({ ...prev, [key]: e.target.value }))}
                                  />
                                </div>
                                <button className="admin-btn-run" style={{ background: 'var(--tec-brand-emerald)' }} onClick={() => handleGrantGrace(g, type)}>
                                  Grant Grace
                                </button>
                                <button className="admin-btn-run" style={{ background: '#ef4444' }} onClick={() => handleDenyGrace(g, type)}>
                                  Deny
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── TAB 8: MODERATOR HUB ────────────────────────────────────────── */}
          {activeTab === 'moderator' && (
            <div className="admin-card">
              <h2 className="admin-card-title" style={{ marginBottom: '0.5rem' }}>Weekly Moderator Hub</h2>
              <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Assign an active member to assist with reviewing and verifying task proofs for week {currentWeekId}.
              </p>

              {/* Current Moderator Banner */}
              {weekSettings?.moderatorUserId ? (
                (() => {
                  const currentMod = users.find(u => u.id === weekSettings.moderatorUserId);
                  return (
                    <div className="admin-subcard" style={{ border: '1px solid rgba(16, 185, 129, 0.35)', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {currentMod?.profilePicUrl ? (
                          <img src={currentMod.profilePicUrl} alt={currentMod.name} className="admin-user-avatar" style={{ width: '48px', height: '48px' }} />
                        ) : (
                          <div className="admin-user-avatar-placeholder" style={{ width: '48px', height: '48px', fontSize: '1.2rem' }}>
                            {(currentMod?.name || 'M').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--admin-text-main)' }}>{currentMod?.name || 'Assigned Moderator'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>{currentMod?.email}</div>
                          <span className="admin-status-pill active" style={{ marginTop: '0.35rem' }}>
                            ✓ Active Moderator for {currentWeekId}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveModerator}
                        style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '0.45rem 0.95rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        Remove Moderator
                      </button>
                    </div>
                  );
                })()
              ) : (
                <div className="admin-subcard" style={{ marginBottom: '2rem', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
                  No moderator assigned for week {currentWeekId}. Select a member below to assign.
                </div>
              )}

              {/* Assign Candidate */}
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--admin-text-main)', marginBottom: '1rem' }}>Available Active Members</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                {users.filter(u => u.status === 'Active' && !u.isAdmin).map(u => (
                  <div key={u.id} className="admin-subcard" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--admin-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{u.totalPoints || 0} pts</div>
                    </div>
                    {weekSettings?.moderatorUserId === u.id ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--tec-brand-emerald)', fontWeight: 700 }}>Current</span>
                    ) : (
                      <button onClick={() => handleAssignModerator(u.id)} className="admin-btn-run" style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}>
                        Assign
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB 9: ACCOUNTABILITY PAIRS ─────────────────────────────────── */}
          {activeTab === 'partners' && (
            <div className="admin-card">
              <h2 className="admin-card-title" style={{ marginBottom: '0.5rem' }}>Accountability Partners ({currentWeekId})</h2>
              <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Pair members together for mutual commitment, check-ins, and Top-3 team cash bonuses.
              </p>

              {/* Actions Header */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <button onClick={handleAutoPairing} className="admin-btn-run">
                  ⚡ Auto-Pair All Active Members
                </button>
                <button onClick={handleAwardAllTeamRewards} className="admin-btn-run" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  🏆 Award Top-3 Team Rewards (₦1,000)
                </button>
              </div>

              {/* Manual Pairing Form */}
              <form onSubmit={handleManualPairing} className="admin-subcard" style={{ marginBottom: '1.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>Partner A</label>
                  <select className="admin-search-input" value={partnerAId} onChange={(e) => setPartnerAId(e.target.value)}>
                    <option value="">Select Member...</option>
                    {users.filter(u => u.status === 'Active' || u.status === 'Warning').map(u => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>Partner B</label>
                  <select className="admin-search-input" value={partnerBId} onChange={(e) => setPartnerBId(e.target.value)}>
                    <option value="">Select Member...</option>
                    {users.filter(u => u.status === 'Active' || u.status === 'Warning').map(u => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="admin-btn-run" style={{ height: '38px', padding: '0 1.25rem' }}>
                  Pair Selected
                </button>
              </form>

              {/* Pairings Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {pairings.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                    No pairings created for this week yet.
                  </div>
                ) : (
                  pairings.map(p => (
                    <div key={p.id} className="admin-subcard" style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                          {p.userIds?.length === 3 ? 'Triad Pairing' : 'Accountability Duo'}
                        </span>
                        <button
                          onClick={() => handleDeletePairing(p.id)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                          title="Delete pairing"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {p.userIds?.map(uid => {
                          const u = users.find(usr => usr.id === uid);
                          return (
                            <div key={uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--admin-text-main)', fontWeight: 500 }}>{u?.name || 'Anonymous'}</span>
                              <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>₦{(u?.walletBalance || 0).toLocaleString()}</span>
                            </div>
                          );
                        })}
                      </div>

                      {p.teamRewarded && (
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--admin-border-subtle)', fontSize: '0.72rem', color: 'var(--tec-brand-gold)', fontWeight: 600 }}>
                          🏆 ₦{(p.rewardAmount || 1000).toLocaleString()} Rewarded
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── MODAL 1: MODIFY FUNDS ─────────────────────────────────────────── */}
      {fundsModalUser && (
        <div className="admin-modal-overlay" onClick={() => setFundsModalUser(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Modify Wallet Funds</h3>
              <button className="admin-modal-close" onClick={() => setFundsModalUser(null)}><FiX /></button>
            </div>

            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>
              Member: <strong style={{ color: 'var(--admin-text-main)' }}>{fundsModalUser.name}</strong><br />
              Current Balance: <strong style={{ color: 'var(--tec-brand-emerald)' }}>₦{(fundsModalUser.walletBalance || 0).toLocaleString()}</strong>
            </div>

            <div className="admin-segmented-control">
              <button
                type="button"
                className={`admin-segment-btn ${fundsModalMode === 'add' ? 'active' : ''}`}
                onClick={() => setFundsModalMode('add')}
              >
                + Add Funds (Credit)
              </button>
              <button
                type="button"
                className={`admin-segment-btn ${fundsModalMode === 'deduct' ? 'active' : ''}`}
                onClick={() => setFundsModalMode('deduct')}
              >
                − Deduct Funds (Debit)
              </button>
            </div>

            <form onSubmit={handleSubmitFundsModal}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Amount (₦)
                </label>
                <input
                  type="number"
                  min="1"
                  className="admin-search-input"
                  placeholder="e.g. 1000"
                  value={fundsModalAmount}
                  onChange={(e) => setFundsModalAmount(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setFundsModalUser(null)}
                  style={{ background: 'transparent', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-main)', padding: '0.45rem 1rem', borderRadius: '7px', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn-run" style={{ padding: '0.45rem 1.25rem' }}>
                  {fundsModalMode === 'add' ? 'Add Funds' : 'Deduct Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: AWARD / DEDUCT POINTS ────────────────────────────────── */}
      {pointsModalUser && (
        <div className="admin-modal-overlay" onClick={() => setPointsModalUser(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Adjust Member Points</h3>
              <button className="admin-modal-close" onClick={() => setPointsModalUser(null)}><FiX /></button>
            </div>

            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>
              Member: <strong style={{ color: 'var(--admin-text-main)' }}>{pointsModalUser.name}</strong><br />
              Current Points: <strong style={{ color: 'var(--tec-brand-gold)' }}>{pointsModalUser.totalPoints || 0} pts</strong>
            </div>

            <div className="admin-segmented-control">
              <button
                type="button"
                className={`admin-segment-btn ${pointsModalMode === 'award' ? 'active' : ''}`}
                onClick={() => setPointsModalMode('award')}
              >
                ⭐ Award Points (+)
              </button>
              <button
                type="button"
                className={`admin-segment-btn ${pointsModalMode === 'deduct' ? 'active' : ''}`}
                onClick={() => setPointsModalMode('deduct')}
              >
                ✗ Deduct Points (−)
              </button>
            </div>

            <form onSubmit={handleSubmitPointsModal}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Number of Points
                </label>
                <input
                  type="number"
                  min="1"
                  className="admin-search-input"
                  placeholder="e.g. 5"
                  value={pointsModalAmount}
                  onChange={(e) => setPointsModalAmount(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setPointsModalUser(null)}
                  style={{ background: 'transparent', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-main)', padding: '0.45rem 1rem', borderRadius: '7px', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn-run" style={{ padding: '0.45rem 1.25rem' }}>
                  {pointsModalMode === 'award' ? 'Award Points' : 'Deduct Points'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: VIEW USER DETAILS ────────────────────────────────────── */}
      {detailModalUser && (
        <div className="admin-modal-overlay" onClick={() => setDetailModalUser(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Member Details</h3>
              <button className="admin-modal-close" onClick={() => setDetailModalUser(null)}><FiX /></button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
              {detailModalUser.profilePicUrl ? (
                <img src={detailModalUser.profilePicUrl} alt={detailModalUser.name} className="admin-user-avatar" style={{ width: '52px', height: '52px' }} />
              ) : (
                <div className="admin-user-avatar-placeholder" style={{ width: '52px', height: '52px', fontSize: '1.3rem' }}>
                  {(detailModalUser.name || 'M').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--admin-text-main)' }}>{detailModalUser.name || 'Anonymous'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>{detailModalUser.email}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{detailModalUser.phone || 'No phone number'}</div>
              </div>
            </div>

            <div className="admin-subcard" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              <div>Status: <strong style={{ color: 'var(--admin-text-main)' }}>{detailModalUser.status}</strong></div>
              <div>Wallet: <strong style={{ color: 'var(--tec-brand-emerald)' }}>₦{(detailModalUser.walletBalance || 0).toLocaleString()}</strong></div>
              <div>Lifetime Points: <strong style={{ color: 'var(--tec-brand-gold)' }}>{detailModalUser.totalPoints || 0}</strong></div>
              <div>Streak: <strong style={{ color: 'var(--tec-brand-violet)' }}>{detailModalUser.consecutiveGoodWeeks || 0} wks</strong></div>
              <div>Stars: <strong style={{ color: 'var(--tec-brand-gold)' }}>⭐ {detailModalUser.achievementStars || 0}</strong></div>
              <div>Admin Role: <strong style={{ color: 'var(--admin-text-main)' }}>{detailModalUser.isAdmin ? 'Yes' : 'No'}</strong></div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => setDetailModalUser(null)}
                className="admin-btn-run"
                style={{ padding: '0.45rem 1.25rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: ACTIVE WEEK DEADLINES ─────────────────────────────────── */}
      {showClockModal && (
        <div className="admin-modal-overlay" onClick={() => setShowClockModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Week {currentWeekId} Schedule</h3>
              <button className="admin-modal-close" onClick={() => setShowClockModal(false)}><FiX /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              <div className="admin-subcard">
                <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>GOAL SETTING DEADLINE</div>
                <div style={{ color: 'var(--admin-text-main)', fontWeight: 700, fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {weekSettings?.setupDeadline ? new Date(weekSettings.setupDeadline).toLocaleString() : 'Not Set'}
                </div>
              </div>

              <div className="admin-subcard">
                <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>TASK SUBMISSION DEADLINE</div>
                <div style={{ color: 'var(--admin-text-main)', fontWeight: 700, fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {weekSettings?.completionDeadline ? new Date(weekSettings.completionDeadline).toLocaleString() : 'Not Set'}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button onClick={() => { setShowClockModal(false); setActiveTab('settings'); }} className="admin-btn-run" style={{ padding: '0.45rem 1.25rem' }}>
                Edit Deadlines →
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
