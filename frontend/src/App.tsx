import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { WebSocketProvider } from './lib/WebSocketContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ProjectView from './pages/ProjectView'
import TimelineView from './pages/TimelineView'
import Transforms from './pages/Transforms'
import TransformBuilder from './pages/TransformBuilder'
import Teams from './pages/Teams'
import Users from './pages/Users'
import Settings from './pages/Settings'
import ProjectSearchPage from './pages/ProjectSearchPage'
import JobManagement from './pages/JobManagement'
import PromptManagement from './pages/PromptManagement'
import ErrorBoundary from './components/ErrorBoundary'

const queryClient = new QueryClient()

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/jobs" element={<ProtectedRoute><JobManagement /></ProtectedRoute>} />
      <Route path="/prompts" element={<ProtectedRoute><PromptManagement /></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute><ProjectView /></ProtectedRoute>} />
      <Route path="/projects/:id/search" element={<ProtectedRoute><ProjectSearchPage /></ProtectedRoute>} />
      <Route path="/timelines/:id" element={<ProtectedRoute><TimelineView /></ProtectedRoute>} />
      <Route path="/transforms" element={<ProtectedRoute><Transforms /></ProtectedRoute>} />
      <Route path="/transforms/:id" element={<ProtectedRoute><TransformBuilder /></ProtectedRoute>} />
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <WebSocketProvider>
              <AppRoutes />
            </WebSocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
