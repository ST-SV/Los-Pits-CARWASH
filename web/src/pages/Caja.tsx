import { useEffect, useState } from 'react'
import { useApp } from '../context/useApp'

interface VentaItem {
  id: string
  nombre: string
  precio: number
  cantidad: number
}

interface Venta {
  id: string
  numeroRecibo?: string | null
  total: number
  metodoPago: string
  anulada: boolean
  fecha: string
  items: VentaItem[]
}

interface Gasto {
  id: string
  descripcion: string
  monto: number
  registradoPor: string
  fecha: string
}

interface Resumen {
  ventasCount: number
  totalVentas: number
  totalGastos: number
  neto: number
  byPay: { efectivo: number; tarjeta: number; transferencia: number }
  ventas: Venta[]
  gastos: Gasto[]
}

interface Empleado {
  id: string
  nombre: string
}

export default function Caja() {
  const { toast } = useApp()
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)

  const [showGasto, setShowGasto] = useState(false)
  const [gastoDesc, setGastoDesc] = useState('')
  const [gastoMonto, setGastoMonto] = useState('')
  const [gastoEmpleado, setGastoEmpleado] = useState('')
  const [gastoPin, setGastoPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [pinAction, setPinAction] = useState<
    | { type: 'anular'; ventaId: string }
    | { type: 'eliminarGasto'; gastoId: string }
    | { type: 'cerrar' }
    | null
  >(null)
  const [actionEmpleado, setActionEmpleado] = useState('')
  const [actionPin, setActionPin] = useState('')
  const [actionMotivo, setActionMotivo] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/caja/resumen').then(r => r.json()),
      fetch('/api/vender/empleados').then(r => r.json()),
    ])
      .then(([res, emps]) => {
        setResumen(res)
        setEmpleados(emps)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCrearGasto = async () => {
    if (!gastoDesc || !gastoMonto || !gastoEmpleado || !gastoPin) {
      toast('Completa todos los campos', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/caja/gasto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: gastoDesc,
          monto: parseFloat(gastoMonto),
          registradoPorId: gastoEmpleado,
          registradoPorPin: gastoPin,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al registrar gasto')
      }
      toast('Gasto registrado', 'success')
      setShowGasto(false)
      setGastoDesc('')
      setGastoMonto('')
      setGastoEmpleado('')
      setGastoPin('')
      load()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const closePinAction = () => {
    setPinAction(null)
    setActionEmpleado('')
    setActionPin('')
    setActionMotivo('')
  }

  const handlePinAction = async () => {
    if (!pinAction) return
    if (!actionEmpleado || !actionPin) {
      toast('Selecciona empleado e ingresa PIN', 'error')
      return
    }
    if (pinAction.type !== 'cerrar' && !actionMotivo) {
      toast('Ingresa el motivo', 'error')
      return
    }
    setSubmitting(true)
    try {
      let url = ''
      let body: any = {}
      if (pinAction.type === 'anular') {
        url = `/api/caja/venta/${pinAction.ventaId}/anular`
        body = { anuladoPorId: actionEmpleado, anuladoPorPin: actionPin, motivo: actionMotivo }
      } else if (pinAction.type === 'eliminarGasto') {
        url = `/api/caja/gasto/${pinAction.gastoId}`
        body = { registradoPorId: actionEmpleado, registradoPorPin: actionPin, motivo: actionMotivo }
      } else {
        url = '/api/caja/cerrar'
        body = { cerradorId: actionEmpleado, cerradorPin: actionPin }
      }
      const res = await fetch(url, {
        method: pinAction.type === 'eliminarGasto' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error')
      }
      toast(
        pinAction.type === 'anular'
          ? 'Venta anulada'
          : pinAction.type === 'eliminarGasto'
          ? 'Gasto eliminado'
          : 'Caja cerrada',
        'success'
      )
      closePinAction()
      load()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="loading">Cargando caja...</div>
  }

  if (!resumen) {
    return <div className="empty-state">Error cargando caja</div>
  }

  return (
    <div className="caja">
      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Ventas del día</div>
          <div className="value">{resumen.ventasCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total vendido</div>
          <div className="value yellow">${resumen.totalVentas.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Gastos</div>
          <div className="value red">${resumen.totalGastos.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Neto</div>
          <div className="value green">${resumen.neto.toFixed(2)}</div>
        </div>
      </div>

      <div className="detail-card">
        <div className="dt-row">
          <span className="k">Efectivo</span>
          <span>${resumen.byPay.efectivo.toFixed(2)}</span>
        </div>
        <div className="dt-row">
          <span className="k">Tarjeta</span>
          <span>${resumen.byPay.tarjeta.toFixed(2)}</span>
        </div>
        <div className="dt-row">
          <span className="k">Transferencia</span>
          <span>${resumen.byPay.transferencia.toFixed(2)}</span>
        </div>
      </div>

      <div className="action-row">
        <button className="btn-secondary" onClick={() => setShowGasto(true)}>
          + Gasto
        </button>
        <button className="btn-primary" onClick={() => setPinAction({ type: 'cerrar' })}>
          Cerrar Caja
        </button>
      </div>

      <h2>Ventas de hoy</h2>
      {resumen.ventas.length === 0 ? (
        <p className="empty-state">Sin ventas todavía</p>
      ) : (
        <div className="list">
          {resumen.ventas.map(v => (
            <div key={v.id} className={`list-row ${v.anulada ? 'annulled' : ''}`}>
              <div className="main">
                <div className="title">
                  {v.items.map(it => `${it.cantidad}x ${it.nombre}`).join(', ')}
                </div>
                <div className="sub">
                  {v.metodoPago} · {new Date(v.fecha).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="amount">${v.total.toFixed(2)}</div>
                {!v.anulada && (
                  <button
                    className="btn-danger"
                    onClick={() => setPinAction({ type: 'anular', ventaId: v.id })}
                  >
                    Anular
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>Gastos de hoy</h2>
      {resumen.gastos.length === 0 ? (
        <p className="empty-state">Sin gastos registrados</p>
      ) : (
        <div className="list">
          {resumen.gastos.map(g => (
            <div key={g.id} className="list-row">
              <div className="main">
                <div className="title">{g.descripcion}</div>
                <div className="sub">{g.registradoPor}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="amount">${g.monto.toFixed(2)}</div>
                <button
                  className="btn-danger"
                  onClick={() => setPinAction({ type: 'eliminarGasto', gastoId: g.id })}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showGasto && (
        <div className="modal-overlay" onClick={() => setShowGasto(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Registrar Gasto</h2>
            <div className="form-group">
              <label>Descripción *</label>
              <input value={gastoDesc} onChange={e => setGastoDesc(e.target.value)} placeholder="Ej. Compra de jabón" />
            </div>
            <div className="form-group">
              <label>Monto *</label>
              <input
                type="number"
                step="0.01"
                value={gastoMonto}
                onChange={e => setGastoMonto(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>Registrado por *</label>
              <select value={gastoEmpleado} onChange={e => setGastoEmpleado(e.target.value)}>
                <option value="">Selecciona empleado</option>
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>PIN *</label>
              <input
                type="password"
                maxLength={4}
                value={gastoPin}
                onChange={e => setGastoPin(e.target.value)}
                placeholder="1234"
              />
            </div>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setShowGasto(false)}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleCrearGasto} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pinAction && (
        <div className="modal-overlay" onClick={closePinAction}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>
              {pinAction.type === 'anular'
                ? 'Anular Venta'
                : pinAction.type === 'eliminarGasto'
                ? 'Eliminar Gasto'
                : 'Cerrar Caja del Día'}
            </h2>
            <div className="form-group">
              <label>Empleado *</label>
              <select value={actionEmpleado} onChange={e => setActionEmpleado(e.target.value)}>
                <option value="">Selecciona empleado</option>
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>PIN *</label>
              <input
                type="password"
                maxLength={4}
                value={actionPin}
                onChange={e => setActionPin(e.target.value)}
                placeholder="1234"
              />
            </div>
            {pinAction.type !== 'cerrar' && (
              <div className="form-group">
                <label>Motivo *</label>
                <input value={actionMotivo} onChange={e => setActionMotivo(e.target.value)} placeholder="Motivo" />
              </div>
            )}
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={closePinAction}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handlePinAction} disabled={submitting}>
                {submitting ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
