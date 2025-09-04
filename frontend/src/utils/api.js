import axios from 'axios';

// If in production mode return the production API URL
// This is controlled by npm run dev versus npm run build (production)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'; //localhost fallback if build does not work

// create an axios instance with the base URL so we can use it in our API calls without repeating the long URL
const api = axios.create({
    baseURL: API_URL,
});

// Add JWT token to every request if it exists in localStorage
// config is the request configuration object that axios uses to make the request
// it is called config because it contains all the configuration options for the request like method, url, headers, data, params, etc.
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token'); // Get token from localStorage
    if (token) {
        config.headers.Authorization = `Bearer ${token}`; // Set Authorization header
    }
    return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle authentication errors
        if (error.response?.status === 401) {
            // Clear invalid token
            localStorage.removeItem('token');

            // Redirect to login if not already there
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Authentication API
export const authAPI = {
    register: (userData) => api.post('/auth/register', userData),
    login: (userData) => api.post('/auth/login', userData),
    getProfile: () => api.get('/auth/profile'), // Add this to fetch user profile from react frontend (user cant enter this in browser to access data)
    updateDailyGoal: (dailyGoal) => api.put('/auth/profile/goal', { dailyGoal }), // Update user's daily goal
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