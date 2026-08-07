import { useEffect, useState } from 'react'
import { useApp } from '../context/useApp'

interface Auto {
  id: string
  modelo: string
}

interface Socio {
  id: string
  numero: number
  nombre: string
  apellido?: string | null
  email?: string | null
  telefono?: string | null
  contacto?: string | null
  autos: Auto[]
}

interface ConsumoItem {
  id: string
  nombre: string
  cantidad: number
}

interface Consumo {
  id: string
  total: number
  metodoPago: string
  fecha: string
  items: ConsumoItem[]
  cajero: { nombre: string }
}

interface Empleado {
  id: string
  nombre: string
}

export default function Socios() {
  const { toast } = useApp()
  const [socios, setSocios] = useState<Socio[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState<Empleado[]>([])

  const [selected, setSelected] = useState<Socio | null>(null)
  const [consumos, setConsumos] = useState<Consumo[] | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Socio | null>(null)
  const [fNombre, setFNombre] = useState('')
  const [fApellido, setFApellido] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fTelefono, setFTelefono] = useState('')
  const [fContacto, setFContacto] = useState('')
  const [fAutos, setFAutos] = useState('')
  const [fActorId, setFActorId] = useState('')
  const [fActorPin, setFActorPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [showDelete, setShowDelete] = useState(false)
  const [delActorId, setDelActorId] = useState('')
  const [delActorPin, setDelActorPin] = useState('')
  const [delMotivo, setDelMotivo] = useState('')

  const loadSocios = (q: string) => {
    setLoading(true)
    fetch(`/api/socios${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .then(r => r.json())
      .then(data => {
        setSocios(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadSocios('')
    fetch('/api/vender/empleados')
      .then(r => r.json())
      .then(setEmpleados)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => loadSocios(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const openDetail = (s: Socio) => {
    setSelected(s)
    setConsumos(null)
    fetch(`/api/socios/${s.id}/consumos`)
      .then(r => r.json())
      .then(setConsumos)
      .catch(() => setConsumos([]))
  }

  const openNew = () => {
    setEditing(null)
    setFNombre('')
    setFApellido('')
    setFEmail('')
    setFTelefono('')
    setFContacto('')
    setFAutos('')
    setFActorId('')
    setFActorPin('')
    setShowForm(true)
  }

  const openEdit = (s: Socio) => {
    setEditing(s)
    setFNombre(s.nombre)
    setFApellido(s.apellido || '')
    setFEmail(s.email || '')
    setFTelefono(s.telefono || '')
    setFContacto(s.contacto || '')
    setFAutos(s.autos.map(a => a.modelo).join(', '))
    setFActorId('')
    setFActorPin('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!fNombre) {
      toast('El nombre es obligatorio', 'error')
      return
    }
    if (editing && (!fActorId || !fActorPin)) {
      toast('Selecciona empleado e ingresa PIN', 'error')
      return
    }
    setSubmitting(true)
    const autos = fAutos
      .split(',')
      .map(a => a.trim())
      .filter(Boolean)
    try {
      if (editing) {
        const res = await fetch(`/api/socios/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: fNombre,
            apellido: fApellido,
            email: fEmail,
            telefono: fTelefono,
            contacto: fContacto,
            autos,
            actorId: fActorId,
            actorPin: fActorPin,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Error al actualizar')
        }
        toast('Socio actualizado', 'success')
      } else {
        const res = await fetch('/api/socios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: fNombre,
            apellido: fApellido,
            email: fEmail,
            telefono: fTelefono,
            contacto: fContacto,
            autos,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Error al crear')
        }
        toast('Socio creado', 'success')
      }
      setShowForm(false)
      setSelected(null)
      loadSocios(query)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!delActorId || !delActorPin || !delMotivo) {
      toast('Completa todos los campos', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/socios/${selected.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: delActorId, actorPin: delActorPin, motivo: delMotivo }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar')
      }
      toast('Socio eliminado', 'success')
      setShowDelete(false)
      setSelected(null)
      setDelActorId('')
      setDelActorPin('')
      setDelMotivo('')
      loadSocios(query)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (selected) {
    return (
      <div className="socios">
        <button className="back-link" onClick={() => setSelected(null)}>
          ← Volver
        </button>
        <h2>
          {selected.nombre} {selected.apellido} · Nº {selected.numero}
        </h2>
        <div className="detail-card">
          <div className="dt-row">
            <span className="k">Teléfono</span>
            <span>{selected.telefono || '-'}</span>
          </div>
          <div className="dt-row">
            <span className="k">Email</span>
            <span>{selected.email || '-'}</span>
          </div>
          <div className="dt-row">
            <span className="k">Contacto</span>
            <span>{selected.contacto || '-'}</span>
          </div>
          <div className="dt-row">
            <span className="k">Autos</span>
            <span>{selected.autos.map(a => a.modelo).join(', ') || '-'}</span>
          </div>
        </div>

        <div className="action-row">
          <button className="btn-secondary" onClick={() => openEdit(selected)}>
            Editar
          </button>
          <button className="btn-danger" onClick={() => setShowDelete(true)}>
            Eliminar
          </button>
        </div>

        <h2>Consumos</h2>
        {consumos === null ? (
          <p className="empty-state">Cargando...</p>
        ) : consumos.length === 0 ? (
          <p className="empty-state">Sin consumos registrados</p>
        ) : (
          <div className="list">
            {consumos.map(c => (
              <div key={c.id} className="list-row static">
                <div className="main">
                  <div className="title">{c.items.map(it => `${it.cantidad}x ${it.nombre}`).join(', ')}</div>
                  <div className="sub">
                    {c.cajero.nombre} · {new Date(c.fecha).toLocaleDateString('es-SV')}
                  </div>
                </div>
                <div className="amount">${c.total.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Editar Socio</h2>
              <div className="form-group">
                <label>Nombre *</label>
                <input value={fNombre} onChange={e => setFNombre(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Apellido</label>
                <input value={fApellido} onChange={e => setFApellido(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input value={fEmail} onChange={e => setFEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input value={fTelefono} onChange={e => setFTelefono(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Contacto</label>
                <input value={fContacto} onChange={e => setFContacto(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Autos (separados por coma)</label>
                <input value={fAutos} onChange={e => setFAutos(e.target.value)} placeholder="Toyota Corolla, Honda Civic" />
              </div>
              <div className="form-group">
                <label>Empleado *</label>
                <select value={fActorId} onChange={e => setFActorId(e.target.value)}>
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
                <input type="password" maxLength={4} value={fActorPin} onChange={e => setFActorPin(e.target.value)} />
              </div>
              <div className="modal-buttons">
                <button className="btn-cancel" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button className="btn-confirm" onClick={handleSave} disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDelete && (
          <div className="modal-overlay" onClick={() => setShowDelete(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Eliminar Socio</h2>
              <div className="form-group">
                <label>Empleado *</label>
                <select value={delActorId} onChange={e => setDelActorId(e.target.value)}>
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
                <input type="password" maxLength={4} value={delActorPin} onChange={e => setDelActorPin(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Motivo *</label>
                <input value={delMotivo} onChange={e => setDelMotivo(e.target.value)} />
              </div>
              <div className="modal-buttons">
                <button className="btn-cancel" onClick={() => setShowDelete(false)}>
                  Cancelar
                </button>
                <button className="btn-confirm" onClick={handleDelete} disabled={submitting}>
                  {submitting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="socios">
      <input
        className="search-input"
        placeholder="Buscar por nombre, apellido o número..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div className="action-row">
        <button className="btn-primary" onClick={openNew}>
          + Nuevo Socio
        </button>
      </div>

      {loading ? (
        <p className="empty-state">Cargando...</p>
      ) : socios.length === 0 ? (
        <p className="empty-state">Sin socios registrados</p>
      ) : (
        <div className="list">
          {socios.map(s => (
            <div key={s.id} className="list-row" onClick={() => openDetail(s)}>
              <div className="main">
                <div className="title">
                  Nº {s.numero} · {s.nombre} {s.apellido}
                </div>
                <div className="sub">{s.telefono || s.email || 'Sin contacto'}</div>
              </div>
              <div className="amount">{s.autos.length} auto(s)</div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nuevo Socio</h2>
            <div className="form-group">
              <label>Nombre *</label>
              <input value={fNombre} onChange={e => setFNombre(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Apellido</label>
              <input value={fApellido} onChange={e => setFApellido(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={fEmail} onChange={e => setFEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={fTelefono} onChange={e => setFTelefono(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Contacto</label>
              <input value={fContacto} onChange={e => setFContacto(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Autos (separados por coma)</label>
              <input value={fAutos} onChange={e => setFAutos(e.target.value)} placeholder="Toyota Corolla, Honda Civic" />
            </div>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleSave} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
