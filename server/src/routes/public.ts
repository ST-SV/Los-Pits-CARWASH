import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { computeRecibo } from '../utils/recibo.js'

const router = Router()
const prisma = new PrismaClient()

export const publicRouter = router

router.get('/recibo/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const recibo = await prisma.reciboFirma.findUnique({ where: { token } })
    if (!recibo) {
      return res.status(404).json({ error: 'Recibo no encontrado' })
    }

    const data = await computeRecibo(recibo.empleadoId, recibo.periodoKey)
    if (!data) {
      return res.status(404).json({ error: 'Recibo no encontrado' })
    }

    res.json({
      ...data,
      firmaNombre: recibo.firmaNombre,
      firmaFecha: recibo.firmaFecha,
    })
  } catch (error) {
    console.error('Error fetching public recibo:', error)
    res.status(500).json({ error: 'Failed to fetch recibo' })
  }
})

router.post('/recibo/:token/firmar', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { nombre } = req.body

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'Nombre requerido para firmar' })
    }

    const recibo = await prisma.reciboFirma.findUnique({ where: { token } })
    if (!recibo) {
      return res.status(404).json({ error: 'Recibo no encontrado' })
    }
    if (recibo.firmaNombre) {
      return res.status(400).json({ error: 'Este recibo ya fue firmado' })
    }

    const updated = await prisma.reciboFirma.update({
      where: { token },
      data: { firmaNombre: nombre.trim(), firmaFecha: new Date() },
    })

    res.json(updated)
  } catch (error) {
    console.error('Error signing recibo:', error)
    res.status(500).json({ error: 'Failed to sign recibo' })
  }
})
