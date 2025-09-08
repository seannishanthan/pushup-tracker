import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { applyActionCode } from 'firebase/auth'
import { auth } from './lib/firebase'
import { useFirebaseAuth } from './hooks/useFirebaseAuth'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Session from './pages/Session.jsx'

// Component to handle email verification from URL parameters
function EmailVerificationHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleEmailVerification = async () => {
      const mode = searchParams.get('mode');
      const oobCode = searchParams.get('oobCode');

      if (mode === 'verifyEmail' && oobCode) {
        console.log('📧 Processing email verification from URL parameters');
        console.log('Current user:', auth?.currentUser?.email);
        console.log('User authenticated:', !!auth?.currentUser);

        // Clear the verification parameters from URL immediately to prevent conflicts
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('mode');
        newParams.delete('oobCode');
        newParams.delete('apiKey');
        newParams.delete('lang');
        setSearchParams(newParams, { replace: true });

        try {
          // Apply the email verification code
          await applyActionCode(auth, oobCode);
          console.log('✅ Email verification applied successfully');

          // Force refresh the current user AND get a new token
          if (auth?.currentUser) {
            await auth.currentUser.reload();
            console.log('🔄 User auth state refreshed');

            // Force get a new ID token (this is crucial!)
            const newToken = await auth.currentUser.getIdToken(true);
            console.log('🔑 New ID token generated after verification');

            // Small delay to ensure token propagation
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // The RequireAuth component will handle redirecting to dashboard
          // once the auth state is updated

        } catch (error) {
          console.error('❌ Error applying verification code:', error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);

          let errorMessage = 'Failed to verify email. ';
          if (error.code === 'auth/invalid-action-code') {
            errorMessage = 'This verification link is invalid or has already been used. Please request a new verification email.';
          } else if (error.code === 'auth/expired-action-code') {
            errorMessage = 'This verification link has expired. Please request a new verification email.';
          } else {
            errorMessage = 'Unable to verify email with this link. Please request a new verification email.';
          }

          // Redirect to verify page with error handling
          navigate(`/verify?error=${encodeURIComponent(errorMessage)}`);
        }
      }
    };

    handleEmailVerification();
  }, [searchParams, setSearchParams, navigate]);

  return null; // This component doesn't render anything
}

// Component to protect routes that require authentication
function RequireAuth({ children }) {
  const { initializing, user, isVerified } = useFirebaseAuth();
  const [verificationCheckDelay, setVerificationCheckDelay] = useState(false);

  // Add a brief delay after user loads to allow verification state to update
  useEffect(() => {
    if (user && !isVerified && !verificationCheckDelay) {
      setVerificationCheckDelay(true);
      const timer = setTimeout(() => {
        setVerificationCheckDelay(false);
      }, 2000); // 2 second delay to allow auth state to update

      return () => clearTimeout(timer);
    }
  }, [user, isVerified, verificationCheckDelay]);

  if (initializing || verificationCheckDelay) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isVerified) {
    return <Navigate to={`/verify?email=${encodeURIComponent(user.email)}`} replace />;
  }

  return children;
}

// Component to protect routes that should only be accessible by anonymous users
function AnonOnly({ children }) {
  const { initializing, user, isVerified } = useFirebaseAuth();

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && isVerified) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppContent() {
  return (
    <>
      <EmailVerificationHandler />
      <Routes>
        <Route path="/login" element={<AnonOnly><Login /></AnonOnly>} />
        <Route path="/register" element={<AnonOnly><Register /></AnonOnly>} />
        <Route path="/verify" element={<VerifyEmail />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/session"
          element={
            <RequireAuth>
              <Session />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App