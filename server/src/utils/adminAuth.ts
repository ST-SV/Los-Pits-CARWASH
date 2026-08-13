import { PrismaClient } from '@prisma/client'
import { verifyPin } from './auth.js'

const prisma = new PrismaClient()

// Resuelve quién está autenticando con este PIN de admin: el PIN maestro de administrador,
// o el PIN individual de alguno de los socios (role: 'socio'). Usado para gatear el acceso
// al panel admin y para atribuir cada acción de auditoría a la persona real.
export const resolveAdminActor = async (adminPin: string): Promise<{ nombre: string; empleadoId?: string } | null> => {
  if (!adminPin) return null
  const config = await prisma.appConfig.findFirst()
  if (config && (await verifyPin(adminPin, config.adminPinHash))) {
    return { nombre: 'Administrador' }
  }
  const socios = await prisma.empleado.findMany({ where: { role: 'socio', pinHash: { not: null } } })
  for (const s of socios) {
    if (s.pinHash && (await verifyPin(adminPin, s.pinHash))) {
      return { nombre: s.apellido ? `${s.nombre} ${s.apellido}` : s.nombre, empleadoId: s.id }
    }
  }
  return null
}

export const requireAdminPin = async (adminPin: string) => !!(await resolveAdminActor(adminPin))
