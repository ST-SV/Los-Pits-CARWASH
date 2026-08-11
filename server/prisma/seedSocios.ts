import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type SocioSeed = {
  numero: number
  nombre: string
  apellido?: string
  telefono?: string
  fechaAlta?: Date
  vehiculo?: string
  servicio?: string
  observaciones?: string
}

const socios: SocioSeed[] = [
  { numero: 4, nombre: 'Santiago', apellido: 'Safie', telefono: '76042972', fechaAlta: new Date('2026-01-08'), vehiculo: 'Mercedes', servicio: 'lavado aspirado pasteado', observaciones: 'primo de Fer' },
  { numero: 5, nombre: 'Javier', apellido: 'Garcia', fechaAlta: new Date('2026-01-08'), vehiculo: 'Susuki Suift', servicio: 'lavado,aspirado.' },
  { numero: 6, nombre: 'Naty', apellido: 'Carranza', telefono: '76835539', fechaAlta: new Date('2026-02-08'), vehiculo: 'Kia Sportage', servicio: 'lavado aspirado pasteado' },
  { numero: 7, nombre: 'Edwin', apellido: 'Gonzáles', telefono: '79676302', fechaAlta: new Date('2026-03-08'), vehiculo: 'Subaru', servicio: 'lavado aspirado pasteado' },
  { numero: 9, nombre: 'Alex', apellido: 'Vasquez', fechaAlta: new Date('2026-03-08'), vehiculo: 'Nissan', servicio: 'lavado aspirado pasteado' },
  { numero: 10, nombre: 'Otmaro', fechaAlta: new Date('2026-03-08'), vehiculo: 'Kia Forte', servicio: 'lavado aspirado pasteado', observaciones: 'amigo carlos' },
  { numero: 11, nombre: 'Rodrigo', apellido: 'Barrios', telefono: '51153869', fechaAlta: new Date('2026-03-08'), vehiculo: 'Nissan', servicio: 'lavado,aspirado,pasteado', observaciones: 'viene de guate' },
  { numero: 12, nombre: 'Madre e hija', fechaAlta: new Date('2026-03-08'), vehiculo: 'Kia Soul', servicio: 'lavado aspirado pasteado', observaciones: 'madre e hija' },
  { numero: 13, nombre: 'Rodri', apellido: 'Santamaría', telefono: '77561548', fechaAlta: new Date('2026-03-08'), vehiculo: 'Chevrolet Spark', servicio: 'lavado,aspirado.', observaciones: 'amigo carlos' },
  { numero: 14, nombre: 'Susan', apellido: 'Quintanila', telefono: '78531547', fechaAlta: new Date('2026-04-08'), vehiculo: 'Mitsubishi', servicio: 'lavado aspirado pasteado', observaciones: 'amiga sebas' },
  { numero: 15, nombre: 'Gerardo', fechaAlta: new Date('2026-04-08'), servicio: 'lavado aspirado pasteado', observaciones: 'amigo carlos' },
  { numero: 16, nombre: 'Erika', fechaAlta: new Date('2026-04-08'), vehiculo: 'Honda Fit', servicio: 'lavado aspirado pasteado', observaciones: 'amiga sebas' },
  { numero: 17, nombre: 'Gio', apellido: 'Cardona', telefono: '60153971', fechaAlta: new Date('2026-04-08'), vehiculo: 'Mitsubishi 4x4', servicio: 'lavado,aspirado.', observaciones: 'amigo sebas' },
  { numero: 18, nombre: 'Daniel', apellido: 'Safie', fechaAlta: new Date('2026-04-08'), servicio: 'lavado aspirado pasteado' },
  { numero: 19, nombre: 'Job', apellido: 'López', telefono: '75667129', fechaAlta: new Date('2026-06-08'), vehiculo: 'Ford Expedition', servicio: 'lavado aspirado pasteado', observaciones: 'cliente nuevo' },
  { numero: 20, nombre: 'David', apellido: 'Duran', telefono: '76361948', fechaAlta: new Date('2026-06-08'), vehiculo: 'Génesis', servicio: 'lavado moto', observaciones: 'socio' },
  { numero: 21, nombre: 'Oscar', apellido: 'Rivera', telefono: '78917441', fechaAlta: new Date('2026-06-08'), vehiculo: 'Hyundai', servicio: 'lavado aspirado pasteado', observaciones: 'cliente nuevo' },
]

async function main() {
  let creados = 0
  let existentes = 0

  for (const s of socios) {
    const existe = await prisma.socio.findUnique({ where: { numero: s.numero } })
    if (existe) {
      existentes++
      continue
    }

    const contactoParts: string[] = []
    if (s.servicio) contactoParts.push(`Servicio preferido: ${s.servicio}`)
    if (s.observaciones) contactoParts.push(`Obs: ${s.observaciones}`)
    const contacto = contactoParts.length > 0 ? contactoParts.join('. ') : undefined

    await prisma.socio.create({
      data: {
        numero: s.numero,
        nombre: s.nombre,
        apellido: s.apellido,
        telefono: s.telefono,
        contacto,
        createdAt: s.fechaAlta,
        autos: s.vehiculo ? { create: [{ modelo: s.vehiculo }] } : undefined,
      },
    })
    creados++
  }

  console.log(`Socios creados: ${creados}. Ya existentes (omitidos): ${existentes}.`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
