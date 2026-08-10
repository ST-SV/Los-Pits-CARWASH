import { useEffect, useState } from 'react'
import { useApp } from '../context/useApp'

interface Catalogo {
  servicios: { id: string; nombre: string; precio: number }[]
  productos: { id: string; nombre: string; precio: number; categoria?: string }[]
}

const CATEGORIAS_PRODUCTO = ['Bebidas Frías', 'Bebidas Calientes', 'Snacks', 'Otros']

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
}

interface Socio {
  id: string
  numero: number
  nombre: string
}

export default function Vender() {
  const { cart, addToCart, removeFromCart, updateCartQty, clearCart, toast } = useApp()
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [showCheckout, setShowCheckout] = useState(false)
  const [selectedEmpleado, setSelectedEmpleado] = useState<string>('')
  const [selectedSocio, setSelectedSocio] = useState<string>('')
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo')
  const [pin, setPin] = useState('')
  const [pinSubmitting, setPinSubmitting] = useState(false)

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

  const handleAddItem = (item: { id: string; nombre: string; precio: number }, tipo: 'servicio' | 'producto') => {
    addToCart({ id: item.id, nombre: item.nombre, precio: item.precio, tipo })
  }

  const handleCheckout = async () => {
    if (!selectedEmpleado) {
      toast('Selecciona cajero', 'error')
      return
    }
    if (!pin) {
      toast('Ingresa PIN', 'error')
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
          })),
          empleadoId: selectedEmpleado,
          socioId: selectedSocio || null,
          metodoPago,
          pin,
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
    } catch (error: any) {
      toast(error.message, 'error')
    } finally {
      setPinSubmitting(false)
    }
  }

  const total = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0)

  if (loading) {
    return <div className="loading">Cargando catálogo...</div>
  }

  if (!catalogo) {
    return <div className="empty-state">Error cargando catálogo</div>
  }

  return (
    <div className="vender">
      <h2>Servicios</h2>
      <div className="grid">
        {catalogo.servicios.map(s => (
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

      {cart.length > 0 && (
        <div className="cart-summary">
          <h2>Carrito</h2>
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
              </div>
            ))}
          </div>
          <div className="cart-total">
            <span>TOTAL</span>
            <span className="total-amount">${total.toFixed(2)}</span>
          </div>
          <button
            className="checkout-btn"
            onClick={() => setShowCheckout(true)}
          >
            Registrar Venta
          </button>
        </div>
      )}

      {showCheckout && (
        <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Confirmar Venta</h2>

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
