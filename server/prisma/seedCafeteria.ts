import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const productos = [
  { nombre: 'Coca 354ml', precio: 1, categoria: 'Bebidas Frías' },
  { nombre: 'Fanta lata 354ml', precio: 1, categoria: 'Bebidas Frías' },
  { nombre: 'Gatorade 350ml', precio: 1, categoria: 'Bebidas Frías' },
  { nombre: 'Yogurt Yes 200ml', precio: 1, categoria: 'Bebidas Frías' },
  { nombre: 'Be Light 600ml', precio: 1, categoria: 'Bebidas Frías' },
  { nombre: 'V8 473ml', precio: 1.5, categoria: 'Bebidas Frías' },
  { nombre: 'Caprisun 200ml', precio: 1, categoria: 'Bebidas Frías' },
  { nombre: 'Café', precio: 1, categoria: 'Bebidas Calientes' },
  { nombre: 'Café libre + Pan', precio: 1.5, categoria: 'Bebidas Calientes' },
  { nombre: 'Té', precio: 0.5, categoria: 'Bebidas Calientes' },
  { nombre: 'Té + Pan', precio: 1, categoria: 'Bebidas Calientes' },
  { nombre: 'Lays 26gr', precio: 0.75, categoria: 'Snacks' },
  { nombre: 'Diana 39gr', precio: 0.35, categoria: 'Snacks' },
  { nombre: 'Diana 39gr Preparado', precio: 0.6, categoria: 'Snacks' },
  { nombre: 'Diana 13gr', precio: 0.25, categoria: 'Snacks' },
  { nombre: 'Diana 13gr Preparado', precio: 0.35, categoria: 'Snacks' },
  { nombre: 'Pan Dulce Sinaí 54gr', precio: 0.4, categoria: 'Snacks' },
  { nombre: 'Galleta Bridge 30gr', precio: 0.25, categoria: 'Snacks' },
  { nombre: 'Maní Natsu 80gr', precio: 1, categoria: 'Snacks' },
]

async function main() {
  const result = await prisma.catalogoProducto.createMany({
    data: productos,
    skipDuplicates: true,
  })
  console.log(`Insertados ${result.count} productos nuevos de ${productos.length} definidos.`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
