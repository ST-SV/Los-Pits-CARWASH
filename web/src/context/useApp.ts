import { createContext, useContext, useState, useCallback } from 'react'

interface CartItem {
  id: string
  nombre: string
  precio: number
  cantidad: number
  categoria: string
  lavadorId?: string
  lavadorNombre?: string
}

interface AppContextType {
  authenticated: boolean
  setAuthenticated: (v: boolean) => void
  cart: CartItem[]
  addToCart: (item: CartItem) => void
  removeFromCart: (id: string) => void
  clearCart: () => void
  toast: (msg: string) => void
}

export const AppContext = createContext<AppContextType | null>(null)

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [authenticated, setAuthenticated] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id)
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, cantidad: c.cantidad + 1 } : c))
      }
      return [...prev, item]
    })
  }, [])

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const toast = useCallback((msg: string) => {
    const el = document.getElementById('toast')
    if (el) {
      el.textContent = msg
      el.classList.add('show')
      setTimeout(() => el.classList.remove('show'), 1800)
    }
  }, [])

  return (
    <AppContext.Provider value={{ authenticated, setAuthenticated, cart, addToCart, removeFromCart, clearCart, toast }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
