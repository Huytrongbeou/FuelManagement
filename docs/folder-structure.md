# Folder Structure

## Overview

This project uses **Monorepo Microservices + Modular MVC** — each service is an independent deployable unit; the monorepo layout is purely for developer convenience.

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

Each service follows **Modular MVC / Layered Architecture** inside its own `src/`:

```
src/
├── server.ts
├── modules/
│   └── <domain>/
│       ├── <domain>.controller.ts
│       ├── <domain>.service.ts
│       ├── <domain>.repository.ts  (if DB access)
│       └── <domain>.routes.ts
└── shared/
    ├── clients/                    # HTTP clients for other services
    └── utils/                      # Pure utility functions
```

### fuel-service (port 3003)

```
src/
├── server.ts
├── modules/
│   ├── fuel-records/
│   │   ├── fuel-record.controller.ts
│   │   ├── fuel-record.service.ts
│   │   ├── fuel-record.repository.ts
│   │   └── fuel-record.routes.ts
│   └── import-commit/
│       └── import-commit.service.ts
└── shared/
    ├── clients/
    │   ├── rabbitmq.ts
    │   └── station.client.ts
    └── utils/
        └── fuel-calculator.ts
```

### import-export-service (port 3004)

```
src/
├── server.ts
├── modules/
│   ├── excel-import/
│   │   ├── import.controller.ts
│   │   ├── import.routes.ts
│   │   ├── excel-validator.service.ts
│   │   └── import-orchestrator.service.ts
│   ├── excel-export/
│   │   ├── export.controller.ts
│   │   └── export.routes.ts
│   └── manual-entry/
│       ├── manual-entry.controller.ts
│       ├── manual-entry.routes.ts
│       └── manual-entry.service.ts
└── shared/
    ├── clients/
    │   ├── fuel.client.ts
    │   ├── rabbitmq.ts
    │   └── station.client.ts
    └── utils/
        ├── excel-parser.ts
        └── haversine.ts
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
