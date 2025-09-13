import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { authAPI } from '../utils/api';

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState('weak');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!auth) {
        throw new Error('Firebase not initialized. Please check your configuration.');
      }

      // Validate name
      if (!formData.name || formData.name.trim().length < 2) {
        throw new Error('Name must be at least 2 characters long');
      }

      if (/\s/.test(formData.name.trim())) {
        throw new Error('Name cannot contain spaces');
      }

      // Validate password
      if (!formData.password || formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      console.log('🔐 Attempting registration with:', formData.email);

      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Send email verification
      const continueUrl = import.meta.env.VITE_FB_CONTINUE_URL || `${window.location.origin}/`;

      await sendEmailVerification(userCredential.user, {
        url: continueUrl
      });

      // Create user profile in MongoDB with enhanced retry logic for mobile
      let profileCreated = false;
      const isMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
      const maxRetries = isMobile ? 5 : 3; // More retries for mobile

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {

          // For mobile, add a small delay before each attempt to ensure network stability
          if (isMobile && attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          const profileData = {
            name: formData.name,
            email: formData.email
          };

          const profileResponse = await authAPI.createRegistrationProfile(profileData);

          // Profile creation successful
          profileCreated = true;
          break; // Success, exit retry loop
        } catch (profileError) {
          // Log error for monitoring (production logging)
          console.error('Profile creation error:', {
            attempt: attempt + 1,
            status: profileError.response?.status,
            message: profileError.message,
            code: profileError.code
          });

          // Check if user already exists - this is not a retryable error
          if (profileError.response?.data?.message === 'User already exists' ||
            profileError.response?.data?.message === 'User profile already exists') {
            profileCreated = true; // Mark as successful since user exists
            break; // Exit the retry loop
          }

          if (attempt < maxRetries - 1) {
            // Progressive delay: longer delays for later attempts
            const baseDelay = isMobile ? 2000 : 1000;
            let delay = baseDelay + (attempt * 1000); // Increase delay with each attempt

            // For timeout errors, add extra delay
            if (profileError.code === 'ECONNABORTED' || profileError.message?.includes('timeout')) {
              delay += 5000; // Add 5 seconds for timeout errors
            }

            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // All attempts failed

            // Show specific error message to user
            let errorMessage = 'Profile setup failed';

            if (profileError.code === 'ECONNABORTED' || profileError.message?.includes('timeout')) {
              errorMessage = 'Network timeout - please check your connection and try logging in after email verification';
            } else if (profileError.response?.data?.message) {
              errorMessage = profileError.response.data.message;
            }

            setError(`Registration successful, but ${errorMessage.toLowerCase()}. Please try logging in after email verification.`);
          }
        }
      }

      // Store email for navigation before clearing form
      const userEmail = formData.email;

      // Show success state
      setSuccess(true);
      setLoading(false);

      // Clear form data to prevent accidental re-submission
      setFormData({
        name: '',
        email: '',
        password: ''
      });

      // Navigate to verification page after a brief delay
      const successMessage = profileCreated
        ? 'Registration successful! Please check your email for verification link.'
        : 'Registration successful! Please check your email for verification link. Note: Profile setup may need to be completed after verification.';

      setTimeout(() => {
        navigate(`/verify?email=${encodeURIComponent(userEmail)}&message=${encodeURIComponent(successMessage)}`, { replace: true });
      }, 2000);

    } catch (error) {
      console.error('❌ Registration error:', error);

      // Handle Firebase-specific errors
      let errorMessage = 'Registration failed. Please try again.';

      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered. Try logging in instead.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Please choose a stronger password.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email registration is not enabled. Please contact support.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection and try again.';
          break;
        default:
          errorMessage = error.message || 'An unexpected error occurred';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Format name: capitalize first letter, lowercase rest
  const formatName = (name) => {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Format name field automatically
    if (name === 'name') {
      setFormData({
        ...formData,
        [name]: formatName(value)
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }

    // Update password strength indicator
    if (name === 'password') {
      if (value.length < 6) {
        setPasswordStrength('weak');
      } else if (value.length < 10) {
        setPasswordStrength('medium');
      } else {
        setPasswordStrength('strong');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              <div className="font-medium">Registration successful! 🎉</div>
              <div className="text-sm mt-1">Please check your email for verification link. Redirecting to verification page...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your name"
                minLength="2"
                maxLength="50"
                pattern="^[^\s]+$"
                title="Name must be at least 2 characters and contain no spaces"
              />
              <p className="mt-1 text-xs text-gray-500">
                At least 2 characters, no spaces. Will be formatted automatically.
              </p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
                minLength="6"
                title="Password must be at least 6 characters long"
              />
              <div className="mt-1">
                <p className="text-xs text-gray-500 mb-1">
                  At least 6 characters required
                </p>
                {formData.password && (
                  <div className="flex items-center space-x-1">
                    <div className={`h-1 w-8 rounded ${passwordStrength === 'weak' ? 'bg-red-400' :
                      passwordStrength === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                      }`}></div>
                    <div className={`h-1 w-8 rounded ${passwordStrength === 'weak' ? 'bg-gray-200' :
                      passwordStrength === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                      }`}></div>
                    <div className={`h-1 w-8 rounded ${passwordStrength === 'weak' ? 'bg-gray-200' :
                      passwordStrength === 'medium' ? 'bg-gray-200' : 'bg-green-400'
                      }`}></div>
                    <span className={`text-xs ml-2 ${passwordStrength === 'weak' ? 'text-red-600' :
                      passwordStrength === 'medium' ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                      {passwordStrength === 'weak' ? 'Weak' :
                        passwordStrength === 'medium' ? 'Medium' : 'Strong'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || success}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : success ? 'Account created! ✅' : 'Create account'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Login
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;
