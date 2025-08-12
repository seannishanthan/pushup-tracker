import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthManager } from './hooks/useAuthManager'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'

function AppContent() {
  useAuthManager(); // This handles all navigation logic

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route 
        path="/dashboard" 
        element={
            <Dashboard />
        } 
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App