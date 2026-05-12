import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import BudgetSetup from './pages/BudgetSetup'
import WeeklyAllocation from './pages/WeeklyAllocation'
import AccountTracker from './pages/AccountTracker'
import Goals from './pages/Goals'
import Charts from './pages/Charts'
import Export from './pages/Export'
import Testing from './pages/Testing'
import DebugPanel from './debug/DebugPanel'
import { installDebugListeners } from './debug/debugStore'
import { ToastProvider } from './components/ui/toast'

installDebugListeners()

export default function App() {
  const [debugVisible, setDebugVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setDebugVisible(v => !v)
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        navigate('/testing')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [navigate])

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Layout>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/setup" element={<BudgetSetup />} />
              <Route path="/weekly" element={<WeeklyAllocation />} />
              <Route path="/tracker" element={<AccountTracker />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/charts" element={<Charts />} />
              <Route path="/export" element={<Export />} />
              <Route path="/testing" element={<Testing />} />
            </Routes>
          </ErrorBoundary>
        </Layout>
        <DebugPanel visible={debugVisible} onClose={() => setDebugVisible(false)} />
      </ToastProvider>
    </ErrorBoundary>
  )
}
