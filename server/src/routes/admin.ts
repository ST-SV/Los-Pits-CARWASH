import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { hashPin, verifyPin, hashPassword } from '../utils/auth.js'
import { computeRecibo } from '../utils/recibo.js'
import { resolveAdminActor, requireAdminPin } from '../utils/adminAuth.js'
import { getVentanaAbierta } from './caja.js'

const router = Router()
const prisma = new PrismaClient()

export const adminRouter = router

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

    // Ventana abierta de hoy: solo lo que todavía no pasó por ningún cierre,
    // para no contar dos veces lo que ya quedó archivado en un CierreDeCaja de hoy.
    const { desde, hasta } = await getVentanaAbierta(prisma)

    const [ventasHoy, gastosHoy, historial] = await Promise.all([
      prisma.venta.findMany({
        where: { fecha: { gte: desde, lt: hasta }, anulada: false },
      }),
      prisma.gasto.findMany({
        where: { fecha: { gte: desde, lt: hasta } },
      }),
      prisma.cierreDeCaja.findMany({
        orderBy: { fecha: 'desc' },
        take: 200,
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

// HISTORIAL: detalle de un cierre puntual (ventana entre el cierre anterior y este)
router.get('/cierre/:id', async (req: Request, res: Response) => {
  try {
    const { adminPin } = req.query
    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const cierre = await prisma.cierreDeCaja.findUnique({ where: { id: req.params.id } })
    if (!cierre) {
      return res.status(404).json({ error: 'Cierre no encontrado' })
    }

    const dia = new Date(cierre.fecha)
    dia.setHours(0, 0, 0, 0)

    const anterior = await prisma.cierreDeCaja.findFirst({
      where: { fecha: dia, createdAt: { lt: cierre.createdAt } },
      orderBy: { createdAt: 'desc' },
    })

    const desde = anterior ? anterior.createdAt : dia
    const hasta = cierre.createdAt

    const [ventas, gastos] = await Promise.all([
      prisma.venta.findMany({
        where: { fecha: { gte: desde, lt: hasta } },
        include: { items: true },
        orderBy: { fecha: 'asc' },
      }),
      prisma.gasto.findMany({
        where: { fecha: { gte: desde, lt: hasta } },
        orderBy: { fecha: 'asc' },
      }),
    ])

    res.json({ cierre, ventas, gastos })
  } catch (error) {
    console.error('Error fetching detalle de cierre:', error)
    res.status(500).json({ error: 'Failed to fetch detalle' })
  }
})

// HISTORIAL: modificar un cierre (solo admin, requiere motivo)
router.put('/cierre/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { adminPin, totalVentas, totalGastos, cerradoPor, motivo } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }
    if (!motivo) {
      return res.status(400).json({ error: 'Motivo is required' })
    }

    const cierre = await prisma.cierreDeCaja.findUnique({ where: { id } })
    if (!cierre) {
      return res.status(404).json({ error: 'Cierre no encontrado' })
    }

    const nuevoTotalVentas = totalVentas !== undefined && totalVentas !== null ? parseFloat(totalVentas) : cierre.totalVentas
    const nuevoTotalGastos = totalGastos !== undefined && totalGastos !== null ? parseFloat(totalGastos) : cierre.totalGastos
    const nuevoNeto = nuevoTotalVentas - nuevoTotalGastos

    const updated = await prisma.cierreDeCaja.update({
      where: { id },
      data: {
        totalVentas: nuevoTotalVentas,
        totalGastos: nuevoTotalGastos,
        neto: nuevoNeto,
        cerradoPor: cerradoPor || cierre.cerradoPor,
      },
    })

    await prisma.auditLog.create({
      data: {
        actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
        accion: 'Cierre de caja modificado',
        detalle: `${new Date(cierre.fecha).toLocaleDateString('es-SV')} · $${cierre.totalVentas.toFixed(2)}→$${nuevoTotalVentas.toFixed(2)} ventas · $${cierre.totalGastos.toFixed(2)}→$${nuevoTotalGastos.toFixed(2)} gastos · Motivo: ${motivo}`,
      },
    })

    res.json(updated)
  } catch (error) {
    console.error('Error updating cierre:', error)
    res.status(500).json({ error: 'Failed to update cierre' })
  }
})

// HISTORIAL: eliminar/anular un cierre (solo admin, requiere motivo)
router.delete('/cierre/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { adminPin, motivo } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }
    if (!motivo) {
      return res.status(400).json({ error: 'Motivo is required' })
    }

    const cierre = await prisma.cierreDeCaja.findUnique({ where: { id } })
    if (!cierre) {
      return res.status(404).json({ error: 'Cierre no encontrado' })
    }

    await prisma.cierreDeCaja.delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
        accion: 'Cierre de caja eliminado',
        detalle: `${new Date(cierre.fecha).toLocaleDateString('es-SV')} · $${cierre.totalVentas.toFixed(2)} ventas · $${cierre.totalGastos.toFixed(2)} gastos · Motivo: ${motivo}`,
      },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting cierre:', error)
    res.status(500).json({ error: 'Failed to delete cierre' })
  }
})

