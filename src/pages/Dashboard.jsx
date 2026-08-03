import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, setDoc, getDoc, collection, query, where, getDocs, addDoc, increment, limit } from 'firebase/firestore';
import { uploadToCloudinary } from '../cloudinary';
import { FiCamera, FiAlertCircle, FiSave, FiDollarSign, FiShield, FiTrendingUp, FiDownload, FiStar, FiActivity, FiZap, FiAward, FiUser, FiCheckCircle } from 'react-icons/fi';
import { onSnapshot } from 'firebase/firestore';
import { getWeekId } from '../utils/weekUtils';

export default function Dashboard({ user, userData }) {
  const [activeTab, setActiveTab] = useState('goals');

  // Profile State
  const [name, setName] = useState(userData?.name || '');
  const [userState, setUserState] = useState(userData?.state || '');
  const [userCountry, setUserCountry] = useState(userData?.country || '');
  const [profession, setProfession] = useState(userData?.profession || '');
  const [bio, setBio] = useState(userData?.bio || '');
  const [socials, setSocials] = useState(userData?.socials || { twitter: '', instagram: '', linkedin: '', github: '' });
  const [profilePic, setProfilePic] = useState(userData?.profilePicUrl || '');
  const [uploading, setUploading] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Attendance State
  const [secretCode, setSecretCode] = useState('');
  const [attendanceMsg, setAttendanceMsg] = useState('');

  // Goals State
  const [tasks, setTasks] = useState([
    { id: 1, description: '', status: '', penalty: '0', proofText: '', proofImage: '', uploadingProof: false },
    { id: 2, description: '', status: '', penalty: '0', proofText: '', proofImage: '', uploadingProof: false },
    { id: 3, description: '', status: '', penalty: '0', proofText: '', proofImage: '', uploadingProof: false }
  ]);
  const [submittingGoals, setSubmittingGoals] = useState(false);
  const [goalsSubmitted, setGoalsSubmitted] = useState(false);
  const [weekSettings, setWeekSettings] = useState(null);
  const [currentWeekId, setCurrentWeekId] = useState('');
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(userData?.totalPoints || 0);

  // Grace Period State
  const [graceRequest, setGraceRequest] = useState(null);
  const [showGraceModal, setShowGraceModal] = useState(null);
  const [requestingGrace, setRequestingGrace] = useState(false);

  // Break / Hold State
  const [requestingBreak, setRequestingBreak] = useState(false);
  const [releasingHold, setReleasingHold] = useState(false);

  // Monthly Vision State
  const [monthlyVision, setMonthlyVision] = useState({ title: '', overview: '', weeks: ['', '', '', ''], weekChecked: [false, false, false, false], completed: false });
  const [savingVision, setSavingVision] = useState(false);
  const [visionMsg, setVisionMsg] = useState('');

  // Daily Streak State
  const [streakData, setStreakData] = useState({ currentStreak: 0, lastCheckin: null, totalCycles: 0, checkedInToday: false });
  const [streakMsg, setStreakMsg] = useState('');

  // Accountability Partner State
  const [partners, setPartners] = useState([]);
  const [systemWallet, setSystemWallet] = useState(0);

  // ── Helper: calendar-aware week-of-month (0-indexed, 0 = Week 1) ──────────
  const getMonthId = (date) =>
    `${date.getFullYear()}-M${String(date.getMonth() + 1).padStart(2, '0')}`;

  const getWeekOfMonth = (date) => {
    // Split the month into 7-day chunks starting from day 1
    return Math.min(Math.floor((date.getDate() - 1) / 7), 3); // 0-3
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  // Derive Lockout Status
  const isLockedOut = userData?.walletBalance < 1000;

  // Fetch existing goals for the current week
  useEffect(() => {
    const fetchCurrentWeekGoals = async () => {
      if (!user) return;
      const now = new Date();
      const weekId = getWeekId(now);
      setCurrentWeekId(weekId);

      const goalDocRef = doc(db, 'weekly_goals', `${user.uid}_${weekId}`);
      const docSnap = await getDoc(goalDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWeeklyPoints(data.weeklyPoints || 0);
        if (data.tasks && data.tasks.length > 0) {
          setTasks(data.tasks);
          setGoalsSubmitted(true);
        } else {
          setGoalsSubmitted(false);
          setTasks([
            { id: 1, description: '', status: '', penalty: '0', proofText: '', proofImage: '', uploadingProof: false },
            { id: 2, description: '', status: '', penalty: '0', proofText: '', proofImage: '', uploadingProof: false },
            { id: 3, description: '', status: '', penalty: '0', proofText: '', proofImage: '', uploadingProof: false }
          ]);
        }
      } else {
        setGoalsSubmitted(false);
      }

      // Fetch week settings
      const unsubSettings = onSnapshot(doc(db, 'week_settings', weekId), (snap) => {
        if (snap.exists()) {
          setWeekSettings(snap.data());
        }
      });
      return () => unsubSettings();
    };

    fetchCurrentWeekGoals();
  }, [user]);

  // Listen to system wallet
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'system_data', 'wallet'), (snap) => {
      if (snap.exists()) {
        setSystemWallet(snap.data().adminBalance || 0);
      }
    });
    return () => unsub();
  }, [user]);

  // Listen to grace requests in real-time
  useEffect(() => {
    if (!user || !currentWeekId) return;
    const goalDocRef = doc(db, 'weekly_goals', `${user.uid}_${currentWeekId}`);
    const unsub = onSnapshot(goalDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGraceRequest(data.graceRequest || null);
        setWeeklyPoints(data.weeklyPoints || 0);
      }
    });
    return () => unsub();
  }, [user, currentWeekId]);

  // Fetch Monthly Vision
  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const monthId = getMonthId(now);
    const visionRef = doc(db, 'monthly_visions', `${user.uid}_${monthId}`);
    const unsub = onSnapshot(visionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMonthlyVision({
          title: data.title || '',
          overview: data.overview || '',
          weeks: data.weeks || ['', '', '', ''],
          weekChecked: data.weekChecked || [false, false, false, false],
          completed: data.completed || false
        });
      }
    });
    return () => unsub();
  }, [user]);

  // Auto-check current week focus when all tasks are 100% approved
  useEffect(() => {
    if (!user || !tasks || tasks.length === 0 || !goalsSubmitted) return;
    const allApproved = tasks.every(t => t.adminAction === 'approved');
    if (!allApproved) return;

    const now = new Date();
    const weekIndex = getWeekOfMonth(now);
    const monthId = getMonthId(now);
    const visionDocId = `${user.uid}_${monthId}`;

    // Only update if not already checked
    if (monthlyVision.weekChecked && monthlyVision.weekChecked[weekIndex]) return;

    const newChecked = [...(monthlyVision.weekChecked || [false, false, false, false])];
    newChecked[weekIndex] = true;
    const allDone = newChecked.every(Boolean);

    setDoc(doc(db, 'monthly_visions', visionDocId), {
      weekChecked: newChecked,
      completed: allDone,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }, [tasks, goalsSubmitted]);

  const handleSaveVision = async () => {
    if (!user) return;
    setSavingVision(true);
    setVisionMsg('');
    try {
      const now = new Date();
      const monthId = getMonthId(now);
      const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
      const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth());
      await setDoc(doc(db, 'monthly_visions', `${user.uid}_${monthId}`), {
        userId: user.uid,
        monthId,
        monthName,
        daysInMonth,
        title: monthlyVision.title,
        overview: monthlyVision.overview,
        weeks: monthlyVision.weeks,
        weekChecked: monthlyVision.weekChecked || [false, false, false, false],
        completed: monthlyVision.completed || false,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setVisionMsg('Monthly vision saved! 🌟');
    } catch (err) {
      setVisionMsg('Error saving vision. Please try again.');
    } finally {
      setSavingVision(false);
    }
  };

  const updateWeek = (index, value) => {
    setMonthlyVision(prev => {
      const newWeeks = [...prev.weeks];
      newWeeks[index] = value;
      return { ...prev, weeks: newWeeks };
    });
  };

  // Fetch Daily Streak
  useEffect(() => {
    if (!user) return;
    const streakRef = doc(db, 'daily_streaks', user.uid);
    const unsub = onSnapshot(streakRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const today = new Date().toISOString().split('T')[0];
        setStreakData({
          currentStreak: data.currentStreak || 0,
          lastCheckin: data.lastCheckin || null,
          totalCycles: data.totalCycles || 0,
          checkedInToday: data.lastCheckin === today
        });
      }
    });
    return () => unsub();
  }, [user]);

  // Fetch Accountability Partner(s) in Real-time
  useEffect(() => {
    if (!user || !currentWeekId) return;
    const q = query(collection(db, 'weekly_pairings'), where('weekId', '==', currentWeekId));
    const unsub = onSnapshot(q, (snap) => {
      const allPairings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const myPairing = allPairings.find(p => p.userIds?.includes(user.uid));

      if (myPairing) {
        const otherUserIds = myPairing.userIds.filter(id => id !== user.uid);
        const unsubscribes = [];
        const partnerDataMap = {};

        otherUserIds.forEach(pId => {
          // Listen to user document
          const userUnsub = onSnapshot(doc(db, 'users', pId), (uSnap) => {
            if (uSnap.exists()) {
              partnerDataMap[pId] = {
                ...partnerDataMap[pId],
                id: pId,
                ...uSnap.data()
              };
              setPartners(Object.values(partnerDataMap));
            }
          });
          unsubscribes.push(userUnsub);

          // Listen to goals document
          const goalsUnsub = onSnapshot(doc(db, 'weekly_goals', `${pId}_${currentWeekId}`), (gSnap) => {
            partnerDataMap[pId] = {
              ...partnerDataMap[pId],
              id: pId,
              goals: gSnap.exists() ? gSnap.data() : null
            };
            setPartners(Object.values(partnerDataMap));
          });
          unsubscribes.push(goalsUnsub);
        });

        return () => {
          unsubscribes.forEach(fn => fn());
        };
      } else {
        setPartners([]);
      }
    });

    return () => unsub();
  }, [user, currentWeekId]);

  const handleDailyCheckin = async () => {
    if (!user) return;
    setStreakMsg('');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (streakData.checkedInToday) {
      setStreakMsg('You already checked in today! Come back tomorrow. 😊');
      return;
    }

    const streakRef = doc(db, 'daily_streaks', user.uid);
    const lastCheckin = streakData.lastCheckin;

    // Calculate new streak: only continue if last check-in was yesterday
    let newStreak = 1;
    if (lastCheckin === yesterday) {
      newStreak = (streakData.currentStreak || 0) + 1;
    } else if (lastCheckin === today) {
      return; // already done
    }
    // else: missed a day, streak resets to 1

    let newCycles = streakData.totalCycles || 0;
    let bonusAwarded = false;

    if (newStreak === 7) {
      // Award +2 points and reset streak
      await updateDoc(doc(db, 'users', user.uid), { totalPoints: increment(2) });
      newCycles += 1;
      newStreak = 0; // reset for next cycle
      bonusAwarded = true;
    }

    await setDoc(streakRef, {
      userId: user.uid,
      currentStreak: newStreak,
      lastCheckin: today,
      totalCycles: newCycles,
      updatedAt: serverTimestamp()
    }, { merge: true });

    if (bonusAwarded) {
      setStreakMsg('🎉 Amazing! You hit a 7-day streak! +2 bonus points awarded. Streak resets — keep going!');
    } else {
      setStreakMsg(`✅ Day ${newStreak} checked! ${7 - newStreak} day${7 - newStreak !== 1 ? 's' : ''} to go for your +2 bonus!`);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name, state: userState, country: userCountry, profession, bio,
        socials: {
          twitter: socials.twitter || '',
          instagram: socials.instagram || '',
          linkedin: socials.linkedin || '',
          github: socials.github || ''
        }
      });
      setProfileMsg('Profile updated successfully!');
    } catch (err) {
      setProfileMsg('Error updating profile.');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setProfileMsg('Uploading... 0%');

    try {
      const downloadURL = await uploadToCloudinary(
        file,
        'tec-weekly/profilePics',
        (percent) => setProfileMsg(`Uploading... ${percent}%`)
      );
      setProfilePic(downloadURL);
      await updateDoc(doc(db, 'users', user.uid), { profilePicUrl: downloadURL });
      setProfileMsg('Profile picture updated!');
    } catch (err) {
      console.error('Profile pic upload error:', err);
      setProfileMsg(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveGoals = async () => {
    if (isLockedOut) return;

    // ── Validation ────────────────────────────────────────────────────────────
    if (tasks.length < 3) {
      alert('You must set at least 3 goals for the week.');
      return;
    }
    if (tasks.length > 10) {
      alert('You can set a maximum of 10 goals.');
      return;
    }
    if (tasks.some(t => !t.description.trim())) {
      alert('All goals must have a description.');
      return;
    }

    setSubmittingGoals(true);

    // ── Dynamic week ID ───────────────────────────────────────────────────────
    const now = new Date();
    const weekId = getWeekId(now);

    // ── Deadline Check ────────────────────────────────────────────────────────
    const setupDeadlineDate = weekSettings?.setupDeadline ? new Date(String(weekSettings.setupDeadline).replace(' ', 'T')) : null;
    const now2 = new Date();
    if (setupDeadlineDate && now2 > setupDeadlineDate && !goalsSubmitted) {
      // Check if setup grace period is active
      const sg = graceRequest?.setup;
      const sgDeadline = sg?.graceDeadline ? new Date(String(sg.graceDeadline).replace(' ', 'T')) : null;
      const sgActive = sg?.status === 'granted' && sgDeadline && now2 <= sgDeadline;
      if (!sgActive) {
        alert('The goal setting deadline has passed. Request a grace period to submit.');
        setSubmittingGoals(false);
        return;
      }
    }
    // Check completion deadline for existing submissions
    const completionDeadlineDate = weekSettings?.completionDeadline ? new Date(String(weekSettings.completionDeadline).replace(' ', 'T')) : null;
    if (completionDeadlineDate && now2 > completionDeadlineDate && goalsSubmitted) {
      const cg = graceRequest?.completion;
      const cgDeadline = cg?.graceDeadline ? new Date(String(cg.graceDeadline).replace(' ', 'T')) : null;
      const cgActive = cg?.status === 'granted' && cgDeadline && now2 <= cgDeadline;
      if (!cgActive) {
        alert('The task submission deadline has passed. Request a grace period to update your goals.');
        setSubmittingGoals(false);
        return;
      }
    }

    // ── Progress ──────────────────────────────────────────────────────────────
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    // Mark all tasks as pending review (admin will approve/deduct individually)
    const tasksForSubmission = tasks.map(t => ({
      ...t,
      reviewed: t.reviewed || false,
    }));

    const goalDocRef = doc(db, 'weekly_goals', `${user.uid}_${weekId}`);
    
    try {
      // ── SANITIZATION: Fetch existing document to prevent self-verification ──
      const docSnap = await getDoc(goalDocRef);
      const existingData = docSnap.exists() ? docSnap.data() : null;
      const existingTasks = existingData?.tasks || [];

      // ── Progress ──
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'Completed').length;
      const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

      // ── Merge tasks with existing admin data to prevent overriding ──
      const mergedTasks = tasks.map(task => {
        const existing = existingTasks.find(et => et.id === task.id);
        if (existing) {
          // Preserve admin-controlled fields strictly from the database
          return {
            ...task,
            reviewed: existing.reviewed || false,
            adminAction: existing.adminAction || null,
            rejectionReason: existing.rejectionReason || '',
            rejectionCount: existing.rejectionCount || 0,
            moderatorReviewed: existing.moderatorReviewed || false,
            moderatorAction: existing.moderatorAction || null,
            // If it was already reviewed, the description should also be locked
            description: existing.reviewed ? existing.description : task.description
          };
        }
        // New task: default values for admin fields
        return {
          ...task,
          reviewed: false,
          adminAction: null,
          rejectionReason: '',
          rejectionCount: 0
        };
      });

      // ── Early Bird Logic ──
      let isFirstToSet = false;
      if (!goalsSubmitted) {
        const goalsRef = collection(db, 'weekly_goals');
        const q = query(goalsRef, where('weekId', '==', weekId), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          isFirstToSet = true;
          alert('Early Bird! You are the first to set goals this week. +1 Point awarded!');
        }
      }

      // ── SANITIZATION: Clean undefined properties to prevent Firestore write crashes ──
      const sanitizedTasks = mergedTasks.map(({ isNew, ...task }) => {
        const cleanedTask = {};
        Object.entries(task).forEach(([key, val]) => {
          if (val !== undefined) {
            cleanedTask[key] = val;
          }
        });
        return cleanedTask;
      });

      await setDoc(goalDocRef, {
        userId: user.uid,
        userName: userData?.name || user.displayName || user.email || 'Anonymous',
        profilePicUrl: userData?.profilePicUrl || user.photoURL || '',
        weekId: weekId,
        tasks: sanitizedTasks,
        progress: progress,
        reviewStatus: 'pending', // admin needs to review
        submittedAt: existingData?.submittedAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        isFirstToSet: existingData?.isFirstToSet || isFirstToSet
      }, { merge: true });

      if (isFirstToSet) {
        await updateDoc(doc(db, 'users', user.uid), {
          totalPoints: increment(1)
        });
      }

      setGoalsSubmitted(true);
      alert('Goals saved! Previously set descriptions remain locked.');
    } catch (err) {
      console.error(err);
      alert(`Failed to save goals. Error: ${err.message}`);
    } finally {
      setSubmittingGoals(false);
    }
  };

  const calculateStars = (pts) => {
    if (pts >= 100) return 5;
    if (pts >= 50) return 4;
    if (pts >= 25) return 3;
    if (pts >= 10) return 2;
    if (pts >= 1) return 1;
    return 0;
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const updateTask = (index, field, value) => {
    // Only lock the task if the admin has already reviewed it
    const task = tasks[index];
    if (task.reviewed) {
      return;
    }

    const newTasks = [...tasks];
    newTasks[index][field] = value;
    setTasks(newTasks);
  };

  const addTaskRow = () => {
    if (tasks.length >= 10) {
      alert('Maximum of 10 goals allowed.');
      return;
    }
    setTasks([...tasks, { 
      id: Date.now(), 
      description: '', 
      status: '', 
      penalty: '0', 
      proofText: '', 
      proofImage: '', 
      uploadingProof: false,
      isNew: true 
    }]);
  };

  const handleProofImageUpload = async (index, e) => {
    const file = e.target.files[0];
    if (!file) return;

    updateTask(index, 'uploadingProof', true);

    try {
      const downloadURL = await uploadToCloudinary(
        file,
        'tec-weekly/proofs',
        (percent) => {
          setTasks(prev => {
            const newTasks = [...prev];
            newTasks[index].uploadProgress = percent;
            return newTasks;
          });
        }
      );
      setTasks(prevTasks => {
        const newTasks = [...prevTasks];
        newTasks[index].proofImage = downloadURL;
        newTasks[index].uploadingProof = false;
        newTasks[index].uploadProgress = 0;
        return newTasks;
      });
    } catch (err) {
      console.error('Proof upload error:', err);
      setTasks(prev => {
        const newTasks = [...prev];
        newTasks[index].uploadingProof = false;
        newTasks[index].uploadProgress = 0;
        return newTasks;
      });
      alert(`Upload failed: ${err.message}`);
    }
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    setAttendanceMsg('');
    if (isLockedOut) return;

    try {
      // 1. Find active session with this code

      const sessionsRef = collection(db, 'attendance_sessions');
      const q = query(sessionsRef, where('isActive', '==', true), where('secretCode', '==', secretCode));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setAttendanceMsg('Invalid or expired attendance code.');
        return;
      }

      const session = snapshot.docs[0];
      const sessionData = session.data();

      // 2. Check if already checked in
      const recordsRef = collection(db, 'attendance_records');
      const rQuery = query(recordsRef, where('userId', '==', user.uid), where('sessionId', '==', session.id));
      const rSnapshot = await getDocs(rQuery);

      if (!rSnapshot.empty) {
        setAttendanceMsg('You have already checked in for this session.');
        return;
      }

      // 3. Record attendance and award 1 point
      await addDoc(recordsRef, {
        userId: user.uid,
        sessionId: session.id,
        timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, 'users', user.uid), {
        totalPoints: increment(1)
      });

      setAttendanceMsg('Successfully checked in! +1 Point awarded.');
      setSecretCode('');
    } catch (err) {
      console.error(err);
      setAttendanceMsg('Failed to check in.');
    }
  };

  const handleRequestBreak = async () => {
    if (!user) return;
    if (!window.confirm('Request a 1-week break? You can only use this once every 2 months. The admin must approve it before it takes effect.')) return;
    setRequestingBreak(true);
    try {
      const lastBreak = userData?.lastBreakApprovedAt;
      if (lastBreak) {
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        if (new Date(lastBreak) > twoMonthsAgo) {
          const nextEligible = new Date(lastBreak);
          nextEligible.setMonth(nextEligible.getMonth() + 2);
          alert(`You already used your break within the last 2 months. You can request again after ${nextEligible.toLocaleDateString()}.`);
          return;
        }
      }
      if (userData?.breakRequest?.status === 'pending') {
        alert('You already have a pending break request. Wait for the admin to respond.');
        return;
      }
      await updateDoc(doc(db, 'users', user.uid), {
        breakRequest: { status: 'pending', requestedAt: new Date().toISOString(), type: '1week' }
      });
      alert('Break request submitted! Your account will be placed on break once the admin approves.');
    } catch (err) {
      console.error(err);
      alert('Failed to submit break request.');
    } finally {
      setRequestingBreak(false);
    }
  };

  const handleRequestRelease = async () => {
    if (!user) return;
    if (!window.confirm('Release your account from Admin Hold? By confirming, you resume full participation and accountability immediately.')) return;
    setReleasingHold(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        status: 'Active',
        onHold: null,
        holdReleaseRequestedAt: new Date().toISOString()
      });
      alert('Your account is now Active again!');
    } catch (err) {
      console.error(err);
      alert('Failed to release hold.');
    } finally {
      setReleasingHold(false);
    }
  };

  const now = new Date();
  const setupDeadline = weekSettings?.setupDeadline ? new Date(String(weekSettings.setupDeadline).replace(' ', 'T')) : null;
  const completionDeadline = weekSettings?.completionDeadline ? new Date(String(weekSettings.completionDeadline).replace(' ', 'T')) : null;

  const isPastSetup = setupDeadline && now > setupDeadline;
  const isPastCompletion = completionDeadline && now > completionDeadline;

  // Grace period computed helpers
  const setupGrace = graceRequest?.setup;
  const completionGrace = graceRequest?.completion;

  const setupGraceDeadline = setupGrace?.graceDeadline ? new Date(String(setupGrace.graceDeadline).replace(' ', 'T')) : null;
  const completionGraceDeadline = completionGrace?.graceDeadline ? new Date(String(completionGrace.graceDeadline).replace(' ', 'T')) : null;

  // Is the user allowed to set goals? 
  // Yes if: deadline hasn't passed, OR grace was granted and grace deadline hasn't passed
  const setupGraceActive = setupGrace?.status === 'granted' && setupGraceDeadline && now <= setupGraceDeadline;
  const completionGraceActive = completionGrace?.status === 'granted' && completionGraceDeadline && now <= completionGraceDeadline;
  
  const canSetGoals = !isPastSetup || setupGraceActive;
  const canSubmitGoals = !isPastCompletion || completionGraceActive;

  const handleRequestGrace = async (type, paymentMethod) => {
    // type: 'setup' | 'completion'
    // paymentMethod: 'points' | 'wallet'
    setRequestingGrace(true);
    try {
      const currentPoints = userData?.totalPoints || 0;
      const currentWallet = userData?.walletBalance || 0;

      if (paymentMethod === 'points') {
        if (currentPoints < 10) {
          alert('Insufficient points. You need at least 10 points to request a grace period.');
          setRequestingGrace(false);
          return;
        }
        await updateDoc(doc(db, 'users', user.uid), { totalPoints: increment(-10) });
      } else {
        if (currentWallet < 100) {
          alert('Insufficient wallet balance. You need at least ₦100 to request a grace period.');
          setRequestingGrace(false);
          return;
        }
        await updateDoc(doc(db, 'users', user.uid), { walletBalance: (currentWallet - 100) });
      }

      const goalDocRef = doc(db, 'weekly_goals', `${user.uid}_${currentWeekId}`);
      await setDoc(goalDocRef, {
        graceRequest: {
          ...(graceRequest || {}),
          [type]: {
            status: 'pending',
            requestedAt: new Date().toISOString(),
            paymentMethod,
            penaltyPaid: paymentMethod === 'points' ? '10 pts' : '₦100',
            graceDeadline: null,
          }
        }
      }, { merge: true });

      setShowGraceModal(null);
      alert(`Grace period request submitted! The admin will set a new deadline for you. Your ${paymentMethod === 'points' ? '10 points' : '₦100'} penalty has been deducted.`);
    } catch (err) {
      console.error(err);
      alert('Failed to submit grace request. Please try again.');
    } finally {
      setRequestingGrace(false);
    }
  };

  // Grace Period Modal component (inline)
  const GracePeriodModal = ({ type, onClose }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-panel" style={{ maxWidth: '420px', width: '100%', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(239,68,68,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⏰</div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--danger)' }}>Request Grace Period</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            The <strong>{type === 'setup' ? 'Goal Setting' : 'Task Submission'}</strong> deadline has passed.
            You can request a grace period by paying a penalty. The admin will assign you a new deadline.
          </p>
        </div>

        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontWeight: '700', color: 'var(--danger)', marginBottom: '0.4rem' }}>⚠️ Penalties</div>
          <div>• Grace unlock fee: <strong>10 Points</strong> or <strong>₦100</strong></div>
          <div>• Failing grace period: auto-debit of <strong>20 Points</strong> or <strong>₦200</strong></div>
        </div>

        <p style={{ fontSize: '0.85rem', fontWeight: '600', textAlign: 'center', marginBottom: '1rem' }}>Choose your payment method:</p>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <button
            onClick={() => handleRequestGrace(type, 'points')}
            disabled={requestingGrace}
            className="btn btn-primary"
            style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}
          >
            <span style={{ fontSize: '1.25rem' }}>⭐</span>
            <strong>10 Points</strong>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>You have {userData?.totalPoints || 0} pts</span>
          </button>
          <button
            onClick={() => handleRequestGrace(type, 'wallet')}
            disabled={requestingGrace}
            className="btn btn-secondary"
            style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', border: '1px solid var(--primary)' }}
          >
            <span style={{ fontSize: '1.25rem' }}>💰</span>
            <strong>₦100 Wallet</strong>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Balance: ₦{userData?.walletBalance || 0}</span>
          </button>
        </div>
        <button onClick={onClose} className="btn btn-secondary" style={{ width: '100%', opacity: 0.7 }}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>

      {/* Grace Modal */}
      {showGraceModal && <GracePeriodModal type={showGraceModal} onClose={() => setShowGraceModal(null)} />}

      {/* ── Setup Deadline Banners ── */}
      {isPastSetup && !goalsSubmitted && !setupGraceActive && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid var(--danger)', padding: '1rem 1.25rem', marginBottom: '1rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiAlertCircle color="var(--danger)" size={20} />
              <div>
                <strong>Goal Setting Deadline Missed</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Deadline was {setupDeadline?.toLocaleString()}. Your goal form is locked.
                </div>
              </div>
            </div>
            {setupGrace?.status === 'pending' ? (
              <span style={{ padding: '0.3rem 0.75rem', background: 'rgba(245,158,11,0.2)', color: 'var(--warning)', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700' }}>
                ⏳ Grace Request Pending Admin Approval
              </span>
            ) : (
              <button onClick={() => setShowGraceModal('setup')} className="btn btn-danger" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                Request Grace Period
              </button>
            )}
          </div>
        </div>
      )}
      {isPastSetup && setupGraceActive && (
        <div style={{ background: 'rgba(16,185,129,0.1)', borderLeft: '4px solid #10b981', padding: '1rem 1.25rem', marginBottom: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <FiAlertCircle color="#10b981" size={20} />
          <div>
            <strong style={{ color: '#10b981' }}>Grace Period Active</strong>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Your grace period for goal setting expires: <strong>{setupGraceDeadline?.toLocaleString()}</strong>. Set your goals before then!
            </div>
          </div>
        </div>
      )}

      {/* ── Completion Deadline Banners ── */}
      {isPastCompletion && !completionGraceActive && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid var(--danger)', padding: '1rem 1.25rem', marginBottom: '1rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiAlertCircle color="var(--danger)" size={20} />
              <div>
                <strong>Task Submission Deadline Missed</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Deadline was {completionDeadline?.toLocaleString()}. Goals are locked for review.
                </div>
              </div>
            </div>
            {completionGrace?.status === 'pending' ? (
              <span style={{ padding: '0.3rem 0.75rem', background: 'rgba(245,158,11,0.2)', color: 'var(--warning)', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700' }}>
                ⏳ Grace Request Pending Admin Approval
              </span>
            ) : goalsSubmitted ? (
              <button onClick={() => setShowGraceModal('completion')} className="btn btn-danger" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                Request Grace Period
              </button>
            ) : null}
          </div>
        </div>
      )}
      {isPastCompletion && completionGraceActive && (
        <div style={{ background: 'rgba(16,185,129,0.1)', borderLeft: '4px solid #10b981', padding: '1rem 1.25rem', marginBottom: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <FiAlertCircle color="#10b981" size={20} />
          <div>
            <strong style={{ color: '#10b981' }}>Grace Period Active</strong>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Your grace period for task submission expires: <strong>{completionGraceDeadline?.toLocaleString()}</strong>. Update & save your goals before then!
            </div>
          </div>
        </div>
      )}

      {/* Warning Banners */}
      {userData?.status === 'Warning' && (
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid var(--warning)', padding: '1rem', marginBottom: '2rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FiAlertCircle color="var(--warning)" size={24} />
          <span><strong>Warning:</strong> You scored less than 5 points last week. Please improve this week to avoid suspension and a ₦1,000 penalty.</span>
        </div>
      )}

      {isLockedOut && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', padding: '1rem', marginBottom: '2rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FiAlertCircle color="var(--danger)" size={24} />
          <div>
            <strong>Account Locked!</strong> Your wallet balance (₦{userData?.walletBalance}) is below the required ₦1,000 minimum.
            <br />You cannot set goals or check in until your wallet is funded. Contact the Admin.
          </div>
        </div>
      )}

      {/* ── On Break Banner ── */}
      {userData?.status === 'On Break' && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeft: '4px solid #10b981', padding: '1.25rem', marginBottom: '2rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem' }}>🏖️</div>
          <div>
            <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>Enjoy your 1-week break!</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              You are exempt from all accountability and penalties for this week. Your account will automatically return to **Active** status next Monday.
            </p>
          </div>
        </div>
      )}

      {/* ── On Hold Banner ── */}
      {userData?.status === 'On Hold' && (
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid var(--warning)', padding: '1.25rem', marginBottom: '2rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem' }}>⏸️</div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '1.1rem', color: 'var(--warning)' }}>Account on Emergency Hold</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Your account is currently inactive due to an emergency. No penalties will apply while on hold.
            </p>
          </div>
          <button onClick={handleRequestRelease} disabled={releasingHold} className="btn btn-primary" style={{ background: 'var(--warning)', border: 'none', color: 'black', fontWeight: 'bold' }}>
            {releasingHold ? 'Releasing...' : 'Request Release'}
          </button>
        </div>
      )}
      {/* Private Stats Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary)' }}>
            <FiDollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Wallet Balance <FiShield size={12} title="Private to you" />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>₦{userData?.walletBalance || 0}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(16, 185, 129, 0.1)', background: 'rgba(16, 185, 129, 0.04)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <FiShield size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>System Recovered Funds</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#10b981' }}>₦{systemWallet.toLocaleString()}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <FiStar size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Community Status</div>
            <div className="stars" style={{ gap: '2px', display: 'flex' }}>
              {[...Array(5)].map((_, i) => (
                <FiStar 
                  key={i} 
                  size={16} 
                  className={i < calculateStars(userData?.totalPoints || 0) ? 'star-filled' : 'star-empty'} 
                  fill={i < calculateStars(userData?.totalPoints || 0) ? 'var(--star-color)' : 'none'}
                />
              ))}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {calculateStars(userData?.totalPoints || 0)} Star Member
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
            <FiActivity size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Weekly Points</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>{weeklyPoints || 0} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>pts</span></div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(236, 72, 153, 0.1)', background: 'rgba(236, 72, 153, 0.04)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>
            <FiTrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Achievement Stars</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--star-color)' }}>★</span> {userData?.achievementStars || 0}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {userData?.consecutiveGoodWeeks || 0}/4 weeks to next
            </div>
          </div>
        </div>

        {/* Total Points Card */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(16, 185, 129, 0.1)', background: 'rgba(16, 185, 129, 0.04)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <FiAward size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Earned Points</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#10b981' }}>{userData?.totalPoints || 0} <span style={{ fontSize: '0.8rem', fontWeight: '400', color: 'var(--text-secondary)' }}>pts</span></div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Lifetime Earnings</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('goals')} className={`btn ${activeTab === 'goals' ? 'btn-primary' : 'btn-secondary'}`}>Weekly Goals</button>
        <button onClick={() => setActiveTab('vision')} className={`btn ${activeTab === 'vision' ? 'btn-primary' : 'btn-secondary'}`}>🎯 Monthly Vision</button>
        <button onClick={() => setActiveTab('streak')} className={`btn ${activeTab === 'streak' ? 'btn-primary' : 'btn-secondary'}`}><FiZap /> Daily Streak</button>
        <button onClick={() => setActiveTab('attendance')} className={`btn ${activeTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`}>Attendance Check-In</button>
        <button onClick={() => setActiveTab('profile')} className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}>Profile Settings</button>
        <button onClick={() => setActiveTab('partner')} className={`btn ${activeTab === 'partner' ? 'btn-primary' : 'btn-secondary'}`}>🤝 Partner</button>
        <Link to="/livefeed" className="btn btn-secondary" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none' }}>
          <FiActivity /> Live Feed
        </Link>
      </div>

      {/* ── Daily Streak Tab ── */}
      {activeTab === 'streak' && (() => {
        const daysArr = Array.from({ length: 7 }, (_, i) => i + 1);
        const streakDisplay = streakData.currentStreak === 0 && streakData.checkedInToday ? 7 : streakData.currentStreak;
        const progressPercent = (Math.min(streakDisplay, 7) / 7) * 100;
        const isComplete = streakData.checkedInToday && streakData.currentStreak === 0 && streakData.totalCycles > 0;

        return (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #eab308)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>⚡</div>
              <div>
                <h2 style={{ margin: 0 }}>Daily Check-In Streak</h2>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Check in every day for 7 days to earn +2 bonus points!</p>
              </div>
              {streakData.totalCycles > 0 && (
                <div style={{ marginLeft: 'auto', textAlign: 'center', padding: '0.5rem 1rem', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#eab308' }}>{streakData.totalCycles}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Cycles Done</div>
                </div>
              )}
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ textAlign: 'center', padding: '1.25rem', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '12px' }}>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#f97316' }}>{Math.min(streakDisplay, 7)}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Current Day</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1.25rem', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '12px' }}>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#eab308' }}>{7 - Math.min(streakDisplay, 7)}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Days Remaining</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1.25rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px' }}>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--primary)' }}>{streakData.totalCycles * 2}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Total Pts Earned</div>
              </div>
            </div>

            {/* 7-Day Dot Progress */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: '600' }}>
                <span>Streak Progress</span>
                <span style={{ color: progressPercent === 100 ? '#10b981' : '#f97316' }}>{Math.round(progressPercent)}% — {Math.min(streakDisplay, 7)}/7 days</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {daysArr.map(day => {
                  const filled = day <= Math.min(streakDisplay, 7);
                  const isToday = day === Math.min(streakDisplay, 7) && streakData.checkedInToday;
                  return (
                    <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                      <div style={{ 
                        width: '100%', height: '8px', borderRadius: '100px',
                        background: filled ? 'linear-gradient(90deg, #f97316, #eab308)' : 'rgba(255,255,255,0.08)',
                        transition: 'all 0.4s ease'
                      }} />
                      <div style={{ 
                        width: '28px', height: '28px', borderRadius: '50%', 
                        background: isToday ? 'linear-gradient(135deg, #f97316, #eab308)' : filled ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.05)',
                        border: `2px solid ${filled ? '#f97316' : 'rgba(255,255,255,0.1)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 'bold', color: filled ? 'white' : 'var(--text-secondary)',
                        transition: 'all 0.4s ease',
                        boxShadow: isToday ? '0 0 12px rgba(249,115,22,0.6)' : 'none'
                      }}>
                        {filled ? '✓' : day}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>D{day}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Check-In Button */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              {streakData.checkedInToday ? (
                <div style={{ padding: '1.5rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '16px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
                  <div style={{ fontWeight: '700', color: '#10b981', marginBottom: '0.25rem' }}>Checked in today!</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Come back tomorrow to keep your streak alive.</div>
                </div>
              ) : (
                <button
                  onClick={handleDailyCheckin}
                  className="btn btn-primary"
                  style={{ padding: '1rem 3rem', fontSize: '1.1rem', borderRadius: '14px', background: 'linear-gradient(135deg, #f97316, #eab308)', border: 'none', boxShadow: '0 8px 24px rgba(249,115,22,0.3)' }}
                >
                  <FiZap /> Check In Today
                </button>
              )}
            </div>

            {/* Feedback Message */}
            {streakMsg && (
              <div style={{ padding: '1rem', background: streakMsg.includes('🎉') ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${streakMsg.includes('🎉') ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: '10px', fontSize: '0.9rem', color: streakMsg.includes('🎉') ? 'var(--primary)' : '#10b981', textAlign: 'center', fontWeight: '500' }}>
                {streakMsg}
              </div>
            )}

            {/* Rules */}
            <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              <div style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.5rem' }}>📋 How it works</div>
              <div>• Check in <strong>once per day</strong> by clicking the button above.</div>
              <div>• Build a <strong>7-day consecutive streak</strong> without missing a day.</div>
              <div>• Missing a day <strong>resets your streak</strong> back to Day 1.</div>
              <div>• Complete 7 days in a row to earn <strong>+2 bonus points</strong> 🎁</div>
              <div>• After the reward, your streak <strong>resets automatically</strong> for another cycle.</div>
            </div>
          </div>
        );
      })()}

      {/* ── Monthly Vision Tab ── */}
      {activeTab === 'vision' && (() => {
        const now = new Date();
        const currentWeekIndex = getWeekOfMonth(now);
        const checkedCount = (monthlyVision.weekChecked || []).filter(Boolean).length;
        const progressPercent = (checkedCount / 4) * 100;
        const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
        const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth());

        // Build week date ranges for this month
        const weekRanges = [0, 1, 2, 3].map(i => {
          const start = i * 7 + 1;
          const end = Math.min(start + 6, daysInMonth);
          return `${start}–${end} ${now.toLocaleString('default', { month: 'short' })}`;
        });

        return (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '2rem' }}>🎯</span>
              <div>
                <h2 style={{ margin: 0 }}>Monthly Vision</h2>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Private to you only — {monthName} ({daysInMonth} days)
                </p>
              </div>
              <span style={{ marginLeft: 'auto', padding: '0.25rem 0.75rem', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(99,102,241,0.3)' }}>
                🔒 Private
              </span>
            </div>

            {/* Monthly Completion Banner */}
            {monthlyVision.completed && (
              <div style={{ margin: '1rem 0', padding: '1rem 1.5rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(99,102,241,0.2))', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>🏆</span>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#10b981' }}>Monthly Cycle Complete!</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>You've completed all 4 weeks of your monthly vision. A new cycle starts next month.</div>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div style={{ margin: '1.5rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                <span>Monthly Progress</span>
                <span style={{ color: checkedCount === 4 ? '#10b981' : 'var(--primary)' }}>{checkedCount}/4 Weeks Complete ({Math.round(progressPercent)}%)</span>
              </div>
              <div style={{ height: '12px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${progressPercent}%`, 
                  background: checkedCount === 4 ? 'linear-gradient(90deg, #10b981, #06b6d4)' : 'linear-gradient(90deg, var(--primary), var(--secondary))',
                  borderRadius: '100px',
                  transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ width: '22px', height: '22px', borderRadius: '50%', background: (monthlyVision.weekChecked||[])[i] ? '#10b981' : 'rgba(255,255,255,0.1)', border: `2px solid ${(monthlyVision.weekChecked||[])[i] ? '#10b981' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'white', fontWeight: 'bold', transition: 'all 0.3s' }}>
                    {(monthlyVision.weekChecked||[])[i] ? '✓' : i+1}
                  </div>
                ))}
              </div>
            </div>

            {/* Month Title */}
            <div className="input-group">
              <label style={{ fontWeight: '700' }}>Main goal for this month</label>
              <input type="text" className="input-field" placeholder="e.g. Launch my freelance portfolio & land first client" value={monthlyVision.title} onChange={(e) => setMonthlyVision(prev => ({ ...prev, title: e.target.value }))} />
            </div>

            {/* Overview */}
            <div className="input-group">
              <label style={{ fontWeight: '700' }}>Your Why</label>
              <textarea className="input-field" rows={2} placeholder="Why does this matter to you?" value={monthlyVision.overview} onChange={(e) => setMonthlyVision(prev => ({ ...prev, overview: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>

            {/* 4-Week Focus Cards */}
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '700' }}>Weekly Focus Tracker</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Each week is automatically checked ✓ when you complete 100% of your weekly goals and get admin approval.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((label, i) => {
                const isChecked = (monthlyVision.weekChecked || [])[i] || false;
                const isCurrent = i === currentWeekIndex;
                return (
                  <div key={i} style={{ 
                    background: isChecked ? 'rgba(16,185,129,0.08)' : isCurrent ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)', 
                    border: `1px solid ${isChecked ? 'rgba(16,185,129,0.4)' : isCurrent ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`, 
                    borderRadius: '12px', padding: '1.25rem',
                    transition: 'all 0.3s ease',
                    position: 'relative', overflow: 'hidden'
                  }}>
                    {/* Checked overlay shimmer */}
                    {isChecked && <div style={{ position: 'absolute', top: 0, right: 0, width: '40px', height: '40px', background: 'rgba(16,185,129,0.15)', borderBottomLeftRadius: '100%' }} />}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      {/* Auto-check indicator */}
                      <div style={{ 
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        background: isChecked ? '#10b981' : isCurrent ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 'bold', fontSize: '0.85rem',
                        transition: 'all 0.3s'
                      }}>
                        {isChecked ? '✓' : i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {label}
                          {isCurrent && !isChecked && <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'white', padding: '1px 6px', borderRadius: '10px' }}>Current</span>}
                          {isChecked && <span style={{ fontSize: '0.65rem', background: '#10b981', color: 'white', padding: '1px 6px', borderRadius: '10px' }}>Done ✓</span>}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{weekRanges[i]}</div>
                      </div>
                    </div>

                    <textarea
                      className="input-field"
                      rows={3}
                      placeholder={`Your focus topic for ${label.toLowerCase()}...`}
                      value={monthlyVision.weeks[i]}
                      onChange={(e) => updateWeek(i, e.target.value)}
                      disabled={isChecked}
                      style={{ resize: 'vertical', fontSize: '0.85rem', opacity: isChecked ? 0.6 : 1 }}
                    />
                    {isChecked && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        🏅 Goals 100% complete — week unlocked!
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Save & Feedback */}
            {visionMsg && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: visionMsg.includes('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${visionMsg.includes('Error') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: '8px', color: visionMsg.includes('Error') ? '#ef4444' : '#10b981', fontSize: '0.875rem' }}>
                {visionMsg}
              </div>
            )}
            <button className="btn btn-primary" onClick={handleSaveVision} disabled={savingVision} style={{ padding: '0.75rem 2rem' }}>
              <FiSave /> {savingVision ? 'Saving...' : 'Save Monthly Vision'}
            </button>
          </div>
        );
      })()}

      {activeTab === 'profile' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Profile Management</h2>
            {userData?.isAdmin ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.3rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }} title="Admin"><FiShield size={18} /></span>
            ) : userData?.isModerator ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.3rem', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }} title="Moderator"><FiCheckCircle size={18} /></span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.3rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--secondary)', border: '1px solid rgba(16, 185, 129, 0.3)' }} title="User"><FiUser size={18} /></span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginTop: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              {profilePic ? (
                <img src={profilePic} alt="Profile" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }} />
              ) : (
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'var(--text-secondary)' }}>
                  {name ? name.charAt(0).toUpperCase() : <FiUser />}
                </div>
              )}
              <label style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}>
                <FiCamera />
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploading} />
              </label>
            </div>
            <div>
              <h3>Profile Picture</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>This picture will be visible on the public live feed.</p>
              {uploading && <p style={{ color: 'var(--primary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Uploading...</p>}
            </div>
          </div>

          <form onSubmit={handleProfileUpdate}>
            {profileMsg && <div style={{ marginBottom: '1rem', color: 'var(--secondary)' }}>{profileMsg}</div>}

            <h3 style={{ marginBottom: '1rem', fontWeight: '700', fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Public Information</h3>
            <div className="input-group">
              <label>Display Name <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Visible on live feed)</span></label>
              <input type="text" className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Profession / Role <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Shown under your name on live feed)</span></label>
              <input type="text" className="input-field" value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="e.g. Software Developer, UI Designer" />
            </div>
            <div className="input-group">
              <label>Bio <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Short description, shown under your name)</span></label>
              <textarea className="input-field" rows="2" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell the community a little about yourself..." style={{ resize: 'vertical' }} />
            </div>

            <h3 style={{ margin: '1.5rem 0 1rem', fontWeight: '700', fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Social Media Handles <span style={{ fontSize: '0.75rem', fontWeight: '400', color: 'var(--text-secondary)' }}>(shown when someone views your profile)</span></h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {[{ key: 'twitter', label: '𝕏 Twitter / X', placeholder: '@handle' }, { key: 'instagram', label: '📸 Instagram', placeholder: '@handle' }, { key: 'linkedin', label: '💼 LinkedIn', placeholder: 'linkedin.com/in/yourname' }, { key: 'github', label: '🐙 GitHub', placeholder: 'github.com/username' }].map(s => (
                <div key={s.key} className="input-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>{s.label}</label>
                  <input type="text" className="input-field" value={socials[s.key] || ''} onChange={(e) => setSocials(prev => ({ ...prev, [s.key]: e.target.value }))} placeholder={s.placeholder} />
                </div>
              ))}
            </div>

            <h3 style={{ margin: '1.5rem 0 1rem', fontWeight: '700', fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Location Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.8rem' }}>State / Region</label>
                <input type="text" className="input-field" value={userState} onChange={(e) => setUserState(e.target.value)} placeholder="e.g. Lagos" />
              </div>
              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.8rem' }}>Country</label>
                <input type="text" className="input-field" value={userCountry} onChange={(e) => setUserCountry(e.target.value)} placeholder="e.g. Nigeria" />
              </div>
            </div>

            <button type="submit" className="btn btn-primary"><FiSave /> Save Profile</button>
          </form>

          {/* ── Break Request Section ── */}
          <div style={{ marginTop: '3rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '16px' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🏖️ 1-Week Break</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              You are eligible for one 1-week break every 2 months. During this break, you are exempt from setting goals and attending meetings. 
              The break follows the standard Monday-to-Sunday cycle and automatically ends after the weekly evaluation.
            </p>

            {userData?.breakRequest?.status === 'pending' ? (
              <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', color: 'var(--warning)', textAlign: 'center', fontWeight: '600' }}>
                ⏳ Break request pending admin approval...
              </div>
            ) : (
              <button 
                onClick={handleRequestBreak} 
                disabled={requestingBreak || userData?.status === 'On Break' || userData?.status === 'On Hold'} 
                className="btn btn-secondary"
                style={{ padding: '0.75rem 1.5rem', border: '1px solid var(--primary)', color: 'var(--primary)' }}
              >
                {requestingBreak ? 'Submitting...' : 'Request 1-Week Break'}
              </button>
            )}

            {userData?.lastBreakApprovedAt && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Last break approved: {new Date(userData.lastBreakApprovedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'goals' && (
        <div className="glass-panel printable" style={{ padding: '2rem', opacity: isLockedOut ? 0.5 : 1, pointerEvents: isLockedOut ? 'none' : 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h1 className="printable-title">TEC Weekly Goals Report</h1>
              <h2>Set & Report Weekly Goals</h2>
              <div className="print-only" style={{ marginTop: '0.5rem' }}>
                <strong>User:</strong> {userData?.name} | <strong>Week:</strong> {currentWeekId} | <strong>Points:</strong> {weeklyPoints}
              </div>
            </div>
            <button onClick={handleDownloadPDF} className="btn btn-secondary no-print" style={{ borderRadius: '12px' }}>
              <FiDownload /> Download Report (PDF)
            </button>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {goalsSubmitted
              ? 'Goals are set. Update your status & proof, then save. Admin will award points after review.'
              : 'Set your goals for the week (Minimum 3, Maximum 10). Once submitted, descriptions are locked.'}
          </p>

          {goalsSubmitted && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', padding: '0.6rem 1rem', background: 'rgba(99,102,241,0.1)', borderLeft: '3px solid var(--primary)', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              🔒 Goal descriptions are locked. You can only update <strong style={{ color: 'var(--text)', margin: '0 2px' }}>Status</strong> and <strong style={{ color: 'var(--text)', margin: '0 2px' }}>Proof</strong> until they are completed.
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '1rem' }}>Task Description</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                  <th style={{ padding: '1rem' }}>Evidence / Proof</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, idx) => {
                  const isLocked = task.reviewed === true || isPastCompletion || (isPastSetup && !goalsSubmitted);
                  return (
                    <tr key={task.id} style={{ borderBottom: '1px solid var(--border)', opacity: isLocked ? 0.6 : 1 }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ marginBottom: '0.4rem', fontSize: '0.75rem', fontWeight: 'bold', color: idx < 3 ? 'var(--primary)' : 'var(--text-secondary)' }}>
                          {idx < 3 ? 'Compulsory (±1 pt)' : 'Optional (0 pts)'}
                        </div>
                        {(goalsSubmitted && !task.isNew) ? (
                          <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', fontSize: '0.9rem', color: 'var(--text)', border: '1px solid var(--border)', minHeight: '48px' }}>
                            {task.description || '—'}
                          </div>
                        ) : (
                          <textarea className="input-field" rows="2" value={task.description} onChange={(e) => updateTask(idx, 'description', e.target.value)} placeholder="What will you accomplish?"></textarea>
                        )}
                      </td>
                      <td style={{ padding: '1rem', width: '200px' }}>
                        <select
                          className="input-field"
                          value={task.status}
                          onChange={(e) => updateTask(idx, 'status', e.target.value)}
                          disabled={isLocked}
                        >
                          <option value="">Pending</option>
                          <option value="Completed">Completed</option>
                          <option value="Partially">Partially</option>
                          <option value="Not Completed">Not Completed</option>
                        </select>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <input
                          type="text"
                          className="input-field"
                          style={{ marginBottom: '0.5rem', border: task.adminAction === 'rejected' ? '1px solid var(--warning)' : '' }}
                          value={task.proofText}
                          onChange={(e) => updateTask(idx, 'proofText', e.target.value)}
                          placeholder="Link to evidence (optional)"
                          disabled={isLocked}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <label
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', cursor: (task.uploadingProof || isLocked) ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1 }}
                          >
                            <FiCamera /> {task.uploadingProof ? `Uploading ${task.uploadProgress || 0}%` : 'Upload Image'}
                            {!isLocked && <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleProofImageUpload(idx, e)} disabled={task.uploadingProof} />}
                          </label>
                          {task.proofImage && <span style={{ color: 'var(--secondary)', fontSize: '0.8rem' }}>✓ Image attached</span>}
                          {task.proofText && (
                            <a 
                              href={task.proofText.startsWith('http') ? task.proofText : `https://${task.proofText}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              style={{ color: 'var(--primary)', fontSize: '0.8rem', textDecoration: 'underline' }}
                            >
                              View Link
                            </a>
                          )}
                        </div>
                        {task.adminAction === 'rejected' && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.4rem', borderRadius: '4px' }}>
                            <strong>Rejected:</strong> {task.rejectionReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {(tasks.length < 10 && !isPastSetup && !isPastCompletion) && (
              <button onClick={addTaskRow} className="btn btn-secondary">Add Another Goal</button>
            )}
            <button
              onClick={handleSaveGoals}
              className="btn btn-primary"
              disabled={submittingGoals || isPastCompletion || (isPastSetup && !goalsSubmitted)}
              style={{ marginLeft: (goalsSubmitted || isPastSetup) ? 'auto' : '0' }}
            >
              {submittingGoals ? 'Saving...' : goalsSubmitted ? 'Update Progress' : 'Submit Weekly Goals'}
            </button>
          </div>

        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="glass-panel" style={{ padding: '2rem', opacity: isLockedOut ? 0.5 : 1, pointerEvents: isLockedOut ? 'none' : 'auto' }}>
          <h2>Meeting Attendance Check-In</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Enter the secret code provided during the Wednesday or Sunday meeting to claim your +1 attendance point.
          </p>

          <form onSubmit={handleCheckIn} style={{ maxWidth: '400px' }}>
            {attendanceMsg && (
              <div style={{ marginBottom: '1rem', color: attendanceMsg.includes('Invalid') || attendanceMsg.includes('already') ? 'var(--danger)' : 'var(--secondary)' }}>
                {attendanceMsg}
              </div>
            )}
            <div className="input-group">
              <label>Secret Code</label>
              <input
                type="text"
                className="input-field"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
                placeholder="e.g. WED-7891"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">Check In</button>
          </form>
        </div>
      )}

      {activeTab === 'partner' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '2rem' }}>🤝</span>
            <div>
              <h2 style={{ margin: 0 }}>Weekly Accountability Partner</h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Track your partner's goals, view their proof of work, and support each other to succeed this week.
              </p>
            </div>
          </div>

          {partners.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border)', borderRadius: '16px', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
              <strong style={{ display: 'block', fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Partner Assigned Yet</strong>
              <p style={{ margin: 0, fontSize: '0.875rem', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
                Accountability partners are paired weekly by the Admin. Check back shortly or contact the circles Coordinator if you believe this is an error.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {partners.map(partner => {
                const partnerGoals = partner.goals || {};
                const partnerTasks = partnerGoals.tasks || [];
                const totalTasks = partnerTasks.length;
                const completedTasks = partnerTasks.filter(t => t.status === 'Completed').length;
                const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

                return (
                  <div key={partner.id} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
                    {/* Partner Profile Header */}
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {partner.profilePicUrl ? (
                        <img src={partner.profilePicUrl} alt={partner.name} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }} />
                      ) : (
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                          {(partner.name || 'P').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>{partner.name || 'Anonymous Partner'}</h3>
                          <span style={{ padding: '0.15rem 0.6rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700', background: partner.status === 'Active' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: partner.status === 'Active' ? '#10b981' : 'var(--warning)' }}>
                            {partner.status || 'Active'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500', marginTop: '2px' }}>{partner.profession || 'Execution Circle Member'}</div>
                        {partner.bio && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0 0 0', fontStyle: 'italic', lineHeight: '1.4' }}>"{partner.bio}"</p>}
                      </div>

                      {/* Contact Socials */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {partner.email && (
                          <a href={`mailto:${partner.email}`} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }} title="Send Email">
                            📧 Email
                          </a>
                        )}
                        {partner.socials?.twitter && (
                          <a href={partner.socials.twitter.startsWith('http') ? partner.socials.twitter : `https://x.com/${partner.socials.twitter.replace('@', '')}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>
                            𝕏 Twitter
                          </a>
                        )}
                        {partner.socials?.linkedin && (
                          <a href={partner.socials.linkedin.startsWith('http') ? partner.socials.linkedin : `https://${partner.socials.linkedin}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>
                            💼 LinkedIn
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Progress Tracker */}
                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '600' }}>
                        <span>Partner's Goals Progress</span>
                        <span style={{ color: progress === 100 ? '#10b981' : 'var(--primary)' }}>
                          {completedTasks}/{totalTasks} Goals Completed ({progress}%)
                        </span>
                      </div>
                      <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${progress}%`, 
                          background: progress === 100 ? 'linear-gradient(90deg, #10b981, #06b6d4)' : 'linear-gradient(90deg, var(--primary), var(--secondary))',
                          borderRadius: '100px',
                          transition: 'width 0.5s ease-in-out'
                        }} />
                      </div>
                    </div>

                    {/* Goals Table */}
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.75rem' }}>Weekly Goals</h4>
                      {partnerTasks.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>No goals set for this week yet.</p>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Task Description</th>
                                <th style={{ padding: '0.5rem 0.75rem', width: '150px' }}>Status</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Proof / Evidence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {partnerTasks.map((task, idx) => (
                                <tr key={task.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '0.75rem' }}>
                                    <div style={{ fontSize: '0.7rem', color: idx < 3 ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '2px' }}>
                                      {idx < 3 ? 'Compulsory' : 'Optional'}
                                    </div>
                                    <span style={{ fontWeight: '500' }}>{task.description || '—'}</span>
                                  </td>
                                  <td style={{ padding: '0.75rem' }}>
                                    <span style={{
                                      padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                                      background: task.status === 'Completed' ? 'rgba(16,185,129,0.15)' : task.status === 'Not Completed' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                      color: task.status === 'Completed' ? '#10b981' : task.status === 'Not Completed' ? 'var(--danger)' : 'var(--warning)'
                                    }}>
                                      {task.status || 'Pending'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.75rem' }}>
                                    {task.proofImage ? (
                                      <a href={task.proofImage} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline' }}>
                                        📷 View Image Proof
                                      </a>
                                    ) : task.proofText ? (
                                      <a href={task.proofText.startsWith('http') ? task.proofText : `https://${task.proofText}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline' }}>
                                        🔗 View Link
                                      </a>
                                    ) : (
                                      <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No proof provided</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
