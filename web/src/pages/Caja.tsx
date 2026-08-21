import { useEffect, useState } from 'react'
import { useApp } from '../context/useApp'

interface VentaItem {
  id: string
  nombre: string
  precio: number
  cantidad: number
  categoria: string
  lavador?: { nombre: string } | null
}

interface Socio {
  id: string
  numero: number
  nombre: string
  apellido?: string | null
  telefono?: string | null
}

interface Venta {
  id: string
  numeroRecibo?: string | null
  total: number
  descuentoMonto: number
  descuentoMotivo?: string | null
  metodoPago: string
  referencia?: string | null
  montoRecibido?: number | null
  vuelto?: number | null
  banco?: string | null
  numeroCupon?: string | null
  comprobanteFoto?: string | null
  anulada: boolean
  anuladaPor?: string | null
  anuladaMotivo?: string | null
  anuladaTime?: string | null
  fecha: string
  items: VentaItem[]
  socio?: Socio | null
  cajero?: { nombre: string } | null
}

interface Gasto {
  id: string
  descripcion: string
  monto: number
  registradoPor: string
  fecha: string
}

interface Cierre {
  id: string
  fecha: string
  totalVentas: number
  totalGastos: number
  neto: number
  ventasCount: number
  byPayEffectivo: number
  byPayTarjeta: number
  byPayTransferencia: number
  cerradoPor: string
  createdAt: string
}

