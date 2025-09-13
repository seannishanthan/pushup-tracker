import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { clearTokenCache } from '../utils/api';
import NavBar from '../components/NavBar';

function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const emailFromParams = searchParams.get('email') || '';
    const verificationMessage = searchParams.get('message') || '';
    const { user, isVerified, error: authError } = useFirebaseAuth();

    // Form state
    const [formData, setFormData] = useState({
        email: emailFromParams,
        password: ''
    });

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState(verificationMessage);

    // Redirect if already authenticated and verified
    useEffect(() => {
        if (user && isVerified) {
            navigate('/');
        }
    }, [user, isVerified, navigate]);

    // Clear any auth errors when component mounts
    useEffect(() => {
        if (authError) {
            setError(authError);
        }
    }, [authError]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMessage('');

        try {
            if (!auth) {
                throw new Error('Firebase not initialized. Please check your configuration.');
            }

            console.log('🔐 Attempting login for:', formData.email);
            const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);

            console.log('✅ Login successful for:', userCredential.user.email);
            console.log('📧 Email verified:', userCredential.user.emailVerified);

            // Clear token cache to ensure fresh tokens
            clearTokenCache();

            // If email is not verified, show appropriate message
            if (!userCredential.user.emailVerified) {
                setError('Please verify your email address before logging in. Check your inbox for a verification link.');
                // Redirect to verification page
                navigate(`/verify?email=${encodeURIComponent(formData.email)}&message=Please verify your email to continue.`);
                return;
            }

            // Navigation will be handled by the useEffect above
            console.log('🎉 Login complete, redirecting to dashboard...');

        } catch (error) {
            console.error('❌ Login error:', error);

            // Handle Firebase-specific errors
            let errorMessage = 'Login failed. Please try again.';

            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email address. Please register first.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password. Please try again.';
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Invalid email or password. If you just registered, please verify your email first.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed attempts. Please try again later.';
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

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div>
            <NavBar />
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="max-w-md w-full space-y-8 p-8">
                    <div>
                        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                            Login to your account
                        </h2>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        {/* Success message for email verification */}
                        {successMessage && (
                            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                                {successMessage}
                            </div>
                        )}

                        {/* Error message */}
                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                                <div className="font-medium">{error}</div>
                                {error.includes('verify your email') && (
                                    <div className="text-sm mt-2">
                                        <Link
                                            to={`/verify?email=${encodeURIComponent(formData.email)}`}
                                            className="font-medium underline hover:text-red-800"
                                        >
                                            Go to verification page
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    value={formData.email} // sync input value with state variable
                                    onChange={handleChange} // update state variable on input change
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
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading} // if loading is true, disable button
                                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {loading ? 'Signing in...' : 'Sign in'}
                            </button>
                        </div>

                        <div className="text-center">
                            <p className="text-sm text-gray-600">
                                Don't have an account?{' '}
                                <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
                                    Register
                                </Link>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Login;