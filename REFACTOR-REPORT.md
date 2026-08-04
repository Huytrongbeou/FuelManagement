# REFACTOR-REPORT.md — Tổng kết refactor cấu trúc thư mục

> Branch: `refactor/project-structure` (trên nền `refactor/layered-mvc-services`)
> Phạm vi: **chỉ di chuyển file + sửa dòng import**. Không đổi logic, không tách/gộp/xóa file.
> Rollback: `git reset --hard d31a84f`

## 1. Số file di chuyển / tổng

| | Số |
|---|---|
| File **rename** (di chuyển) | **43** |
| Dòng **import** sửa | **123** (gw 1 · auth 9 · fuel 18 · import-export 20 · station 19 · web 56) |
| File **xóa** | **0** |
| File tracked: baseline → sau | 244 → 258 (**+14** = 100% file mới thêm chủ động: 1 `tsconfig.json` + 1 `REFACTOR-PLAN.md` + 12 file `.refactor-baseline/`) |
| Kiểm chứng rename | git nhận **43 rename** (R097–R100), `git diff -M ...HEAD | grep '^D'` **rỗng** |

Mỗi service = 1 commit riêng: `621e76f`(gateway) · `d10970e`(auth) · `487a34b`(fuel) · `21063d5`(import-export) · `a9a9f7a`(station) · `8f26229`(web). realtime-service: **0 dời** (đã đúng đích sẵn).

## 2. Số lỗi tsc trước → sau

| Đối tượng | Trước | Sau | Ghi chú |
|---|---|---|---|
| 6 backend service | 0 | 0 | list-diff **rỗng** từng service |
| Frontend | 30 | 30 | **danh sách** giống hệt; 3 dòng chỉ **đổi path** theo file dời (client.ts, Topbar, main.tsx-css) — không lỗi mới, không lỗi mất |

So sánh bằng **danh sách chuẩn hóa** (bỏ số dòng/cột, sort) chứ không bằng số lượng — để bắt cả trường hợp một lỗi cũ biến mất (file rơi khỏi phạm vi tsc) lẫn lỗi mới xuất hiện.

## 3. Cấu trúc đích đã áp dụng

Backend (mỗi service, chỉ tạo thư mục khi có file thật): `lib/`→`config/`, `clients/rabbitmq.ts`→`config/`,
`middleware/`→`middlewares/`, `models/*.types.ts`→`@types/`, `utils/`→`helpers/`,
`middleware/validate-login.ts`→`validators/` (chỉ auth). **Giữ** `clients/` (HTTP client), `controllers/`,
`repositories/`, `services/`, `routes/`, `app.ts`, `server.ts`.

Frontend: `shared/{types→@types, api, auth/permissions→utils/permissions, data, utils, components}`,
`app/App.tsx`→`App.tsx`, `styles/`→`themes/`. **Giữ nguyên** `features/**` và `main.tsx`.

## 4. File cấu hình đã sửa (và KHÔNG sửa)

| File | Sửa gì |
|---|---|
| `services/fuel-service/scripts/backfill-current-fuel-state.ts` | 1 dòng: `'../src/lib/prisma'` → `'../src/config/prisma'` |
| `apps/web/src/main.tsx` | 2 dòng import: `./app/App.tsx`→`./App.tsx`, `./styles/index.css`→`./themes/index.css` |
| `apps/web/tsconfig.json` | **Tạo mới** (lưới an toàn) — xem §7 |

**KHÔNG sửa** (nhờ cấu trúc `COPY . .` + `include:["src/**/*"]` + `server.ts` ở gốc src): mọi `Dockerfile`,
`package.json` (scripts), `tsconfig.json` backend, `docker-entrypoint.sh`; và `vite.config.ts`, `index.html`,
`capacitor.config.ts`, `docker-compose*.yml`.

## 5. File có vẻ KHÔNG được dùng (để Ngài quyết xóa sau — tại hạ KHÔNG xóa)

- `services/station-service/src/helpers/haversine.ts` — **0 importer** (station-service dùng `geo.ts`; bản haversine là tàn dư). import-export có bản haversine riêng đang dùng.
- `apps/web/src/themes/globals.css` — **không** file nào `@import` hay JS-import (chỉ `index.css` import fonts/tailwind/theme).

