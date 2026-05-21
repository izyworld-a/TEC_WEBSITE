import React from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function PendingPage({ userData }) {
  return (
    <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', maxWidth: '500px', margin: '2rem auto' }}>
      <h2>Action Required</h2>
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
