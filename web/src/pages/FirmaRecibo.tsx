import { useEffect, useState, CSSProperties } from 'react'

interface ReciboData {
  empleado: { nombre: string; apellido?: string | null; role: string }
  periodo: {
    label: string
    sueldoBase: number
    autosLavados: number
    comisionPercent: number
    comisionThreshold: number
    comision: number
    descuentos: { id: string; monto: number; motivo: string }[]
    totalDescuentos: number
    totalPagar: number
  }
  firmaNombre?: string | null
  firmaFecha?: string | null
}

export default function FirmaRecibo({ token }: { token: string }) {
  const [data, setData] = useState<ReciboData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nombre, setNombre] = useState('')
  const [confirmo, setConfirmo] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`/api/public/recibo/${token}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'No se pudo cargar el recibo')
        return r.json()
      })
      .then(d => {
        setData(d)
        setError('')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const firmar = async () => {
    if (!nombre.trim() || !confirmo) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/recibo/${token}/firmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error al firmar')
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="loading">Cargando recibo...</div>
  if (error) return <div className="loading">{error}</div>
  if (!data) return null

  const { empleado, periodo, firmaNombre, firmaFecha } = data

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: 18, marginBottom: 0 }}>Los Pits Car Wash — Recibo de sueldo</h1>
      <div style={{ color: '#666', fontSize: 13, marginTop: 4, marginBottom: 20 }}>
        {empleado.nombre} {empleado.apellido} · {empleado.role} · {periodo.label}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={cellStyle}>Sueldo base</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>${periodo.sueldoBase.toFixed(2)}</td>
          </tr>
          <tr>
            <td style={cellStyle}>
              Comisión ({periodo.comisionPercent}% · {periodo.autosLavados} autos)
            </td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>${periodo.comision.toFixed(2)}</td>
          </tr>
          {periodo.descuentos.map(d => (
            <tr key={d.id}>
              <td style={cellStyle}>Descuento: {d.motivo}</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>-${d.monto.toFixed(2)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...cellStyle, fontWeight: 700, fontSize: 16, borderTop: '2px solid #111', borderBottom: 'none' }}>
              Total a pagar
            </td>
            <td style={{ ...cellStyle, fontWeight: 700, fontSize: 16, borderTop: '2px solid #111', borderBottom: 'none', textAlign: 'right' }}>
              ${periodo.totalPagar.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 30, borderTop: '1px solid #ddd', paddingTop: 20 }}>
        {firmaNombre ? (
          <div style={{ color: '#0a7a2f', fontWeight: 600 }}>
            ✓ Firmado por {firmaNombre} el {new Date(firmaFecha as string).toLocaleString('es-SV')}
          </div>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Nombre completo</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              style={{ width: '100%', padding: 8, marginBottom: 10, fontSize: 14 }}
              placeholder="Tu nombre completo"
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 14 }}>
              <input type="checkbox" checked={confirmo} onChange={e => setConfirmo(e.target.checked)} />
              Confirmo que recibí y estoy de acuerdo con este recibo
            </label>
            <button
              disabled={!nombre.trim() || !confirmo || submitting}
              onClick={firmar}
              style={{ padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}
            >
              Firmar recibo
            </button>
          </>
        )}
      </div>

      <button onClick={() => window.print()} style={{ marginTop: 20, padding: '8px 16px', fontSize: 13 }}>
        Imprimir / Descargar PDF
      </button>
    </div>
  )
}

const cellStyle: CSSProperties = { padding: '6px 4px', borderBottom: '1px solid #ddd', fontSize: 14 }
