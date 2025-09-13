import { useEffect, useState, useCallback, useRef } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export function useFirebaseAuth() {
    const [initializing, setInitializing] = useState(true);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const reloadTimeoutRef = useRef(null);

    // Memoized logout function
    const logout = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
            setError('Failed to logout. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Memoized reload function with debouncing
    const reloadUser = useCallback(async (firebaseUser) => {
        if (!firebaseUser) return;

        // Clear any existing timeout
        if (reloadTimeoutRef.current) {
            clearTimeout(reloadTimeoutRef.current);
        }

        // Debounce reload to avoid excessive calls
        reloadTimeoutRef.current = setTimeout(async () => {
            try {
                await firebaseUser.reload();
                console.log('✅ User reloaded successfully');
            } catch (error) {
                console.error('❌ Error reloading user:', error);
                setError('Failed to refresh user data');
            }
        }, 100);
    }, []);

    useEffect(() => {
        if (!auth) {
            console.warn('⚠️ Firebase auth not initialized');
            setInitializing(false);
            setError('Firebase authentication not configured');
            return;
        }

        console.log('🔐 Setting up Firebase auth listener');

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log('🔄 Auth state changed:', firebaseUser ? `User: ${firebaseUser.email}` : 'No user');

            if (firebaseUser) {
                // Only reload if user is not verified to get latest status
                if (!firebaseUser.emailVerified) {
                    await reloadUser(firebaseUser);
                }
            }

            setUser(firebaseUser);
            setError(null);
            setInitializing(false);
        }, (error) => {
            console.error('❌ Auth state change error:', error);
            setError('Authentication error occurred');
            setInitializing(false);
        });

        return () => {
            console.log('🧹 Cleaning up auth listener');
            unsubscribe();
            if (reloadTimeoutRef.current) {
                clearTimeout(reloadTimeoutRef.current);
            }
        };
    }, [reloadUser]);

    return {
        initializing,
        user,
        isVerified: !!user?.emailVerified,
        isAuthenticated: !!user,
        error,
        loading,
        logout
    };
}
