Bạn là một Senior UI/UX Designer + Product Designer chuyên thiết kế dashboard quản trị nội bộ cho doanh nghiệp.

Hãy thiết kế giao diện web app hiện đại, chuyên nghiệp cho hệ thống:

“Hệ thống quản lý nhiên liệu máy phát điện tại các trạm”

Bối cảnh:
Đây là hệ thống nội bộ dùng để quản lý lượng nhiên liệu còn lại tại các trạm máy phát điện. Nhân viên sẽ export/import file Excel tổng, nhập số giờ chạy máy phát, nhiên liệu bổ sung, nhiên liệu tồn thực tế. Hệ thống tự tính nhiên liệu tiêu hao, nhiên liệu còn lại, cảnh báo màu và hiển thị các trạm trên bản đồ.

Mục tiêu UI:

* Giao diện hiện đại, sạch, dễ nhìn, phù hợp với người dùng nội bộ.
* Không quá màu mè, ưu tiên rõ ràng, dễ thao tác.
* Phù hợp cho dashboard vận hành doanh nghiệp.
* Dễ chuyển thành React frontend sau này.
* Thiết kế responsive tốt cho desktop, tablet và có thể phát triển tiếp thành mobile app bằng React Native hoặc Flutter.
* Ngôn ngữ giao diện: Tiếng Việt.

Phong cách thiết kế:

* Modern enterprise dashboard.
* Clean, minimal, professional.
* Màu chủ đạo: xanh dương đậm hoặc xanh teal, thể hiện sự tin cậy và kỹ thuật.
* Màu cảnh báo nhiên liệu:

  * Xanh lá: nhiên liệu trên 20 lít.
  * Vàng: nhiên liệu từ 10 đến 20 lít.
  * Đỏ: nhiên liệu dưới 10 lít.
  * Xám: chưa có dữ liệu nhiên liệu.
* Dùng card bo góc nhẹ, shadow nhẹ, khoảng trắng tốt.
* Font rõ ràng, dễ đọc.
* Icon đơn giản, nhất quán.
* Không thiết kế kiểu quá gaming hoặc quá nhiều gradient.

Layout tổng thể:

* Sidebar bên trái.
* Topbar phía trên.
* Khu vực nội dung chính bên phải.
* Sidebar có các menu:

  1. Dashboard
  2. Danh sách trạm
  3. Bản đồ trạm
  4. Import Excel
  5. Lịch sử import
  6. Loại máy phát
  7. Cài đặt / Tài khoản

Topbar:

* Tên hệ thống: Quản lý nhiên liệu trạm
* Ô tìm kiếm nhanh theo mã trạm / tên trạm.
* Nút Export Excel.
* Nút Import Excel.
* Avatar người dùng.
* Trạng thái realtime: “Đang đồng bộ” hoặc “Đã cập nhật”.

Các màn hình cần thiết kế:

1. Màn hình Login

* Thiết kế đơn giản, chuyên nghiệp.
* Có logo/tên hệ thống.
* Form gồm:

  * Tên đăng nhập
  * Mật khẩu
  * Nút Đăng nhập
* Có hình minh họa nhẹ về trạm/máy phát/bản đồ hoặc dashboard.

2. Dashboard
   Mục tiêu: cho quản lý nhìn nhanh tình trạng nhiên liệu toàn hệ thống.

Cần có các card thống kê:

* Tổng số trạm
* Tổng nhiên liệu tồn hiện tại
* Số trạm màu xanh
* Số trạm màu vàng
* Số trạm màu đỏ
* Số trạm chưa có dữ liệu
* Số trạm cập nhật hôm nay

Cần có biểu đồ hoặc khu vực phân tích:

* Biểu đồ phân bổ trạng thái nhiên liệu: xanh/vàng/đỏ/xám.
* Danh sách trạm nhiên liệu thấp.
* Danh sách trạm cập nhật gần đây.
* Bộ lọc: ngày, tháng, quý, năm, loại máy phát, trạng thái nhiên liệu.

Thiết kế Dashboard cần rõ ràng, ưu tiên khả năng quan sát nhanh. Các trạm đỏ cần nổi bật nhất.

3. Danh sách trạm
   Dạng bảng dữ liệu hiện đại.

Các cột:

* Mã trạm
* Tên trạm
* Địa chỉ
* Loại máy phát
* Dung tích tối đa
* Nhiên liệu tồn
* Trạng thái
* Cập nhật gần nhất
* Hành động

Có:

* Search theo mã trạm/tên trạm.
* Filter theo trạng thái: xanh, vàng, đỏ, chưa có dữ liệu.
* Filter theo loại máy phát.
* Badge trạng thái màu.
* Nút xem chi tiết.
* Nút nhập cập nhật nhiên liệu nhanh.

4. Chi tiết trạm
   Mục tiêu: xem đầy đủ thông tin một trạm.

Bố cục:

* Header: Mã trạm, tên trạm, badge trạng thái nhiên liệu.
* Card thông tin trạm:

  * Địa chỉ
  * Lat
  * Long
  * Loại máy phát
  * Định mức tiêu hao
  * Dung tích tối đa
* Card nhiên liệu:

  * Nhiên liệu tồn hiện tại
  * Màu trạng thái
  * Cập nhật gần nhất
* Form nhập nhanh:

  * Nhiên liệu bổ sung
  * Số giờ chạy
  * Nhiên liệu tồn
  * Ngày ghi nhận
  * Ghi chú
  * Nút Cập nhật
