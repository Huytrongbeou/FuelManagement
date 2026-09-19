# VNPT Fuel Management System

Hệ thống quản lý nhiên liệu máy phát điện tại các trạm viễn thông VNPT. Theo dõi lượng dầu tồn của từng trạm, cảnh báo trạm sắp hết dầu, nhập liệu thủ công hoặc qua Excel, hiển thị trên bản đồ và cập nhật thời gian thực.

Kiến trúc **monorepo microservices** (Node.js + TypeScript + Prisma + PostgreSQL + RabbitMQ), giao diện web **React + Vite**, có thể đóng gói thành **ứng dụng Android** bằng Capacitor.

## Mục lục

1. [Chức năng](#1-chức-năng)
2. [Phân quyền](#2-phân-quyền)
3. [Kiến trúc](#3-kiến-trúc)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Nghiệp vụ nhiên liệu](#5-nghiệp-vụ-nhiên-liệu)
6. [Cài đặt và chạy](#6-cài-đặt-và-chạy)
7. [Biến môi trường](#7-biến-môi-trường)
8. [API qua gateway](#8-api-qua-gateway)
9. [Cơ sở dữ liệu](#9-cơ-sở-dữ-liệu)
10. [Ứng dụng Android](#10-ứng-dụng-android)
11. [Kiểm thử](#11-kiểm-thử)
12. [Sao lưu và triển khai](#12-sao-lưu-và-triển-khai)
13. [Bảo mật](#13-bảo-mật)

---

## 1. Chức năng

| Nhóm | Mô tả |
|------|-------|
| **Dashboard** | Tổng quan số trạm theo trạng thái nhiên liệu (xanh / vàng / đỏ / xám), thống kê hoạt động |
| **Quản lý trạm** | Danh sách, chi tiết, tạo/sửa trạm; tọa độ, địa chỉ, đơn vị hành chính, vùng vận hành, công suất, suất tiêu thụ, dung tích tối đa. Trạm không bị xóa cứng, chỉ vô hiệu hóa (kèm lý do) |
| **Bản đồ** | Hiển thị trạm trên bản đồ Leaflet theo màu trạng thái; form tạo trạm chọn tọa độ trực tiếp trên bản đồ |
| **Máy phát** | Danh mục hãng và model máy phát (công suất kVA, loại nhiên liệu, suất tiêu thụ và dung tích gợi ý) |
| **Nhân viên** | Danh mục nhân viên phụ trách, gán cho trạm |
| **Lịch sử trạm** | Nhật ký bảo trì và lịch sử thay máy phát của từng trạm |
| **Nhập liệu trực tiếp** | Nhập lượng dầu thêm và số giờ chạy máy theo trạm/ngày (giờ + phút) |
| **Nhập Excel** | Upload → xem trước và kiểm tra hợp lệ → xác nhận/hủy; có lịch sử job, chống trùng lặp, idempotency key, sao lưu trạng thái trước khi ghi |
| **Xuất Excel** | Xuất snapshot hiện tại và tải file mẫu nhập liệu |
| **Điều chỉnh bản ghi** | Manager gửi yêu cầu điều chỉnh bản ghi nhiên liệu, Admin duyệt hoặc từ chối |
| **Yêu cầu trạm** | Luồng đề xuất tạo/sửa trạm, được duyệt bởi Admin/Manager |
| **Người dùng** | Admin quản lý tài khoản và vai trò |
| **Thời gian thực** | Dữ liệu mới đẩy tới trình duyệt qua Socket.IO (RabbitMQ → realtime-service → gateway) |

## 2. Phân quyền

Xác thực bằng JWT (mặc định hết hạn sau 8 giờ). Ba vai trò:

| Vai trò | Quyền |
|---------|-------|
| `admin` | Toàn quyền: người dùng, hãng/model máy phát, nhân viên, trạm, duyệt điều chỉnh |
| `manager` | Nhập liệu trực tiếp, nhập Excel, lịch sử nhập, ghi bảo trì, duyệt/từ chối yêu cầu trạm, gửi yêu cầu điều chỉnh. Không vào các trang quản trị (hãng, model, người dùng, nhân viên) |
| `staff` | Chỉ xem (dashboard, danh sách/chi tiết trạm, bản đồ) và gửi yêu cầu trạm |

Quyền được kiểm tra ở hai lớp: gateway/service (`requireRole`) và điều hướng phía frontend.

## 3. Kiến trúc

```
Trình duyệt / App Android
        │  HTTPS (nginx :443, tùy chọn)
        ▼
   gateway :3000 ── JWT, rate limit 300 req/phút, helmet, CORS
        │
        ├── auth-service :3001            ── auth_db
        ├── station-service :3002         ── station_db
        ├── fuel-service :3003            ── fuel_db
        ├── import-export-service :3004   ── import_db
        └── realtime-service :3005        (WebSocket, không có DB)

   RabbitMQ (exchange `fuel.events`, topic)   PostgreSQL 16 (4 database riêng)
```

| Service | Cổng | DB | Trách nhiệm |
|---------|------|----|-------------|
| `gateway` | 3000 | — | Điểm vào API, xác thực JWT, proxy, tổng hợp dữ liệu (dashboard, bản đồ, chi tiết trạm) |
| `auth-service` | 3001 | `auth_db` | Đăng nhập/đăng xuất, `/me`, CRUD người dùng |
| `station-service` | 3002 | `station_db` | Trạm, hãng/model máy phát, nhân viên, bảo trì, đổi máy, yêu cầu trạm |
| `fuel-service` | 3003 | `fuel_db` | Bản ghi nhiên liệu, trạng thái hiện tại, yêu cầu điều chỉnh |
| `import-export-service` | 3004 | `import_db` | Nhập/xuất Excel, nhập liệu trực tiếp |
| `realtime-service` | 3005 | — | Nhận sự kiện RabbitMQ, đẩy xuống client qua Socket.IO |
| `postgres` | 5432 | — | PostgreSQL 16, khởi tạo 4 database |
| `rabbitmq` | 5672 | — | Message broker (RabbitMQ 3.13) |

**Gọi giữa các service** (HTTP nội bộ, không qua gateway):
`import-export → station` (bulk upsert trạm), `import-export → fuel` (`/fuel/import-commit`), `fuel → station` (lấy suất tiêu thụ).

**Sự kiện RabbitMQ** (`fuel.events`): `fuel.record.created`, `fuel.records.committed` (từ fuel-service), `import.committed` (từ import-export-service) — realtime-service là bên nhận.

Mỗi service theo mô hình **layered MVC** (routes → controllers → services → repositories/helpers). Mỗi service sở hữu database riêng, không ghi chéo DB.

Chi tiết: [docs/architecture.md](docs/architecture.md), [docs/folder-structure.md](docs/folder-structure.md).

## 4. Cấu trúc thư mục

```
apps/web/                 Frontend React + Vite + Tailwind 4 (+ Capacitor Android)
  src/features/           auth, dashboard, stations, generators, employees,
                          fuel, direct-entry, import-export, users, settings
  src/api/                Client gọi gateway
  android/                Dự án Android native
services/
  gateway/                API gateway
  auth-service/           Xác thực, người dùng (Prisma + seed)
  station-service/        Trạm, máy phát, nhân viên
  fuel-service/           Nhiên liệu
  import-export-service/  Excel
  realtime-service/       WebSocket
infrastructure/
  postgres/init/          SQL tạo 4 database
  nginx/                  Cấu hình nginx + script sinh chứng chỉ dev
  backup/                 pg_dump backup (docker-compose.backup.yml)
  scripts/                Sinh Excel mẫu, seed bản ghi nhiên liệu
tests/e2e/                Bộ E2E Playwright
docs/                     Tài liệu kiến trúc
docker-compose.yml        Cấu hình chạy production
docker-compose.dev.yml    Ghi đè cho dev (mở cổng, hot reload)
docker-compose.local-override.yml   Ghi đè cục bộ (gateway ra host :3010)
```

## 5. Nghiệp vụ nhiên liệu

```
fuelConsumed = hoursRun × consumptionRate
fuelAfter    = fuelBefore + fuelAdded − fuelConsumed
```

- `fuelBefore` **luôn đọc từ DB** (`CurrentFuelState.currentFuel`), không nhận từ client.
- `consumptionRate` (lít/giờ) **luôn lấy từ station-service**, không nhận từ client.
- Trạng thái theo **số giờ tự chủ** = lượng dầu còn lại ÷ suất tiêu thụ:

| Số giờ tự chủ | Trạng thái |
|---------------|-----------|
| > 8h | `green` — đủ |
| ≥ 4h và ≤ 8h | `yellow` — sắp hết |
| < 4h | `red` — nguy hiểm |
| Dữ liệu suất tiêu thụ không hợp lệ | `gray` |

Ngưỡng định nghĩa tại `services/fuel-service/src/helpers/fuel-calculator.ts` và **phải khớp** với `apps/web/src/@types/index.ts`.

- Nguồn bản ghi (`source`): `manual`, `excel`, `direct`. Giá trị `direct` chỉ do import-export-service đặt, không lấy từ frontend.
- Bản ghi đã ghi không sửa trực tiếp; sửa qua **yêu cầu điều chỉnh** được Admin duyệt.

## 6. Cài đặt và chạy

Yêu cầu: **Docker + Docker Compose**, **Node.js 20+** (chạy frontend/test), Git.

### 6.1. Cấu hình

```bash
cp .env.example .env
# Sinh JWT secret (>= 32 ký tự, không chứa "change_me"):
openssl rand -hex 32     # dán vào AUTH_JWT_SECRET trong .env
```

Auth-service từ chối khởi động nếu `AUTH_JWT_SECRET` vẫn là giá trị mẫu.

### 6.2. Chạy toàn bộ backend

```bash
# Production-like (chỉ gateway/nginx lộ ra ngoài)
docker compose up -d --build

# Dev: mở cổng 3001–3005, mount mã nguồn, hot reload (ts-node-dev)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

> `docker-compose.dev.yml` mở trực tiếp cổng các service nội bộ, cho phép **bỏ qua gateway và RBAC**. Chỉ dùng trên máy dev.

Để lộ gateway ra host cổng `3010` (dùng cho E2E): thêm `-f docker-compose.local-override.yml`.

Khởi tạo người dùng: seed của auth-service tạo tài khoản `admin` (mật khẩu mặc định `admin123` — **đổi ngay** ngoài môi trường dev).

```bash
cd services/auth-service && npx prisma db seed
```

### 6.3. Chạy frontend

```bash
cd apps/web
# tạo apps/web/.env với nội dung:  VITE_API_URL=http://localhost:3000/api
npm install
npm run dev        # http://localhost:5173
npm run build      # build production vào dist/
```

`VITE_API_URL` trỏ tới gateway (`:3000`, hoặc `:3010` nếu dùng local-override).

### 6.4. Kiểm tra

```bash
curl http://localhost:3000/health
```

## 7. Biến môi trường

Toàn bộ biến nằm trong [.env.example](.env.example). Các biến chính:

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | `fuelapp` / `fuelapp_secret` | Tài khoản PostgreSQL (dùng chung cho RabbitMQ) — đổi khi deploy |
| `AUTH_JWT_SECRET` | *(bắt buộc đổi)* | Khóa ký JWT, dùng chung auth và realtime |
| `AUTH_JWT_EXPIRES_IN` | `8h` | Thời hạn token |
| `*_DATABASE_URL` | — | Chuỗi kết nối từng DB (`auth_db`, `station_db`, `fuel_db`, `import_db`) |
| `RABBITMQ_URL` | — | Địa chỉ AMQP |
| `*_SERVICE_URL` | — | URL nội bộ giữa các service |
| `IMPORT_MAX_FILE_SIZE_MB` | `10` | Giới hạn kích thước file Excel |
| `CORS_ORIGIN` | `http://localhost:5173` | Origin được phép, phân tách bằng dấu phẩy |
| `VITE_API_URL` (frontend) | — | URL gateway cho frontend |

Không commit file `.env`.

## 8. API qua gateway

Frontend chỉ gọi gateway (`/api/...`); mọi route trừ đăng nhập đều yêu cầu `Authorization: Bearer <JWT>`.

| Nhóm | Endpoint chính |
|------|----------------|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Người dùng | `GET/POST /users`, `PATCH/DELETE /users/:id` (admin) |
| Tổng hợp | `GET /dashboard/summary`, `GET /map/stations`, `GET /stations`, `GET /stations/:id/full` |
| Trạm | `GET/POST /stations`, `PUT /stations/:id`, `PATCH /stations/:id/deactivate` và `/reactivate`, `POST /stations/bulk-upsert` |
| Lịch sử trạm | `GET/POST /stations/:id/maintenance`, `GET /stations/:id/machine-changes` |
| Hãng / model | `/brands`, `/models` (GET, POST, PUT, deactivate/reactivate) |
| Nhân viên | `/employees` |
| Yêu cầu trạm | `GET/POST /station-requests`, `POST /station-requests/:id/approve` và `/reject` |
| Nhiên liệu | `GET /fuel/current`, `GET /fuel/current/:station_id`, `GET /fuel/records/:station_id`, `GET /fuel/stats/activity` |
| Điều chỉnh | `POST/GET /fuel/adjustment-requests`, `PATCH /fuel/adjustment-requests/:id/approve` và `/reject` |
| Nhập Excel | `POST /import/upload`, `GET /import/jobs`, `GET /import/jobs/:job_id`, `POST /import/jobs/:job_id/confirm` và `/cancel` |
| Nhập trực tiếp | `POST /manual-entry/preview`, `POST /manual-entry/confirm` |
| Xuất | `GET /export/snapshot`, `GET /export/template` |
| Realtime | Socket.IO qua `/socket.io` |

`POST /fuel/import-commit` và `POST /fuel/current/init` bị gateway chặn (403) — chỉ dùng nội bộ.

## 9. Cơ sở dữ liệu

PostgreSQL 16 với 4 database độc lập (tạo bởi `infrastructure/postgres/init/01-create-databases.sql`). Schema quản lý bằng Prisma trong `services/<tên>/prisma/schema.prisma`.

| Database | Bảng chính |
|----------|-----------|
| `auth_db` | `User` (username, passwordHash, role, isActive) |
| `station_db` | `Station`, `GeneratorBrand`, `GeneratorModel`, `Employee`, `MaintenanceLog`, `StationMachineChange`, `StationRequest` |
| `fuel_db` | `FuelRecord`, `CurrentFuelState`, `AdjustmentRequest`, `FuelImportCommit` |
| `import_db` | `ImportJob` (lưu preview, lỗi hợp lệ, bản sao lưu để hoàn tác, kết quả commit) |

## 10. Ứng dụng Android

Đóng gói bằng Capacitor (`appId`: `vn.vnpt.fuelmanagement`), dùng các plugin app, filesystem, geolocation, share, status-bar.

```bash
cd apps/web
npm run app:sync            # vite build + cap sync
npm run app:open:android    # mở Android Studio
npm run app:run:android     # build + chạy trên thiết bị/emulator

# Build APK debug
cd android && ./gradlew assembleDebug
```

Lưu ý:
- Cần JDK (dùng JBR của Android Studio, đặt `JAVA_HOME` tương ứng).
- `VITE_API_URL` trong `apps/web/.env.production` phải là địa chỉ **thiết bị truy cập được** (IP LAN/domain của gateway). Nếu để `localhost` hoặc IP sai, ứng dụng báo `Failed to fetch`.

## 11. Kiểm thử

- **E2E (Playwright)**: `tests/e2e/`, 118 test, chạy trên stack đang hoạt động (gateway `:3010`, frontend `:5173`). Các file `.env` bắt buộc và tài khoản 3 vai trò xem [tests/e2e/README.md](tests/e2e/README.md).

```bash
cd tests/e2e
npm install
npx playwright test
```

- **Type-check frontend**: `cd apps/web && npx tsc --noEmit`
- **Lint React**: `npm run doctor` (react-doctor)

## 12. Sao lưu và triển khai

**Sao lưu** — `pg_dump` cả 4 database:

```bash
docker compose -f infrastructure/backup/docker-compose.backup.yml run --rm backup
# Khôi phục:
docker exec -i fuel_postgres psql -U $PGUSER <db> < backups/<db>_YYYYMMDD_HHMMSS.sql
```

**Nginx (TLS)**: cấu hình tại `infrastructure/nginx/nginx.conf`, chứng chỉ đặt ở `infrastructure/nginx/certs/` (`server.crt`, `server.key`). Sinh chứng chỉ dev bằng `infrastructure/nginx/generate-dev-certs.sh`. Trên Windows, đảm bảo các `docker-entrypoint.sh` dùng kết thúc dòng LF.

**Checklist triển khai**
- Đổi `POSTGRES_PASSWORD` và `AUTH_JWT_SECRET`, đổi mật khẩu `admin`.
- Không dùng `docker-compose.dev.yml`; không mở cổng 3001–3005, 5432, 5672, 15672 ra ngoài.
- Đặt `CORS_ORIGIN` đúng domain thật.

## 13. Bảo mật

- JWT + kiểm tra vai trò ở gateway và từng service; helmet, CORS, rate limit trên gateway.
- Dữ liệu dùng cho tính toán (`fuelBefore`, `consumptionRate`, `source=direct`) không bao giờ lấy từ client.
- Trạm chỉ vô hiệu hóa, không xóa cứng.
- Nhập Excel dùng idempotency key và chữ ký import để chống ghi trùng.
- Service từ chối khởi động với JWT secret mẫu.

---

Giao diện dựa trên shadcn/ui, xem [apps/web/ATTRIBUTIONS.md](apps/web/ATTRIBUTIONS.md).