interface Resumen {
  ventasCount: number
  totalVentas: number
  totalGastos: number
  neto: number
  byPay: { efectivo: number; tarjeta: number; transferencia: number }
  ventas: Venta[]
  gastos: Gasto[]
  cierresHoy: Cierre[]
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
  const [gastoCategoria, setGastoCategoria] = useState('otro')
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

  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null)

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
          categoria: gastoCategoria,
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
      setGastoCategoria('otro')
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

  const huboCierresHoy = resumen.cierresHoy.length > 0

  return (
    <div className="caja">
      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">{huboCierresHoy ? 'Ventas desde último cierre' : 'Ventas del día'}</div>
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
            <div
              key={v.id}
              className={`list-row ${v.anulada ? 'annulled' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedVenta(v)}
            >
              <div className="main">
                <div className="title">
                  {v.items.map(it => `${it.cantidad}x ${it.nombre}`).join(', ')}
                </div>
                <div className="sub">
                  {v.metodoPago} · {new Date(v.fecha).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}
                  {v.socio && ` · ${v.socio.nombre} ${v.socio.apellido || ''}`.trimEnd()}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="amount">${v.total.toFixed(2)}</div>
                {!v.anulada && (
                  <button
                    className="btn-danger"
                    onClick={(e) => { e.stopPropagation(); setPinAction({ type: 'anular', ventaId: v.id }) }}
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

      {huboCierresHoy && (
        <div className="cierre-banner-compact">
          <div className="cierre-banner-compact-title">Cierres de hoy ({resumen.cierresHoy.length})</div>
          {resumen.cierresHoy.map(c => (
            <div key={c.id} className="cierre-banner-compact-row">
              <span>{new Date(c.createdAt).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })} · {c.cerradoPor}</span>
              <span>${c.totalVentas.toFixed(2)} vtas · ${c.totalGastos.toFixed(2)} gastos · <strong>${c.neto.toFixed(2)}</strong></span>
            </div>
          ))}
        </div>
      )}

      {showGasto && (
        <div className="modal-overlay" onClick={() => { setShowGasto(false); setGastoCategoria('otro') }}>
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
              <label>Categoría</label>
              <select value={gastoCategoria} onChange={e => setGastoCategoria(e.target.value)}>
                <option value="otro">Otro / Operativo</option>
                <option value="nomina">Nómina (pago a empleado)</option>
              </select>
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
              <button className="btn-cancel" onClick={() => { setShowGasto(false); setGastoCategoria('otro') }}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleCrearGasto} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVenta && (
        <div className="modal-overlay" onClick={() => setSelectedVenta(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Detalle de Venta {selectedVenta.numeroRecibo ? `· Recibo ${selectedVenta.numeroRecibo}` : ''}</h2>

            {selectedVenta.anulada && (
              <div className="dt-row" style={{ color: 'var(--red, #c0392b)' }}>
                <span className="k">Anulada</span>
                <span>
                  {selectedVenta.anuladaPor ? `Por ${selectedVenta.anuladaPor}` : ''}
                  {selectedVenta.anuladaTime ? ` · ${new Date(selectedVenta.anuladaTime).toLocaleString('es-SV')}` : ''}
                  {selectedVenta.anuladaMotivo ? ` · Motivo: ${selectedVenta.anuladaMotivo}` : ''}
                </span>
              </div>
            )}

            <div className="dt-row">
              <span className="k">Cliente</span>
              <span>
                {selectedVenta.socio
                  ? `Nº ${selectedVenta.socio.numero} · ${selectedVenta.socio.nombre} ${selectedVenta.socio.apellido || ''}${selectedVenta.socio.telefono ? ` · ${selectedVenta.socio.telefono}` : ''}`
                  : 'Sin cliente asociado'}
              </span>
            </div>

            <div className="dt-row">
              <span className="k">Fecha</span>
              <span>{new Date(selectedVenta.fecha).toLocaleString('es-SV')}</span>
            </div>

            <div className="dt-row">
              <span className="k">Cajero</span>
              <span>{selectedVenta.cajero?.nombre || '-'}</span>
            </div>

            <div className="dt-row">
              <span className="k">Método de pago</span>
              <span>{selectedVenta.metodoPago}</span>
            </div>

            {selectedVenta.metodoPago === 'efectivo' && (
              <>
                {selectedVenta.montoRecibido != null && (
                  <div className="dt-row">
                    <span className="k">Recibido</span>
                    <span>${selectedVenta.montoRecibido.toFixed(2)}</span>
                  </div>
                )}
                {selectedVenta.vuelto != null && (
                  <div className="dt-row">
                    <span className="k">Vuelto</span>
                    <span>${selectedVenta.vuelto.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}

            {selectedVenta.metodoPago === 'tarjeta' && (
              <>
                {selectedVenta.banco && (
                  <div className="dt-row">
                    <span className="k">Banco</span>
                    <span>{selectedVenta.banco}</span>
                  </div>
                )}
                {selectedVenta.numeroCupon && (
                  <div className="dt-row">
                    <span className="k">Nº Cupón</span>
                    <span>{selectedVenta.numeroCupon}</span>
                  </div>
                )}
              </>
            )}

            {selectedVenta.metodoPago === 'transferencia' && (
              <>
                {selectedVenta.referencia && (
                  <div className="dt-row">
                    <span className="k">Referencia</span>
                    <span>{selectedVenta.referencia}</span>
                  </div>
                )}
                {selectedVenta.comprobanteFoto && (
                  <div className="form-group">
                    <label>Comprobante</label>
                    <img
                      src={selectedVenta.comprobanteFoto}
                      alt="Comprobante de transferencia"
                      style={{ maxWidth: '100%', borderRadius: 8 }}
                    />
                  </div>
                )}
              </>
            )}

            {selectedVenta.descuentoMonto > 0 && (
              <div className="dt-row">
                <span className="k">Descuento</span>
                <span>
                  -${selectedVenta.descuentoMonto.toFixed(2)}
                  {selectedVenta.descuentoMotivo ? ` · ${selectedVenta.descuentoMotivo}` : ''}
                </span>
              </div>
            )}

            <h3 style={{ marginTop: 16 }}>Items</h3>
            <div className="list">
              {selectedVenta.items.map(it => (
                <div key={it.id} className="list-row">
                  <div className="main">
                    <div className="title">{it.cantidad}x {it.nombre}</div>
                    <div className="sub">
                      {it.categoria}
                      {it.lavador ? ` · Lavador: ${it.lavador.nombre}` : ''}
                    </div>
                  </div>
                  <div className="amount">${(it.precio * it.cantidad).toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div className="dt-row" style={{ marginTop: 12, fontWeight: 'bold' }}>
              <span className="k">Total</span>
              <span>${selectedVenta.total.toFixed(2)}</span>
            </div>

            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setSelectedVenta(null)}>
                Cerrar
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
