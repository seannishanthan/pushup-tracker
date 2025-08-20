import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthManager } from './hooks/useAuthManager'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Session from './pages/Session.jsx'

function AppContent() {
  useAuthManager(); // This handles all navigation logic

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route 
        path="/" 
        element={
            <Dashboard />
        } 
      />
      <Route 
        path="/session" 
        element={
            <Session />
        } 
      />
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