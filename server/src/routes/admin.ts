import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { hashPin, verifyPin, hashPassword } from '../utils/auth.js'

const router = Router()
const prisma = new PrismaClient()

export const adminRouter = router

const requireAdminPin = async (adminPin: string) => {
  const config = await prisma.appConfig.findFirst()
  if (!config) return false
  return verifyPin(adminPin, config.adminPinHash)
}

// HISTORIAL: Agregados por semana/quincena/mes + días cerrados
router.get('/historial', async (req: Request, res: Response) => {
  try {
    const { adminPin } = req.query

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(now.getDate() - 7)
    const fortStart = now.getDate() <= 15 ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth(), 16)
    const monthAgo = new Date(now)
    monthAgo.setDate(now.getDate() - 30)

    // Today's ventas
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [ventasHoy, gastosHoy, historial] = await Promise.all([
      prisma.venta.findMany({
        where: { fecha: { gte: today, lt: tomorrow }, anulada: false },
      }),
      prisma.gasto.findMany({
        where: { fecha: { gte: today, lt: tomorrow } },
      }),
      prisma.cierreDeCaja.findMany({
        orderBy: { fecha: 'desc' },
        take: 100,
      }),
    ])

    let weekSales = ventasHoy.reduce((s: number, v: any) => s + v.total, 0)
    let weekNet = weekSales - gastosHoy.reduce((s: number, g: any) => s + g.monto, 0)
    let fortSales = weekSales
    let fortNet = weekNet
    let monthSales = weekSales
    let monthNet = weekNet

    historial.forEach((d: any) => {
      const dd = new Date(d.fecha)
      if (dd >= weekAgo) {
        weekSales += d.totalVentas
        weekNet += d.neto
      }
      if (dd >= fortStart) {
        fortSales += d.totalVentas
        fortNet += d.neto
      }
      if (dd >= monthAgo) {
        monthSales += d.totalVentas
        monthNet += d.neto
      }
    })

    res.json({
      week: { sales: weekSales, net: weekNet },
      fortnight: { sales: fortSales, net: fortNet },
      month: { sales: monthSales, net: monthNet },
      cierres: historial,
    })
  } catch (error) {
    console.error('Error fetching historial:', error)
    res.status(500).json({ error: 'Failed to fetch historial' })
  }
})

// CONTABILIDAD: Acumulados + libro diario
router.get('/contabilidad', async (req: Request, res: Response) => {
  try {
    const { adminPin } = req.query

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [ventasHoy, gastosHoy, historial] = await Promise.all([
      prisma.venta.findMany({
        where: { fecha: { gte: today, lt: tomorrow }, anulada: false },
        include: { items: true },
      }),
      prisma.gasto.findMany({
        where: { fecha: { gte: today, lt: tomorrow } },
      }),
      prisma.cierreDeCaja.findMany({
        orderBy: { fecha: 'desc' },
      }),
    ])

    const hoyVentas = ventasHoy.reduce((s: number, v: any) => s + v.total, 0)
    const hoyGastos = gastosHoy.reduce((s: number, g: any) => s + g.monto, 0)
    const hoyNomina = gastosHoy.filter((g: any) => g.categoria === 'nomina').reduce((s: number, g: any) => s + g.monto, 0)
    const hoyOtros = gastosHoy.filter((g: any) => g.categoria !== 'nomina').reduce((s: number, g: any) => s + g.monto, 0)

    let accIngresos = hoyVentas
    let accNomina = hoyNomina
    let accOtros = hoyOtros

    historial.forEach((d: any) => {
      accIngresos += d.totalVentas
      // Parse gastos from cierre (needs refactor but works for now)
    })

    res.json({
      hoy: {
        ventas: hoyVentas,
        nomina: hoyNomina,
        otros: hoyOtros,
        neto: hoyVentas - hoyGastos,
      },
      acumulado: {
        ingresos: accIngresos,
        nomina: accNomina,
        otros: accOtros,
        egreso: accNomina + accOtros,
        ganancia: accIngresos - (accNomina + accOtros),
      },
      diarios: historial,
    })
  } catch (error) {
    console.error('Error fetching contabilidad:', error)
    res.status(500).json({ error: 'Failed to fetch contabilidad' })
  }
})

