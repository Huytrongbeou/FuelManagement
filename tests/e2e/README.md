# Fuel Management — E2E Test Kit

Bộ E2E Playwright kiểm thử hệ thống **Fuel Management** (backend microservices + frontend React).
Kit chạy độc lập với monorepo, nhắm vào một stack **đang chạy** (backend qua gateway + frontend Vite).

```bash
npm install
npx playwright test              # full kit (~9 phút, 118 test)
npx playwright test tests/FI-import-regression.spec.ts -g "FI-13"   # 1 test
```

---

## ⚠️ Phụ thuộc các file KHÔNG được git theo dõi

Kit **và** stack mà nó nhắm tới đều dựa vào một số file **untracked** (không có trong `git clone` sạch của
monorepo lẫn kit). Thiếu bất kỳ file nào bên dưới, kit sẽ đỏ hàng loạt vì lý do **không liên quan đến code**.
Đây là danh sách đầy đủ để dựng lại từ đầu — ghi lại vì đã từng mất nhiều giờ chỉ để phát hiện chúng.

### A. Ở kit này (`fuel-frontend-test-runner/`)
| File | Nội dung / khóa | Vai trò |
|---|---|---|
| `.env` | `FRONTEND_URL=http://localhost:5173`, `GATEWAY_URL=http://localhost:3010/api/`, `ADMIN_USERNAME`/`ADMIN_PASSWORD`, `MANAGER_USERNAME`/`MANAGER_PASSWORD`, `STAFF_USERNAME`/`STAFF_PASSWORD`, `REPO_PATH`, `RUN_MODE`, `ALLOW_WRITE_TESTS=true` | URL stack + thông tin đăng nhập 3 vai trò. **Mật khẩu phải KHỚP với user trong DB** (xem mục C). |

### B. Ở monorepo Fuel Management (cần để dựng stack kit nhắm tới)
| File (đường dẫn trong monorepo) | Vai trò | Thiếu thì |
|---|---|---|
| `.env` (gốc) | `POSTGRES_USER/PASSWORD`, `AUTH_JWT_SECRET`, `*_DATABASE_URL`, `*_SERVICE_URL/PORT`, `RABBITMQ_URL`, `CORS_ORIGIN` | Backend services crash lúc khởi động (`FATAL: JWT_SECRET missing`…) |
| `apps/web/.env` | **`VITE_API_URL=http://localhost:3010/api`** | Frontend dev mặc định gọi `:3000` (sai — gateway ở host `:3010`) → **UI login thất bại → mọi test UI đỏ** |
| `docker-compose.local-override.yml` | remap gateway ra host: `ports: !override ["3010:3000"]` | Gateway không lộ ở `:3010` → kit không gọi được API |
| `infrastructure/nginx/certs/server.crt` + `server.key` | Chứng chỉ TLS cho nginx (`:443`) | nginx crash-loop. **Kit KHÔNG cần nginx** (gọi thẳng `:3010`+`:5173`), nên có thể bỏ qua khi chỉ chạy kit — nhưng stack "đầy đủ" thì cần. |

> Lưu ý Windows: khi checkout trên máy có `core.autocrlf=true`, các `docker-entrypoint.sh` có thể bị **CRLF**
> → container báo `exec ./docker-entrypoint.sh: no such file or directory`. Chuẩn hóa về LF trước khi build
> (`sed -i 's/\r$//' services/*/docker-entrypoint.sh`) hoặc đặt `*.sh text eol=lf` trong `.gitattributes`.

### C. ⚠️ Trạng thái DB phải có sẵn (bẫy lớn nhất)
Kit **giả định** DB đã có sẵn và **KHÔNG tự tạo** 3 user đăng nhập cũng như các trạm nền:
- **Seed gốc chỉ tạo `admin/admin123`** (`services/auth-service/prisma/seed.ts`). **Không** tạo `manager`, `staff`,
  cũng **không** đặt mật khẩu `VnptVnpt…` mà `.env` của kit dùng.
- Vì vậy, dựng từ DB trắng cần: (1) chạy **`node scripts/seed-test-accounts.mjs`** — script idempotent, đọc
  `ADMIN/MANAGER/STAFF_*` từ `.env` của kit rồi upsert cả ba user (đúng role, băm mật khẩu **trong container
  `fuel_auth`**, không cần cài thêm gì); (2) seed trạm (`station-service`: `npm run seed` → 12 trạm `CL-*` +
  tồn ban đầu). Không còn thao tác SQL bằng tay.
- `global-setup.ts` của kit chỉ **đăng nhập** bằng các user đó rồi tạo dữ liệu test (trạm base, fixture Excel,
  bản ghi F14) — nó **không** bootstrap user/mật khẩu.

Cách nhanh nhất khi cần một DB "sạch mà chạy được": **clone volume Postgres của một stack đã provisioning đúng**
(`docker run --rm -v <src>_pg_data:/from:ro -v <new>_pg_data:/to alpine sh -c "cp -a /from/. /to/"`) rồi trỏ
stack mới vào volume clone — giữ nguyên user/mật khẩu/trạm.

---

## Dựng lại từ clone sạch (tóm tắt)
1. Monorepo: tạo `.env` gốc, `apps/web/.env` (VITE_API_URL=…:3010), `docker-compose.local-override.yml`, cert nginx (nếu cần nginx).
2. `docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.local-override.yml up -d --build` → chờ healthy.
3. Provisioning DB: `node scripts/seed-test-accounts.mjs` (admin/manager/staff) + seed trạm CL (mục C).
4. `cd apps/web && npm run dev` (Vite `:5173`).
5. Kit: tạo `.env` (mục A) → `npm install` → `npx playwright test`.

## Đặc điểm cần biết của kit
- **Phụ thuộc thứ tự chạy + ngày hệ thống** ở một chỗ: **`FI-import-regression.spec.ts`** dùng **trạm chia sẻ**
  (`getActiveStationWithFuelState`, 6 chỗ). Nếu một test trước ghi bản ghi **cùng ngày** cho trạm đó, kiểm tra
  chống-trùng-nội-dung (same-date) làm `confirm` không kèm `acknowledgeWarnings` bị chặn (ví dụ **FI-13**). Các
  spec còn lại đều tạo **trạm disposable** cô lập nên không bị.
- Một số ID (`FI-01,06,07,08,15,18,19,20`…) không tồn tại như test riêng — bình thường.
