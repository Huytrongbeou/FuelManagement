# REFACTOR-PLAN.md — Bản đồ di chuyển cấu trúc (Giai đoạn 1)

> **Chưa di chuyển file nào.** Đây chỉ là bản đồ để Ngài duyệt trước khi thực thi.
> Branch: `refactor/project-structure` · Điểm rollback: `d31a84f` (`git reset --hard d31a84f`)
> Base branch thực tế: **`refactor/layered-mvc-services`** (KHÔNG phải `main` — xem báo cáo Việc 1).

---

## 0. Kết luận rút gọn (đọc trước)

- **Backend gần như KHÔNG phải sửa file cấu hình.** Mọi service dùng `COPY . .`, `tsconfig include: ["src/**/*"]`, `rootDir: ./src`, `dev → src/server.ts`, `start → node dist/server.js`. Vì `app.ts`/`server.ts` **giữ nguyên** ở gốc `src/` và ta chỉ sắp xếp các **thư mục con**, nên **Dockerfile / tsconfig / package.json không đổi**. Ngoại lệ duy nhất: **`fuel-service/scripts/backfill-current-fuel-state.ts`** import `'../src/lib/prisma'` → phải đổi khi dời `lib/`.
- **Frontend rất sạch cho việc dời:** mọi tham chiếu `shared/` đều qua alias `@/` (51 chỗ), chỉ `main.tsx` là relative. Import động toàn là package npm (Capacitor) + 1 lazy trong-feature (`../components/DashboardCharts`, không dời) → **không bị ảnh hưởng**.
- **Backend 0 import động.** `docker-compose*.yml` không đổi (`build.context: ./services/<name>` — thư mục service không dời).
- **realtime-service ĐÃ đúng cấu trúc đích** (`config/`, `socket/`) → **0 file phải dời**. Đề nghị đổi service "làm mẫu" sang **gateway** (xem §1.4).

---

## 1.1 — Bảng ánh xạ từng file

Quy ước: chỉ liệt kê file **có dời**. File không xuất hiện = **giữ nguyên** (gồm `app.ts`, `server.ts`, `controllers/`, `repositories/`, `routes/`, `services/`, các HTTP client `*.client.ts`, và toàn bộ `features/` frontend).

### realtime-service (4 file) — **0 DỜI** (đã đúng đích)
Không có `lib/`, `middleware/`, `models/`, `utils/`. `config/rabbitmq.ts` + `socket/fuel-events.handler.ts` đã đúng chỗ.

### gateway (7 file)
| # | Cũ | Mới | #importers |
|---|---|---|---|
| 1 | `middleware/auth.middleware.ts` | `middlewares/auth.middleware.ts` | 1 |

### auth-service (15 file)
| # | Cũ | Mới | #importers |
|---|---|---|---|
| 1 | `lib/prisma.ts` | `config/prisma.ts` | 4 |
| 2 | `middleware/authenticate.ts` | `middlewares/authenticate.ts` | 1 |
| 3 | `middleware/require-role.ts` | `middlewares/require-role.ts` | 1 |
| 4 | `middleware/validate-login.ts` | `validators/validate-login.ts` | 1 |
| 5 | `models/auth.types.ts` | `@types/auth.types.ts` | 2 |

### fuel-service (19 file)
| # | Cũ | Mới | #importers |
|---|---|---|---|
| 1 | `lib/prisma.ts` | `config/prisma.ts` | 5 (+1 script backfill) |
| 2 | `clients/rabbitmq.ts` | `config/rabbitmq.ts` | 2 |
| 3 | `middleware/require-role.ts` | `middlewares/require-role.ts` | 2 |
| 4 | `utils/audit-log.ts` | `helpers/audit-log.ts` | 1 |
| 5 | `utils/date-vn.ts` | `helpers/date-vn.ts` | 3 |
| 6 | `utils/fuel-calculator.ts` | `helpers/fuel-calculator.ts` | 3 |
| 7 | `utils/normalize.ts` | `helpers/normalize.ts` | 1 |

_(giữ nguyên: `clients/station.client.ts`)_

