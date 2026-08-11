import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PERIOD_LABELS: Record<string, string> = {
  Q1: 'Quincena 1 (1–15)',
  Q2: 'Quincena 2 (16–fin)',
  M: 'Mes completo',
}

export async function computeRecibo(empleadoId: string, periodoKey: string) {
  const match = periodoKey.match(/^(\d{4})-(\d{2})-(Q1|Q2|M)$/)
  if (!match) return null

  const [, yearStr, monthStr, periodo] = match
  const year = Number(yearStr)
  const month = Number(monthStr)

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 1)
  const q1Start = monthStart
  const q1End = new Date(year, month - 1, 16)
  const q2Start = q1End
  const q2End = monthEnd

  const range =
    periodo === 'Q1' ? { start: q1Start, end: q1End } : periodo === 'Q2' ? { start: q2Start, end: q2End } : { start: monthStart, end: monthEnd }

  const empleado = await prisma.empleado.findUnique({ where: { id: empleadoId } })
  if (!empleado) return null

  const [itemsPeriodo, descuentosPeriodo] = await Promise.all([
    prisma.ventaItem.findMany({
      where: { lavadorId: empleadoId, venta: { fecha: { gte: range.start, lt: range.end }, anulada: false } },
      include: { venta: true },
    }),
    prisma.descuento.findMany({ where: { empleadoId, periodo: periodoKey } }),
  ])

  const serviciosPeriodo = itemsPeriodo.filter(it => it.categoria === 'servicio')
  const autosLavados = serviciosPeriodo.reduce((s, it) => s + it.cantidad, 0)
  const comision = serviciosPeriodo
    .filter(it => it.precio > (empleado.comisionThreshold || 0))
    .reduce((s, it) => s + it.precio * it.cantidad * ((empleado.comisionPercent || 0) / 100), 0)
  const sueldoBase = periodo === 'M' ? empleado.sueldoMensual || 0 : empleado.sueldoQuincenal || 0
  const totalDescuentos = descuentosPeriodo.reduce((s, d) => s + d.monto, 0)
  const totalPagar = sueldoBase + comision - totalDescuentos

  return {
    empleado: {
      id: empleado.id,
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      role: empleado.role,
    },
    periodo: {
      periodoKey,
      label: PERIOD_LABELS[periodo],
      sueldoBase,
      autosLavados,
      comisionPercent: empleado.comisionPercent || 0,
      comisionThreshold: empleado.comisionThreshold || 0,
      comision,
      descuentos: descuentosPeriodo.map(d => ({ id: d.id, monto: d.monto, motivo: d.motivo })),
      totalDescuentos,
      totalPagar,
    },
  }
}