// PLANILLA: nómina quincenal/mensual + balance del mes en curso
router.get('/planilla', async (req: Request, res: Response) => {
  try {
    const { adminPin, mes } = req.query

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const now = new Date()
    const mesStr = (mes as string) && /^\d{4}-\d{2}$/.test(mes as string) ? (mes as string) : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const [year, month] = mesStr.split('-').map(Number)

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 1)
    const q1Start = monthStart
    const q1End = new Date(year, month - 1, 16)
    const q2Start = q1End
    const q2End = monthEnd

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const periodoKeys = [`${mesStr}-Q1`, `${mesStr}-Q2`, `${mesStr}-M`]

    const [empleados, ventasHoy, gastosHoy, ventasMes, gastosMes, itemsMes, descuentosMes] = await Promise.all([
      prisma.empleado.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.venta.findMany({ where: { fecha: { gte: today, lt: tomorrow }, anulada: false } }),
      prisma.gasto.findMany({ where: { fecha: { gte: today, lt: tomorrow } } }),
      prisma.venta.findMany({ where: { fecha: { gte: monthStart, lt: monthEnd }, anulada: false } }),
      prisma.gasto.findMany({ where: { fecha: { gte: monthStart, lt: monthEnd } } }),
      prisma.ventaItem.findMany({
        where: { lavadorId: { not: null }, venta: { fecha: { gte: monthStart, lt: monthEnd }, anulada: false } },
        include: { venta: true },
      }),
      prisma.descuento.findMany({ where: { periodo: { in: periodoKeys } } }),
    ])

    const hoyVentas = ventasHoy.reduce((s: number, v: any) => s + v.total, 0)
    const hoyGastos = gastosHoy.reduce((s: number, g: any) => s + g.monto, 0)

    const sumInRange = (list: any[], start: Date, end: Date) =>
      list.filter((v: any) => new Date(v.fecha) >= start && new Date(v.fecha) < end).reduce((s: number, v: any) => s + v.total, 0)

    const ingresosMes = ventasMes.reduce((s: number, v: any) => s + v.total, 0)
    const ingresosQ1 = sumInRange(ventasMes, q1Start, q1End)
    const ingresosQ2 = sumInRange(ventasMes, q2Start, q2End)

    const gastosOperativosMes = gastosMes.filter((g: any) => g.categoria !== 'nomina').reduce((s: number, g: any) => s + g.monto, 0)
    const gastosOperativosQ1 = gastosMes
      .filter((g: any) => g.categoria !== 'nomina' && new Date(g.fecha) >= q1Start && new Date(g.fecha) < q1End)
      .reduce((s: number, g: any) => s + g.monto, 0)
    const gastosOperativosQ2 = gastosMes
      .filter((g: any) => g.categoria !== 'nomina' && new Date(g.fecha) >= q2Start && new Date(g.fecha) < q2End)
      .reduce((s: number, g: any) => s + g.monto, 0)
    const nominaYaRegistrada = gastosMes.filter((g: any) => g.categoria === 'nomina').reduce((s: number, g: any) => s + g.monto, 0)

    const periodDef = [
      { key: 'Q1' as const, label: `Quincena 1 (1–15)`, start: q1Start, end: q1End },
      { key: 'Q2' as const, label: `Quincena 2 (16–fin)`, start: q2Start, end: q2End },
      { key: 'M' as const, label: 'Mes completo', start: monthStart, end: monthEnd },
    ]

    const empleadosPlanilla = empleados
      .filter((e: any) => (e.sueldoQuincenal || 0) > 0 || (e.sueldoMensual || 0) > 0)
      .map((e: any) => {
        const periodos = periodDef
          .filter(p =>
            p.key === 'M'
              ? (e.sueldoMensual || 0) > 0 && !((e.sueldoQuincenal || 0) > 0)
              : (e.sueldoQuincenal || 0) > 0
          )
          .map(p => {
            const itemsPeriodo = itemsMes.filter(
              (it: any) => it.lavadorId === e.id && new Date(it.venta.fecha) >= p.start && new Date(it.venta.fecha) < p.end
            )
            const serviciosPeriodo = itemsPeriodo.filter((it: any) => it.categoria === 'servicio')
            const autosLavados = serviciosPeriodo.reduce((s: number, it: any) => s + it.cantidad, 0)
            const ventasAtribuidas = itemsPeriodo.reduce((s: number, it: any) => s + it.precio * it.cantidad, 0)
            // Comisión: % sobre cada servicio individual (no producto) cuyo precio unitario supere el umbral
            const comision = serviciosPeriodo
              .filter((it: any) => it.precio > (e.comisionThreshold || 0))
              .reduce((s: number, it: any) => s + it.precio * it.cantidad * ((e.comisionPercent || 0) / 100), 0)
            const sueldoBase = p.key === 'M' ? e.sueldoMensual || 0 : e.sueldoQuincenal || 0
            const periodoKey = `${mesStr}-${p.key}`
            const descuentosPeriodo = descuentosMes.filter((d: any) => d.empleadoId === e.id && d.periodo === periodoKey)
            const totalDescuentos = descuentosPeriodo.reduce((s: number, d: any) => s + d.monto, 0)
            const totalPagar = sueldoBase + comision - totalDescuentos

            return {
              periodo: p.key,
              periodoKey,
              label: p.label,
              sueldoBase,
              autosLavados,
              ventasAtribuidas,
              comision,
              descuentos: descuentosPeriodo,
              totalDescuentos,
              totalPagar,
            }
          })

        return {
          id: e.id,
          nombre: e.nombre,
          apellido: e.apellido,
          role: e.role,
          sueldoQuincenal: e.sueldoQuincenal,
          sueldoMensual: e.sueldoMensual,
          comisionPercent: e.comisionPercent,
          comisionThreshold: e.comisionThreshold,
          periodos,
        }
      })

    const planillaPorPeriodo = (key: 'Q1' | 'Q2' | 'M') =>
      empleadosPlanilla.reduce((s: number, e: any) => s + e.periodos.filter((p: any) => p.periodo === key).reduce((s2: number, p: any) => s2 + p.totalPagar, 0), 0)

    const planillaQ1 = planillaPorPeriodo('Q1')
    const planillaQ2 = planillaPorPeriodo('Q2')
    const planillaMensualDirecta = planillaPorPeriodo('M')
    const planillaTotalMes = planillaQ1 + planillaQ2 + planillaMensualDirecta

    const autosLavadosMes = itemsMes.filter((it: any) => it.categoria === 'servicio').reduce((s: number, it: any) => s + it.cantidad, 0)
    const ticketPromedio = ventasMes.length > 0 ? ingresosMes / ventasMes.length : 0
    const ventasPorMetodo = ventasMes.reduce((acc: any, v: any) => {
      acc[v.metodoPago] = (acc[v.metodoPago] || 0) + v.total
      return acc
    }, {} as Record<string, number>)

    const ventasPorLavador: Record<string, number> = {}
    itemsMes.forEach((it: any) => {
      if (!it.lavadorId) return
      ventasPorLavador[it.lavadorId] = (ventasPorLavador[it.lavadorId] || 0) + it.precio * it.cantidad
    })
    let topLavador: { nombre: string; ventas: number } | null = null
    Object.entries(ventasPorLavador).forEach(([empId, ventas]) => {
      if (!topLavador || ventas > topLavador.ventas) {
        const emp = empleados.find((e: any) => e.id === empId)
        if (emp) topLavador = { nombre: `${emp.nombre} ${emp.apellido || ''}`.trim(), ventas: ventas as number }
      }
    })

    res.json({
      mes: mesStr,
      hoy: { ventas: hoyVentas, gastos: hoyGastos, neto: hoyVentas - hoyGastos },
      resumenMensual: {
        ingresos: ingresosMes,
        gastosOperativos: gastosOperativosMes,
        nominaYaRegistrada,
        planillaCalculada: planillaTotalMes,
        balance: ingresosMes - gastosOperativosMes - planillaTotalMes,
      },
      quincenas: [
        {
          nombre: 'Quincena 1 (1–15)',
          ingresos: ingresosQ1,
          gastosOperativos: gastosOperativosQ1,
          planilla: planillaQ1,
          balance: ingresosQ1 - gastosOperativosQ1 - planillaQ1,
        },
        {
          nombre: 'Quincena 2 (16–fin)',
          ingresos: ingresosQ2,
          gastosOperativos: gastosOperativosQ2,
          planilla: planillaQ2,
          balance: ingresosQ2 - gastosOperativosQ2 - planillaQ2,
        },
      ],
      empleados: empleadosPlanilla,
      totalPlanilla: planillaTotalMes,
      stats: {
        ticketPromedio,
        autosLavadosMes,
        ventasPorMetodo,
        topLavador,
        ventasQ1: ingresosQ1,
        ventasQ2: ingresosQ2,
      },
    })
  } catch (error) {
    console.error('Error fetching planilla:', error)
    res.status(500).json({ error: 'Failed to fetch planilla' })
  }
})