## 6. Code TRÙNG LẶP giữa các service (đề xuất lần sau, KHÔNG gộp lần này)

`date-vn.ts` (fuel + import-export) · `normalize.ts` (fuel + import-export) · `audit-log.ts` (fuel +
import-export) · `haversine.ts` (import-export + station). Gộp thành package dùng chung là **thay đổi kiến
trúc**, ngoài phạm vi "di chuyển file". Đề xuất: tạo `packages/shared-utils` (workspace) ở đợt sau.

## 7. Việc cố ý KHÔNG làm (ngoài phạm vi)

- **Không** gộp code trùng lặp (§6) · **Không** tách `routes/` khỏi `App.tsx` (là sửa logic) · **Không** tạo
  barrel `index.ts` (dễ import vòng) · **Không** sửa **30 lỗi kiểu frontend có sẵn** (nợ kỹ thuật, chủ yếu
  `TS2503` React-namespace do dùng `React.X` trong type mà không `import React`) · **Không** dời `src/assets`
  (vite hard-code) hay `main.tsx` (index.html trỏ cứng) · **Không** tách lại branch từ `main`.
- **Về branch gốc:** `refactor/layered-mvc-services` = `main` + 116 commit (fast-forward, KHÔNG diverge);
  `main` dừng ở 17/06/2026. Tách lại từ main sẽ mất 116 commit → giữ nguyên nền layered.

## 8. Ghi chú quan trọng — lưới an toàn từng THỦNG

`apps/web` không có `tsconfig.json` → frontend **chưa bao giờ được type-check** (esbuild/vite bỏ qua lỗi
kiểu). tsconfig tạo ban đầu (theo mẫu) có `baseUrl` → sinh `TS5101` là lỗi **cấu hình**, khiến `tsc` **dừng
trước khi kiểm tra**: lưới bắt được **0** import gãy (đã thử phá — không báo). **Bỏ `baseUrl`** (paths vẫn
chạy với `moduleResolution:"bundler"`) mới làm lưới hoạt động thật — đã kiểm chứng bằng cách phá import
alias/tương đối/named-export ở cả frontend lẫn backend, đều báo `TS2307`. Nhờ vậy mới lộ ra 30 lỗi có sẵn.

## 9. Kiểm chứng toàn hệ (Giai đoạn 3)

- Kiểm kê file: khớp (chênh +14 = file thêm chủ động). File bị xóa: **0**.
- `tsc --noEmit` mọi service: **0 lỗi**; frontend: list-diff **rỗng**.
- `npm run build` từng service: **exit 0**; `npx vite build`: **exit 0**.
- `docker compose build`: **exit 0**, cả 6 image build sạch.
- `docker compose up`: **9/9 container healthy**, log **không** `MODULE_NOT_FOUND`, mọi service listening + RabbitMQ connected.
- **E2E kit** (`D:\fuel-frontend-test-runner`): lần chạy đầu **116 passed / 1 skipped / 1 failed**. Lỗi
  duy nhất là **FI-13** ("double-commit"), **KHÔNG do refactor**: test dùng trạm chia sẻ + `recordedDate:
  today`, chỉ né `isDuplicate` (fuelAdded unique) mà không lường cảnh báo **cùng-ngày** của A5 (tính năng
  đã có từ trước refactor) — trạm chia sẻ tích lũy bản ghi hôm nay nên confirm-1 thiếu `acknowledgeWarnings`
  bị chặn. Đã tái hiện thủ công trên backend (preview trả `warningRows=1`), xác nhận là hành vi logic A5.
  Vá test: confirm-1 truyền `acknowledgeWarnings: true` (đúng nghĩa "Vẫn tạo"). **Chạy lại full kit:
  117 passed / 1 skipped / 0 failed** (exit 0). _(Bản vá nằm ở repo test-runner riêng, không thuộc commit refactor.)_

## 10. Rollback

```
git reset --hard d31a84f     # về ngay trước Giai đoạn 0
```
