import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface CartItem {
  id: string
  nombre: string
  precio: number
  cantidad: number
  tipo?: 'servicio' | 'producto' | 'cuenta'
  categoria?: string
  lavadorId?: string
  lavadorNombre?: string
  lavadorIds?: string[]
}

interface AppContextType {
  authenticated: boolean
  setAuthenticated: (v: boolean) => void
  cart: CartItem[]
  addToCart: (item: Omit<CartItem, 'cantidad'>) => void
  removeFromCart: (index: number) => void
  updateCartQty: (index: number, cantidad: number) => void
  updateCartLavadores: (index: number, lavadorIds: string[]) => void
  clearCart: () => void
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export const AppContext = createContext<AppContextType | null>(null)

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [authenticated, setAuthenticated] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])

  const addToCart = useCallback((item: Omit<CartItem, 'cantidad'>) => {
    setCart((prev) => {
      const existing = prev.findIndex((c) => c.id === item.id && c.tipo === item.tipo)
      if (existing >= 0) {
        const newCart = [...prev]
        newCart[existing].cantidad += 1
        return newCart
      }
      return [...prev, { ...item, cantidad: 1 }]
    })
  }, [])

  const removeFromCart = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateCartQty = useCallback((index: number, cantidad: number) => {
    if (cantidad <= 0) return
    setCart((prev) => {
      const newCart = [...prev]
      newCart[index].cantidad = cantidad
      return newCart
    })
  }, [])

  const updateCartLavadores = useCallback((index: number, lavadorIds: string[]) => {
    setCart((prev) => {
      const newCart = [...prev]
      newCart[index] = { ...newCart[index], lavadorIds }
      return newCart
    })
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const toast = useCallback((msg: string, type = 'info') => {
    const el = document.getElementById('toast')
    if (el) {
      el.textContent = msg
      el.className = `toast show toast-${type}`
      setTimeout(() => el.classList.remove('show'), 1800)
    }
  }, [])

  const value: AppContextType = {
    authenticated,
    setAuthenticated,
    cart,
    addToCart,
    removeFromCart,
    updateCartQty,
    updateCartLavadores,
    clearCart,
    toast,
  }

  return React.createElement(AppContext.Provider, { value }, children)
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