// EMPLEADOS: CRUD + stats
router.get('/empleados', async (req: Request, res: Response) => {
  try {
    const { adminPin } = req.query

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const empleados = await prisma.empleado.findMany({
      orderBy: { createdAt: 'desc' },
    })

    res.json(empleados)
  } catch (error) {
    console.error('Error fetching empleados:', error)
    res.status(500).json({ error: 'Failed to fetch empleados' })
  }
})

router.post('/empleados', async (req: Request, res: Response) => {
  try {
    const { adminPin, nombre, apellido, role, pin, dui, email, telefono, emergName, emergPhone, horario, sueldoQuincenal, sueldoMensual, comisionPercent, comisionThreshold } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    if (!nombre || !role) {
      return res.status(400).json({ error: 'Nombre and role required' })
    }

    const empleado = await prisma.empleado.create({
      data: {
        nombre,
        apellido,
        role,
        pinHash: pin ? await hashPin(pin) : null,
        dui,
        email,
        telefono,
        emergenciaName: emergName,
        emergenciaTelefono: emergPhone,
        horario,
        sueldoQuincenal: sueldoQuincenal || 0,
        sueldoMensual: sueldoMensual || 0,
        comisionPercent: comisionPercent || 5,
        comisionThreshold: comisionThreshold || 12,
      },
    })

    await prisma.auditLog.create({
      data: {
        actor: 'Administrador',
        accion: 'Empleado creado',
        detalle: `${empleado.nombre} · ${role}`,
      },
    })

    res.json(empleado)
  } catch (error) {
    console.error('Error creating empleado:', error)
    res.status(500).json({ error: 'Failed to create empleado' })
  }
})

router.put('/empleados/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { adminPin, nombre, apellido, pin, dui, email, telefono, emergName, emergPhone, horario, sueldoQuincenal, sueldoMensual, comisionPercent, comisionThreshold } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const empleado = await prisma.empleado.update({
      where: { id },
      data: {
        nombre,
        apellido,
        pinHash: pin ? await hashPin(pin) : undefined,
        dui,
        email,
        telefono,
        emergenciaName: emergName,
        emergenciaTelefono: emergPhone,
        horario,
        sueldoQuincenal: sueldoQuincenal ?? undefined,
        sueldoMensual: sueldoMensual ?? undefined,
        comisionPercent: comisionPercent ?? undefined,
        comisionThreshold: comisionThreshold ?? undefined,
      },
    })

    await prisma.auditLog.create({
      data: {
        actor: 'Administrador',
        accion: 'Empleado modificado',
        detalle: `${empleado.nombre}`,
      },
    })

    res.json(empleado)
  } catch (error) {
    console.error('Error updating empleado:', error)
    res.status(500).json({ error: 'Failed to update empleado' })
  }
})

router.delete('/empleados/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { adminPin } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const empleado = await prisma.empleado.findUnique({ where: { id } })

    await prisma.empleado.delete({ where: { id } })

    if (empleado) {
      await prisma.auditLog.create({
        data: {
          actor: 'Administrador',
          accion: 'Empleado eliminado',
          detalle: `${empleado.nombre}`,
        },
      })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting empleado:', error)
    res.status(500).json({ error: 'Failed to delete empleado' })
  }
})

// CATALOGO: CRUD servicios y productos
router.get('/catalogo', async (req: Request, res: Response) => {
  try {
    const { adminPin } = req.query

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const [servicios, productos] = await Promise.all([
      prisma.catalogoServicio.findMany(),
      prisma.catalogoProducto.findMany(),
    ])

    res.json({ servicios, productos })
  } catch (error) {
    console.error('Error fetching catalogo:', error)
    res.status(500).json({ error: 'Failed to fetch catalogo' })
  }
})

