import { PrismaClient } from '@prisma/client'
import { hashPin, hashPassword } from './dist/utils/auth.js'

const prisma = new PrismaClient()

async function main() {
  // Create app config
  let config = await prisma.appConfig.findFirst()
  if (!config) {
    config = await prisma.appConfig.create({
      data: {
        devicePassword: await hashPassword('admin'),
        adminPinHash: await hashPin('1234'),
      },
    })
    console.log('✓ AppConfig created')
  }

  // Create employees
  let empleadoCount = 0
  try {
    await prisma.empleado.create({
      data: {
        nombre: 'Juan',
        apellido: 'Lavador',
        role: 'lavador',
        pinHash: await hashPin('1111'),
        comisionPercent: 5,
      },
    })
    empleadoCount++
  } catch (e) {}
  try {
    await prisma.empleado.create({
      data: {
        nombre: 'María',
        apellido: 'Recepción',
        role: 'recepcion',
        pinHash: await hashPin('2222'),
      },
    })
    empleadoCount++
  } catch (e) {}
  try {
    await prisma.empleado.create({
      data: {
        nombre: 'Carlos',
        apellido: 'Lavador',
        role: 'lavador',
        pinHash: await hashPin('3333'),
        comisionPercent: 5,
      },
    })
    empleadoCount++
  } catch (e) {}
  console.log(`✓ ${empleadoCount} empleados created`)

  // Create services
  let serviciosCount = 0
  const serviciosData = [
    { nombre: 'Lavado Simple', precio: 15 },
    { nombre: 'Lavado Completo', precio: 25 },
    { nombre: 'Lavado Premium', precio: 35 },
    { nombre: 'Encerado', precio: 20 },
    { nombre: 'Desodorizante', precio: 10 },
  ]
  for (const s of serviciosData) {
    try {
      await prisma.catalogoServicio.create({ data: s })
      serviciosCount++
    } catch (e) {}
  }
  console.log(`✓ ${serviciosCount} servicios created`)

  // Create products
  let productosCount = 0
  const productosData = [
    { nombre: 'Ambientador', precio: 5 },
    { nombre: 'Detalle Interior', precio: 8 },
    { nombre: 'Protector Llantas', precio: 12 },
    { nombre: 'Cera Automotriz', precio: 18 },
    { nombre: 'Limpiador Vidrios', precio: 7 },
  ]
  for (const p of productosData) {
    try {
      await prisma.catalogoProducto.create({ data: p })
      productosCount++
    } catch (e) {}
  }
  console.log(`✓ ${productosCount} productos created`)

  // Create customers
  let sociosCount = 0
  const sociosData = [
    {
      numero: 1,
      nombre: 'Pedro',
      apellido: 'González',
      email: 'pedro@example.com',
      telefono: '7777-0001',
    },
    {
      numero: 2,
      nombre: 'Laura',
      apellido: 'Martínez',
      email: 'laura@example.com',
      telefono: '7777-0002',
    },
    {
      numero: 3,
      nombre: 'Roberto',
      apellido: 'López',
      email: 'roberto@example.com',
      telefono: '7777-0003',
    },
  ]
  for (const s of sociosData) {
    try {
      await prisma.socio.create({ data: s })
      sociosCount++
    } catch (e) {}
  }
  console.log(`✓ ${sociosCount} socios created`)

  console.log('✅ Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
