import { useEffect, useState } from 'react'
import { useApp } from '../context/useApp'

type SubTab = 'historial' | 'contabilidad' | 'empleados' | 'catalogo' | 'auditoria' | 'config'

interface Cierre {
  id: string
  fecha: string
  totalVentas: number
  totalGastos: number
  neto: number
}

interface Historial {
  week: { sales: number; net: number }
  fortnight: { sales: number; net: number }
  month: { sales: number; net: number }
  cierres: Cierre[]
}

interface Diario {
  fecha: string
  ventas: number
  nomina: number
  otros: number
  neto: number
}

interface Contabilidad {
  hoy: { ventas: number; nomina: number; otros: number; neto: number }
  acumulado: { ingresos: number; nomina: number; otros: number; egreso: number; ganancia: number }
  diarios: Diario[]
}

interface Empleado {
  id: string
  nombre: string
  apellido?: string | null
  role: string
  dui?: string | null
  email?: string | null
  telefono?: string | null
  emergName?: string | null
  emergPhone?: string | null
  horario?: string | null
  sueldoQuincenal?: number | null
  sueldoMensual?: number | null
  comisionPercent?: number | null
  comisionThreshold?: number | null
}

interface CatalogoItem {
  id: string
  nombre: string
  precio: number
}

interface Catalogo {
  servicios: CatalogoItem[]
  productos: CatalogoItem[]
}

interface AuditEntry {
  id: string
  actor: string
  accion: string
  detalle?: string | null
  fecha: string
}

