# Los Pits — Sistema de Caja y Nómina

Aplicación web para gestión de punto de venta, nómina y contabilidad del carwash Los Pits. MVP migrado de HTML puro a web stack real (Express + React + Prisma + SQLite).

## Arquitectura

- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Base de datos**: SQLite (archivo local, fácil backup)
- **Frontend**: React + Vite + TypeScript
- **Seguridad**: PIN hashing con bcrypt, device session auth, audit logging en todas las acciones sensibles

## Setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Inicializar base de datos

```bash
cd server
npm run db:push
```

Esto:
- Crea `db.sqlite` si no existe
- Aplica el schema Prisma
- Inicializa `AppConfig` con usuario y contraseña defaults

### 3. Desarrollo

Desde la raíz:

```bash
npm run dev
```

Esto inicia:
- **Server**: http://localhost:3000
- **Web**: http://localhost:5173 (con proxy a `/api`)

O en terminales separadas:

```bash
npm run server  # Terminal 1
npm run web    # Terminal 2
```

## Estructura

```
.
├── server/                    # Backend Express + Prisma
│   ├── src/
│   │   ├── index.ts          # Main server + routes setup
│   │   ├── routes/
│   │   │   ├── auth.ts       # Device login
│   │   │   ├── vender.ts     # Sales, catalog, open accounts
│   │   │   ├── caja.ts       # Daily summary, expenses, close day
│   │   │   ├── socios.ts     # Customers CRUD
│   │   │   └── admin.ts      # Admin panel (6 tabs + edit sale)
│   │   └── utils/
│   │       └── auth.ts       # PIN/password hashing
│   ├── prisma/
│   │   └── schema.prisma     # Full data model
│   ├── .env                  # Database URL, secret keys
│   └── package.json
├── web/                       # Frontend React + Vite
│   ├── src/
│   │   ├── App.tsx           # Main app with tabs
│   │   ├── pages/
│   │   │   ├── Login.tsx     # Device auth
│   │   │   ├── Vender.tsx    # Sales, services, products
│   │   │   ├── Caja.tsx      # Daily cash management
│   │   │   ├── Socios.tsx    # Customer management
│   │   │   └── Admin.tsx     # Admin dashboard (6 tabs)
│   │   ├── context/
│   │   │   └── useApp.ts     # Global app state
│   │   └── styles/
│   │       ├── index.css     # Dark theme + layout
│   │       └── login.css     # Login page
│   ├── index.html
│   └── package.json
└── package.json              # Workspace root (npm workspaces)
```

## Endpoints

### Auth
- `GET /api/auth/check` — Check session
- `POST /api/auth/login` — Device login (password)
- `POST /api/auth/logout` — Logout

### Vender (requires auth)
- `GET /api/vender/catalogo` — Servicios + productos
- `POST /api/vender/venta` — Crear venta (PIN confirm)
- `GET /api/vender/cuentas` — Listar cuentas abiertas
- `POST /api/vender/cuentas` — Crear cuenta abierta
- `PUT /api/vender/cuentas/:id` — Actualizar items de cuenta
- `DELETE /api/vender/cuentas/:id` — Cancelar cuenta
- `POST /api/vender/cuentas/:id/checkout` — Cerrar cuenta → venta

### Caja (requires auth)
- `GET /api/caja/resumen` — Resumen del día
- `POST /api/caja/gasto` — Registrar gasto (PIN)
- `DELETE /api/caja/gasto/:id` — Eliminar gasto (PIN + motivo)
- `POST /api/caja/venta/:id/anular` — Anular venta (PIN + motivo)
- `POST /api/caja/cerrar` — Cerrar caja del día (PIN)

### Socios (requires auth)
- `GET /api/socios` — Listar (con búsqueda)
- `POST /api/socios` — Crear
- `GET /api/socios/:id` — Obtener
- `PUT /api/socios/:id` — Editar (PIN)
- `DELETE /api/socios/:id` — Eliminar (PIN + motivo)
- `GET /api/socios/:id/consumos` — Historial de ventas (readonly)

### Admin (requires auth + adminPin)
- `GET /api/admin/historial` — Agregados por semana/quincena/mes
- `GET /api/admin/contabilidad` — Totales + libro diario
- `GET /api/admin/empleados` — Listar empleados
- `POST /api/admin/empleados` — Crear empleado
- `PUT /api/admin/empleados/:id` — Editar perfil/sueldo/comisión
- `DELETE /api/admin/empleados/:id` — Eliminar empleado
- `GET /api/admin/catalogo` — Servicios + productos
- `POST /api/admin/catalogo/servicio` — Crear servicio
- `PUT /api/admin/catalogo/servicio/:id` — Editar precio
- `DELETE /api/admin/catalogo/servicio/:id` — Eliminar servicio
- `POST /api/admin/catalogo/producto` — Crear producto
- `PUT /api/admin/catalogo/producto/:id` — Editar precio
- `DELETE /api/admin/catalogo/producto/:id` — Eliminar producto
- `GET /api/admin/auditoria` — Audit log (readonly)
- `PUT /api/admin/venta/:id` — Editar venta cobrada (PIN + motivo)
- `PUT /api/admin/config/admin-pin` — Cambiar PIN admin

## Default Credentials

- **Device Password**: `admin` (en `.env` server/)
- **Admin PIN**: `1234` (hasheado en BD al iniciar)

Cambiar en producción SIEMPRE.

## Data Model

Ver [server/prisma/schema.prisma](server/prisma/schema.prisma) para el schema completo.

Entidades principales:
- `Empleado` — Recepción, lavadores, extras con PIN individual, comisión personal
- `Socio` — Clientes frecuentes con número, autos, consumo history
- `Venta` — Transacciones con items, método pago, recibo, referencia, cajero
- `Gasto` — Gastos (nómina u otros) con categoría
- `CuentaAbierta` — Carrito temporal, se convierte a Venta
- `CierreDeCaja` — Historial diario (week/month reporting)
- `AuditLog` — Todas las acciones: quién, qué, cuándo, detalle
- `CatalogoServicio`, `CatalogoProducto` — Precios

## Security

- PIN hashing: bcrypt (10 rounds)
- All PIN-requiring actions logged with real employee name
- Admin PIN gates sensitive operations
- Motivo (reason) field required on: anular venta, eliminar gasto, eliminar/editar socio
- Comisiones individuales por empleado (% + threshold)
- Edit venta: admin-only with before/after audit trail

## Diseño

- Mobile-first, tablet-optimized (touch targets)
- Dark theme (fondo #14171A) para legibilidad con luz solar directa
- Acentos amarillo (#FFC72C) y rojo (#E5484D)
- Tipografías del sistema (no Google Fonts) con weight 900 para títulos — resuelve bug de legibilidad por fallback
- Botones grandes táctiles, 64px min height
