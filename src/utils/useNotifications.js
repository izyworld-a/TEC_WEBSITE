import { useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { getWeekId } from './weekUtils';

const NOTIF_KEY = 'tec_shown_notifs'; // localStorage key for dedup

function getShownSet() {
  try { return new Set(JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]')); }
  catch { return new Set(); }
}
function markShown(id) {
  const s = getShownSet();
  s.add(id);
  localStorage.setItem(NOTIF_KEY, JSON.stringify([...s]));
}

function sendNotif(title, body, tag) {
  if (Notification.permission !== 'granted') return;
  if (getShownSet().has(tag)) return;
  try {
    new Notification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag,
      requireInteraction: false,
    });
    markShown(tag);
  } catch (e) {
    console.warn('Notification failed:', e);
  }
}

export function useNotifications(user, userData) {
  const prevModeratorRef = useRef(null);
  const deadlineNotifSentRef = useRef({ setup: false, completion: false });

  // ── Step 1: Request permission once user is logged in ────────────────
  useEffect(() => {
    if (!user) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [user]);

  // ── Step 2: Announcements ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      snap.docs.forEach(d => {
        const data = d.data();
        if (!data.active) return;
        const tag = `announcement-${d.id}`;
        const title = `📢 ${data.type || 'Announcement'}`;
        const body = data.message || 'You have a new announcement.';
        sendNotif(title, body, tag);
      });
    });
    return () => unsub();
  }, [user]);

  // ── Step 3: Moderator assignment ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const isMod = data.isModerator === true;
      // Only fire if it just flipped to true
      if (prevModeratorRef.current === false && isMod) {
        sendNotif(
          "🎉 You've been assigned as Moderator!",
          'You now have moderator access on TEC Weekly.',
          `moderator-assigned-${user.uid}`
        );
      }
      prevModeratorRef.current = isMod;
    });
    return () => unsub();
  }, [user]);

  // ── Step 4: Deadline countdown notifications ──────────────────────────
  useEffect(() => {
    if (!user) return;
    const weekId = getWeekId(new Date());
    const unsub = onSnapshot(doc(db, 'week_settings', weekId), (snap) => {
      if (!snap.exists()) return;
      const settings = snap.data();

      const checkDeadline = (deadlineStr, type) => {
        if (!deadlineStr) return;
        const deadline = new Date(String(deadlineStr).replace(' ', 'T'));
        const now = new Date();
        const diff = deadline - now;
        if (diff <= 0) return;

        const hours = diff / (1000 * 60 * 60);
        const tag = `deadline-${type}-${weekId}-1h`;

        // Notify when under 1 hour remaining
        if (hours <= 1 && !deadlineNotifSentRef.current[type]) {
          const mins = Math.floor(diff / 60000);
          sendNotif(
            `⏰ ${type === 'setup' ? 'Goal Setting' : 'Task Completion'} deadline in ${mins} min!`,
            `Hurry! Your ${type === 'setup' ? 'goal setting' : 'task completion'} deadline is almost up.`,
            tag
          );
          deadlineNotifSentRef.current[type] = true;
        }

        // Notify when under 24 hours
        const tag24 = `deadline-${type}-${weekId}-24h`;
        if (hours <= 24 && hours > 1) {
          const hrs = Math.floor(hours);
          sendNotif(
            `📅 ${type === 'setup' ? 'Goal Setting' : 'Task Completion'} closes in ${hrs}h`,
            `Don't forget — ${type === 'setup' ? 'set your goals' : 'complete your tasks'} before the deadline.`,
            tag24
          );
        }
      };

      checkDeadline(settings.setupDeadline, 'setup');
      checkDeadline(settings.completionDeadline, 'completion');
    });
    return () => unsub();
  }, [user]);
}
