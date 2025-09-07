import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';

function VerifyEmail() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const emailFromParams = searchParams.get('email') || '';
    const { user, isVerified } = useFirebaseAuth();

    const [resendLoading, setResendLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [resendCountdown, setResendCountdown] = useState(0);

    // Check for error parameter from App.jsx verification handling
    useEffect(() => {
        const errorParam = searchParams.get('error');
        const mode = searchParams.get('mode');
        const oobCode = searchParams.get('oobCode');

        // If we have verification parameters, don't show error - these are being handled by App.jsx
        if (mode === 'verifyEmail' && oobCode) {
            console.log('🔄 Verification parameters detected on /verify page - ignoring');
            return;
        }

        if (errorParam) {
            setError(errorParam);
        }
    }, [searchParams]);

    // Countdown timer for resend button
    useEffect(() => {
        let timer;
        if (resendCountdown > 0) {
            timer = setInterval(() => {
                setResendCountdown(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [resendCountdown]);

    // Check if user is already verified
    useEffect(() => {
        if (user && isVerified) {
            setMessage('Email already verified! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        }
    }, [user, isVerified, navigate]);

    const handleResendVerification = async () => {
        if (resendCountdown > 0 || !auth?.currentUser) return;

        setResendLoading(true);
        setError('');
        setMessage('');

        try {
            const continueUrl = import.meta.env.VITE_FB_CONTINUE_URL || `${window.location.origin}/`;

            await sendEmailVerification(auth.currentUser, {
                url: continueUrl
            });

            setMessage('New verification email sent! Please check your inbox.');
            setResendCountdown(60); // 60 second cooldown
        } catch (error) {
            console.error('Resend error:', error);
            setError(error.message || 'Failed to resend verification email');
        }

        setResendLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full space-y-8 p-8">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Verify your email
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        We sent a verification link to <strong>{emailFromParams || user?.email}</strong>
                    </p>
                </div>

                <div className="mt-8 space-y-6">
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                            {message}
                        </div>
                    )}

                    <div className="text-center space-y-4">
                        <p className="text-sm text-gray-600">
                            Click the verification link in your email to verify your account and access the dashboard.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={handleResendVerification}
                                disabled={resendLoading || resendCountdown > 0 || !auth?.currentUser}
                                className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {resendLoading ? 'Sending...' :
                                    resendCountdown > 0 ? `Resend link (${resendCountdown}s)` :
                                        'Resend verification email'}
                            </button>
                        </div>
                    </div>

                    <div className="text-center">
                        <p className="text-sm text-gray-600">
                            Remember your password?{' '}
                            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                                Back to Login
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default VerifyEmail;
