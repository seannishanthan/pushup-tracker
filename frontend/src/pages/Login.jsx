import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../utils/api';

function Login() {
    const navigate = useNavigate(); // A react hook that allows us to navigate to Dashboard upon successful login 

    // when state variables are changed, the component will re-render on UI with the new values

    // stateful variables to update form data on UI as user types
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    // state to show signing in... and disable button while login request is in progress
    const [loading, setLoading] = useState(false);

    // state to show error messages if login fails
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault(); // prevent refresh on submit
        setLoading(true); // update states
        setError('');

        try {
            const response = await authAPI.login(formData); //send login request to backend (async function)

            //response is a JSON object with data obj (wrapping user, token, message, success by axios)
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user)); // store user without password in localStorage
            
            // Navigate to dashboard after successful login
            console.log('Login successful!', response.data);
            navigate('/dashboard');
        } catch (error) {
            console.error('Login error:', error);
            setError(error.response?.data?.message || 'Login failed'); // ? syntax allows safe access to nested properties if they are null
        }

        setLoading(false);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full space-y-8 p-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Login to your account
                    </h2>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>

                    {/* If error is not empty string (falsy) display it in red */}
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                value={formData.email} // sync input value with state variable
                                onChange={handleChange} // update state variable on input change
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter your email"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter your password"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading} // if loading is true, disable button
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </div>

                    <div className="text-center">
                        <p className="text-sm text-gray-600">
                            Don't have an account?{' '}
                            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
                                Register
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Login;