import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';

function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const emailFromParams = searchParams.get('email') || '';
    const { user, isVerified } = useFirebaseAuth();

    // when state variables are changed, the component will re-render on UI with the new values

    // stateful variables to update form data on UI as user types
    const [formData, setFormData] = useState({
        email: emailFromParams,
        password: ''
    });

    // state to show signing in... and disable button while login request is in progress
    const [loading, setLoading] = useState(false);

    // state to show error messages if login fails
    const [error, setError] = useState('');
    const [showVerificationBanner, setShowVerificationBanner] = useState(false);

    // Redirect if already authenticated and verified
    useEffect(() => {
        if (user && isVerified) {
            navigate('/');
        }
    }, [user, isVerified, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault(); // prevent refresh on submit
        setLoading(true); // update states
        setError('');
        setShowVerificationBanner(false);

        try {
            if (!auth) {
                throw new Error('Firebase not initialized. Please check your configuration.');
            }

            const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);

            // Reload user multiple times to ensure we get the latest verification status
            await userCredential.user.reload();

            // If still not verified, wait a moment and try again
            if (!userCredential.user.emailVerified) {
                console.log('First check: email not verified, retrying...');

                // Wait 2 seconds and reload again
                await new Promise(resolve => setTimeout(resolve, 2000));
                await userCredential.user.reload();

                // Final check
                if (!userCredential.user.emailVerified) {
                    setShowVerificationBanner(true);
                    setError('Please verify your email before logging in. If you just clicked the verification link, please wait a moment and try again.');
                    return;
                }
            }

            console.log('Login successful!', userCredential.user.uid);
            // Navigation will be handled by the useEffect above

        } catch (error) {
            console.error('Login error:', error);

            // Handle Firebase-specific errors
            let errorMessage = 'Login failed';

            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    errorMessage = 'Invalid email or password';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed attempts. Please try again later.';
                    break;
                default:
                    errorMessage = error.message;
            }

            setError(errorMessage);
        }

        setLoading(false);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full space-y-8 p-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Login to your account
                    </h2>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>

                    {/* Verification banner */}
                    {showVerificationBanner && (
                        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded">
                            <p className="text-sm mb-2">
                                Please verify your email address before logging in.{' '}
                                <Link
                                    to={`/verify?email=${encodeURIComponent(formData.email)}`}
                                    className="font-medium underline hover:text-yellow-900"
                                >
                                    Click here to verify
                                </Link>
                            </p>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                className="text-xs bg-yellow-200 hover:bg-yellow-300 px-2 py-1 rounded"
                            >
                                ↻ I just verified, try again
                            </button>
                        </div>
                    )}

                    {/* If error is not empty string (falsy) display it in red */}
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {error}
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
    );
}

export default Login;