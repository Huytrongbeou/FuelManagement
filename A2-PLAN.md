# A2-PLAN.md — Đổi ngưỡng cảnh báo sang "giờ tự chủ" (Giai đoạn 1)

> Nhánh: `fix/A2-fuel-status-autonomy` · Rollback: `git checkout refactor/layered-mvc-services` (điểm phân nhánh `28f4ad2`).
> **Chưa sửa code.** Chờ Ngài duyệt.

## 0. ⚠️ PHÁT HIỆN QUAN TRỌNG NHẤT — nhiệm vụ này là REVISION, không phải làm mới

Đề bài giả định hệ thống **đang** phân loại theo **lít tuyệt đối** và cần đấu dây `fuelRate` khắp nơi. **Thực tế KHÔNG phải vậy** — A2 đã được triển khai một phần ở phiên trước (commit `98feae6`, đã merge). Hiện trạng:

| Hạng mục đề bài yêu cầu | Thực tế |
|---|---|
| `determineFuelStatus`/`getFuelStatus` nhận `consumptionRate` | **ĐÃ CÓ** cả hai phía |
| 28 call site frontend truyền `fuelRate` | **ĐÃ XONG cả 28** (0 thiếu) |
| `FuelBadge` thêm prop `fuelRate` | **ĐÃ CÓ** (`{ fuel, fuelRate }`) |
| `EntryRow` thêm trường định mức + DirectEntry:171 | **ĐÃ CÓ** (`fuelRate: number`, đã truyền `row.fuelRate`) |
| 4 backend caller truyền `consumptionRate` | **ĐÃ TRUYỀN cả 4** |

→ **Mục 3.2 và mục 4 của đề bài gần như là no-op.** Việc thật sự cần làm là phần **logic ngưỡng** khác với bản đã có, cộng backfill + unit test.

### Bản A2 hiện có KHÁC đặc tả mới ở 4 điểm:
| # | Điểm | A2 hiện có | Đặc tả MỚI |
|---|---|---|---|
| 1 | Ngưỡng vàng | `>= 3h` | **`>= 4h`** |
| 2 | Biên xanh | `>= 8h` (8.00h = xanh) | **`> 8h`** (8.00h = **vàng**, theo dòng 3 bảng chân lý) |
| 3 | Rate ≤ 0 / null | **lùi về lít tuyệt đối** (`fuel>20`→xanh…) | **`gray`** (không được thành xanh) |
| 4 | Tên hằng số | `AUTONOMY_GREEN_HOURS`/`AUTONOMY_YELLOW_HOURS` | `FUEL_AUTONOMY_GREEN_H`/`FUEL_AUTONOMY_YELLOW_H` |

## 1.1 Danh sách file — thực tế so với đề bài

