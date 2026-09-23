import React, { useEffect, useRef, useState } from 'react';
import './heroProductDemo.css';

const TYPE_TEXT = 'Ship portfolio update';

/**
 * Animated hero product demo (make.com style).
 * A ghost cursor walks through the TEC weekly ritual inside a browser window:
 * add a goal, type it, submit, attach proof, get verified, earn points. Loops forever.
 */
export default function HeroProductDemo() {
  const stageRef = useRef(null);
  const addBtnRef = useRef(null);
  const inputRef = useRef(null);
  const submitBtnRef = useRef(null);
  const proofBtnRef = useRef(null);

  const [pos, setPos] = useState({ x: 86, y: 86 });
  const [clicked, setClicked] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [typed, setTyped] = useState('');
  const [newGoal, setNewGoal] = useState(false);
  const [proofChip, setProofChip] = useState(false);
  const [verified, setVerified] = useState(false);
  const [toast, setToast] = useState(false);

  const moveCursorTo = (el, fallback) => {
    if (el && stageRef.current) {
      const s = stageRef.current.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setPos({
        x: ((r.left + r.width / 2 - s.left) / s.width) * 100,
        y: ((r.top + r.height / 2 - s.top) / s.height) * 100,
      });
    } else if (fallback) {
      setPos(fallback);
    }
  };

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Static final scene, no animation loop
      setTyped(TYPE_TEXT);
      setNewGoal(true);
      setProofChip(true);
      setVerified(true);
      setToast(true);
      return;
    }

    let timers = [];
    let typing = null;

    const run = () => {
      const T = (ms, fn) => timers.push(setTimeout(fn, ms));

      // Scene reset
      setClicked(false);
      setShowPopover(false);
      setTyped('');
      setNewGoal(false);
      setProofChip(false);
      setVerified(false);
      setToast(false);
      setPos({ x: 86, y: 86 });

      // 1. Cursor glides to "+ Add goal" and clicks it
      T(900, () => moveCursorTo(addBtnRef.current));
      T(1900, () => setClicked(true));
      T(2100, () => {
        setClicked(false);
        setShowPopover(true);
      });

      // 2. Cursor moves into the input, then types the goal
      T(2250, () => moveCursorTo(inputRef.current));
      T(2600, () => {
        let i = 0;
        typing = setInterval(() => {
          i += 1;
          setTyped(TYPE_TEXT.slice(0, i));
          if (i >= TYPE_TEXT.length) clearInterval(typing);
        }, 75);
      });

      // 3. Cursor clicks Submit; the goal appears on the board
      T(5000, () => moveCursorTo(submitBtnRef.current));
      T(5900, () => setClicked(true));
      T(6100, () => {
        setClicked(false);
        setShowPopover(false);
        setNewGoal(true);
      });

      // 4. Cursor clicks "+ Proof" on the new goal row
      T(7100, () => moveCursorTo(proofBtnRef.current));
      T(8100, () => setClicked(true));
      T(8300, () => {
        setClicked(false);
        setProofChip(true);
      });

      // 5. Verification lands: status flips, points float up, toast slides in
      T(9700, () => {
        setVerified(true);
        moveCursorTo(null, { x: 58, y: 38 });
      });
      T(10000, () => setToast(true));

      // 6. Hold the finished scene, then fade it back out
      T(12900, () => setToast(false));
      T(13200, () => {
        setNewGoal(false);
        setProofChip(false);
        setVerified(false);
        setTyped('');
      });

      // Restart the loop
      timers.push(setTimeout(run, 14000));
    };

    run();

    return () => {
      timers.forEach(clearTimeout);
      if (typing) clearInterval(typing);
    };
  }, []);

  const newGoalStatus = verified ? 'verified' : proofChip ? 'review' : 'progress';
  const newGoalLabel = verified ? 'Verified' : proofChip ? 'In review' : 'In progress';

  return (
    <div className="tpd-stage" ref={stageRef} aria-hidden="true">
      <div className="tpd-glow" />

      <div className="tpd-window">
        <div className="tpd-titlebar">
          <span className="tpd-dots"><i /><i /><i /></span>
          <span className="tpd-title">TEC Weekly · Execution Board</span>
          <span className="tpd-weekchip">Week 38</span>
        </div>

        <div className="tpd-header">
          <div>
            <span className="tpd-eyebrow">Current week</span>
            <strong>Execution Board</strong>
          </div>
          <span className="tpd-live"><i />Live</span>
        </div>

        <div className="tpd-wallet">
          <span>Wallet balance</span>
          <strong>NGN 12,000</strong>
          <small>Active member</small>
          <span className={verified ? 'tpd-points-float go' : 'tpd-points-float'}>+30 pts</span>
        </div>

        <div className="tpd-goals">
          <div className="tpd-goal">
            <span className="tpd-goal-idx">1</span>
            <p>Complete React module</p>
            <span className="tpd-status done">Done</span>
          </div>
          <div className="tpd-goal">
            <span className="tpd-goal-idx">2</span>
            <p>Publish proof thread</p>
            <span className="tpd-status review">In review</span>
          </div>
          <div className={newGoal ? 'tpd-goal tpd-goal-new show' : 'tpd-goal tpd-goal-new'}>
            <span className="tpd-goal-idx">3</span>
            <p>{typed || 'New goal'}</p>
            <button ref={proofBtnRef} className={proofChip ? 'tpd-proof-btn done' : 'tpd-proof-btn'}>
              {proofChip ? 'Proof ✓' : '+ Proof'}
            </button>
            <span className={`tpd-status ${newGoalStatus}`}>{newGoalLabel}</span>
          </div>
        </div>

        <div className="tpd-footer">
          <button ref={addBtnRef} className="tpd-add-btn">+ Add goal</button>
          <span className="tpd-footer-note">3 goals minimum · proof required</span>
        </div>

        <div className={showPopover ? 'tpd-popover open' : 'tpd-popover'}>
          <div className="tpd-input" ref={inputRef}>
            <span>{typed}</span>
            <span className="tpd-caret" />
          </div>
          <button ref={submitBtnRef} className={typed.length >= 3 ? 'tpd-submit' : 'tpd-submit dim'}>
            Submit
          </button>
        </div>

        <div className={toast ? 'tpd-toast show' : 'tpd-toast'}>
          <span className="tpd-toast-check">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </span>
          <div>
            <strong>Proof verified</strong>
            <small>+30 points awarded</small>
          </div>
        </div>
      </div>

      <div
        className={clicked ? 'tpd-cursor click' : 'tpd-cursor'}
        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      >
        <span className="tpd-ripple" />
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path
            d="M4 2 L4 19 L8.4 15.2 L11.2 21 L13.8 19.7 L11 14.1 L16.4 14.1 Z"
            fill="#ffffff"
            stroke="#1e1b4b"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
