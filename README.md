# Los Pits — Sistema de Caja y Nómina

Aplicación web para gestión de punto de venta, nómina y contabilidad del carwash Los Pits.

## Setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar base de datos

```bash
cd server
npm run db:push
```

Esto crea el archivo `db.sqlite` y aplica el schema de Prisma.

### 3. Desarrollo

Desde la raíz del proyecto:

```bash
npm run dev
```

Esto inicia:
- **Server**: http://localhost:3000
- **Web**: http://localhost:5173 (con proxy a `/api`)

O inicia cada uno por separado:

```bash
npm run server  # Terminal 1
npm run web    # Terminal 2
```

## Estructura

```
.
├── server/              # Backend Express + Prisma
│   ├── src/
│   │   └── index.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env
│   └── package.json
├── web/                 # Frontend React + Vite
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── styles/
│   ├── index.html
│   └── package.json
└── package.json         # Workspace root
```

## Default Credentials

- **Device Password**: `admin` (cámbialo en `.env` luego)
- **Admin PIN**: `1234` (será guardado con hash en la base de datos)

## Features

- Vender: servicios + productos, lavadores, socios, cuentas abiertas
- Caja: resumen diario, gastos, anular ventas, cierre de día
- Socios: clientes frecuentes con historial
- Admin: historial, contabilidad, empleados, catálogo, auditoría, configuración
