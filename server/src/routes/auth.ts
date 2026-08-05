import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { hashPassword, verifyPassword } from '../utils/auth.js'

const router = Router()
const prisma = new PrismaClient()

export const authRouter = router

router.get('/check', (req: Request, res: Response) => {
  res.json({ authenticated: !!req.session?.authenticated })
})

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { password } = req.body

    if (!password) {
      return res.status(400).json({ error: 'Password required' })
    }

    // Get app config
    let config = await prisma.appConfig.findFirst()

    if (!config) {
      // First time setup - initialize with default password
      const defaultPassword = process.env.DEVICE_PASSWORD || 'admin'
      const hashedPassword = await hashPassword(defaultPassword)
      config = await prisma.appConfig.create({
        data: {
          devicePassword: hashedPassword,
          adminPinHash: await hashPassword('1234'),
        },
      })
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, config.devicePassword)
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid password' })
    }

    // Set session
    req.session.authenticated = true
    req.session.loginTime = Date.now()
    await req.session.save()

    res.json({ success: true })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.json({ success: true })
  })
})
