import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { applyActionCode } from 'firebase/auth'
import { auth } from './lib/firebase'
import { useFirebaseAuth } from './hooks/useFirebaseAuth'
import { clearTokenCache } from './utils/api'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Session from './pages/Session.jsx'

// Component to handle email verification from URL parameters
function EmailVerificationHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const processedRef = useRef(false);

  useEffect(() => {
    const handleEmailVerification = async () => {
      const mode = searchParams.get('mode');
      const oobCode = searchParams.get('oobCode');

      // Prevent duplicate processing
      if (processedRef.current || !mode || !oobCode) {
        return;
      }

      if (mode === 'verifyEmail') {
        processedRef.current = true;
        console.log('📧 Processing email verification from URL parameters');

        try {
          // Apply the email verification code
          await applyActionCode(auth, oobCode);
          console.log('✅ Email verification applied successfully');

          // Clear URL parameters
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('mode');
          newParams.delete('oobCode');
          newParams.delete('apiKey');
          newParams.delete('lang');
          setSearchParams(newParams, { replace: true });

          // Clear token cache to ensure fresh tokens
          clearTokenCache();

          // Check if user is signed in
          if (auth?.currentUser) {
            console.log('🔄 User signed in, refreshing auth state...');
            console.log('📱 User agent:', navigator.userAgent);

            // For mobile Safari, add extra delay and retry logic
            const isMobileSafari = /iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);

            if (isMobileSafari) {
              console.log('📱 Mobile Safari detected - using enhanced verification flow...');
              // Add extra delay for mobile Safari
              await new Promise(resolve => setTimeout(resolve, 1500));
            }

            await auth.currentUser.reload();

            // Force get a fresh ID token with the updated verification status
            console.log('🔑 Getting fresh ID token after verification...');
            await auth.currentUser.getIdToken(true); // Force refresh

            // Clear token cache to ensure fresh tokens are used
            clearTokenCache();

            // For mobile Safari, add one more delay before navigation
            if (isMobileSafari) {
              console.log('📱 Mobile Safari: adding final delay before navigation...');
              await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Redirect to dashboard
            navigate('/', { replace: true });
          } else {
            console.log('⚠️ No user signed in, redirecting to login');
            navigate('/login?message=Email verified! Please sign in to continue.', { replace: true });
          }

        } catch (error) {
          console.error('❌ Error applying verification code:', error);

          // Clear URL parameters
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('mode');
          newParams.delete('oobCode');
          newParams.delete('apiKey');
          newParams.delete('lang');
          setSearchParams(newParams, { replace: true });

          // Handle specific errors
          let errorMessage = 'Failed to verify email. Please try again.';
          if (error.code === 'auth/invalid-action-code') {
            errorMessage = 'This verification link is invalid or has already been used.';
          } else if (error.code === 'auth/expired-action-code') {
            errorMessage = 'This verification link has expired.';
          }

          navigate(`/verify?error=${encodeURIComponent(errorMessage)}`);
        }
      }
    };

    handleEmailVerification();
  }, [searchParams, setSearchParams, navigate]);

  return null;
}

// Component to protect routes that require authentication
function RequireAuth({ children }) {
  const { initializing, user, isVerified, error } = useFirebaseAuth();

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium mb-4">Authentication Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry
          </button>
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