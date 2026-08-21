import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { verifyPin } from '../utils/auth.js'

const router = Router()
const prisma = new PrismaClient()

export const sociosRouter = router

// GET all socios with search
router.get('/', async (req: Request, res: Response) => {
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

// POST crear socio
router.post('/', async (req: Request, res: Response) => {
  try {
    const { nombre, apellido, email, telefono, contacto, autos } = req.body

    if (!nombre) {
      return res.status(400).json({ error: 'Nombre is required' })
    }

    // Get next numero (socioCounter)
    let config = await prisma.appConfig.findFirst()
    if (!config) {
      return res.status(500).json({ error: 'App not initialized' })
    }

    // Create socio with incrementing numero. Reintenta si dos altas concurrentes
    // calculan el mismo próximo número (choque en la restricción @unique de numero).
    let socio
    for (let attempt = 0; ; attempt++) {
      const ultimo = await prisma.socio.findFirst({ orderBy: { numero: 'desc' } })
      const nextNumero = (ultimo?.numero ?? 0) + 1
      try {
        socio = await prisma.socio.create({
          data: {
            numero: nextNumero,
            nombre,
            apellido,
            email,
            telefono,
            contacto,
            autos: autos
              ? {
                  create: autos.map((modelo: string) => ({ modelo })),
                }
              : undefined,
          },
          include: { autos: true },
        })
        break
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < 5) {
          continue
        }
        throw err
      }
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        actor: 'Recepción',
        accion: 'Socio creado',
        detalle: `${socio.nombre} ${socio.apellido || ''} (Nº ${socio.numero})`,
      },
    })

    res.json(socio)
  } catch (error) {
    console.error('Error creating socio:', error)
    res.status(500).json({ error: 'Failed to create socio' })
  }
})

// GET socio by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const socio = await prisma.socio.findUnique({
      where: { id },
      include: { autos: true },
    })

    if (!socio) {
      return res.status(404).json({ error: 'Socio not found' })
    }

    res.json(socio)
  } catch (error) {
    console.error('Error fetching socio:', error)
    res.status(500).json({ error: 'Failed to fetch socio' })
  }
})

// PUT update socio (requires PIN)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { nombre, apellido, email, telefono, contacto, autos, actorId, actorPin } = req.body

    if (!actorId || !actorPin) {
      return res.status(400).json({ error: 'Actor ID and PIN required' })
    }

    const socio = await prisma.socio.findUnique({
      where: { id },
      include: { autos: true },
    })

    if (!socio) {
      return res.status(404).json({ error: 'Socio not found' })
    }

    // Verify PIN
    const actor = await prisma.empleado.findUnique({
      where: { id: actorId },
    })

    if (!actor || !actor.pinHash) {
      return res.status(400).json({ error: 'Actor not found or has no PIN' })
    }

    const pinMatch = await verifyPin(actorPin, actor.pinHash)
    if (!pinMatch) {
      return res.status(401).json({ error: 'Invalid PIN' })
    }

    const updated = await prisma.socio.update({
      where: { id },
      data: {
        nombre: nombre ?? socio.nombre,
        apellido: apellido ?? socio.apellido,
        email: email ?? socio.email,
        telefono: telefono ?? socio.telefono,
        contacto: contacto ?? socio.contacto,
        autos: autos
          ? {
              deleteMany: {},
              create: autos.map((modelo: string) => ({ modelo })),
            }
          : undefined,
      },
      include: { autos: true },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        actor: actor.nombre,
        accion: 'Socio modificado',
        detalle: `${updated.nombre} ${updated.apellido || ''} (Nº ${updated.numero})`,
        actorId: actor.id,
      },
    })

    res.json(updated)
  } catch (error) {
    console.error('Error updating socio:', error)
    res.status(500).json({ error: 'Failed to update socio' })
  }
})

// DELETE socio (requires PIN + motivo)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { actorId, actorPin, motivo } = req.body

    if (!actorId || !actorPin || !motivo) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const socio = await prisma.socio.findUnique({
      where: { id },
    })

    if (!socio) {
      return res.status(404).json({ error: 'Socio not found' })
    }

    // Verify PIN
    const actor = await prisma.empleado.findUnique({
      where: { id: actorId },
    })

    if (!actor || !actor.pinHash) {
      return res.status(400).json({ error: 'Actor not found or has no PIN' })
    }

    const pinMatch = await verifyPin(actorPin, actor.pinHash)
    if (!pinMatch) {
      return res.status(401).json({ error: 'Invalid PIN' })
    }

    await prisma.socio.delete({
      where: { id },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        actor: actor.nombre,
        accion: 'Socio eliminado',
        detalle: `${socio.nombre} ${socio.apellido || ''} (Nº ${socio.numero}) · Motivo: ${motivo}`,
        actorId: actor.id,
      },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting socio:', error)
    res.status(500).json({ error: 'Failed to delete socio' })
  }
})

// GET socio consumos (ventas asociadas - readonly)
router.get('/:id/consumos', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const ventas = await prisma.venta.findMany({
      where: {
        socioId: id,
        anulada: false,
      },
      include: {
        items: true,
        cajero: { select: { nombre: true } },
      },
      orderBy: { fecha: 'desc' },
    })

    res.json(ventas)
  } catch (error) {
    console.error('Error fetching consumos:', error)
    res.status(500).json({ error: 'Failed to fetch consumos' })
  }
})
