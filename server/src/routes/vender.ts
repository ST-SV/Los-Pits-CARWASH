import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { verifyPin } from '../utils/auth.js'

const router = Router()
const prisma = new PrismaClient()

export const venderRouter = router

// GET catalogo
router.get('/catalogo', async (req: Request, res: Response) => {
  try {
    const [servicios, productos] = await Promise.all([
      prisma.catalogoServicio.findMany(),
      prisma.catalogoProducto.findMany(),
    ])
    res.json({ servicios, productos })
  } catch (error) {
    console.error('Error fetching catalog:', error)
    res.status(500).json({ error: 'Failed to fetch catalog' })
  }
})

// POST venta (crear venta con PIN confirm)
router.post('/venta', async (req: Request, res: Response) => {
  try {
    const {
      items,
      metodoPago,
      empleadoId,
      pin,
      socioId,
      numeroRecibo,
      referencia,
      montoRecibido,
      banco,
      numeroCupon,
      comprobanteFoto,
    } = req.body

    if (!items || !metodoPago || !empleadoId || !pin || !numeroRecibo) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (metodoPago === 'efectivo' && (montoRecibido === undefined || montoRecibido === null)) {
      return res.status(400).json({ error: 'Falta el monto recibido' })
    }
    if (metodoPago === 'transferencia' && !referencia) {
      return res.status(400).json({ error: 'Falta el número de transferencia' })
    }
    if (metodoPago === 'tarjeta' && (!banco || !numeroCupon)) {
      return res.status(400).json({ error: 'Falta el banco o el número de cupón' })
    }

    // Verify empleado exists and PIN is correct
    const empleado = await prisma.empleado.findUnique({
      where: { id: empleadoId },
    })

    if (!empleado || !empleado.pinHash) {
      return res.status(400).json({ error: 'Empleado not found or has no PIN' })
    }

    const pinMatch = await verifyPin(pin, empleado.pinHash)
    if (!pinMatch) {
      return res.status(401).json({ error: 'Invalid PIN' })
    }

    // Fetch items from catalog to calculate total
    const ventaItems: any[] = []
    let total = 0

    for (const item of items) {
      if (item.catalogoServicioId) {
        const servicio = await prisma.catalogoServicio.findUnique({
          where: { id: item.catalogoServicioId },
        })
        if (!servicio) {
          return res.status(404).json({ error: `Servicio ${item.catalogoServicioId} not found` })
        }
        ventaItems.push({
          nombre: servicio.nombre,
          precio: servicio.precio,
          cantidad: item.cantidad,
          categoria: 'servicio',
        })
        total += servicio.precio * item.cantidad
      } else if (item.catalogoProductoId) {
        const producto = await prisma.catalogoProducto.findUnique({
          where: { id: item.catalogoProductoId },
        })
        if (!producto) {
          return res.status(404).json({ error: `Producto ${item.catalogoProductoId} not found` })
        }
        ventaItems.push({
          nombre: producto.nombre,
          precio: producto.precio,
          cantidad: item.cantidad,
          categoria: 'producto',
        })
        total += producto.precio * item.cantidad
      }
    }

    const vuelto = metodoPago === 'efectivo' ? Math.max(0, montoRecibido - total) : null

    // Create venta
    const venta = await prisma.venta.create({
      data: {
        numeroRecibo,
        total,
        metodoPago,
        referencia: metodoPago === 'transferencia' ? referencia : null,
        montoRecibido: metodoPago === 'efectivo' ? montoRecibido : null,
        vuelto,
        banco: metodoPago === 'tarjeta' ? banco : null,
        numeroCupon: metodoPago === 'tarjeta' ? numeroCupon : null,
        comprobanteFoto: metodoPago === 'transferencia' ? comprobanteFoto || null : null,
        cajeroId: empleadoId,
        socioId: socioId || null,
        items: {
          create: ventaItems,
        },
      },
      include: {
        items: true,
        cajero: true,
      },
    })

    // Log audit
    const itemsResumen = venta.items.map((it: any) => `${it.cantidad}x ${it.nombre}`).join(', ')
    await prisma.auditLog.create({
      data: {
        actor: empleado.nombre,
        accion: 'Venta registrada',
        detalle: `Recibo ${numeroRecibo} · $${total.toFixed(2)} · ${metodoPago} · ${itemsResumen}`,
        actorId: empleadoId,
      },
    })

    res.json(venta)
  } catch (error) {
    console.error('Error creating venta:', error)
    res.status(500).json({ error: 'Failed to create venta' })
  }
})

// GET cuentas abiertas
router.get('/cuentas', async (req: Request, res: Response) => {
  try {
    const cuentas = await prisma.cuentaAbierta.findMany({
      include: {
        items: true,
        socio: true,
      },
      orderBy: {
        fechaApertura: 'desc',
      },
    })
    res.json(cuentas)
  } catch (error) {
    console.error('Error fetching cuentas:', error)
    res.status(500).json({ error: 'Failed to fetch cuentas' })
  }
})

