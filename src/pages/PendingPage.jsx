import React from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function PendingPage({ userData }) {
  return (
    <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', maxWidth: '500px', margin: '2rem auto' }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
        Membership Checkpoint
      </div>
      <h2>Pending Circle Approval</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: '1.55' }}>
        Your profile is created. The final step is admin approval after the agreement and wallet requirement are confirmed.
      </p>
      <div style={{ marginTop: '1.5rem', textAlign: 'left', background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '8px' }}>
        <p>Your account is currently <strong>Pending</strong>.</p>
        <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem', listStyle: 'disc' }}>
          <li>Status: {userData?.status}</li>
          <li>Wallet Balance: ₦{userData?.walletBalance || 0}</li>
          <li>Terms Signed: {userData?.hasSignedTerms ? 'Yes' : 'No'}</li>
        </ul>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--warning)' }}>
          To activate your account, you must sign the terms and have a minimum of ₦1000 in your wallet. An admin will then approve your account.
        </p>
      </div>
      <button 
        className="btn btn-secondary" 
        style={{ marginTop: '2rem' }}
        onClick={() => signOut(auth)}
      >
        Logout
      </button>
    </div>
  );
}
