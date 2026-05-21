import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import SignatureCanvasComponent from 'react-signature-canvas';
const SignatureCanvas = SignatureCanvasComponent.default || SignatureCanvasComponent;

const termsText = `THE EXECUTION CIRCLE
Membership Agreement & Terms and Conditions

This Membership Agreement (“Agreement”) is entered into by and between The Execution Circle (“the Group”) and the undersigned member (“the Member”).
By signing this Agreement, the Member confirms that they have read, understood, and agreed to abide by all terms outlined below.

1. PURPOSE OF THE GROUP
The Execution Circle is a structured accountability system designed to ensure consistent execution, measurable progress, and disciplined personal development. This is not a casual group, social forum, or motivational space. It is a performance-driven system built on commitment, accountability, and results.

2. MEMBER COMMITMENT
By joining, the Member agrees to:
• Declare clear, specific, and measurable weekly goals
• Actively work towards completing declared goals
• Maintain honesty in all reporting
• Show up consistently for required meetings
• Uphold the standards and integrity of the group

The Member acknowledges that:
“Their word to the group is binding.”

3. CORE PRINCIPLES
All members must operate under the following principles:
a. Commitment
Only realistic and intentional goals should be declared.
b. Accountability
Failure to report or avoidance will be treated as failure.
c. Progress Over Perfection
Partial progress is accepted only with honest reporting. Dishonesty is not tolerated.

4. MEETING REQUIREMENTS
The Member agrees to participate in the weekly structure:
a. Monday – Declaration Meeting (Mandatory)
• Present weekly goals
• Define measurable outcomes
b. Wednesday – Check-In (Optional but Encouraged)
• Provide status update: On Track / Behind / Done
c. Friday – Report Meeting (Mandatory)
• Report outcomes honestly
• Answer required accountability questions
Failure to attend mandatory meetings without valid reason will be treated as non-compliance.

5. GOAL STANDARDS
All goals must be:
• Specific
• Measurable
• Achievable
• Verifiable (proof required)
The group reserves the right to challenge unclear or unrealistic goals.

6. ACCOUNTABILITY & PENALTY SYSTEM
a. Financial Commitment
Each Member agrees to deposit ₦1,000 weekly alongside their declared goals.
b. Penalty Structure
• Tier 1: Partial completion with honesty → No penalty
• Tier 2: Full failure (valid reason) → Goal carried over and doubled next week
• Tier 3: Full failure (no valid reason) → ₦1,000 deducted
• Tier 4: Two consecutive failures → Membership review; possible suspension or removal
c. Group Fund
All penalties contribute to a shared fund used quarterly for group benefit.

7. MEMBER RESPONSIBILITIES
Each Member agrees to:
• Maintain active participation in the group
• Avoid ghosting (non-response equals failure)
• Avoid overpromising
• Accept direct and constructive feedback
• Contribute to a disciplined and respectful environment

8. ROLES & STRUCTURE
Members may be assigned rotating roles:
• Coordinator – Organizes meetings
• Tracker – Records progress and outcomes
• Enforcer – Applies rules and penalties fairly
The Member agrees to perform assigned roles responsibly.

9. MEMBERSHIP ELIGIBILITY
By signing, the Member confirms:
• They have (or are willing to develop) a tech-related skill
• They are actively working toward personal or professional growth
• They are willing to be held accountable

10. TRIAL & ENTRY PROCESS
New Members must:
• Participate in a trial week
• Observe group structure before full commitment
• Make an informed decision to join

11. EXIT & TERMINATION
Please note that a member may be removed if they repeatedly miss meetings, fail to meet commitments without accountability, act dishonestly, negatively affect group performance or culture and Termination will be handled respectfully and without conflict.

12. CONFIDENTIALITY
All discussions, goals, and personal progress shared within the group are considered confidential. Members agree not to disclose internal information without consent.

13. ACKNOWLEDGEMENT
By signing below, you acknowledge that: You fully understand the expectations of the Execution Circle and accept the accountability structure and consequences and also committed to consistent execution and growth.

Final Statement: “We don’t plan. We execute.”`;

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const navigate = useNavigate();
  const sigCanvas = useRef(null);

  const clearSignature = () => {
    sigCanvas.current.clear();
    setSignatureData(null);
  };

  const handleAcceptModal = () => {
    setModalError('');
    const effectiveName = signatureName || name;
    if (!effectiveName.trim()) {
      setModalError('Please enter your full name.');
      return;
    }
    if (!acceptedTerms) {
      setModalError('Please check the box to agree to the terms.');
      return;
    }
    if (sigCanvas.current.isEmpty()) {
      setModalError('Please provide your digital signature.');
      return;
    }
    setSignatureName(effectiveName);
    
    // Try to get trimmed canvas, fallback to standard if it fails in production
    let data;
    try {
      data = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    } catch (e) {
      console.warn("getTrimmedCanvas failed, using fallback", e);
      data = sigCanvas.current.toDataURL('image/png');
    }
    
    setSignatureData(data);
    setShowModal(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Password Validation
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{6,}$/;
    if (!passwordRegex.test(password)) {
      setError('Password must be at least 6 characters long and include a mixture of letters, numbers, and special characters.');
      return;
    }

    if (!acceptedTerms || !signatureData) {
      setError('Please click the button above to read, sign, and accept the Terms & Conditions before signing up.');
      setShowModal(true);
      return;
    }
    setError('');
    setLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Send verification email
      await sendEmailVerification(user);
      
      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        totalPoints: 0,
        totalCompletedTasks: 0,
        isAdmin: false,
        status: 'Pending', // Requires Admin Approval
        walletBalance: 0, // Must be funded manually by Admin
        hasSignedTerms: true,
        signatureUrl: signatureData,
        createdAt: new Date().toISOString()
      });
      
      navigate('/pending');
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message || 'An unexpected error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel auth-card" style={{ position: 'relative' }}>
      <h2>Create Account</h2>
      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>{error}</div>}
      
      <form onSubmit={handleRegister}>
        <div className="input-group">
          <label>Full Name</label>
          <input 
            type="text" 
            className="input-field" 
            required 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
          />
        </div>
        
        <div className="input-group">
          <label>Email Address</label>
          <input 
            type="email" 
            className="input-field" 
            required 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
          />
        </div>
        
        <div className="input-group">
          <label>Password</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showPassword ? "text" : "password"}
              className="input-field" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength="6"
              style={{ width: '100%', paddingRight: '2.5rem' }}
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: '1.4' }}>
            Must be at least 6 characters and include letters, numbers, and special characters.
          </p>
        </div>
        
        <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <button 
            type="button" 
            onClick={() => setShowModal(true)} 
            className={`btn ${acceptedTerms ? '' : 'btn-secondary'}`} 
            style={{ 
              width: '100%', 
              borderWidth: '2px',
              borderStyle: acceptedTerms ? 'solid' : 'dashed', 
              borderColor: acceptedTerms ? 'var(--secondary)' : 'var(--primary)', 
              backgroundColor: acceptedTerms ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              color: acceptedTerms ? 'var(--secondary)' : undefined
            }}
          >
            {acceptedTerms && signatureData ? '✓ Terms Accepted & Signed' : 'Click to Read & Sign Agreement'}
          </button>
        </div>
        
        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '0.75rem' }}
          disabled={loading}
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>
      
      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
        <Link to="/login" style={{ color: 'var(--text-secondary)' }}>
          Already have an account? <span style={{ color: 'var(--primary)', fontWeight: '500' }}>Login</span>
        </Link>
      </div>

      {/* Terms & Conditions Modal */}
      {showModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.8)', zIndex: 1000, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' 
        }}>
          <div className="glass-panel" style={{ 
            width: '100%', maxWidth: '600px', maxHeight: '90vh', 
            background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', 
            borderRadius: '16px', overflow: 'hidden', position: 'relative' 
          }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Membership Agreement</h3>
              <button type="button" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-main)', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              <div style={{ 
                background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px', 
                border: '1px solid var(--border)', fontSize: '0.8rem', lineHeight: '1.6', 
                whiteSpace: 'pre-wrap', marginBottom: '1.5rem', color: 'var(--text-main)'
              }}>
                {termsText}
              </div>

              {/* Full Name Field */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Type your full name exactly as it appears on your account.</p>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. John Adebayo Doe"
                  value={signatureName || name}
                  onChange={(e) => setSignatureName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Digital Signature <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Please use your mouse or finger to sign.</p>
                <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <SignatureCanvas 
                    ref={(ref) => { sigCanvas.current = ref; }} 
                    penColor="black"
                    canvasProps={{ width: 500, height: 150, style: { width: '100%', height: '150px', cursor: 'crosshair' } }} 
                  />
                </div>
                <button type="button" onClick={clearSignature} style={{ marginTop: '0.5rem', fontSize: '0.8rem', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}>
                  Clear Signature
                </button>
              </div>

              <div className="input-group" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="modal-terms" 
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  style={{ marginTop: '0.25rem', cursor: 'pointer' }}
                />
                <label htmlFor="modal-terms" style={{ cursor: 'pointer', lineHeight: '1.4', fontSize: '0.875rem' }}>
                  I have read, understood, and signed the Execution Circle Membership Agreement.
                </label>
              </div>
            </div>

            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
              {modalError && (
                <div style={{ 
                  marginBottom: '1rem', padding: '0.75rem 1rem', 
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', 
                  borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem',
                  display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.1rem' }}>⚠️</span> {modalError}
                </div>
              )}
              <button type="button" onClick={handleAcceptModal} className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
                Confirm & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
