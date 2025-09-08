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

        // If we have verification parameters, show loading message and don't show errors
        if (mode === 'verifyEmail' && oobCode) {
            console.log('🔄 Verification parameters detected on /verify page - processing...');
            setError(''); // Clear any previous errors
            setMessage('Processing email verification...');
            return;
        }

        // Only set error if user is not already verified and no verification is in progress
        if (errorParam && !(user && isVerified)) {
            setError(errorParam);
            // If it's a verification link error, clear the error parameter from URL
            if (errorParam.includes('verification link') || errorParam.includes('verify email')) {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('error');
                window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
            }
        }
    }, [searchParams, user, isVerified]);

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
            setError(''); // Clear any error state
            setMessage('Email already verified! Redirecting to dashboard...');
            setTimeout(() => {
                navigate('/');
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
            setResendCountdown(120); // 2 minute cooldown to avoid rate limits
        } catch (error) {
            console.error('Resend error:', error);

            // Handle specific Firebase errors
            if (error.code === 'auth/too-many-requests') {
                setError('Too many requests. Please wait a few minutes before trying again.');
            } else if (error.code === 'auth/user-disabled') {
                setError('Your account has been disabled. Please contact support.');
            } else {
                setError(error.message || 'Failed to resend verification email');
            }
        }

        setResendLoading(false);
    };

    const handleCheckVerification = async () => {
        if (!auth?.currentUser) return;

        try {
            // Force refresh the user to get latest verification status
            await auth.currentUser.reload();

            if (auth.currentUser.emailVerified) {
                setError('');
                setMessage('Email verified! Redirecting to dashboard...');
                setTimeout(() => {
                    navigate('/');
                }, 1500);
            } else {
                setError('Email not yet verified. Please check your email and click the verification link.');
            }
        } catch (error) {
            console.error('Check verification error:', error);
            setError('Unable to check verification status. Please try again.');
        }
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
                            <div className="font-medium">{error}</div>
                            {(error.includes('verification link') || error.includes('verify email')) && (
                                <div className="text-sm mt-2">
                                    💡 Tip: Use the "Resend verification email" button below to get a fresh link.
                                </div>
                            )}
                        </div>
                    )}

                    {message && (
                        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                            {message}
                        </div>
                    )}

                    <div className="text-center space-y-4">
                        <p className="text-sm text-gray-600">
                            Click the verification link in your email to verify your account and access the dashboard. Check your spam/junk folder as it might have been filtered there.
                        </p>

                        {resendCountdown > 0 && (
                            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
                                <div className="text-sm font-medium">
                                    Please wait before requesting another email
                                </div>
                                <div className="text-lg font-bold mt-1">
                                    {Math.floor(resendCountdown / 60)}:{String(resendCountdown % 60).padStart(2, '0')}
                                </div>
                            </div>
                        )}                        <div className="space-y-3">
                            <button
                                onClick={handleCheckVerification}
                                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                                I've Verified My Email
                            </button>

                            <button
                                onClick={handleResendVerification}
                                disabled={resendLoading || resendCountdown > 0 || !auth?.currentUser}
                                className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {resendLoading ? 'Sending...' :
                                    resendCountdown > 0 ?
                                        'Please wait...' :
                                        'Resend verification email'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default VerifyEmail;