router.post('/catalogo/servicio', async (req: Request, res: Response) => {
  try {
    const { adminPin, nombre, precio } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const servicio = await prisma.catalogoServicio.create({
      data: { nombre, precio },
    })

    await prisma.auditLog.create({
      data: {
        actor: 'Administrador',
        accion: 'Servicio creado',
        detalle: `${nombre} · $${precio.toFixed(2)}`,
      },
    })

    res.json(servicio)
  } catch (error) {
    console.error('Error creating servicio:', error)
    res.status(500).json({ error: 'Failed to create servicio' })
  }
})

router.put('/catalogo/servicio/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { adminPin, nombre, precio } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const before = await prisma.catalogoServicio.findUnique({ where: { id } })
    const servicio = await prisma.catalogoServicio.update({
      where: { id },
      data: { nombre, precio },
    })

    if (before) {
      await prisma.auditLog.create({
        data: {
          actor: 'Administrador',
          accion: 'Precio modificado',
          detalle: `${before.nombre}: $${before.precio.toFixed(2)} → $${precio.toFixed(2)}`,
        },
      })
    }

    res.json(servicio)
  } catch (error) {
    console.error('Error updating servicio:', error)
    res.status(500).json({ error: 'Failed to update servicio' })
  }
})

router.delete('/catalogo/servicio/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { adminPin } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const servicio = await prisma.catalogoServicio.findUnique({ where: { id } })
    await prisma.catalogoServicio.delete({ where: { id } })

    if (servicio) {
      await prisma.auditLog.create({
        data: {
          actor: 'Administrador',
          accion: 'Servicio eliminado',
          detalle: `${servicio.nombre}`,
        },
      })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting servicio:', error)
    res.status(500).json({ error: 'Failed to delete servicio' })
  }
})

// Similar endpoints for productos...
router.post('/catalogo/producto', async (req: Request, res: Response) => {
  try {
    const { adminPin, nombre, precio } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const producto = await prisma.catalogoProducto.create({
      data: { nombre, precio },
    })

    await prisma.auditLog.create({
      data: {
        actor: 'Administrador',
        accion: 'Producto creado',
        detalle: `${nombre} · $${precio.toFixed(2)}`,
      },
    })

    res.json(producto)
  } catch (error) {
    console.error('Error creating producto:', error)
    res.status(500).json({ error: 'Failed to create producto' })
  }
})

router.put('/catalogo/producto/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { adminPin, nombre, precio } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const before = await prisma.catalogoProducto.findUnique({ where: { id } })
    const producto = await prisma.catalogoProducto.update({
      where: { id },
      data: { nombre, precio },
    })

    if (before) {
      await prisma.auditLog.create({
        data: {
          actor: 'Administrador',
          accion: 'Precio modificado',
          detalle: `${before.nombre}: $${before.precio.toFixed(2)} → $${precio.toFixed(2)}`,
        },
      })
    }

    res.json(producto)
  } catch (error) {
    console.error('Error updating producto:', error)
    res.status(500).json({ error: 'Failed to update producto' })
  }
})

router.delete('/catalogo/producto/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { adminPin } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const producto = await prisma.catalogoProducto.findUnique({ where: { id } })
    await prisma.catalogoProducto.delete({ where: { id } })

    if (producto) {
      await prisma.auditLog.create({
        data: {
          actor: 'Administrador',
          accion: 'Producto eliminado',
          detalle: `${producto.nombre}`,
        },
      })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting producto:', error)
    res.status(500).json({ error: 'Failed to delete producto' })
  }
})

// AUDITORIA: Read-only log
router.get('/auditoria', async (req: Request, res: Response) => {
  try {
    const { adminPin } = req.query

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const logs = await prisma.auditLog.findMany({
      orderBy: { fecha: 'desc' },
      take: 300,
    })

    res.json(logs)
  } catch (error) {
    console.error('Error fetching auditoria:', error)
    res.status(500).json({ error: 'Failed to fetch auditoria' })
  }
})

