# Architecture

## Overview

VNPT Fuel Management System — Microservices architecture deployed via Docker Compose.

## Service Map

| Service | Container | Port | DB | Responsibility |
|---------|-----------|------|----|----------------|
| gateway | fuel_gateway | 3000 | — | API entry, auth middleware, proxy |
| auth-service | fuel_auth | 3001 | auth_db | JWT login, token validation |
| station-service | fuel_station | 3002 | station_db | Stations, generator brands/models |
| fuel-service | fuel_fuel | 3003 | fuel_db | Fuel records, current state |
| import-export-service | fuel_import | 3004 | import_db | Excel import/export, DirectEntry |
| realtime-service | fuel_realtime | 3005 | — | WebSocket push via RabbitMQ |
| postgres | fuel_postgres | 5432 | — | PostgreSQL 16, 4 separate databases |
| rabbitmq | fuel_rabbitmq | 5672 | — | AMQP message broker |

## Request Flow

```
Browser → gateway:3000
  → /auth/*        → auth-service:3001
  → /stations/*    → station-service:3002
  → /fuel/*        → fuel-service:3003
  → /import/*      → import-export-service:3004
  → /export/*      → import-export-service:3004
  → /manual-entry/* → import-export-service:3004
  → /realtime      → realtime-service:3005 (WebSocket upgrade)
```

The gateway validates JWT on every authenticated route before proxying.

## Service-to-Service Communication

Internal calls use HTTP clients (not through the gateway):

```
import-export-service → station-service:3002  (bulk upsert stations)
import-export-service → fuel-service:3003      (POST /fuel/import-commit)
fuel-service          → station-service:3002   (get station consumption rate)
```

`POST /fuel/import-commit` is blocked at the gateway (403) — only import-export-service may call it internally.

## Event Bus (RabbitMQ)

Exchange: `fuel.events` (topic)

| Routing key | Publisher | Subscriber |
|-------------|-----------|------------|
| `fuel.record.created` | fuel-service | realtime-service |
| `fuel.records.committed` | fuel-service | realtime-service |
| `import.committed` | import-export-service | realtime-service |

## Security Constraints

- `fuel_before` is NEVER sourced from the client — always read from DB.
- `source='direct'` is set by `manual-entry.service.ts`, never from the frontend.
- Stations are never hard-deleted — only deactivated (`active=false`).
- Frontend only calls the gateway; never calls internal services directly.
- Services own their own DB; no cross-service DB writes.

## Fuel Calculation (Business Logic)

```
fuelConsumed = hoursRun × consumptionRate
fuelAfter    = fuelBefore + fuelAdded - fuelConsumed
```

`fuelBefore` is always the `currentFuel` value from the DB at time of write.
`consumptionRate` is always fetched from station-service, never from the client.