**Chỉ 5 loại thay đổi thật:**
1. `services/fuel-service/src/helpers/fuel-calculator.ts` — sửa logic `determineFuelStatus`: đổi 2 hằng số (8/**4**), biên `>8`/`>=4`, **rate xấu → gray** (bỏ fallback lít), đổi kiểu trả `'unknown'`→`'gray'`. Comment trỏ sang frontend.
2. `apps/web/src/@types/index.ts` — sửa `getFuelStatus` y hệt (đổi hằng số, `>8`/`>=4`, bỏ fallback lít → `gray`). Comment trỏ sang backend.
3. **Text ngưỡng hardcode** (đổi 3→4, và ≥8→>8):
   - `features/stations/pages/MapView.tsx:387–389` (chú giải bản đồ)
   - `features/settings/pages/Settings.tsx:39–40` (`< 3 giờ`→`< 4 giờ`, `3–8 giờ`→`4–8 giờ`)
   - _(Nhãn trạng thái "Đủ nhiên liệu/Sắp hết/Nguy hiểm" giữ nguyên — chỉ đổi con số giờ mô tả ngưỡng.)_
4. **MỚI:** `services/fuel-service/scripts/recompute-fuel-status.ts` + script `package.json`.
5. **MỚI:** unit test 12 dòng bảng chân lý cho `determineFuelStatus`.

**KHÔNG cần đụng** (đã xong): 28 call site, FuelBadge, EntryRow, 4 backend caller.

## 1.2 Backend caller — đều đã có `consumptionRate` trong scope ✓
| file:dòng | lấy rate từ | có sẵn |
|---|---|---|
| adjustment-request.service.ts:127 | `station.consumptionRate` | ✓ đã truyền |
| current-state-init.service.ts:27 | `input.consumptionRate` | ✓ đã truyền |
| import-commit.service.ts:106 | `consumptionRate` (scope) | ✓ đã truyền |
| import-commit.service.ts:148 | `consumptionRate` (scope) | ✓ đã truyền |

→ Backend chỉ cần sửa **1 file** (`fuel-calculator.ts`); 4 caller không phải đụng.

## 1.3 Hiện trạng DB & ước tính theo quy tắc MỚI (số Ngài quan tâm nhất)

9 trạm có `current_fuel_state` (CL-008/009/010 chưa có state). Giá trị lưu chỉ dùng `green/red`.

| Trạm | Tồn | Rate | Giờ | Lưu | Quy tắc MỚI | Đổi |
|---|---|---|---|---|---|---|
| CL-001 | 137.4 | 10.0 | 13.74 | green | green | |
| CL-002 | 208.0 | 14.0 | 14.86 | green | green | |
| CL-003 | 160.0 | 15.0 | 10.67 | green | green | |
| CL-004 | 37.5 | 6.5 | 5.77 | green | **yellow** | 🟢→🟡 |
| CL-005 | 24.0 | 10.5 | 2.29 | green | **red** | 🟢→🔴 |
| CL-006 | 3.0 | 2.5 | 1.20 | red | red | |
| CL-007 | 8.0 | 8.0 | 1.00 | red | red | |
| CL-011 | 95.5 | 6.5 | 14.69 | green | green | |
| CL-012 | 30.0 | 10.0 | 3.00 | green | **red** | 🟢→🔴 |

- **Lưu hiện tại:** green 7 / red 2 → **Quy tắc mới:** green 4 / vàng 1 / **đỏ 4**.
- **3 trạm đổi màu**, trong đó **2 trạm 🟢→🔴** (CL-005 2.29h, CL-012 3.00h) — đúng nhóm "báo an toàn sai".
- CL-012 (đúng 3.00h) là điểm khác biệt do **đổi ngưỡng vàng 3h→4h**: A2-cũ cho *vàng*, quy tắc mới cho **đỏ**.
- **Không trạm nào rate xấu** → chưa phát sinh gray (nhưng backfill vẫn phải xử lý ca này).
- _Lưu ý:_ giá trị lưu đang **cũ** vì A2 phiên trước chưa backfill; frontend đang tính-lại-trực-tiếp theo A2-cũ (8/3). Backfill lần này sẽ đồng bộ cột lưu về quy tắc mới.

## 1.4 Test E2E chạm trạng thái nhiên liệu (dự đoán)
Ứng viên: `DASH-activity-stats`, `F10-F12`, `FI-import-regression`, `SREQ-station-requests`, `helpers/import`.
Dự đoán: **rất ít hoặc không** test đỏ — đa số dùng trạm *disposable* với tồn/rate tự đặt và kiểm **công thức tính tồn** (không đụng), không assert **màu** theo lít. Sẽ phân loại (A)/(B) chính xác ở Giai đoạn 5 sau khi chạy thật. Behavior delta so với A2-cũ chỉ là ngưỡng vàng 3→4 + biên 8 + gray → phạm vi hẹp.

## 2. Bảng chân lý (dùng làm unit test — phải khớp từng dòng)
```
gioTuChu = currentFuel / rate ;  >8 green ; 4..8 yellow ; <4 red ; rate<=0|null|fuel null -> gray
```
1:(21,15)=1.40 red · 2:(21,2.5)=8.40 green · 3:(120,15)=8.00 **yellow** · 4:(120.1,15)=8.006 green ·
5:(60,15)=4.00 **yellow** · 6:(59.9,15)=3.99 red · 7:(0,15)=0 red · 8:(null,15) gray ·
9:(50,0) **gray** · 10:(50,null) **gray** · 11:(300,14)=21.4 green · 12:(25,2.5)=10.0 green

## 3. Thứ tự thực hiện (5 lần DỪNG chờ duyệt)
1. **[DỪNG — đang ở đây]** A2-PLAN.md.
2. Backend: sửa `fuel-calculator.ts` + unit test 12 dòng → build + test 12/12 → **DỪNG báo cáo diff**.
3. Frontend: sửa `@types/index.ts` + 3 chỗ text → tsc list-diff rỗng + vite build → **DỪNG báo cáo**.
4. Backfill: viết script → chạy `--dry-run` **dán kết quả** → **DỪNG chờ duyệt** → `--apply` → dry-run lại (0 đổi).
5. Toàn hệ: docker build+up, chạy kit, **phân loại test đỏ (A)/(B) TRƯỚC khi sửa** → DỪNG báo cáo.

## Điểm cần Ngài xác nhận
- Đồng ý phạm vi hẹp ở §0/§1.1 (chỉ sửa ngưỡng + text + backfill + test; **không** đụng lại phần đấu dây đã xong)?
- Backend `determineFuelStatus` hiện trả `'unknown'` cho ca không tính được. Tại hạ đổi sang `'gray'` cho khớp bảng chân lý + frontend + cột lưu (4 caller đang `as FuelStatus`, ca này chúng không bao giờ chạm vì rate luôn hợp lệ ở luồng commit). Đồng ý chứ?
