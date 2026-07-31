import { useState, useEffect } from 'react'

export default function App() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check device session
    fetch('/api/auth/check')
      .then(r => r.json())
      .then(data => {
        if (!data.authenticated) {
          // Redirect to login
          window.location.href = '/login'
        }
        setLoading(false)
      })
      .catch(() => {
        window.location.href = '/login'
      })
  }, [])

  if (loading) {
    return <div className="loading">Cargando caja de Los Pits...</div>
  }

  return (
    <div className="app">
      <header>
        <h1>LOS PITS · CAJA</h1>
      </header>
      <main>
        <p>Bienvenida</p>
      </main>
    </div>
  )
}
