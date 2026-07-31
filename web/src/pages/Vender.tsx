import { useEffect, useState } from 'react'

interface Catalogo {
  servicios: { id: string; nombre: string; precio: number }[]
  productos: { id: string; nombre: string; precio: number }[]
}

export default function Vender() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/vender/catalogo')
      .then(r => r.json())
      .then(data => {
        setCatalogo(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="loading">Cargando catálogo...</div>
  }

  if (!catalogo) {
    return <div className="empty-state">Error cargando catálogo</div>
  }

  return (
    <div>
      <h2>Servicios</h2>
      <div className="grid">
        {catalogo.servicios.map(s => (
          <button key={s.id} className="item-btn">
            <span className="nm">{s.nombre}</span>
            <span className="pr">${s.precio.toFixed(2)}</span>
          </button>
        ))}
      </div>

      <h2>Cafetería</h2>
      <div className="grid">
        {catalogo.productos.map(p => (
          <button key={p.id} className="item-btn">
            <span className="nm">{p.nombre}</span>
            <span className="pr">${p.precio.toFixed(2)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
