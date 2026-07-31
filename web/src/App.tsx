import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/useApp'
import Login from './pages/Login'
import Vender from './pages/Vender'
import Caja from './pages/Caja'
import Socios from './pages/Socios'
import Admin from './pages/Admin'

function AppContent() {
  const { authenticated, setAuthenticated } = useApp()
  const [activeTab, setActiveTab] = useState<'vender' | 'caja' | 'socios' | 'admin'>('vender')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check auth on mount
    fetch('/api/auth/check')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated) {
          setAuthenticated(true)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [setAuthenticated])

  if (loading) {
    return <div className="loading">Cargando caja de Los Pits...</div>
  }

  if (!authenticated) {
    return <Login />
  }

  const today = new Date().toLocaleDateString('es-SV', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="brand-name">LOS PITS · CAJA</div>
          <div className="brand-date">{today}</div>
        </div>
        <nav className="nav">
          <button
            className={`nav-btn ${activeTab === 'vender' ? 'active' : ''}`}
            onClick={() => setActiveTab('vender')}
          >
            Vender
          </button>
          <button
            className={`nav-btn ${activeTab === 'caja' ? 'active' : ''}`}
            onClick={() => setActiveTab('caja')}
          >
            Caja
          </button>
          <button
            className={`nav-btn ${activeTab === 'socios' ? 'active' : ''}`}
            onClick={() => setActiveTab('socios')}
          >
            Socios
          </button>
          <button
            className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Admin
          </button>
        </nav>
      </header>

      <main>
        {activeTab === 'vender' && <Vender />}
        {activeTab === 'caja' && <Caja />}
        {activeTab === 'socios' && <Socios />}
        {activeTab === 'admin' && <Admin />}
      </main>

      <div id="toast" className="toast"></div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
