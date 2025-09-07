import axios from 'axios';
import { auth } from '../lib/firebase';

// If in production mode return the production API URL
// This is controlled by npm run dev versus npm run build (production)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'; //localhost fallback if build does not work

// create an axios instance with the base URL so we can use it in our API calls without repeating the long URL
const api = axios.create({
    baseURL: API_URL,
});

// Add Firebase ID token to every request if user is authenticated
api.interceptors.request.use(async (config) => {
    if (auth?.currentUser) {
        try {
            const token = await auth.currentUser.getIdToken(); // auto-refreshed by Firebase
            config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
            console.error('Failed to get Firebase ID token:', error);
        }
    }
    return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle authentication errors
        if (error.response?.status === 401) {
            // For 401 errors, we'll let the Firebase auth state handle redirects
            console.warn('Authentication failed - user may need to re-login');
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
    updateUsername: (username) => api.put('/auth/profile/username', { username }),
    // Health check for auth
    checkAuth: () => api.get('/auth/check'),
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