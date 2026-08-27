import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LiveFeedPage from './pages/LiveFeedPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import ModeratorDashboard from './pages/ModeratorDashboard';
import PendingPage from './pages/PendingPage';
import ForgotPassword from './pages/ForgotPassword';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getWeekId } from './utils/weekUtils';
import { useNotifications } from './utils/useNotifications';

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Global notifications — deadlines, announcements, moderator assignment
  useNotifications(user, userData);

  useEffect(() => {
    let unsubscribeUserData = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeUserData) {
        unsubscribeUserData();
        unsubscribeUserData = null;
      }

      if (currentUser) {
        // Use onSnapshot for real-time updates to status, wallet, etc.
        unsubscribeUserData = onSnapshot(doc(db, "users", currentUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() };
            
            // Check for automatic break release
            if (data.status === 'On Break' && data.lastBreakApprovedAt) {
              const breakWeek = getWeekId(new Date(data.lastBreakApprovedAt));
              const currentWeek = getWeekId(new Date());
              if (currentWeek > breakWeek) {
                // Break is over, transition to Active
                try {
                  await updateDoc(doc(db, "users", currentUser.uid), { status: 'Active' });
                  data.status = 'Active';
                } catch (e) {
                  console.error("Failed to update break status", e);
                }
              }
            }
            
            setUserData(data);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user data:", error);
          setLoading(false);
        });
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserData) unsubscribeUserData();
    };
  }, []);

  if (loading) {
    return <div className="loader-container"><div className="loader"></div></div>;
  }

  // Protected Route Wrapper
  const ProtectedRoute = ({ children, requireAdmin, requireModerator }) => {
    if (!user) return <Navigate to="/login" />;
    
    if (requireAdmin && !userData?.isAdmin) {
      return <Navigate to="/dashboard" />;
    }

    if (requireModerator && !userData?.isAdmin && !userData?.isModerator) {
      return <Navigate to="/dashboard" />;
    }

    if (!requireAdmin && !requireModerator && userData?.status === 'Pending') {
      return <Navigate to="/pending" />;
    }

    return children;
  };

  return (
    <Router>
      <AppContent user={user} userData={userData} ProtectedRoute={ProtectedRoute} />
    </Router>
  );
}

function AppContent({ user, userData, ProtectedRoute }) {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <div className="app-container">
      <Navbar user={user} userData={userData} />
      <main className={isHome ? "main-content-home" : "main-content"}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/livefeed" element={<LiveFeedPage user={user} userData={userData} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/pending" element={user && userData?.status === 'Pending' ? <PendingPage userData={userData} /> : <Navigate to="/" />} />

          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard user={user} userData={userData} />
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute requireAdmin={true}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/moderator" element={
            <ProtectedRoute requireModerator={true}>
              <ModeratorDashboard user={user} userData={userData} />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
      {!isHome && (
        <footer style={{ 
          textAlign: 'center', 
          padding: '2rem', 
          opacity: 0.5, 
          fontSize: '0.85rem', 
          borderTop: '1px solid rgba(255,255,255,0.05)',
          marginTop: 'auto'
        }}>
          © 2025 Izyworld Global Limited. All rights Reserved
        </footer>
      )}
    </div>
  );
}

export default App;
