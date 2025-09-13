import { Link } from 'react-router-dom';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { clearTokenCache } from '../utils/api';

function NavBar() {
    const { user, isAuthenticated, logout, loading } = useFirebaseAuth();

    const handleLogout = async () => {
        try {
            // Clear token cache before logout
            clearTokenCache();
            await logout();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // Don't show navbar if user is not authenticated
    if (!isAuthenticated) {
        return null;
    }

    return (
        <nav className="bg-blue-600 shadow-lg">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between items-center h-16">

                    {/* Logo/Brand */}
                    <div className="flex items-center">
                        <Link to="/" className="text-white text-xl font-bold">
                            💪 Pushup Tracker
                        </Link>
                    </div>

                    {/* Navigation Links */}
                    <div className="flex items-center space-x-4">
                        <Link to="/session" className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors border border-blue-500 hover:border-blue-600">
                            Start Session
                        </Link>

                        <button
                            onClick={handleLogout}
                            disabled={loading}
                            className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors border border-blue-500 hover:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Logging out...' : 'Logout'}
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default NavBar;