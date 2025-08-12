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

// export api instance with methods for authentication that the frontend can use to make requests to call the backend API
export const authAPI = {
    register: (userData) => api.post('/auth/register', userData),
    login: (userData) => api.post('/auth/login', userData),
    getProfile: () => api.get('/auth/profile'), // Add this to fetch user profile from react frontend (user cant enter this in browser to access data)
};

export default api;