export default function Admin() {
  const { toast } = useApp()
  const [unlocked, setUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [tab, setTab] = useState<SubTab>('historial')

  const [historial, setHistorial] = useState<Historial | null>(null)
  const [contabilidad, setContabilidad] = useState<Contabilidad | null>(null)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [auditoria, setAuditoria] = useState<AuditEntry[] | null>(null)

  const [empForm, setEmpForm] = useState<Partial<Empleado> & { pin?: string }>({})
  const [showEmpForm, setShowEmpForm] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Empleado | null>(null)

  const [catForm, setCatForm] = useState<{ tipo: 'servicio' | 'producto'; nombre: string; precio: string; id?: string } | null>(null)

  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleUnlock = async () => {
    if (!pinInput) return
    try {
      const res = await fetch(`/api/admin/historial?adminPin=${encodeURIComponent(pinInput)}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'PIN incorrecto')
      }
      setAdminPin(pinInput)
      setUnlocked(true)
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  useEffect(() => {
    if (!unlocked) return
    loadTab(tab)
  }, [unlocked, tab])

  const loadTab = (t: SubTab) => {
    if (t === 'historial') {
      fetch(`/api/admin/historial?adminPin=${encodeURIComponent(adminPin)}`)
        .then(r => r.json())
        .then(setHistorial)
        .catch(() => {})
    } else if (t === 'contabilidad') {
      fetch(`/api/admin/contabilidad?adminPin=${encodeURIComponent(adminPin)}`)
        .then(r => r.json())
        .then(setContabilidad)
        .catch(() => {})
    } else if (t === 'empleados') {
      fetch(`/api/admin/empleados?adminPin=${encodeURIComponent(adminPin)}`)
        .then(r => r.json())
        .then(setEmpleados)
        .catch(() => {})
    } else if (t === 'catalogo') {
      fetch(`/api/admin/catalogo?adminPin=${encodeURIComponent(adminPin)}`)
        .then(r => r.json())
        .then(setCatalogo)
        .catch(() => {})
    } else if (t === 'auditoria') {
      fetch(`/api/admin/auditoria?adminPin=${encodeURIComponent(adminPin)}`)
        .then(r => r.json())
        .then(setAuditoria)
        .catch(() => {})
    }
  }

  const openNewEmp = () => {
    setEditingEmp(null)
    setEmpForm({ role: 'lavador' })
    setShowEmpForm(true)
  }

  const openEditEmp = (e: Empleado) => {
    setEditingEmp(e)
    setEmpForm({ ...e })
    setShowEmpForm(true)
  }

  const handleSaveEmp = async () => {
    if (!empForm.nombre || !empForm.role) {
      toast('Nombre y rol son obligatorios', 'error')
      return
    }
    setSubmitting(true)
    try {
      const body: any = { adminPin, ...empForm }
      const res = await fetch(editingEmp ? `/api/admin/empleados/${editingEmp.id}` : '/api/admin/empleados', {
        method: editingEmp ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar empleado')
      }
      toast('Empleado guardado', 'success')
      setShowEmpForm(false)
      loadTab('empleados')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteEmp = async (id: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/empleados/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar')
      }
      toast('Empleado eliminado', 'success')
      loadTab('empleados')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveCat = async () => {
    if (!catForm || !catForm.nombre || !catForm.precio) {
      toast('Completa nombre y precio', 'error')
      return
    }
    setSubmitting(true)
    try {
      const url = catForm.id
        ? `/api/admin/catalogo/${catForm.tipo}/${catForm.id}`
        : `/api/admin/catalogo/${catForm.tipo}`
      const res = await fetch(url, {
        method: catForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin, nombre: catForm.nombre, precio: parseFloat(catForm.precio) }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }
      toast('Guardado', 'success')
      setCatForm(null)
      loadTab('catalogo')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCat = async (tipo: 'servicio' | 'producto', id: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/catalogo/${tipo}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar')
      }
      toast('Eliminado', 'success')
      loadTab('catalogo')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChangePin = async () => {
    if (!oldPin || !newPin) {
      toast('Completa ambos PINs', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/config/admin-pin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPin, newPin }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al cambiar PIN')
      }
      toast('PIN actualizado', 'success')
      setAdminPin(newPin)
      setOldPin('')
      setNewPin('')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!unlocked) {
    return (
      <div className="pin-gate">
        <h2>Administración</h2>
        <p className="empty-state">Ingresa el PIN de administrador</p>
        <input
          type="password"
          maxLength={4}
          value={pinInput}
          onChange={e => setPinInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          placeholder="••••"
        />
        <button className="btn-primary" onClick={handleUnlock} style={{ maxWidth: 160 }}>
          Desbloquear
        </button>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="subnav">
        {(['historial', 'contabilidad', 'empleados', 'catalogo', 'auditoria', 'config'] as SubTab[]).map(t => (
          <button key={t} className={`subnav-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'historial' && (
        <div>
          {!historial ? (
            <p className="empty-state">Cargando...</p>
          ) : (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="label">Semana</div>
                  <div className="value yellow">${historial.week.sales.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Neto semana</div>
                  <div className="value green">${historial.week.net.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Quincena</div>
                  <div className="value yellow">${historial.fortnight.sales.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Neto quincena</div>
                  <div className="value green">${historial.fortnight.net.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Mes</div>
                  <div className="value yellow">${historial.month.sales.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Neto mes</div>
                  <div className="value green">${historial.month.net.toFixed(2)}</div>
                </div>
              </div>
              <h2>Cierres de caja</h2>
              {historial.cierres.length === 0 ? (
                <p className="empty-state">Sin cierres registrados</p>
              ) : (
                <div className="list">
                  {historial.cierres.map(c => (
                    <div key={c.id} className="list-row static">
                      <div className="main">
                        <div className="title">{new Date(c.fecha).toLocaleDateString('es-SV')}</div>
                        <div className="sub">
                          Ventas ${c.totalVentas.toFixed(2)} · Gastos ${c.totalGastos.toFixed(2)}
                        </div>
                      </div>
                      <div className="amount">${c.neto.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'contabilidad' && (
        <div>
          {!contabilidad ? (
            <p className="empty-state">Cargando...</p>
          ) : (
            <>
              <h2>Hoy</h2>
              <div className="detail-card">
                <div className="dt-row">
                  <span className="k">Ventas</span>
                  <span>${contabilidad.hoy.ventas.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Nómina</span>
                  <span>${contabilidad.hoy.nomina.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Otros gastos</span>
                  <span>${contabilidad.hoy.otros.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Neto</span>
                  <span>${contabilidad.hoy.neto.toFixed(2)}</span>
                </div>
              </div>
              <h2>Acumulado</h2>
              <div className="detail-card">
                <div className="dt-row">
                  <span className="k">Ingresos</span>
                  <span>${contabilidad.acumulado.ingresos.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Nómina</span>
                  <span>${contabilidad.acumulado.nomina.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Otros</span>
                  <span>${contabilidad.acumulado.otros.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Egreso total</span>
                  <span>${contabilidad.acumulado.egreso.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Ganancia</span>
                  <span>${contabilidad.acumulado.ganancia.toFixed(2)}</span>
                </div>
              </div>
              <h2>Diario</h2>
              {contabilidad.diarios.length === 0 ? (
                <p className="empty-state">Sin datos</p>
              ) : (
                <div className="list">
                  {contabilidad.diarios.map((d, i) => (
                    <div key={i} className="list-row static">
                      <div className="main">
                        <div className="title">{new Date(d.fecha).toLocaleDateString('es-SV')}</div>
                        <div className="sub">
                          Ventas ${d.ventas.toFixed(2)} · Nómina ${d.nomina.toFixed(2)} · Otros ${d.otros.toFixed(2)}
                        </div>
                      </div>
                      <div className="amount">${d.neto.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'empleados' && (
        <div>
          <div className="action-row">
            <button className="btn-primary" onClick={openNewEmp}>
              + Nuevo Empleado
            </button>
          </div>
          {empleados.length === 0 ? (
            <p className="empty-state">Sin empleados</p>
          ) : (
            <div className="list">
              {empleados.map(e => (
                <div key={e.id} className="list-row" onClick={() => openEditEmp(e)}>
                  <div className="main">
                    <div className="title">
                      {e.nombre} {e.apellido}
                    </div>
                    <div className="sub">{e.role}</div>
                  </div>
                  <button
                    className="btn-danger"
                    onClick={ev => {
                      ev.stopPropagation()
                      handleDeleteEmp(e.id)
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'catalogo' && (
        <div>
          <div className="action-row">
            <button className="btn-secondary" onClick={() => setCatForm({ tipo: 'servicio', nombre: '', precio: '' })}>
              + Servicio
            </button>
            <button className="btn-secondary" onClick={() => setCatForm({ tipo: 'producto', nombre: '', precio: '' })}>
              + Producto
            </button>
          </div>
          <h2>Servicios</h2>
          {!catalogo || catalogo.servicios.length === 0 ? (
            <p className="empty-state">Sin servicios</p>
          ) : (
            <div className="list">
              {catalogo.servicios.map(s => (
                <div
                  key={s.id}
                  className="list-row"
                  onClick={() => setCatForm({ tipo: 'servicio', nombre: s.nombre, precio: String(s.precio), id: s.id })}
                >
                  <div className="main">
                    <div className="title">{s.nombre}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="amount">${s.precio.toFixed(2)}</div>
                    <button
                      className="btn-danger"
                      onClick={ev => {
                        ev.stopPropagation()
                        handleDeleteCat('servicio', s.id)
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <h2>Productos</h2>
          {!catalogo || catalogo.productos.length === 0 ? (
            <p className="empty-state">Sin productos</p>
          ) : (
            <div className="list">
              {catalogo.productos.map(p => (
                <div
                  key={p.id}
                  className="list-row"
                  onClick={() => setCatForm({ tipo: 'producto', nombre: p.nombre, precio: String(p.precio), id: p.id })}
                >
                  <div className="main">
                    <div className="title">{p.nombre}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="amount">${p.precio.toFixed(2)}</div>
                    <button
                      className="btn-danger"
                      onClick={ev => {
                        ev.stopPropagation()
                        handleDeleteCat('producto', p.id)
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'auditoria' && (
        <div>
          {!auditoria ? (
            <p className="empty-state">Cargando...</p>
          ) : auditoria.length === 0 ? (
            <p className="empty-state">Sin registros</p>
          ) : (
            <div className="list">
              {auditoria.map(a => (
                <div key={a.id} className="list-row static">
                  <div className="main">
                    <div className="title">{a.accion}</div>
                    <div className="sub">
                      {a.actor} · {a.detalle} · {new Date(a.fecha).toLocaleString('es-SV')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'config' && (
        <div>
          <h2>Cambiar PIN de Administrador</h2>
          <div className="form-group">
            <label>PIN actual</label>
            <input type="password" maxLength={4} value={oldPin} onChange={e => setOldPin(e.target.value)} />
          </div>
          <div className="form-group">
            <label>PIN nuevo</label>
            <input type="password" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={handleChangePin} disabled={submitting} style={{ maxWidth: 200 }}>
            {submitting ? 'Guardando...' : 'Actualizar PIN'}
          </button>
        </div>
      )}

      {showEmpForm && (
        <div className="modal-overlay" onClick={() => setShowEmpForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingEmp ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
            <div className="form-group">
              <label>Nombre *</label>
              <input value={empForm.nombre || ''} onChange={e => setEmpForm({ ...empForm, nombre: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Apellido</label>
              <input value={empForm.apellido || ''} onChange={e => setEmpForm({ ...empForm, apellido: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Rol *</label>
              <select value={empForm.role || 'lavador'} onChange={e => setEmpForm({ ...empForm, role: e.target.value })}>
                <option value="lavador">Lavador</option>
                <option value="recepcion">Recepción</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label>{editingEmp ? 'Nuevo PIN (opcional)' : 'PIN *'}</label>
              <input type="password" maxLength={4} value={empForm.pin || ''} onChange={e => setEmpForm({ ...empForm, pin: e.target.value })} />
            </div>
            <div className="form-group">
              <label>DUI</label>
              <input value={empForm.dui || ''} onChange={e => setEmpForm({ ...empForm, dui: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={empForm.email || ''} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={empForm.telefono || ''} onChange={e => setEmpForm({ ...empForm, telefono: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Contacto de emergencia</label>
              <input value={empForm.emergName || ''} onChange={e => setEmpForm({ ...empForm, emergName: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Teléfono de emergencia</label>
              <input value={empForm.emergPhone || ''} onChange={e => setEmpForm({ ...empForm, emergPhone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Horario</label>
              <input value={empForm.horario || ''} onChange={e => setEmpForm({ ...empForm, horario: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Sueldo quincenal</label>
              <input
                type="number"
                step="0.01"
                value={empForm.sueldoQuincenal ?? ''}
                onChange={e => setEmpForm({ ...empForm, sueldoQuincenal: parseFloat(e.target.value) || undefined })}
              />
            </div>
            <div className="form-group">
              <label>Sueldo mensual</label>
              <input
                type="number"
                step="0.01"
                value={empForm.sueldoMensual ?? ''}
                onChange={e => setEmpForm({ ...empForm, sueldoMensual: parseFloat(e.target.value) || undefined })}
              />
            </div>
            <div className="form-group">
              <label>Comisión %</label>
              <input
                type="number"
                step="0.1"
                value={empForm.comisionPercent ?? ''}
                onChange={e => setEmpForm({ ...empForm, comisionPercent: parseFloat(e.target.value) || undefined })}
              />
            </div>
            <div className="form-group">
              <label>Umbral de comisión</label>
              <input
                type="number"
                step="0.01"
                value={empForm.comisionThreshold ?? ''}
                onChange={e => setEmpForm({ ...empForm, comisionThreshold: parseFloat(e.target.value) || undefined })}
              />
            </div>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setShowEmpForm(false)}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleSaveEmp} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {catForm && (
        <div className="modal-overlay" onClick={() => setCatForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{catForm.id ? 'Editar' : 'Nuevo'} {catForm.tipo === 'servicio' ? 'Servicio' : 'Producto'}</h2>
            <div className="form-group">
              <label>Nombre *</label>
              <input value={catForm.nombre} onChange={e => setCatForm({ ...catForm, nombre: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Precio *</label>
              <input type="number" step="0.01" value={catForm.precio} onChange={e => setCatForm({ ...catForm, precio: e.target.value })} />
            </div>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setCatForm(null)}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleSaveCat} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
