import { useEffect, useState } from 'react'
import { useApp } from '../context/useApp'

interface Catalogo {
  servicios: { id: string; nombre: string; precio: number; categoria?: string }[]
  productos: { id: string; nombre: string; precio: number; categoria?: string }[]
}

const CATEGORIAS_PRODUCTO = ['Bebidas Frías', 'Bebidas Calientes', 'Snacks', 'Otros']
const CATEGORIAS_SERVICIO = ['SEDÁN', 'CAMIONETA PEQUEÑA', 'CAMIONETA MEDIANA', 'CAMIONETA GRANDE', 'PICK UP', 'PICK UP XL', 'General']

interface CartItem {
  id: string
  nombre: string
  precio: number
  tipo: 'servicio' | 'producto'
  cantidad: number
}

interface Empleado {
  id: string
  nombre: string
  role?: string
}

interface Socio {
  id: string
  numero: number
  nombre: string
}

export default function Vender() {
  const { cart, addToCart, removeFromCart, updateCartQty, updateCartLavadores, clearCart, toast } = useApp()
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [showCheckout, setShowCheckout] = useState(false)
  const [cartExpanded, setCartExpanded] = useState(false)
  const [selectedEmpleado, setSelectedEmpleado] = useState<string>('')
  const [selectedSocio, setSelectedSocio] = useState<string>('')
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo')
  const [pin, setPin] = useState('')
  const [pinSubmitting, setPinSubmitting] = useState(false)
  const [numeroRecibo, setNumeroRecibo] = useState('')
  const [referencia, setReferencia] = useState('')
  const [comprobanteFoto, setComprobanteFoto] = useState<string | null>(null)
  const [montoRecibido, setMontoRecibido] = useState('')
  const [banco, setBanco] = useState('')
  const [numeroCupon, setNumeroCupon] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/vender/catalogo').then(r => r.json()),
      fetch('/api/vender/empleados').then(r => r.json()),
      fetch('/api/vender/socios').then(r => r.json()),
    ])
      .then(([cat, emps, socs]) => {
        setCatalogo(cat)
        setEmpleados(emps)
        setSocios(socs)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const lavadores = empleados.filter(e => e.role === 'lavador')

  const handleAddItem = (item: { id: string; nombre: string; precio: number }, tipo: 'servicio' | 'producto') => {
    addToCart({ id: item.id, nombre: item.nombre, precio: item.precio, tipo })
  }

  const toggleLavador = (index: number, lavadorId: string) => {
    const current = cart[index].lavadorIds || []
    const next = current.includes(lavadorId)
      ? current.filter(id => id !== lavadorId)
      : [...current, lavadorId]
    updateCartLavadores(index, next)
  }

  const handleFotoComprobante = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxW = 1000
        const scale = Math.min(1, maxW / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
        setComprobanteFoto(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleCheckout = async () => {
    if (!selectedEmpleado) {
      toast('Selecciona cajero', 'error')
      return
    }
    if (!numeroRecibo.trim()) {
      toast('Ingresa el número de recibo entregado al cliente', 'error')
      return
    }
    const servicioSinLavador = cart.find(item => item.tipo === 'servicio' && !(item.lavadorIds && item.lavadorIds.length > 0))
    if (servicioSinLavador) {
      toast(`Selecciona el/los lavador(es) de "${servicioSinLavador.nombre}"`, 'error')
      return
    }
    if (!pin) {
      toast('Ingresa PIN', 'error')
      return
    }
    if (metodoPago === 'efectivo' && (!montoRecibido || parseFloat(montoRecibido) < total)) {
      toast('Ingresa con cuánto paga el cliente (debe cubrir el total)', 'error')
      return
    }
    if (metodoPago === 'transferencia' && !referencia.trim()) {
      toast('Ingresa el número de transferencia', 'error')
      return
    }
    if (metodoPago === 'tarjeta' && (!banco.trim() || !numeroCupon.trim())) {
      toast('Ingresa el banco y el número de cupón', 'error')
      return
    }

    setPinSubmitting(true)
    try {
      const res = await fetch('/api/vender/venta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            catalogoServicioId: item.tipo === 'servicio' ? item.id : null,
            catalogoProductoId: item.tipo === 'producto' ? item.id : null,
            cantidad: item.cantidad,
            lavadorIds: item.tipo === 'servicio' ? item.lavadorIds || [] : undefined,
          })),
          empleadoId: selectedEmpleado,
          socioId: selectedSocio || null,
          metodoPago,
          pin,
          numeroRecibo: numeroRecibo.trim(),
          referencia: metodoPago === 'transferencia' ? referencia.trim() : undefined,
          montoRecibido: metodoPago === 'efectivo' ? parseFloat(montoRecibido) : undefined,
          banco: metodoPago === 'tarjeta' ? banco.trim() : undefined,
          numeroCupon: metodoPago === 'tarjeta' ? numeroCupon.trim() : undefined,
          comprobanteFoto: metodoPago === 'transferencia' ? comprobanteFoto : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error en la venta')
      }

      toast('Venta registrada', 'success')
      clearCart()
      setShowCheckout(false)
      setPin('')
      setSelectedEmpleado('')
      setSelectedSocio('')
      setNumeroRecibo('')
      setReferencia('')
      setComprobanteFoto(null)
      setMontoRecibido('')
      setBanco('')
      setNumeroCupon('')
    } catch (error: any) {
      toast(error.message, 'error')
    } finally {
      setPinSubmitting(false)
    }
  }

  const total = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  const vuelto = metodoPago === 'efectivo' && montoRecibido ? Math.max(0, parseFloat(montoRecibido) - total) : 0

  if (loading) {
    return <div className="loading">Cargando catálogo...</div>
  }

  if (!catalogo) {
    return <div className="empty-state">Error cargando catálogo</div>
  }

  return (
    <div className="vender">
      <h2>Servicios</h2>
      {CATEGORIAS_SERVICIO.map(cat => {
        const items = catalogo.servicios.filter(s => (s.categoria || 'General') === cat)
        if (items.length === 0) return null
        return (
          <div key={cat}>
            <h3 className="cat-subheader">{cat}</h3>
            <div className="grid">
              {items.map(s => (
                <button
                  key={s.id}
                  className="item-btn"
                  onClick={() => handleAddItem(s, 'servicio')}
                >
                  <span className="nm">{s.nombre}</span>
                  <span className="pr">${s.precio.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <h2>Cafetería</h2>
      {CATEGORIAS_PRODUCTO.map(cat => {
        const items = catalogo.productos.filter(p => (p.categoria || 'Otros') === cat)
        if (items.length === 0) return null
        return (
          <div key={cat}>
            <h3 className="cat-subheader">{cat}</h3>
            <div className="grid">
              {items.map(p => (
                <button
                  key={p.id}
                  className="item-btn"
                  onClick={() => handleAddItem(p, 'producto')}
                >
                  <span className="nm">{p.nombre}</span>
                  <span className="pr">${p.precio.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {cartExpanded && (
        <div className="cart-sheet-overlay" onClick={() => setCartExpanded(false)}>
          <div className="cart-sheet" onClick={e => e.stopPropagation()}>
            <div className="cart-sheet-handle" />
            <h2>Carrito</h2>
            {cart.length === 0 ? (
              <div className="empty-state">Todavía no agregaste nada</div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item, i) => (
                    <div key={i} className="cart-item">
                      <div className="item-name">{item.nombre}</div>
                      <div className="item-controls">
                        <button
                          className="qty-btn"
                          onClick={() => updateCartQty(i, Math.max(1, item.cantidad - 1))}
                        >
                          −
                        </button>
                        <span className="qty">{item.cantidad}</span>
                        <button
                          className="qty-btn"
                          onClick={() => updateCartQty(i, item.cantidad + 1)}
                        >
                          +
                        </button>
                        <div className="item-price">${(item.precio * item.cantidad).toFixed(2)}</div>
                        <button
                          className="remove-btn"
                          onClick={() => removeFromCart(i)}
                        >
                          ✕
                        </button>
                      </div>
                      {item.tipo === 'servicio' && (
                        <div className="lavador-chips">
                          <span className="lavador-label">Lavador(es):</span>
                          {lavadores.map(l => {
                            const selected = (item.lavadorIds || []).includes(l.id)
                            return (
                              <button
                                key={l.id}
                                type="button"
                                className={`lavador-chip ${selected ? 'selected' : ''}`}
                                onClick={() => toggleLavador(i, l.id)}
                              >
                                {l.nombre}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="cart-total">
                  <span>TOTAL</span>
                  <span className="total-amount">${total.toFixed(2)}</span>
                </div>
                <button
                  className="checkout-btn"
                  onClick={() => {
                    setCartExpanded(false)
                    setShowCheckout(true)
                  }}
                >
                  Registrar Venta
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="cart-bar">
        <button className="cart-bar-summary" onClick={() => setCartExpanded(v => !v)}>
          <span className="cart-bar-count">
            {cart.length === 0 ? 'Carrito vacío' : `${cart.reduce((s, i) => s + i.cantidad, 0)} artículo(s)`}
          </span>
          <span className="cart-bar-total">${total.toFixed(2)}</span>
          <span className={`cart-bar-chevron ${cartExpanded ? 'up' : ''}`}>▲</span>
        </button>
        <button
          className="cart-bar-checkout"
          disabled={cart.length === 0}
          onClick={() => setShowCheckout(true)}
        >
          Cobrar
        </button>
      </div>

      {showCheckout && (
        <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Confirmar Venta</h2>

            <div className="resumen-venta">
              {cart.map((item, i) => (
                <div key={i} className="resumen-row">
                  <span>{item.cantidad}x {item.nombre}</span>
                  <span>${(item.precio * item.cantidad).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label>Número de recibo (papel) *</label>
              <input
                value={numeroRecibo}
                onChange={e => setNumeroRecibo(e.target.value)}
                placeholder="Ej: 0421"
              />
            </div>

            <div className="form-group">
              <label>Cajero *</label>
              <select
                value={selectedEmpleado}
                onChange={e => setSelectedEmpleado(e.target.value)}
              >
                <option value="">Selecciona cajero</option>
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Socio (opcional)</label>
              <select value={selectedSocio} onChange={e => setSelectedSocio(e.target.value)}>
                <option value="">Selecciona socio</option>
                {socios.map(s => (
                  <option key={s.id} value={s.id}>
                    #{s.numero} - {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Método de Pago *</label>
              <div className="payment-methods">
                {(['efectivo', 'tarjeta', 'transferencia'] as const).map(method => (
                  <label key={method} className="radio-option">
                    <input
                      type="radio"
                      name="metodoPago"
                      value={method}
                      checked={metodoPago === method}
                      onChange={e => setMetodoPago(e.target.value as any)}
                    />
                    <span className="capitalize">{method}</span>
                  </label>
                ))}
              </div>
            </div>

            {metodoPago === 'efectivo' && (
              <div className="form-group">
                <label>Paga con *</label>
                <input
                  type="number"
                  step="0.01"
                  value={montoRecibido}
                  onChange={e => setMontoRecibido(e.target.value)}
                  placeholder="0.00"
                />
                {montoRecibido && (
                  <div className="vuelto-info">Vuelto: ${vuelto.toFixed(2)}</div>
                )}
              </div>
            )}

            {metodoPago === 'transferencia' && (
              <>
                <div className="form-group">
                  <label>Número de transferencia *</label>
                  <input
                    value={referencia}
                    onChange={e => setReferencia(e.target.value)}
                    placeholder="Ej: 000123456"
                  />
                </div>
                <div className="form-group">
                  <label>Comprobante</label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    id="foto-comprobante"
                    style={{ display: 'none' }}
                    onChange={handleFotoComprobante}
                  />
                  <label htmlFor="foto-comprobante" className="btn-secondary foto-btn">
                    📷 {comprobanteFoto ? 'Cambiar foto' : 'Tomar foto del comprobante'}
                  </label>
                  {comprobanteFoto && (
                    <img src={comprobanteFoto} alt="Comprobante" className="comprobante-preview" />
                  )}
                </div>
              </>
            )}

            {metodoPago === 'tarjeta' && (
              <>
                <div className="form-group">
                  <label>Banco *</label>
                  <input
                    value={banco}
                    onChange={e => setBanco(e.target.value)}
                    placeholder="Ej: Banco Agrícola"
                  />
                </div>
                <div className="form-group">
                  <label>Número de cupón *</label>
                  <input
                    value={numeroCupon}
                    onChange={e => setNumeroCupon(e.target.value)}
                    placeholder="Ej: 000789"
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label>PIN Cajero *</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="1234"
                maxLength={4}
              />
            </div>

            <div className="modal-total">TOTAL: ${total.toFixed(2)}</div>

            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setShowCheckout(false)}>
                Cancelar
              </button>
              <button
                className="btn-confirm"
                onClick={handleCheckout}
                disabled={pinSubmitting}
              >
                {pinSubmitting ? 'Procesando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
