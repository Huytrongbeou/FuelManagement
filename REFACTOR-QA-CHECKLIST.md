# REFACTOR-QA-CHECKLIST.md — Kiểm tra thủ công sau refactor

> Refactor **chỉ di chuyển file + sửa import**, không đổi logic. Nhưng repo **không có test tự động
> cho backend/frontend** (chỉ có bộ E2E ngoài `D:\fuel-frontend-test-runner`). Danh sách dưới đây
> để Ngài bấm tay xác nhận các luồng nghiệp vụ chính vẫn chạy đúng.
>
> Branch: `refactor/project-structure` · Rollback: `git reset --hard d31a84f`

## Đăng nhập & phân quyền
- [ ] Đăng nhập **admin** — thấy đủ menu quản trị
- [ ] Đăng nhập **manager** — quyền đúng (nhập liệu, không thấy quản trị user)
- [ ] Đăng nhập **staff** — chỉ xem, không có nút nhập/import

## Bảng điều khiển & giám sát
- [ ] Dashboard hiện số liệu; đủ 4 kỳ (hôm nay / tuần / tháng / năm)
- [ ] Danh sách trạm: tìm kiếm, lọc trạng thái/hãng/khu vực, sắp xếp, phân trang
- [ ] Mở chi tiết trạm: lịch sử nhiên liệu, lọc tuần/tháng/năm/tất cả
- [ ] Bản đồ trạm: marker đúng vị trí, **màu theo giờ tự chủ** (xanh ≥8h / vàng ≥3h / đỏ <3h)
- [ ] Chuông cảnh báo: đếm đúng số trạm vàng/đỏ

## Nghiệp vụ cốt lõi (quan trọng nhất)
- [ ] **Nhập nhiên liệu trực tiếp**: Tải dữ liệu → nhập **giờ + phút** → Kiểm tra → Xác nhận lưu → tồn cập nhật đúng công thức
- [ ] Nhập trùng nội dung/cùng ngày → hiện cảnh báo, nút **"Vẫn tạo"** cho lưu tiếp
- [ ] **Nhập Excel**: upload → preview → confirm → tồn cập nhật; file lỗi bị chặn (all-or-nothing)
- [ ] **Xuất Excel**: tải được file, mở được, đúng cột
- [ ] Đề xuất điều chỉnh sai sót → admin duyệt → tồn thay đổi đúng
- [ ] Đề xuất trạm mới từ mobile (lấy GPS) → admin duyệt
- [ ] Ghi nhận bảo dưỡng; lịch sử đổi máy

## Realtime & hạ tầng
- [ ] WebSocket: mở 2 tab, nhập ở tab 1 → tab 2 tự cập nhật
- [ ] Ảnh/icon/font hiển thị đủ (plugin `figma:asset`, không dời `src/assets`)
- [ ] Build Android: `cd apps/web && npm run app:sync` chạy được (webDir `dist`)

## Ghi chú
Các mục đã xác minh tự động trong refactor (không cần bấm tay lại): tsc mọi service **0 lỗi**;
frontend **30 lỗi kiểu có sẵn** không đổi; `vite build`, `npm run build` từng service, và **E2E kit**
(xem REFACTOR-REPORT.md). Danh sách trên tập trung vào phần **chỉ mắt người mới thấy** (giao diện,
GPS, realtime, đóng gói app).
