# A2-REPORT.md — Đổi ngưỡng cảnh báo sang "giờ tự chủ"

> Nhánh: `fix/A2-fuel-status-autonomy` · Rollback: xem §8.
> Bản chất: **REVISION** quy tắc A2 đã có (98feae6). Phần đấu dây `fuelRate`/`consumptionRate` đã xong từ trước;
> lần này chỉ đổi **logic ngưỡng + gray + text + backfill + unit test**.

## 1. Số file / dòng sửa
**5 file sửa (37+/35−) + 3 file mới:**
| File | Việc |
|---|---|
| `services/fuel-service/src/helpers/fuel-calculator.ts` | `determineFuelStatus`: `>8`/`>=4`/gray, bỏ fallback lít, `'unknown'`→`'gray'` |
| `apps/web/src/@types/index.ts` | `getFuelStatus`: y hệt backend |
| `apps/web/src/features/stations/pages/MapView.tsx` | chú giải: `>8` / `4–8` / `<4 giờ` |
| `apps/web/src/features/settings/pages/Settings.tsx` | mô tả cảnh báo: `<4 giờ` / `4–8 giờ` |
| `services/fuel-service/package.json` | thêm script `test:unit`, `recompute:fuel-status` |
| `services/fuel-service/tests/fuel-calculator.test.ts` *(mới)* | unit test 12 dòng |
| `services/fuel-service/scripts/recompute-fuel-status.ts` *(mới)* | backfill (dry-run/apply) |
| `A2-PLAN.md` *(mới)* | kế hoạch Giai đoạn 1 |

**KHÔNG đụng:** 28 call site frontend, FuelBadge, EntryRow, 4 backend caller (đã đấu dây sẵn), `fuel_records`, công thức tính tồn (`calculateFuelConsumed`/`calculateFuelResult`), nhãn hiển thị, màu.

## 2. Bảng chân lý — unit test 12/12 PASS
`> 8h` green · `4–8h` yellow · `< 4h` red · `fuel null / rate<=0 / rate null` → gray
```
#1 (21,15)=1.40 red   #2 (21,2.5)=8.40 green  #3 (120,15)=8.00 yellow  #4 (120.1,15)=8.006 green
#5 (60,15)=4.00 yellow #6 (59.9,15)=3.99 red   #7 (0,15)=0 red          #8 (null,15) gray
#9 (50,0) gray        #10 (50,null) gray       #11 (300,14)=21.4 green  #12 (25,2.5)=10.0 green
```
Đặc biệt: #3 8.00h→**yellow** (biên `>8`), #5 4.00h→**yellow** (biên `>=4`), #9/#10 rate xấu→**gray** (chặn `Infinity>8`).

## 3. ⚠️ THAY ĐỔI QUAN TRỌNG NHẤT — bỏ fallback về lít
Trước đây khi `consumptionRate` hỏng (0/null), hàm **lặng lẽ quay về quy tắc lít** (`fuel>20`→green…) — tức
trạm **thiếu dữ liệu master bị phân loại bằng đúng quy tắc ta đang loại bỏ, không ai biết**. Nay trả **`gray`**.
→ Danh sách gray ở dry-run là **chỉ báo dữ liệu master thủng**. Trên DB dev hiện tại: **0 trạm gray vì rate xấu**
(mọi trạm đều có `consumptionRate` hợp lệ). Khi lên dữ liệu thật, danh sách này phải được rà kỹ (xem §5, §7).

## 4. Phân bố trạng thái: trước → sau backfill
| | green | yellow | red | gray | tổng |
|---|---|---|---|---|---|
| **fuel_status LƯU (trước)** | 7 | 0 | 2 | — | 9 có state |
| **Sau backfill (quy tắc mới)** | 4 | 1 | 4 | — | 9 có state |

**3 trạm đổi màu** (backfill `--apply`, chỉ cột `fuel_status`; `snapshotVersion`/`fuel_records` không đụng):
| Trạm | Tồn | Rate | Giờ | Đổi |
|---|---|---|---|---|
| CL-005 | 24.0 | 10.5 | **2.29** | 🟢→🔴 (trước báo an toàn sai) |
| CL-012 | 30.0 | 10.0 | **3.00** | 🟢→🔴 (do ngưỡng vàng 3h→4h) |
| CL-004 | 37.5 | 6.5 | **5.77** | 🟢→🟡 |

Idempotent: chạy `--dry-run` lại sau `--apply` → **0 thay đổi** ✓.

## 5. Kiểm chéo dashboard (2 nguồn đếm độc lập) — KHỚP sau backfill
- Gateway `dashboard.controller` đếm theo `fuel_status` **LƯU** trong DB.
- Frontend `Dashboard.tsx` đếm bằng **tự tính lại** (`getFuelStatus`).

| | green | yellow | red | gray |
|---|---|---|---|---|
| Gateway (lưu) | 4 | 1 | 4 | 2 |
| Frontend (tính lại) | 4 | 1 | 4 | 2 |

**Trước backfill hai nguồn LỆCH** (lưu là green7/red2). **Sau backfill KHỚP tuyệt đối.** (2 gray = trạm active
thiếu `current_fuel_state` — xem §6, tính null-fuel nên gray, khác với gray-vì-rate-xấu ở §3.)

## 6. Ghi nhận ngoài phạm vi (KHÔNG xử lý — để Ngài quyết)
- **CL-008, CL-009 (active), CL-010 (inactive)** không có `current_fuel_state` → không nhập được nhiên liệu
  (code chặn "chưa có tồn ban đầu"). 3/12 trạm ở trạng thái không dùng được. **Không thuộc A2.**

## 7. ⚠️ Khi triển khai lên môi trường THẬT
9 trạm trong DB hiện tại là **dữ liệu dev**. Con số "2 trạm 🟢→🔴 / 3 trạm đổi màu" **chỉ đúng với DB này**.
Trên môi trường thật **BẮT BUỘC**: chạy lại `npm run recompute:fuel-status` (dry-run) trên dữ liệu thật,
**rà danh sách gray** (§3), và **xin duyệt lại trước khi `--apply`**.

## 8. Kiểm chứng & rollback
- Unit test: **12/12 PASS** · `tsc --noEmit` fuel-service OK · `npm run build` exit 0.
- Frontend tsc list-diff vs baseline: **RỖNG (30/30 y hệt — 0 lỗi mới)** · `vite build` exit 0.
- **Full E2E kit: 117 passed / 1 skipped / 0 failed** → **không test nào đỏ**. Kit kiểm công thức tính tồn
  (không đụng) chứ không assert màu theo lít, nên đổi ngưỡng không phá test. Không có test loại (A)/(B) cần sửa.

Rollback: `git checkout refactor/layered-mvc-services` (nhánh chưa merge). Điểm phân nhánh `28f4ad2`.