// POST crear cuenta abierta
router.post('/cuentas', async (req: Request, res: Response) => {
  try {
    const { etiqueta, items, socioId } = req.body

    if (!etiqueta || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const cuenta = await prisma.cuentaAbierta.create({
      data: {
        etiqueta,
        socioId: socioId || null,
        items: {
          create: items.map((item: any) => ({
            nombre: item.nombre,
            precio: item.precio,
            cantidad: item.cantidad,
            categoria: item.categoria,
            lavadorId: item.lavadorId || null,
            lavadorNombre: item.lavadorNombre || null,
          })),
        },
      },
      include: {
        items: true,
        socio: true,
      },
    })

    res.json(cuenta)
  } catch (error) {
    console.error('Error creating cuenta:', error)
    res.status(500).json({ error: 'Failed to create cuenta' })
  }
})

// PUT actualizar cuenta abierta
router.put('/cuentas/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { items } = req.body

    const cuenta = await prisma.cuentaAbierta.update({
      where: { id },
      data: {
        items: {
          deleteMany: {},
          create: items.map((item: any) => ({
            nombre: item.nombre,
            precio: item.precio,
            cantidad: item.cantidad,
            categoria: item.categoria,
            lavadorId: item.lavadorId || null,
            lavadorNombre: item.lavadorNombre || null,
          })),
        },
      },
      include: {
        items: true,
        socio: true,
      },
    })

    res.json(cuenta)
  } catch (error) {
    console.error('Error updating cuenta:', error)
    res.status(500).json({ error: 'Failed to update cuenta' })
  }
})

// DELETE cuenta abierta
router.delete('/cuentas/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    await prisma.cuentaAbierta.delete({
      where: { id },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting cuenta:', error)
    res.status(500).json({ error: 'Failed to delete cuenta' })
  }
})

// POST checkout cuenta abierta (convertir a venta)
router.post('/cuentas/:id/checkout', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const {
      cajeroId,
      cajeroPin,
      numeroRecibo,
      referencia,
      metodoPago,
      montoRecibido,
      banco,
      numeroCupon,
      comprobanteFoto,
    } = req.body

    if (!cajeroId || !cajeroPin || !numeroRecibo || !metodoPago) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Verify PIN
    const cajero = await prisma.empleado.findUnique({
      where: { id: cajeroId },
    })

    if (!cajero || !cajero.pinHash) {
      return res.status(400).json({ error: 'Cajero not found or has no PIN' })
    }

    const pinMatch = await verifyPin(cajeroPin, cajero.pinHash)
    if (!pinMatch) {
      return res.status(401).json({ error: 'Invalid PIN' })
    }

    // Get cuenta
    const cuenta = await prisma.cuentaAbierta.findUnique({
      where: { id },
      include: { items: true, socio: true },
    })

    if (!cuenta) {
      return res.status(404).json({ error: 'Cuenta not found' })
    }

    // Calculate total
    const total = cuenta.items.reduce((sum: number, item: any) => sum + item.precio * item.cantidad, 0)

    const vuelto = metodoPago === 'efectivo' ? Math.max(0, montoRecibido - total) : null

    // Create venta from cuenta
    const venta = await prisma.venta.create({
      data: {
        numeroRecibo,
        referencia: metodoPago === 'transferencia' ? referencia : null,
        montoRecibido: metodoPago === 'efectivo' ? montoRecibido : null,
        vuelto,
        banco: metodoPago === 'tarjeta' ? banco : null,
        numeroCupon: metodoPago === 'tarjeta' ? numeroCupon : null,
        comprobanteFoto: metodoPago === 'transferencia' ? comprobanteFoto || null : null,
        total,
        metodoPago,
        cajeroId,
        socioId: cuenta.socioId,
        items: {
          create: cuenta.items.map((item: any) => ({
            nombre: item.nombre,
            precio: item.precio,
            cantidad: item.cantidad,
            categoria: item.categoria,
            lavadorId: item.lavadorId || null,
          })),
        },
      },
      include: { items: true },
    })

    // Delete cuenta
    await prisma.cuentaAbierta.delete({
      where: { id },
    })

    // Log audit
    const itemsResumen = venta.items.map((it: any) => `${it.cantidad}x ${it.nombre}`).join(', ')
    await prisma.auditLog.create({
      data: {
        actor: cajero.nombre,
        accion: 'Venta registrada (desde cuenta abierta)',
        detalle: `Recibo ${numeroRecibo} · $${total.toFixed(2)} · ${metodoPago} · ${itemsResumen}`,
        actorId: cajeroId,
      },
    })

    res.json(venta)
  } catch (error) {
    console.error('Error checking out cuenta:', error)
    res.status(500).json({ error: 'Failed to checkout cuenta' })
  }
})

// GET empleados (lavadores para servicio)
router.get('/empleados', async (req: Request, res: Response) => {
  try {
    const empleados = await prisma.empleado.findMany({
      where: {
        role: {
          in: ['lavador', 'recepcion'],
        },
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        role: true,
      },
    })
    res.json(empleados)
  } catch (error) {
    console.error('Error fetching empleados:', error)
    res.status(500).json({ error: 'Failed to fetch empleados' })
  }
})

// GET socios (para asociar venta)
router.get('/socios', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || ''
    const socios = await prisma.socio.findMany({
      where: query
        ? {
            OR: [
              { nombre: { contains: query } },
              { apellido: { contains: query } },
              { numero: parseInt(query) || undefined },
            ],
          }
        : {},
      include: { autos: true },
      orderBy: { numero: 'desc' },
    })
    res.json(socios)
  } catch (error) {
    console.error('Error fetching socios:', error)
    res.status(500).json({ error: 'Failed to fetch socios' })
  }
})
