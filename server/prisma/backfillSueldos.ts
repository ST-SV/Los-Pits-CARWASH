import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const empleados = await prisma.empleado.findMany()
  let actualizados = 0

  for (const e of empleados) {
    const mensual = e.sueldoMensual || 0
    const quincenal = e.sueldoQuincenal || 0

    let nuevoMensual = mensual
    if (mensual === 0 && quincenal > 0) {
      nuevoMensual = quincenal * 2
    }
    const nuevoQuincenal = nuevoMensual / 2

    if (nuevoMensual !== mensual || nuevoQuincenal !== quincenal) {
      await prisma.empleado.update({
        where: { id: e.id },
        data: { sueldoMensual: nuevoMensual, sueldoQuincenal: nuevoQuincenal },
      })
      actualizados++
    }
  }

  console.log(`Empleados normalizados: ${actualizados} de ${empleados.length}.`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
