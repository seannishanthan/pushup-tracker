import { useState, useEffect } from 'react'

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Test backend connection
    fetch('http://localhost:5000/api/test')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(err => console.error('Backend connection failed:', err));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-4">
          Push-up Tracker
        </h1>
        <p className="text-center text-gray-600">
          {message || 'Connecting to backend...'} 
        </p>
      </div>
    </div>
  )
}

export default App