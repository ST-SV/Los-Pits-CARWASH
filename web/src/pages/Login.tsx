import { useState } from 'react'
import { useApp } from '../context/useApp'
import '../styles/login.css'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuthenticated, toast } = useApp()

  const handleLogin = async () => {
    if (!password) {
      setError('Ingresá la contraseña')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        setError('Contraseña incorrecta')
        setLoading(false)
        return
      }

      setAuthenticated(true)
      toast('Sesión iniciada ✓')
    } catch (err) {
      setError('Error al conectar')
      console.error(err)
    }
    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>LOS PITS · CAJA</h1>
        <p className="login-subtitle">Ingresá la contraseña de dispositivo</p>

        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          placeholder="Contraseña"
          disabled={loading}
          className="login-input"
        />

        {error && <p className="login-error">{error}</p>}

        <button onClick={handleLogin} disabled={loading} className="login-button">
          {loading ? 'Conectando...' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}
