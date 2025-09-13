import axios from 'axios';
import { auth } from '../lib/firebase';

// If in production mode return the production API URL
// This is controlled by npm run dev versus npm run build (production)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'; //localhost fallback if build does not work

// Token cache to avoid multiple simultaneous requests
let tokenCache = null;
let tokenPromise = null;

// create an axios instance with the base URL so we can use it in our API calls without repeating the long URL
const api = axios.create({
    baseURL: API_URL,
    timeout: 10000, // 10 second timeout
});

// Get fresh token with caching and error handling
const getAuthToken = async (forceRefresh = false) => {
    if (!auth?.currentUser) {
        return null;
    }

    // Return cached token if available and not forcing refresh
    if (tokenCache && !forceRefresh) {
        return tokenCache;
    }

    // If there's already a token request in progress, wait for it
    if (tokenPromise) {
        return tokenPromise;
    }

    // Create new token request
    tokenPromise = (async () => {
        try {
            const token = await auth.currentUser.getIdToken(forceRefresh);
            tokenCache = token;
            console.log('🔑 Token obtained successfully');
            return token;
        } catch (error) {
            console.error('❌ Failed to get Firebase ID token:', error);
            tokenCache = null;
            throw error;
        } finally {
            tokenPromise = null;
        }
    })();

    return tokenPromise;
};

// Clear token cache (call this on logout)
export const clearTokenCache = () => {
    tokenCache = null;
    tokenPromise = null;
};

// Add Firebase ID token to every request if user is authenticated
api.interceptors.request.use(async (config) => {
    try {
        const token = await getAuthToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (error) {
        console.error('Failed to get auth token for request:', error);
        // Don't block the request, let it proceed without auth
    }
    return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Handle authentication errors
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Try to get a fresh token
                const newToken = await getAuthToken(true);
                if (newToken) {
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return api(originalRequest);
                }
            } catch (tokenError) {
                console.error('Failed to refresh token:', tokenError);
                // Clear cache and let the auth state handle redirects
                clearTokenCache();
            }
        }

        // Handle other common errors
        if (error.response?.status === 403) {
            console.warn('Access forbidden - user may need email verification');
        } else if (error.response?.status >= 500) {
            console.error('Server error:', error.response?.data?.message || 'Internal server error');
        }

        return Promise.reject(error);
    }
);

// Authentication API - now handled by Firebase Auth
export const authAPI = {
    // Profile endpoints still go through our backend
    createProfile: (userData) => api.post('/auth/profile', userData),
    createRegistrationProfile: (userData) => api.post('/auth/register-profile', userData),
    getProfile: () => api.get('/auth/profile'),
    updateDailyGoal: (dailyGoal) => api.put('/auth/profile/goal', { dailyGoal }),
    updateName: (name) => api.put('/auth/profile/name', { name }),
    // Health check for auth
    checkAuth: () => api.get('/auth/check'),
    // Debug endpoint
    debugProfile: () => api.get('/auth/debug-profile'),
};

// Pushup Sessions API
export const pushupAPI = {
    // Create a new pushup session
    create: (sessionData) => {
        return api.post('/pushups', sessionData);
    },

    // List pushup sessions with pagination
    list: ({ limit = 10, page = 1, ...filters } = {}) => {
        const params = {
            limit,
            page,
            ...filters,
        };
        return api.get('/pushups', { params });
    },

    // Get user statistics
    stats: (dailyGoal = 100) => {
        return api.get('/pushups/stats', {
            params: { dailyGoal }
        });
    },

    // Get specific pushup session
    getById: (sessionId) => {
        return api.get(`/pushups/${sessionId}`);
    },

    // Update pushup session (partial updates supported)
    update: (sessionId, updateData) => {
        return api.put(`/pushups/${sessionId}`, updateData);
    },

    // Delete pushup session
    delete: (sessionId) => {
        return api.delete(`/pushups/${sessionId}`);
    },
};

export default api;