// PLANILLA: agregar descuento manual a un empleado en un período
router.post('/planilla/descuento', async (req: Request, res: Response) => {
  try {
    const { adminPin, empleadoId, periodo, monto, motivo } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }
    if (!empleadoId || !periodo || !monto || !motivo) {
      return res.status(400).json({ error: 'Faltan datos del descuento' })
    }

    const empleado = await prisma.empleado.findUnique({ where: { id: empleadoId } })
    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado' })
    }

    const descuento = await prisma.descuento.create({
      data: { empleadoId, periodo, monto: parseFloat(monto), motivo },
    })

    await prisma.auditLog.create({
      data: {
        actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
        accion: 'Descuento agregado',
        detalle: `${empleado.nombre} ${empleado.apellido || ''} · ${periodo} · $${descuento.monto.toFixed(2)} · ${motivo}`,
      },
    })

    res.json(descuento)
  } catch (error) {
    console.error('Error creating descuento:', error)
    res.status(500).json({ error: 'Failed to create descuento' })
  }
})

// PLANILLA: eliminar descuento
router.delete('/planilla/descuento/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { adminPin } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const descuento = await prisma.descuento.findUnique({ where: { id }, include: { empleado: true } })
    if (!descuento) {
      return res.status(404).json({ error: 'Descuento no encontrado' })
    }

    await prisma.descuento.delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
        accion: 'Descuento eliminado',
        detalle: `${descuento.empleado.nombre} ${descuento.empleado.apellido || ''} · ${descuento.periodo} · $${descuento.monto.toFixed(2)}`,
      },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting descuento:', error)
    res.status(500).json({ error: 'Failed to delete descuento' })
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
    const { adminPin, nombre, apellido, role, pin, dui, tipoDocumento, numeroDocumento, email, telefono, emergName, emergPhone, horario, sueldoMensual, comisionPercent, comisionThreshold } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    if (!nombre || !role) {
      return res.status(400).json({ error: 'Nombre and role required' })
    }

    if (role === 'socio' && !pin) {
      return res.status(400).json({ error: 'El PIN es requerido para socios' })
    }

    const empleado = await prisma.empleado.create({
      data: {
        nombre,
        apellido,
        role,
        pinHash: pin ? await hashPin(pin) : null,
        dui,
        tipoDocumento,
        numeroDocumento,
        email,
        telefono,
        emergenciaName: emergName,
        emergenciaTelefono: emergPhone,
        horario,
        sueldoMensual: sueldoMensual || 0,
        sueldoQuincenal: (sueldoMensual || 0) / 2,
        comisionPercent: comisionPercent || 5,
        comisionThreshold: comisionThreshold || 12,
      },
    })

    await prisma.auditLog.create({
      data: {
        actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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
    const { adminPin, nombre, apellido, pin, dui, tipoDocumento, numeroDocumento, email, telefono, emergName, emergPhone, horario, sueldoMensual, comisionPercent, comisionThreshold } = req.body

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
        tipoDocumento,
        numeroDocumento,
        email,
        telefono,
        emergenciaName: emergName,
        emergenciaTelefono: emergPhone,
        horario,
        sueldoMensual: sueldoMensual ?? undefined,
        sueldoQuincenal: sueldoMensual !== undefined && sueldoMensual !== null ? sueldoMensual / 2 : undefined,
        comisionPercent: comisionPercent ?? undefined,
        comisionThreshold: comisionThreshold ?? undefined,
      },
    })

    await prisma.auditLog.create({
      data: {
        actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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
          actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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
    const { adminPin, nombre, precio, categoria } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const servicio = await prisma.catalogoServicio.create({
      data: { nombre, precio, categoria: categoria || 'General' },
    })

    await prisma.auditLog.create({
      data: {
        actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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
    const { adminPin, nombre, precio, categoria } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const before = await prisma.catalogoServicio.findUnique({ where: { id } })
    const servicio = await prisma.catalogoServicio.update({
      where: { id },
      data: { nombre, precio, categoria: categoria || 'General' },
    })

    if (before) {
      await prisma.auditLog.create({
        data: {
          actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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
          actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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
    const { adminPin, nombre, precio, categoria } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const producto = await prisma.catalogoProducto.create({
      data: { nombre, precio, categoria: categoria || 'Otros' },
    })

    await prisma.auditLog.create({
      data: {
        actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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
    const { adminPin, nombre, precio, categoria } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const before = await prisma.catalogoProducto.findUnique({ where: { id } })
    const producto = await prisma.catalogoProducto.update({
      where: { id },
      data: { nombre, precio, categoria: categoria || 'Otros' },
    })

    if (before) {
      await prisma.auditLog.create({
        data: {
          actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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
          actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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

// AUDITORIA: Exportar CSV filtrado por rango (dia/semana/quincena/mes o rango personalizado)
// El log de auditoria es de solo lectura y append-only: no existe ni debe agregarse ruta de
// borrado/edicion. Este endpoint solo lee y exporta.
router.get('/auditoria/export', async (req: Request, res: Response) => {
  try {
    const { adminPin, rango, fecha } = req.query

    if (!adminPin || !(await requireAdminPin(adminPin as string))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }

    const baseDate = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha as string) ? new Date(`${fecha}T00:00:00`) : new Date()
    baseDate.setHours(0, 0, 0, 0)

    let desde: Date
    let hasta: Date

    switch (rango) {
      case 'dia':
        desde = new Date(baseDate)
        hasta = new Date(baseDate)
        hasta.setDate(hasta.getDate() + 1)
        break
      case 'semana': {
        const dow = (baseDate.getDay() + 6) % 7 // 0=Lunes
        desde = new Date(baseDate)
        desde.setDate(desde.getDate() - dow)
        hasta = new Date(desde)
        hasta.setDate(hasta.getDate() + 7)
        break
      }
      case 'quincena': {
        const y = baseDate.getFullYear()
        const m = baseDate.getMonth()
        if (baseDate.getDate() <= 15) {
          desde = new Date(y, m, 1)
          hasta = new Date(y, m, 16)
        } else {
          desde = new Date(y, m, 16)
          hasta = new Date(y, m + 1, 1)
        }
        break
      }
      case 'mes': {
        const y = baseDate.getFullYear()
        const m = baseDate.getMonth()
        desde = new Date(y, m, 1)
        hasta = new Date(y, m + 1, 1)
        break
      }
      default:
        return res.status(400).json({ error: 'rango debe ser dia, semana, quincena o mes' })
    }

    const logs = await prisma.auditLog.findMany({
      where: { fecha: { gte: desde, lt: hasta } },
      orderBy: { fecha: 'asc' },
    })

    const escapeCsv = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
    const header = ['Fecha', 'Hora', 'Actor', 'Accion', 'Detalle']
    const rows = logs.map(l => {
      const d = new Date(l.fecha)
      return [
        d.toLocaleDateString('es-SV'),
        d.toLocaleTimeString('es-SV'),
        l.actor,
        l.accion,
        l.detalle || '',
      ].map(v => escapeCsv(String(v))).join(',')
    })
    const csv = '﻿' + [header.map(escapeCsv).join(','), ...rows].join('\r\n')

    const fileName = `auditoria_${rango}_${baseDate.toISOString().slice(0, 10)}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(csv)
  } catch (error) {
    console.error('Error exporting auditoria:', error)
    res.status(500).json({ error: 'Failed to export auditoria' })
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
        actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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
        actor: (await resolveAdminActor(oldPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(oldPin))?.empleadoId,
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
        actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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
        actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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
        actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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
          actor: (await resolveAdminActor(adminPin))?.nombre || 'Administrador',
        actorId: (await resolveAdminActor(adminPin))?.empleadoId,
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

// PLANILLA: generar/obtener link de recibo para firma online de un empleado en un período
router.post('/planilla/recibo-link', async (req: Request, res: Response) => {
  try {
    const { adminPin, empleadoId, periodoKey } = req.body

    if (!adminPin || !(await requireAdminPin(adminPin))) {
      return res.status(401).json({ error: 'Invalid admin PIN' })
    }
    if (!empleadoId || !periodoKey) {
      return res.status(400).json({ error: 'empleadoId y periodoKey son requeridos' })
    }

    let recibo = await prisma.reciboFirma.findUnique({ where: { empleadoId_periodoKey: { empleadoId, periodoKey } } })
    if (!recibo) {
      recibo = await prisma.reciboFirma.create({
        data: { empleadoId, periodoKey, token: crypto.randomBytes(16).toString('hex') },
      })
    }

    res.json(recibo)
  } catch (error) {
    console.error('Error generating recibo link:', error)
    res.status(500).json({ error: 'Failed to generate recibo link' })
  }
})
