import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AuthCallback from './pages/AuthCallback'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import ChatPage from './pages/ChatPage'
import ArchitecturePage from './pages/ArchitecturePage'

export default function App() {
  return (
    <AuthProvider>
      <AnimatePresence mode="wait">
        <Routes>
          {/* Public routes */}
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute><Landing /></ProtectedRoute>
          } />
          <Route path="/repository/:id" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/repository/:id/chat" element={
            <ProtectedRoute><ChatPage /></ProtectedRoute>
          } />
          <Route path="/repository/:id/architecture" element={
            <ProtectedRoute><ArchitecturePage /></ProtectedRoute>
          } />
        </Routes>
      </AnimatePresence>
    </AuthProvider>
  )
}
