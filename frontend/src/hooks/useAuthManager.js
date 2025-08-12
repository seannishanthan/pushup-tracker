// useAuthManager.js - Custom hook to handle all auth navigation
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useAuthManager() {
    const location = useLocation();

    // Function to check if token is expired 
    function checkTokenExpiration(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1])); // Extract payload from JWT
            const now = Date.now() / 1000; // Current time in seconds
            return payload.exp < now;
        } catch (error) {
            return true;
        }
    }

    // If token exists in localStorage and not expired, user is authenticated
    function isAuthenticated() {
        const token = localStorage.getItem('token');
        return token && !checkTokenExpiration(token);
    }

    // Handle route protection and history management
    // Every time the url changes, we check authentication status
    useEffect(() => {
        const authenticated = isAuthenticated();

        // If user is on login/register page but authenticated, replace history with dashboard
        if ((location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/') && authenticated) {
            window.history.replaceState(null, '', '/dashboard');
            window.location.replace('/dashboard');
            return;
        }

        // If user is on dashboard but not authenticated, replace history with login
        if (location.pathname === '/dashboard' && !authenticated) {
            localStorage.removeItem('token');
            window.history.replaceState(null, '', '/login');
            window.location.replace('/login');
            return;
        }
    }, [location.pathname]);

    // Disable back button for authenticated users on dashboard
    // Whenever url changes, if user is on dashboard and authenticated we push /dashboard to history
    // This ensures that if they try to go back, they stay on the dashboard
    useEffect(() => {
        if (location.pathname === '/dashboard' && isAuthenticated()) {
            // Push state to prevent going back
            window.history.pushState(null, '', location.pathname);

            // We use pushState instead of replaceState to keep the current page in history and trap the user

            // This occurs if user presses back button
            const handlePopState = (event) => {
                if (isAuthenticated()) {
                    // Stay on current page
                    window.history.pushState(null, '', location.pathname);
                }
            };

            window.addEventListener('popstate', handlePopState);

            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [location.pathname]);

    // Return object with methods to manage authentication state
    // Use window.location.replace instead of navigate() for logout/login to prevent browser history of /dashboard being kept
    return {
        isAuthenticated,
        logout: () => {
            localStorage.removeItem('token');
            // Replace current history entry with login
            window.history.replaceState(null, '', '/login');
            window.location.replace('/login');
        },
        login: (token) => {
            localStorage.setItem('token', token);
            // Replace entire history with dashboard
            window.history.replaceState(null, '', '/dashboard');
            window.location.replace('/dashboard');
        }
    };
}