* Bảng lịch sử nhiên liệu:

  * Ngày ghi nhận
  * Tồn trước
  * Bổ sung
  * Số giờ chạy
  * Tiêu hao
  * Tồn cuối
  * Chênh lệch
  * Nguồn cập nhật: nhập tay/import

5. Bản đồ trạm
   Dùng bản đồ nền kiểu OpenStreetMap.

Yêu cầu:

* Hiển thị marker các trạm theo lat/long.
* Marker màu:

  * Xanh: > 20 lít
  * Vàng: 10–20 lít
  * Đỏ: < 10 lít
  * Xám: chưa có dữ liệu
* Có panel bên trái hoặc floating panel hiển thị:

  * Tổng trạm
  * Trạm đỏ
  * Trạm vàng
  * Trạm chưa có dữ liệu
* Khi click marker, mở popup:

  * Mã trạm
  * Tên trạm
  * Địa chỉ
  * Loại máy phát
  * Nhiên liệu tồn hiện tại
  * Trạng thái
  * Cập nhật gần nhất
  * Nút “Xem lịch sử trạm”

Thiết kế bản đồ cần trực quan, dễ nhận biết trạm nào đang thiếu nhiên liệu.

6. Import Excel
   Thiết kế theo wizard 3 bước:

Bước 1: Upload file

* Khu vực drag & drop file Excel.
* Chỉ chấp nhận .xlsx.
* Nút “Tải file mẫu”.
* Nút “Export file tổng hiện tại”.
* Hướng dẫn ngắn:

  * Ô trống nghĩa là không cập nhật.
  * Số 0 là giá trị hợp lệ.
  * Cột hệ thống không nên sửa.

Bước 2: Preview dữ liệu

* Summary card:

  * Tổng dòng
  * Dòng hợp lệ
  * Dòng cảnh báo
  * Dòng lỗi
* Bảng preview:

  * Mã trạm
  * Tên trạm
  * Nhiên liệu bổ sung
  * Số giờ chạy
  * Nhiên liệu tồn
  * Tồn sau tính
  * Trạng thái
  * Lỗi/cảnh báo
* Dòng hợp lệ màu xanh nhẹ.
* Dòng cảnh báo màu vàng nhẹ.
* Dòng lỗi màu đỏ nhẹ.
* Có tooltip hoặc panel bên phải giải thích lỗi.

Bước 3: Confirm import

* Hiển thị tóm tắt trước khi xác nhận.
* Nút “Xác nhận import”.
* Nút “Quay lại sửa file”.
* Sau khi import thành công, hiển thị modal:

  * Import thành công
  * Số trạm đã cập nhật
  * Số trạm tạo mới
  * Số dòng cảnh báo
  * Nút về Dashboard
  * Nút xem lịch sử import

7. Lịch sử import
   Bảng gồm:

* Mã lần import
* Tên file
* Người import
* Thời gian
* Tổng dòng
* Dòng hợp lệ
* Dòng lỗi
* Trạng thái: previewing, committed, failed, cancelled
* Hành động: xem chi tiết

Chi tiết import:

* Summary.
* Danh sách lỗi/cảnh báo.
* Danh sách trạm bị ảnh hưởng.

8. Quản lý loại máy phát
   Bảng gồm:

* Loại máy phát
* Định mức tiêu hao L/giờ
* Ghi chú
* Trạng thái active/inactive
* Hành động sửa

Form thêm/sửa:

* Loại máy phát
* Định mức L/giờ
* Ghi chú

Thiết kế component cần có:

* Sidebar
* Topbar
* StatCard
* FuelStatusBadge
* FuelLevelCard
* StationTable
* ImportWizard
* PreviewTable
* MapMarkerPopup
* FilterBar
* ConfirmModal
* ErrorAlert
* WarningAlert
* EmptyState
* LoadingState
* RealtimeStatusIndicator

Yêu cầu UX quan trọng:

* Người dùng phải dễ hiểu trạng thái nhiên liệu qua màu sắc.
* Dữ liệu lỗi khi import phải dễ đọc, không gây rối.
* Các thao tác nguy hiểm như confirm import cần có xác nhận rõ ràng.
* Dashboard và bản đồ phải làm nổi bật trạm đỏ.
* Các bảng cần dễ scan, spacing rõ.
* Giao diện phải hỗ trợ dữ liệu nhiều trạm, ví dụ 100–500 trạm.

Yêu cầu responsive:

* Desktop: sidebar cố định, bảng đầy đủ.
* Tablet: sidebar thu gọn, card xếp lại.
* Mobile: sidebar thành bottom navigation hoặc drawer.
* Các màn hình chính phải có bản mobile-friendly để sau này chuyển sang React Native hoặc Flutter dễ hơn.

Yêu cầu thiết kế để sau này dễ build app:

* Thiết kế component-based.
* Dùng design system rõ ràng.
* Mỗi component có trạng thái: default, hover, active, disabled, loading, error.
* Không phụ thuộc quá nhiều vào layout web desktop.
* Các card, list item, badge, form field nên có thể tái sử dụng trên mobile.
* Với mobile app, ưu tiên bottom tabs:

  1. Dashboard
  2. Trạm
  3. Bản đồ
  4. Import
  5. Tài khoản

Hãy tạo UI đầy đủ cho các màn hình trên, ưu tiên thiết kế đẹp, rõ ràng, có tính sản phẩm thực tế và dễ chuyển thành code React.
