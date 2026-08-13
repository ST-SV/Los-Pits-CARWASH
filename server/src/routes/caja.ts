import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { verifyPin } from '../utils/auth.js'

const isDiaCerrado = async (prisma: PrismaClient, fecha: Date) => {
  const dia = new Date(fecha)
  dia.setHours(0, 0, 0, 0)
  const cierre = await prisma.cierreDeCaja.findUnique({ where: { fecha: dia } })
  return !!cierre
}

const router = Router()
const prisma = new PrismaClient()

export const cajaRouter = router

// GET resumen del día actual
router.get('/resumen', async (req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [ventasActivas, gastos] = await Promise.all([
      prisma.venta.findMany({
        where: {
          fecha: {
            gte: today,
            lt: tomorrow,
          },
          anulada: false,
        },
        include: { items: true },
      }),
      prisma.gasto.findMany({
        where: {
          fecha: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
    ])

    const totalVentas = ventasActivas.reduce((sum: number, v: any) => sum + v.total, 0)
    const totalGastos = gastos.reduce((sum: number, g: any) => sum + g.monto, 0)
    const neto = totalVentas - totalGastos

    const byPay = {
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
    }

    ventasActivas.forEach((v: any) => {
      ;(byPay as any)[v.metodoPago] = ((byPay as any)[v.metodoPago] || 0) + v.total
    })

    const cierre = await prisma.cierreDeCaja.findUnique({ where: { fecha: today } })

    res.json({
      ventasCount: ventasActivas.length,
      totalVentas,
      totalGastos,
      neto,
      byPay,
      ventas: ventasActivas,
      gastos,
      cierre,
    })
  } catch (error) {
    console.error('Error fetching caja resumen:', error)
    res.status(500).json({ error: 'Failed to fetch caja resumen' })
  }
})

// POST crear gasto
router.post('/gasto', async (req: Request, res: Response) => {
  try {
    const { descripcion, monto, registradoPorId, registradoPorPin } = req.body

    if (!descripcion || !monto || !registradoPorId || !registradoPorPin) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Verify PIN
    const empleado = await prisma.empleado.findUnique({
      where: { id: registradoPorId },
    })

    if (!empleado || !empleado.pinHash) {
      return res.status(400).json({ error: 'Empleado not found or has no PIN' })
    }

    const pinMatch = await verifyPin(registradoPorPin, empleado.pinHash)
    if (!pinMatch) {
      return res.status(401).json({ error: 'Invalid PIN' })
    }

    const gasto = await prisma.gasto.create({
      data: {
        descripcion,
        monto,
        categoria: 'otro',
        registradoPor: empleado.nombre,
        registradoPorId: empleado.id,
      },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        actor: empleado.nombre,
        accion: 'Gasto registrado',
        detalle: `${descripcion} · $${monto.toFixed(2)}`,
        actorId: empleado.id,
      },
    })

    res.json(gasto)
  } catch (error) {
    console.error('Error creating gasto:', error)
    res.status(500).json({ error: 'Failed to create gasto' })
  }
})

// DELETE gasto (requires PIN + motivo)
router.delete('/gasto/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { registradoPorId, registradoPorPin, motivo } = req.body

    if (!registradoPorId || !registradoPorPin || !motivo) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const gasto = await prisma.gasto.findUnique({ where: { id } })
    if (!gasto) {
      return res.status(404).json({ error: 'Gasto not found' })
    }

    // Verify PIN
    const empleado = await prisma.empleado.findUnique({
      where: { id: registradoPorId },
    })

    if (!empleado || !empleado.pinHash) {
      return res.status(400).json({ error: 'Empleado not found or has no PIN' })
    }

    const pinMatch = await verifyPin(registradoPorPin, empleado.pinHash)
    if (!pinMatch) {
      return res.status(401).json({ error: 'Invalid PIN' })
    }

    if ((await isDiaCerrado(prisma, gasto.fecha)) && empleado.role !== 'socio') {
      return res.status(403).json({ error: 'La caja de ese día ya fue cerrada. Solo un administrador puede eliminar este gasto.' })
    }

    await prisma.gasto.delete({ where: { id } })

    // Log audit
    await prisma.auditLog.create({
      data: {
        actor: empleado.nombre,
        accion: 'Gasto eliminado',
        detalle: `${gasto.descripcion} · $${gasto.monto.toFixed(2)} · Motivo: ${motivo}`,
        actorId: empleado.id,
      },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting gasto:', error)
    res.status(500).json({ error: 'Failed to delete gasto' })
  }
})

// POST anular venta
router.post('/venta/:id/anular', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { anuladoPorId, anuladoPorPin, motivo } = req.body

    if (!anuladoPorId || !anuladoPorPin || !motivo) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const venta = await prisma.venta.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!venta) {
      return res.status(404).json({ error: 'Venta not found' })
    }

    if (venta.anulada) {
      return res.status(400).json({ error: 'Venta already annulled' })
    }

    // Verify PIN
    const empleado = await prisma.empleado.findUnique({
      where: { id: anuladoPorId },
    })

    if (!empleado || !empleado.pinHash) {
      return res.status(400).json({ error: 'Empleado not found or has no PIN' })
    }

    const pinMatch = await verifyPin(anuladoPorPin, empleado.pinHash)
    if (!pinMatch) {
      return res.status(401).json({ error: 'Invalid PIN' })
    }

    if ((await isDiaCerrado(prisma, venta.fecha)) && empleado.role !== 'socio') {
      return res.status(403).json({ error: 'La caja de ese día ya fue cerrada. Solo un administrador puede anular esta venta.' })
    }

    const updated = await prisma.venta.update({
      where: { id },
      data: {
        anulada: true,
        anuladaPor: empleado.nombre,
        anuladaTime: new Date(),
        anuladaMotivo: motivo,
      },
      include: { items: true },
    })

    // Log audit
    const itemsResumen = venta.items.map((it: any) => `${it.cantidad}x ${it.nombre}`).join(', ')
    await prisma.auditLog.create({
      data: {
        actor: empleado.nombre,
        accion: 'Venta anulada',
        detalle: `Recibo ${venta.numeroRecibo} · $${venta.total.toFixed(2)} · ${itemsResumen} · Motivo: ${motivo}`,
        actorId: empleado.id,
      },
    })

    res.json(updated)
  } catch (error) {
    console.error('Error annulling venta:', error)
    res.status(500).json({ error: 'Failed to annul venta' })
  }
})