### import-export-service (22 file)
| # | Cũ | Mới | #importers |
|---|---|---|---|
| 1 | `lib/prisma.ts` | `config/prisma.ts` | 5 |
| 2 | `clients/rabbitmq.ts` | `config/rabbitmq.ts` | 2 |
| 3 | `middleware/require-role.ts` | `middlewares/require-role.ts` | 2 |
| 4 | `utils/audit-log.ts` | `helpers/audit-log.ts` | 2 |
| 5 | `utils/date-vn.ts` | `helpers/date-vn.ts` | 3 |
| 6 | `utils/excel-parser.ts` | `helpers/excel-parser.ts` | 1 |
| 7 | `utils/excel-upload.ts` | `helpers/excel-upload.ts` | 2 |
| 8 | `utils/haversine.ts` | `helpers/haversine.ts` | 1 |
| 9 | `utils/normalize.ts` | `helpers/normalize.ts` | 2 |

_(giữ nguyên: `clients/fuel.client.ts`, `clients/station.client.ts`)_

### station-service (34 file) — lớn nhất, làm CUỐI
| # | Cũ | Mới | #importers |
|---|---|---|---|
| 1 | `lib/prisma.ts` | `config/prisma.ts` | 10 |
| 2 | `clients/rabbitmq.ts` | `config/rabbitmq.ts` | 1 |
| 3 | `middleware/require-role.ts` | `middlewares/require-role.ts` | 5 |
| 4 | `models/station.types.ts` | `@types/station.types.ts` | 1 |
| 5 | `utils/geo.ts` | `helpers/geo.ts` | 2 |
| 6 | `utils/haversine.ts` | `helpers/haversine.ts` | **0 — dead code** (xem §1.3 R2) |

_(giữ nguyên: `clients/fuel.client.ts`)_

### apps/web/src
| # | Cũ | Mới | #importers |
|---|---|---|---|
| 1 | `app/App.tsx` | `App.tsx` | 1 (`main.tsx`) |
| 2 | `shared/types/index.ts` | `@types/index.ts` | 20 |
| 3 | `shared/api/client.ts` | `api/client.ts` | 19 |
| 4 | `shared/auth/permissions.ts` | `utils/permissions.ts` | 4 |
| 5 | `shared/data/dongthap-admin-units.ts` | `data/dongthap-admin-units.ts` | 1 |
| 6 | `shared/utils/date.ts` | `utils/date.ts` | 2 |
| 7 | `shared/utils/geolocation.ts` | `utils/geolocation.ts` | 1 |
| 8 | `shared/components/LoadingScreen.tsx` | `components/LoadingScreen.tsx` | 1 |
| 9 | `shared/components/layout/Sidebar.tsx` | `components/layout/Sidebar.tsx` | 1 |
| 10 | `shared/components/layout/Topbar.tsx` | `components/layout/Topbar.tsx` | 1 |
| 11 | `styles/fonts.css` | `themes/fonts.css` | (chỉ `index.css` @import) |
| 12 | `styles/tailwind.css` | `themes/tailwind.css` | (chỉ `index.css` @import) |
| 13 | `styles/theme.css` | `themes/theme.css` | (chỉ `index.css` @import) |
| 14 | `styles/globals.css` | `themes/globals.css` | **0 — không ai import** (§1.3 R3) |
| 15 | `styles/index.css` | `themes/index.css` | 1 (`main.tsx`) |

_(giữ nguyên TOÀN BỘ `features/**`, và `main.tsx` — chỉ sửa 2 dòng import trong `main.tsx`: `./app/App.tsx`→`./App.tsx`, `./styles/index.css`→`./themes/index.css`)_

Đổi tên alias frontend sau khi dời (rewrite toàn bộ):
`@/shared/types`→`@/@types` · `@/shared/api/client`→`@/api/client` · `@/shared/auth/permissions`→`@/utils/permissions` · `@/shared/data/...`→`@/data/...` · `@/shared/utils/date`→`@/utils/date` · `@/shared/utils/geolocation`→`@/utils/geolocation` · `@/shared/components/LoadingScreen`→`@/components/LoadingScreen` · `@/shared/components/layout/*`→`@/components/layout/*`

---

## 1.2 — File cấu hình phải sửa

