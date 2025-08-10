import { Navigate } from 'react-router-dom';

// children is the protected component (Dashboard)
function ProtectedRoute({ children }) {


    function checkTokenExpiration(token) {
        try{
            const payload = JSON.parse(atob(token.split('.')[1])); // Decode the token payload
            const now = Date.now() / 1000; // Current time in seconds

            return payload.exp < now; // returns true if token expiry date has passed

        } catch (error) {
            return true; // if error occured, token is invalid
        }
    }

    const token = localStorage.getItem('token');

    // If no token, redirect to login
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // Token expiration check here later
    const isTokenExpired = checkTokenExpiration(token);
    if (isTokenExpired) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return <Navigate to="/login" replace />;
    }

    // If token exists, render the dashboard
    return children;
}

export default ProtectedRoute;