// POST cerrar caja del día
router.post('/cerrar', async (req: Request, res: Response) => {
  try {
    const { cerradorId, cerradorPin } = req.body

    if (!cerradorId || !cerradorPin) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Verify PIN
    const empleado = await prisma.empleado.findUnique({
      where: { id: cerradorId },
    })

    if (!empleado || !empleado.pinHash) {
      return res.status(400).json({ error: 'Empleado not found or has no PIN' })
    }

    const pinMatch = await verifyPin(cerradorPin, empleado.pinHash)
    if (!pinMatch) {
      return res.status(401).json({ error: 'Invalid PIN' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get today's ventas and gastos
    const [ventasActivas, gastos] = await Promise.all([
      prisma.venta.findMany({
        where: {
          fecha: {
            gte: today,
            lt: tomorrow,
          },
          anulada: false,
        },
      }),
      prisma.gasto.findMany({
        where: {
          fecha: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
    ])

    const totalVentas = ventasActivas.reduce((sum: number, v: any) => sum + v.total, 0)
    const totalGastos = gastos.reduce((sum: number, g: any) => sum + g.monto, 0)
    const neto = totalVentas - totalGastos

    const byPay = {
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
    }

    ventasActivas.forEach((v: any) => {
      ;(byPay as any)[v.metodoPago] = ((byPay as any)[v.metodoPago] || 0) + v.total
    })

    // Create o actualizar cierre (idempotente: reintentar el cierre del mismo día no falla)
    const cierre = await prisma.cierreDeCaja.upsert({
      where: { fecha: today },
      create: {
        fecha: today,
        totalVentas,
        totalGastos,
        neto,
        ventasCount: ventasActivas.length,
        byPayEffectivo: byPay.efectivo,
        byPayTarjeta: byPay.tarjeta,
        byPayTransferencia: byPay.transferencia,
        cerradoPor: empleado.nombre,
      },
      update: {
        totalVentas,
        totalGastos,
        neto,
        ventasCount: ventasActivas.length,
        byPayEffectivo: byPay.efectivo,
        byPayTarjeta: byPay.tarjeta,
        byPayTransferencia: byPay.transferencia,
        cerradoPor: empleado.nombre,
      },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        actor: empleado.nombre,
        accion: 'Caja cerrada',
        detalle: `${today.toISOString().split('T')[0]} · $${totalVentas.toFixed(2)} ventas · $${totalGastos.toFixed(2)} gastos`,
        actorId: empleado.id,
      },
    })

    res.json(cierre)
  } catch (error) {
    console.error('Error closing caja:', error)
    res.status(500).json({ error: 'Failed to close caja' })
  }
})
