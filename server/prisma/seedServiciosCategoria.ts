import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SERVICIOS: { nombre: string; categoria: string; precio: number }[] = [
  { categoria: 'SEDÁN', nombre: 'Sedán - Lavado y aspirado', precio: 6 },
  { categoria: 'SEDÁN', nombre: 'Sedán - Pasteado (mano)', precio: 10 },
  { categoria: 'SEDÁN', nombre: 'Sedán - Pasteado a máquina', precio: 15 },

  { categoria: 'CAMIONETA PEQUEÑA', nombre: 'Camioneta pequeña - Lavado y aspirado', precio: 7 },
  { categoria: 'CAMIONETA PEQUEÑA', nombre: 'Camioneta pequeña - Pasteado (mano)', precio: 11 },
  { categoria: 'CAMIONETA PEQUEÑA', nombre: 'Camioneta pequeña - Pasteado a máquina', precio: 16 },

  { categoria: 'CAMIONETA MEDIANA', nombre: 'Camioneta mediana - Lavado y aspirado', precio: 9 },
  { categoria: 'CAMIONETA MEDIANA', nombre: 'Camioneta mediana - Pasteado (mano)', precio: 13 },
  { categoria: 'CAMIONETA MEDIANA', nombre: 'Camioneta mediana - Pasteado a máquina', precio: 17 },

  { categoria: 'CAMIONETA GRANDE', nombre: 'Camioneta grande - Lavado y aspirado', precio: 11 },
  { categoria: 'CAMIONETA GRANDE', nombre: 'Camioneta grande - Pasteado (mano)', precio: 16 },
  { categoria: 'CAMIONETA GRANDE', nombre: 'Camioneta grande - Pasteado a máquina', precio: 20 },

  { categoria: 'PICK UP', nombre: 'Pick up - Lavado y aspirado', precio: 13 },
  { categoria: 'PICK UP', nombre: 'Pick up - Pasteado (mano)', precio: 14 },
  { categoria: 'PICK UP', nombre: 'Pick up - Pasteado a máquina', precio: 17 },

  { categoria: 'PICK UP XL', nombre: 'Pick up XL - Lavado y aspirado', precio: 15 },
  { categoria: 'PICK UP XL', nombre: 'Pick up XL - Pasteado (mano)', precio: 18 },
  { categoria: 'PICK UP XL', nombre: 'Pick up XL - Pasteado a máquina', precio: 20 },
]

async function main() {
  let creados = 0
  let actualizados = 0

  for (const s of SERVICIOS) {
    const existente = await prisma.catalogoServicio.findUnique({ where: { nombre: s.nombre } })
    if (existente) {
      if (existente.categoria !== s.categoria || existente.precio !== s.precio) {
        await prisma.catalogoServicio.update({
          where: { id: existente.id },
          data: { categoria: s.categoria, precio: s.precio },
        })
        actualizados++
      }
    } else {
      await prisma.catalogoServicio.create({
        data: { nombre: s.nombre, categoria: s.categoria, precio: s.precio },
      })
      creados++
    }
  }

  console.log(`Servicios creados: ${creados}, actualizados: ${actualizados}, total en lista: ${SERVICIOS.length}.`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