| Service/App | File | Sửa gì |
|---|---|---|
| **fuel-service** | `scripts/backfill-current-fuel-state.ts` | dòng 16: `'../src/lib/prisma'` → `'../src/config/prisma'` |
| **apps/web** | `src/main.tsx` | 2 dòng import: App + index.css (như trên) |
| _tất cả backend_ | `tsconfig.json`, `package.json`, `Dockerfile`, `docker-entrypoint.sh` | **KHÔNG đổi** (xem §0) |
| apps/web | `vite.config.ts`, `index.html`, `capacitor.config.ts`, `tsconfig.json` | **KHÔNG đổi** (alias `@`→`./src`, `main.tsx` không dời, `assets/` không dời) |
| _root_ | `docker-compose*.yml` | **KHÔNG đổi** (`build.context: ./services/<name>` không dời) |

---

## 1.3 — Rủi ro đã phát hiện

- **R1 — 30 lỗi kiểu frontend có sẵn** (22×TS2503 React-namespace…). Nợ kỹ thuật, **cố ý không sửa**. So sánh bằng danh sách chuẩn hóa `.refactor-baseline/tsc-web-errors.txt`.
- **R2 — `station-service/src/utils/haversine.ts`: 0 importer** (dead code; `import-export` có bản haversine riêng đang dùng). **Không xóa**, dời sang `helpers/` theo bảng, ghi vào REFACTOR-REPORT.
- **R3 — `apps/web/src/styles/globals.css`: không ai import** (không JS-import, không @import). **Không xóa**, dời sang `themes/`, ghi báo cáo.
- **R4 — `clients/rabbitmq.ts` là kết nối+publish trộn lẫn.** Không tách (cấm). Dời **nguyên file** sang `config/` cho khớp realtime-service (đã là `config/rabbitmq.ts`).
- **R5 — `validate-login.ts` có chữ ký middleware nhưng vai trò validator** → `validators/` theo đúng chỉ định đề bài.
- **R6 — Import động:** frontend chỉ npm (Capacitor) + 1 lazy trong-feature (`../components/DashboardCharts`, không dời); backend 0. **Không bị ảnh hưởng.**
- **R7 — Code trùng lặp giữa service** (`date-vn.ts`, `normalize.ts`, `audit-log.ts` ở fuel+import-export; `haversine.ts` ở import-export+station). **KHÔNG gộp** (đổi kiến trúc, ngoài phạm vi) — ghi báo cáo cho lần sau.
- **R8 — realtime-service đã đúng đích** → 0 dời; "mẫu" thành vô nghĩa. Đề nghị lấy **gateway** làm mẫu (xem §1.4).
- **R9 — `@/@types`** trông lạ nhưng resolve qua index (bundler). Chấp nhận vì đề bài đặt tên `@types/`.
- **R10 — styles→themes:** rủi ro thấp (mọi `@import` là relative cùng thư mục, chỉ 1 tham chiếu ngoài ở `main.tsx`). Nếu Ngài muốn an toàn tuyệt đối, **giữ `styles/`** cũng được (tên đã rõ nghĩa) — xin Ngài quyết ở §2.

---

## 1.4 — Thứ tự thực hiện (rủi ro tăng dần)

| Bước | Service | Số file dời | Ghi chú |
|---|---|---|---|
| 1 | realtime-service | **0** | Xác lập vòng kiểm chứng (verify-only), không commit dời |
| 2 | **gateway** | 1 | **MẪU thật** — DỪNG chờ Ngài duyệt sau bước này |
| 3 | auth-service | 5 | có `validators/` |
| 4 | fuel-service | 7 | + sửa script backfill |
| 5 | import-export-service | 9 | |
| 6 | station-service | 11 | lớn nhất |
| 7 | apps/web | 15 | lưới yếu nhất — DỪNG chờ Ngài duyệt trước khi bắt đầu |

Mỗi service = 1 commit riêng, chạy đủ kiểm chứng §6 (tsc **diff danh sách rỗng**, dev khởi động), rồi báo cáo.

**Kiểm chứng Giai đoạn 3 (đã sửa base):** dùng `refactor/layered-mvc-services...HEAD` thay cho `main...HEAD` khi soát file bị xóa.

---

## 2 — Điểm cần Ngài quyết trước khi thực thi

1. **`styles/` → `themes/`**: đổi (theo đề) hay **giữ `styles/`** (R10)? Mặc định tại hạ sẽ đổi theo đề nếu Ngài không phản đối.
2. **Service làm mẫu**: realtime 0-dời → lấy **gateway** làm mẫu thật. Ngài đồng ý?
3. **`@types/` frontend**: chấp nhận import `@/@types` (qua index) chứ? (thay cho `@/shared/types`)
