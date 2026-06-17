# Folder Structure

## Overview

This project uses **Monorepo Microservices + Layered MVC Architecture** — each service is an independent deployable unit; the monorepo layout is purely for developer convenience.

## Root

```
FuelManagement/
├── apps/
│   └── web/                        # React/Vite frontend (not containerized)
├── services/
│   ├── gateway/                    # API gateway, port 3000
│   ├── auth-service/               # JWT auth, port 3001
│   ├── station-service/            # Stations, brands, models, port 3002
│   ├── fuel-service/               # Fuel records & state, port 3003
│   ├── import-export-service/      # Excel import/export, DirectEntry, port 3004
│   └── realtime-service/           # WebSocket via RabbitMQ, port 3005
├── infrastructure/
│   ├── postgres/init/              # DB init SQL scripts
│   └── scripts/                    # Utility scripts
├── docs/                           # Architecture documentation
├── docker-compose.yml
└── docker-compose.dev.yml
```

## Frontend — apps/web/src/

Feature-based structure. The `@` alias resolves to `./src`.

```
src/
├── main.tsx                        # Vite entry point
├── app/
│   ├── App.tsx                     # Root component, routing state
│   └── mockData.ts
├── features/                       # One folder per domain
│   ├── auth/
│   │   ├── api/authApi.ts
│   │   └── pages/Login.tsx
│   ├── dashboard/
│   │   ├── api/dashboardApi.ts
│   │   └── pages/Dashboard.tsx
│   ├── stations/
│   │   ├── api/stationApi.ts
│   │   ├── components/StationFormModal.tsx
│   │   └── pages/{StationList,StationDetail,MapView}.tsx
│   ├── fuel/
│   │   ├── api/fuelApi.ts
│   │   └── components/FuelEntryModal.tsx
│   ├── direct-entry/
│   │   ├── api/manualEntryApi.ts
│   │   └── pages/DirectEntry.tsx
│   ├── import-export/
│   │   ├── api/importApi.ts
│   │   └── pages/{ImportExcel,ImportHistory}.tsx
│   ├── generators/
│   │   ├── api/{brandApi,modelApi}.ts
│   │   └── pages/{GeneratorBrands,GeneratorModels,GeneratorTypes}.tsx
│   └── settings/
│       └── pages/Settings.tsx
└── shared/                         # Cross-feature shared code
    ├── api/
    │   ├── client.ts               # fetch wrapper with auth
    │   └── socket.ts
    ├── components/
    │   ├── layout/{Sidebar,Topbar}.tsx
    │   ├── figma/ImageWithFallback.tsx
    │   └── ui/                     # shadcn/ui components (40+)
    └── types/
        └── index.ts                # All shared TypeScript types
```

## Backend Services — Internal Structure

Each service follows **Microservices + Layered MVC Architecture** — flat layer grouping by technical concern, not by domain:

```
src/
├── app.ts               # Express app: middleware + routes (exported)
├── server.ts            # Entry: import app, connect RabbitMQ, listen
├── controllers/         # Request/response handling
├── services/            # Business logic
├── repositories/        # DB queries (Prisma) — only if service has DB
├── routes/              # Route declarations
├── models/              # TypeScript interfaces & DTOs
├── middleware/          # auth, validation
├── clients/             # HTTP clients for other services + RabbitMQ
├── utils/               # Pure helpers (no cross-service calls)
├── socket/              # Only in realtime-service
└── config/              # Only in realtime-service
```

### auth-service (port 3001)

```
src/
├── app.ts
├── server.ts
├── controllers/auth.controller.ts
├── services/auth.service.ts
├── repositories/auth.repository.ts
├── routes/auth.routes.ts
├── models/auth.types.ts
└── middleware/
    ├── authenticate.ts
    └── validate-login.ts
```

### station-service (port 3002)

```
src/
├── app.ts
├── server.ts
├── controllers/
│   ├── station.controller.ts
│   ├── generator-brand.controller.ts
│   └── generator-model.controller.ts
├── services/
│   ├── station.service.ts
│   ├── station-bulk-upsert.service.ts
│   ├── generator-brand.service.ts
│   └── generator-model.service.ts
├── repositories/
│   ├── station.repository.ts
│   ├── generator-brand.repository.ts
│   └── generator-model.repository.ts
├── routes/
│   ├── station.routes.ts
│   ├── generator-brand.routes.ts
│   └── generator-model.routes.ts
├── models/station.types.ts
├── clients/rabbitmq.ts
└── utils/haversine.ts
```

### fuel-service (port 3003)

```
src/
├── app.ts
├── server.ts
├── controllers/fuel-record.controller.ts
├── services/
│   ├── fuel-record.service.ts
│   └── import-commit.service.ts
├── repositories/fuel-record.repository.ts
├── routes/fuel-record.routes.ts
├── clients/
│   ├── rabbitmq.ts
│   └── station.client.ts
└── utils/fuel-calculator.ts
```

### import-export-service (port 3004)

```
src/
├── app.ts
├── server.ts
├── controllers/
│   ├── import.controller.ts
│   ├── export.controller.ts
│   └── manual-entry.controller.ts
├── services/
│   ├── import-orchestrator.service.ts
│   ├── excel-validator.service.ts
│   └── manual-entry.service.ts
├── routes/
│   ├── import.routes.ts
│   ├── export.routes.ts
│   └── manual-entry.routes.ts
├── clients/
│   ├── fuel.client.ts
│   ├── rabbitmq.ts
│   └── station.client.ts
└── utils/
    ├── excel-parser.ts
    └── haversine.ts
```

### gateway (port 3000)

```
src/
├── app.ts               # Express + CORS + rateLimit + all routes; exports app + wsProxy
├── server.ts            # http.Server + WebSocket upgrade + listen
├── controllers/
│   ├── stations.controller.ts      # list with fuel state + shared helpers
│   ├── dashboard.controller.ts     # aggregates station + fuel for dashboard
│   ├── map-stations.controller.ts  # aggregates station + fuel for map
│   └── station-full.controller.ts  # single station + fuel state
└── middleware/
    └── auth.middleware.ts
```

### realtime-service (port 3005)

```
src/
├── app.ts               # Express + health endpoint
├── server.ts            # http.Server + Socket.io + RabbitMQ + listen
├── socket/
│   └── fuel-events.handler.ts   # consume RabbitMQ events → emit to socket.io
└── config/
    └── rabbitmq.ts              # RabbitMQ connection + queue binding
```

## Naming Conventions

| File type | Pattern | Example |
|-----------|---------|---------|
| Controller | `<domain>.controller.ts` | `fuel-record.controller.ts` |
| Service | `<domain>.service.ts` | `fuel-record.service.ts` |
| Repository | `<domain>.repository.ts` | `fuel-record.repository.ts` |
| Routes | `<domain>.routes.ts` | `fuel-record.routes.ts` |
| HTTP client | `<service>.client.ts` | `station.client.ts` |
| Utility | `<name>.ts` (kebab-case) | `fuel-calculator.ts` |

## Service Boundaries

Services communicate **only via HTTP through the gateway or direct HTTP client calls**. No service imports code from another service.

| Allowed | Not allowed |
|---------|-------------|
| `await stationClient.getStation(id)` | `import { ... } from '../../station-service/src/...'` |
| `await fuelClient.commitImport(...)` | Shared DB tables across services |
| RabbitMQ events | Direct DB queries into another service's DB |
