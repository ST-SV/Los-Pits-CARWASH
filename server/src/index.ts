import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import session, { SessionData } from 'express-session'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'
import { authRouter } from './routes/auth'
import { venderRouter } from './routes/vender'
import { cajaRouter } from './routes/caja'
import { sociosRouter } from './routes/socios'
import { adminRouter } from './routes/admin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const prisma = new PrismaClient()

declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean
    loginTime?: number
  }
}

// Middleware
app.use(cors())
app.use(express.json())
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
)

// Auth middleware
export const requireAuth = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (!req.session?.authenticated) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  next()
}

// Routes
app.use('/api/auth', authRouter)
app.use('/api/vender', requireAuth, venderRouter)
app.use('/api/caja', requireAuth, cajaRouter)
app.use('/api/socios', requireAuth, sociosRouter)
app.use('/api/admin', requireAuth, adminRouter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Serve static files from web build
const webPath = path.resolve(__dirname, '../../web/dist')
app.use(express.static(webPath))
app.get('*', (req, res) => {
  res.sendFile(path.join(webPath, 'index.html'))
})

const PORT = process.env.PORT || 3000

async function main() {
  try {
    // Test database connection
    await prisma.$connect()
    console.log('✓ Database connected')

    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

main()
