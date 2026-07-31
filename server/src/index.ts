import express from 'express'
import cors from 'cors'
import session from 'express-session'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const prisma = new PrismaClient()

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

// Declare session types
declare global {
  namespace Express {
    interface Session {
      authenticated: boolean
      loginTime: number
    }
  }
}

// Auth middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.session?.authenticated) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  next()
}

// Routes
app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: !!req.session?.authenticated })
})

app.post('/api/auth/login', express.json(), async (req, res) => {
  const { password } = req.body
  const devicePassword = process.env.DEVICE_PASSWORD || 'admin'

  if (password !== devicePassword) {
    return res.status(401).json({ error: 'Invalid password' })
  }

  req.session.authenticated = true
  req.session.loginTime = Date.now()
  await req.session.save()
  res.json({ success: true })
})

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' })
    res.json({ success: true })
  })
})

// Health check
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