// EDIT VENTA: Only admin can edit a completed sale (requires PIN + motivo)
router.put('/venta/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { adminPin, numeroRecibo, referencia, metodoPago, items, motivo } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    if (!motivo) {
      return res.status(400).json({ error: 'Motivo is required' })
    }

    const venta = await prisma.venta.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!venta) {
      return res.status(404).json({ error: 'Venta not found' })
    }

    if (venta.anulada) {
      return res.status(400).json({ error: 'Cannot edit annulled venta' })
    }

    // Record before state
    const before = {
      numeroRecibo: venta.numeroRecibo,
      referencia: venta.referencia,
      metodoPago: venta.metodoPago,
      total: venta.total,
    }

    // Calculate new total
    const newTotal = items.reduce((sum: number, item: any) => sum + item.precio * item.cantidad, 0)

    // Update venta
    const updated = await prisma.venta.update({
      where: { id },
      data: {
        numeroRecibo: numeroRecibo || venta.numeroRecibo,
        referencia: referencia ?? venta.referencia,
        metodoPago: metodoPago || venta.metodoPago,
        total: newTotal,
        ultimoMotivoEdicion: motivo,
        items: {
          deleteMany: {},
          create: items.map((item: any) => ({
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

    // Log audit
    const changeDetail = `Recibo ${before.numeroRecibo || '—'}→${updated.numeroRecibo || '—'} · $${before.total.toFixed(2)}→$${newTotal.toFixed(2)} · ${before.metodoPago}→${updated.metodoPago} · Motivo: ${motivo}`

    await prisma.auditLog.create({
      data: {
        actor: 'Administrador',
        accion: 'Venta modificada',
        detalle: changeDetail,
      },
    })

    res.json(updated)
  } catch (error) {
    console.error('Error editing venta:', error)
    res.status(500).json({ error: 'Failed to edit venta' })
  }
})

// CONFIG: Cambiar PIN de administrador
router.put('/config/admin-pin', async (req: Request, res: Response) => {
  try {
    const { oldPin, newPin } = req.body

    if (!oldPin || !newPin) {
      return res.status(400).json({ error: 'Old and new PIN required' })
    }

    if (!(await requireAdminPin(oldPin))) {
      return res.status(401).json({ error: 'Invalid current PIN' })
    }

    const config = await prisma.appConfig.findFirst()
    if (!config) {
      return res.status(500).json({ error: 'App not initialized' })
    }

    const updated = await prisma.appConfig.update({
      where: { id: config.id },
      data: {
        adminPinHash: await hashPin(newPin),
      },
    })

    await prisma.auditLog.create({
      data: {
        actor: 'Administrador',
        accion: 'PIN de administrador cambiado',
        detalle: '',
      },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error changing admin PIN:', error)
    res.status(500).json({ error: 'Failed to change admin PIN' })
  }
})

// CONFIG: Cambiar contraseña del dispositivo
router.put('/config/device-password', async (req: Request, res: Response) => {
  try {
    const { adminPin, newPassword } = req.body

    if (!adminPin || !newPassword) {
      return res.status(400).json({ error: 'Admin PIN and new password required' })
    }

    if (!(await requireAdminPin(adminPin))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const config = await prisma.appConfig.findFirst()
    if (!config) {
      return res.status(500).json({ error: 'App not initialized' })
    }

    await prisma.appConfig.update({
      where: { id: config.id },
      data: {
        devicePassword: await hashPassword(newPassword),
      },
    })

    await prisma.auditLog.create({
      data: {
        actor: 'Administrador',
        accion: 'Contraseña del dispositivo cambiada',
        detalle: '',
      },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error updating device password:', error)
    res.status(500).json({ error: 'Failed to update device password' })
  }
})

// HORARIOS: Horario del negocio (días/horas de apertura) + turnos de empleados
router.get('/horarios', async (req: Request, res: Response) => {
  try {
    const { adminPin } = req.query

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const [horarioNegocio, turnos, empleados] = await Promise.all([
      prisma.horarioNegocio.findMany({ orderBy: { diaSemana: 'asc' } }),
      prisma.turno.findMany({
        include: { empleado: { select: { id: true, nombre: true, apellido: true, role: true } } },
        orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
      }),
      prisma.empleado.findMany({
        select: { id: true, nombre: true, apellido: true, role: true },
        orderBy: { nombre: 'asc' },
      }),
    ])

    // Asegura que existan los 7 días (0=Lunes .. 6=Domingo)
    const existentes = new Set(horarioNegocio.map((h: any) => h.diaSemana))
    const faltantes = [0, 1, 2, 3, 4, 5, 6].filter((d) => !existentes.has(d))
    if (faltantes.length > 0) {
      await prisma.horarioNegocio.createMany({
        data: faltantes.map((diaSemana) => ({
          diaSemana,
          abierto: true,
          horaApertura: '07:00',
          horaCierre: '18:00',
        })),
      })
    }

    const horarioFinal = faltantes.length > 0
      ? await prisma.horarioNegocio.findMany({ orderBy: { diaSemana: 'asc' } })
      : horarioNegocio

    res.json({ horarioNegocio: horarioFinal, turnos, empleados })
  } catch (error) {
    console.error('Error fetching horarios:', error)
    res.status(500).json({ error: 'Failed to fetch horarios' })
  }
})

// HORARIOS: Guardar horario del negocio (todos los días de una vez)
router.put('/horarios/negocio', async (req: Request, res: Response) => {
  try {
    const { adminPin, dias } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    if (!Array.isArray(dias)) {
      return res.status(400).json({ error: 'Dias array required' })
    }

    await Promise.all(
      dias.map((d: any) =>
        prisma.horarioNegocio.upsert({
          where: { diaSemana: d.diaSemana },
          update: {
            abierto: !!d.abierto,
            horaApertura: d.horaApertura || null,
            horaCierre: d.horaCierre || null,
          },
          create: {
            diaSemana: d.diaSemana,
            abierto: !!d.abierto,
            horaApertura: d.horaApertura || null,
            horaCierre: d.horaCierre || null,
          },
        })
      )
    )

    await prisma.auditLog.create({
      data: {
        actor: 'Administrador',
        accion: 'Horario del negocio actualizado',
        detalle: '',
      },
    })

    const horarioNegocio = await prisma.horarioNegocio.findMany({ orderBy: { diaSemana: 'asc' } })
    res.json(horarioNegocio)
  } catch (error) {
    console.error('Error updating horario negocio:', error)
    res.status(500).json({ error: 'Failed to update horario negocio' })
  }
})

// HORARIOS: Crear turno de empleado (entrada/salida en un día)
router.post('/horarios/turnos', async (req: Request, res: Response) => {
  try {
    const { adminPin, empleadoId, diaSemana, horaInicio, horaFin } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    if (!empleadoId || diaSemana === undefined || diaSemana === null || !horaInicio || !horaFin) {
      return res.status(400).json({ error: 'empleadoId, diaSemana, horaInicio y horaFin son requeridos' })
    }

    const empleado = await prisma.empleado.findUnique({ where: { id: empleadoId } })
    if (!empleado) {
      return res.status(404).json({ error: 'Empleado not found' })
    }

    const turno = await prisma.turno.create({
      data: { empleadoId, diaSemana: Number(diaSemana), horaInicio, horaFin },
      include: { empleado: { select: { id: true, nombre: true, apellido: true, role: true } } },
    })

    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    await prisma.auditLog.create({
      data: {
        actor: 'Administrador',
        accion: 'Turno agregado',
        detalle: `${empleado.nombre} · ${dias[Number(diaSemana)]} ${horaInicio}-${horaFin}`,
      },
    })

    res.json(turno)
  } catch (error) {
    console.error('Error creating turno:', error)
    res.status(500).json({ error: 'Failed to create turno' })
  }
})

// HORARIOS: Eliminar turno de empleado
router.delete('/horarios/turnos/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { adminPin } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const turno = await prisma.turno.findUnique({
      where: { id },
      include: { empleado: { select: { nombre: true } } },
    })

    await prisma.turno.delete({ where: { id } })

    if (turno) {
      const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
      await prisma.auditLog.create({
        data: {
          actor: 'Administrador',
          accion: 'Turno eliminado',
          detalle: `${turno.empleado.nombre} · ${dias[turno.diaSemana]} ${turno.horaInicio}-${turno.horaFin}`,
        },
      })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting turno:', error)
    res.status(500).json({ error: 'Failed to delete turno' })
  }
})
