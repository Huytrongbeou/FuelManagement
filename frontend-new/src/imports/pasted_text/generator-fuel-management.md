Bạn là Senior Product Designer + UI/UX Designer chuyên thiết kế dashboard vận hành nội bộ cho doanh nghiệp.

Hãy thiết kế giao diện web app hiện đại cho hệ thống:

“Hệ thống quản lý nhiên liệu máy phát điện tại các trạm”

Bối cảnh:
Hệ thống dùng để quản lý các trạm máy phát điện tại khu vực Cao Lãnh. Mỗi trạm hiện có một máy phát. Người dùng cần quản lý thông tin trạm, vị trí trạm, thông tin máy phát, nhiên liệu tồn, nhập nhiên liệu bổ sung, số giờ chạy và theo dõi cảnh báo nhiên liệu trên dashboard/bản đồ.

Hiện tại cần thiết kế lại UI theo hướng dễ dùng hơn, đặc biệt là:

1. Không dùng dropdown “Loại máy phát” quá dài và rối.
2. Quản lý máy phát theo cấu trúc: Hãng máy → Model máy → Công suất.
3. Cho phép nhập dữ liệu trực tiếp trên hệ thống giống nhập Excel.
4. Giao diện phải dễ build thành web trước, sau này có thể chuyển thành app bằng React Native hoặc Flutter.

I. Phong cách thiết kế

Thiết kế theo phong cách:

* Modern enterprise dashboard.
* Sạch, rõ ràng, chuyên nghiệp.
* Dễ dùng cho nhân viên nội bộ.
* Không quá màu mè.
* Ưu tiên khả năng nhập liệu nhanh, đọc dữ liệu nhanh và phát hiện cảnh báo nhanh.
* Ngôn ngữ giao diện: Tiếng Việt.

Màu sắc:

* Màu chủ đạo: xanh dương đậm hoặc xanh teal.
* Màu phụ: trắng, xám nhạt, xanh nhạt.
* Màu cảnh báo nhiên liệu:

  * Xanh lá: nhiên liệu > 20 lít.
  * Vàng: nhiên liệu từ 10 đến 20 lít.
  * Đỏ: nhiên liệu < 10 lít.
  * Xám: chưa có dữ liệu nhiên liệu.

Yêu cầu layout:

* Desktop: sidebar trái, topbar trên, nội dung chính bên phải.
* Tablet: sidebar thu gọn.
* Mobile: layout dễ chuyển sang bottom tab hoặc drawer.
* Component-based design.
* Tất cả form, card, badge, table, modal phải có style nhất quán.

II. Điều hướng chính

Sidebar gồm các menu:

1. Dashboard
2. Danh sách trạm
3. Bản đồ trạm
4. Nhập dữ liệu trực tiếp
5. Import Excel
6. Lịch sử import
7. Hãng máy phát
8. Model máy phát
9. Tài khoản / Cài đặt

Topbar gồm:

* Tên hệ thống: Quản lý nhiên liệu máy phát
* Ô tìm kiếm nhanh: mã trạm / tên trạm / địa chỉ
* Nút “Nhập dữ liệu”
* Nút “Export Excel”
* Trạng thái realtime: “Đang đồng bộ” / “Đã cập nhật”
* Avatar người dùng

III. Thiết kế lại khái niệm máy phát

Không dùng một dropdown dài kiểu “Loại máy phát” chứa tất cả dữ liệu như:

* Cummins 100kVA
* Cummins 50kVA
* Mitsubishi 36kVA
* Denyo 25kVA
* Honda 15kVA

Thay vào đó, giao diện phải tách rõ:

1. Hãng máy phát
   Ví dụ:

* Cummins
* Mitsubishi
* Denyo
* Honda
* Perkins
* Khác

2. Model máy phát
   Ví dụ:

* ABC-100
* M-36
* DCA-25

3. Công suất
   Ví dụ:

* 15 kVA
* 36 kVA
* 50 kVA
* 100 kVA

4. Thông số gợi ý theo model

* Loại nhiên liệu
* Định mức tiêu hao gợi ý L/giờ
* Dung tích nhiên liệu gợi ý L

Quan trọng:

* Hãng/model/công suất là danh mục để gợi ý và quản lý có cấu trúc.
* Khi tạo trạm, người dùng chọn Hãng → chọn Model đã lọc theo hãng.
* Hệ thống tự điền công suất, định mức tiêu hao gợi ý và dung tích gợi ý.
* Người dùng vẫn được chỉnh định mức tiêu hao và dung tích tối đa riêng cho từng trạm.
* Không được làm người dùng hiểu rằng tên trạm là công suất máy phát.
* Tên trạm và tên máy phát là thông tin thực tế do người dùng tự đặt.

IV. Màn hình Hãng máy phát

Thiết kế màn hình quản lý hãng máy phát.

Bảng gồm các cột:

* Tên hãng
* Quốc gia / xuất xứ
* Số model đang sử dụng
* Trạng thái: đang sử dụng / ngưng sử dụng
* Ghi chú
* Hành động

Có các chức năng:

* Tìm kiếm hãng
* Thêm hãng mới
* Sửa hãng
* Vô hiệu hóa hãng

Form thêm/sửa hãng gồm:

* Tên hãng
* Quốc gia / xuất xứ
* Ghi chú
* Trạng thái

Yêu cầu UI:

* Form ngắn, dễ nhập.
* Không hard delete, chỉ vô hiệu hóa.
* Khi vô hiệu hóa hãng, hiện popup xác nhận.

V. Màn hình Model máy phát

Thiết kế màn hình quản lý model máy phát.

Bảng gồm các cột:

* Hãng máy
* Model
* Công suất kVA
* Loại nhiên liệu
* Định mức tiêu hao gợi ý L/giờ
* Dung tích nhiên liệu gợi ý L
* Số trạm đang dùng
* Trạng thái
* Hành động

Filter:

* Hãng máy
* Công suất
* Trạng thái

Form thêm/sửa model gồm:

* Hãng máy
* Tên model
* Công suất kVA
* Loại nhiên liệu:

  * Dầu Diesel
  * Xăng
  * Khác
* Định mức tiêu hao gợi ý L/giờ
* Dung tích nhiên liệu gợi ý L
* Ghi chú
* Trạng thái

Yêu cầu UI:

* Khi chọn hãng trong form trạm, dropdown model chỉ hiện model của hãng đó.
* Có nút “Thêm nhanh model mới” nếu người dùng không tìm thấy model.
* Model chỉ là dữ liệu gợi ý, không khóa cứng thông số của trạm.

VI. Màn hình Danh sách trạm

Thiết kế màn hình danh sách trạm dạng bảng hiện đại.

Bộ lọc:

* Tìm kiếm theo mã trạm / tên trạm / địa chỉ
* Trạng thái nhiên liệu: tất cả, xanh, vàng, đỏ, chưa có dữ liệu
* Hãng máy
* Model máy
* Công suất
* Đơn vị hành chính hiện tại
* Địa bàn cũ
* Khu vực quản lý nội bộ

Bảng gồm các cột:

* Mã trạm
* Tên trạm
* Tên máy phát
* Địa chỉ
* Đơn vị hành chính hiện tại
* Địa bàn cũ
* Khu vực quản lý
* Hãng máy
* Model
* Công suất
* Định mức L/giờ
* Dung tích tối đa
* Nhiên liệu tồn
* Trạng thái nhiên liệu
* Cập nhật gần nhất
* Hành động

Cột hành động có 3 chức năng chính:

1. Nhập nhiên liệu

* Button nổi bật nhất.
* Mở modal/drawer “Nhập nhiên liệu cho trạm”.
* Chỉ nhập dữ liệu nhiên liệu, không sửa thông tin trạm.

2. Chỉnh sửa thông tin trạm

* Mở modal/drawer “Chỉnh sửa thông tin trạm”.
* Cho sửa thông tin trạm, vị trí, khu vực, máy phát, định mức và dung tích.

3. Vô hiệu hóa trạm

* Icon hoặc action trong menu ba chấm.
* Khi bấm phải hiện popup xác nhận.
* Không xóa lịch sử nhiên liệu.

Nếu bảng quá rộng:

* Giữ button “Nhập nhiên liệu” hiển thị trực tiếp.
* “Chỉnh sửa” và “Vô hiệu hóa” đưa vào dropdown action.

VII. Modal “Nhập nhiên liệu cho trạm”

Mục tiêu:
Người dùng nhập nhanh nhiên liệu cho một trạm cụ thể.

Thông tin readonly phía trên:

* Mã trạm
* Tên trạm
* Tên máy phát
* Địa chỉ
* Hãng máy
* Model
* Công suất
* Định mức tiêu hao
* Dung tích tối đa
* Nhiên liệu tồn hiện tại
* Trạng thái hiện tại

Form nhập:

* Nhiên liệu bổ sung L
* Số giờ chạy
* Nhiên liệu tồn thực tế L
* Ngày ghi nhận
* Ghi chú

Preview tính toán ngay trong modal:

* Tồn trước cập nhật
* Tiêu hao theo định mức
* Tồn hệ thống tự tính
* Chênh lệch
* Tồn cuối cùng
* Trạng thái cảnh báo mới

UX:

* Ô trống nghĩa là không cập nhật.
* Số 0 là giá trị hợp lệ.
* Nếu nhập “Nhiên liệu tồn thực tế” thì đây là tồn cuối thực tế.
* Nếu không nhập “Nhiên liệu tồn thực tế” thì hệ thống tự tính.
* Nếu kết quả âm hoặc vượt dung tích tối đa thì báo lỗi đỏ, không cho lưu.
* Button: Hủy / Lưu cập nhật.

VIII. Modal “Thêm/Sửa trạm máy phát”

Form chia thành các nhóm rõ ràng:

A. Thông tin trạm

* Mã trạm
* Tên trạm
* Tên máy phát
* Ghi chú

B. Vị trí

* Địa chỉ
* Lat
* Long
* Nút “Chọn trên bản đồ”

C. Khu vực

* Đơn vị hành chính hiện tại
* Địa bàn cũ
* Khu vực quản lý nội bộ

D. Thông tin máy phát

* Hãng máy
* Model máy
* Công suất kVA
* Loại nhiên liệu
* Định mức tiêu hao L/giờ
* Dung tích tối đa L

Interaction:

* Người dùng chọn Hãng máy.
* Sau đó dropdown Model chỉ hiện model thuộc hãng đó.
* Khi chọn Model, hệ thống tự điền:

  * Công suất
  * Loại nhiên liệu
  * Định mức tiêu hao gợi ý
  * Dung tích nhiên liệu gợi ý
* Người dùng vẫn có thể chỉnh định mức tiêu hao và dung tích tối đa riêng cho trạm.
* Nếu không có model phù hợp, có nút “Thêm nhanh model mới”.

E. Nhiên liệu ban đầu

* Nhiên liệu tồn ban đầu
* Ngày ghi nhận
* Ghi chú nhiên liệu

UX:

* Nếu không nhập nhiên liệu ban đầu, trạm vẫn được tạo nhưng trạng thái nhiên liệu là “Chưa có dữ liệu”.
* Nếu nhập nhiên liệu ban đầu, hiển thị preview trạng thái nhiên liệu.
* Lat/Long sai định dạng thì báo lỗi.
* Nếu chỉ nhập Lat mà không nhập Long, hoặc ngược lại, hiển thị cảnh báo rõ.

IX. Popup xác nhận vô hiệu hóa trạm

Khi người dùng bấm “Vô hiệu hóa trạm”, hiện popup.

Title:
“Vô hiệu hóa trạm?”

Nội dung:
“Trạm [Mã trạm] - [Tên trạm] sẽ không còn hiển thị trong danh sách trạm đang hoạt động, dashboard và bản đồ. Dữ liệu lịch sử nhiên liệu vẫn được giữ lại.”

Hiển thị thông tin:

* Mã trạm
* Tên trạm
* Tên máy phát
* Địa chỉ
* Nhiên liệu tồn hiện tại
* Trạng thái nhiên liệu

Field:

* Lý do vô hiệu hóa

Checkbox:
“Tôi hiểu rằng trạm sẽ bị vô hiệu hóa nhưng dữ liệu lịch sử vẫn được giữ lại.”

Button:

* Hủy
* Xác nhận vô hiệu hóa

Button xác nhận dùng màu cảnh báo/đỏ.

X. Màn hình Bản đồ trạm

Hiển thị marker các trạm theo lat/long.

Filter:

* Trạng thái nhiên liệu
* Hãng máy
* Model
* Công suất
* Đơn vị hành chính hiện tại
* Địa bàn cũ
* Khu vực quản lý nội bộ

Marker màu:

* Xanh: > 20 lít
* Vàng: 10–20 lít
* Đỏ: < 10 lít
* Xám: chưa có dữ liệu

Nếu trạm không có lat/long:

* Không hiển thị marker.
* Có panel “Trạm chưa có tọa độ” để người dùng biết và cập nhật.

Popup khi click marker:

* Mã trạm
* Tên trạm
* Tên máy phát
* Địa chỉ
* Lat, Long
* Khu vực quản lý
* Hãng máy
* Model
* Công suất
* Định mức tiêu hao
* Dung tích tối đa
* Nhiên liệu tồn
* Trạng thái
* Cập nhật gần nhất
* Button “Nhập nhiên liệu”
* Button “Xem chi tiết”

XI. Màn hình Nhập dữ liệu trực tiếp

Đây là màn hình rất quan trọng. Thiết kế giống nhập Excel nhưng chạy trực tiếp trên web.

Tên màn hình:
“Nhập dữ liệu trực tiếp”

Mục tiêu:
Người dùng có thể cập nhật nhiều trạm cùng lúc mà không cần upload Excel. Giao diện giống bảng tính Excel, mỗi dòng là một trạm, mỗi cột là một thông tin.

Header:

* Tiêu đề: Nhập dữ liệu trực tiếp
* Mô tả: “Cập nhật thông tin trạm, máy phát và nhiên liệu ngay trên hệ thống.”
* Button:

  * Tải dữ liệu hiện tại
  * Thêm dòng mới
  * Kiểm tra dữ liệu
  * Xác nhận lưu
  * Export Excel

Filter bar:

* Tìm kiếm mã trạm / tên trạm
* Trạng thái nhiên liệu
* Hãng máy
* Model
* Công suất
* Đơn vị hành chính hiện tại
* Địa bàn cũ
* Khu vực quản lý

Editable spreadsheet table:

Các cột editable:

1. Mã trạm
2. Tên trạm
3. Tên máy phát
4. Địa chỉ
5. Lat
6. Long
7. Đơn vị hành chính hiện tại
8. Địa bàn cũ
9. Khu vực quản lý nội bộ
10. Hãng máy
11. Model máy
12. Công suất kVA
13. Loại nhiên liệu
14. Định mức tiêu hao L/giờ
15. Dung tích tối đa L
16. Nhiên liệu bổ sung L
17. Số giờ chạy
18. Nhiên liệu tồn L
19. Ngày ghi nhận
20. Ghi chú

Các cột readonly hệ thống:

21. Tồn trước cập nhật L
22. Tiêu hao theo định mức L
23. Tồn hệ thống tự tính L
24. Chênh lệch L
25. Tồn cuối cùng L
26. Trạng thái cảnh báo
27. Lỗi / Cảnh báo

Yêu cầu UI table:

* Header sticky.
* Cột mã trạm và tên trạm sticky bên trái.
* Cột lỗi/cảnh báo sticky bên phải.
* Readonly columns nền xám nhạt.
* Dòng lỗi nền đỏ nhạt.
* Dòng cảnh báo nền vàng nhạt.
* Dòng hợp lệ nền xanh rất nhẹ.
* Ô đang focus có viền xanh.
* Có thể tab qua ô tiếp theo.
* Có thể enter để xuống dòng.
* Có thể copy/paste nhiều ô từ Excel.
* Có nút hoàn tác dòng.
* Có nút xóa dòng mới.
* Có badge trạng thái dòng:

  * Hợp lệ
  * Cảnh báo
  * Lỗi
  * Không thay đổi

Summary panel sau khi bấm “Kiểm tra dữ liệu”:

* Tổng số dòng
* Dòng hợp lệ
* Dòng cảnh báo
* Dòng lỗi
* Số trạm sẽ cập nhật
* Số trạm sẽ tạo mới
* Số dòng không có phát sinh sẽ bỏ qua

Luồng UX:

1. Người dùng tải dữ liệu hiện tại.
2. Người dùng sửa trực tiếp trên bảng.
3. Người dùng bấm “Kiểm tra dữ liệu”.
4. Hệ thống hiển thị preview kết quả.
5. Nếu có lỗi đỏ, không cho xác nhận lưu.
6. Nếu chỉ có hợp lệ/cảnh báo, cho phép xác nhận lưu.
7. Sau khi lưu thành công, hiển thị modal thành công:

   * Số trạm đã cập nhật
   * Số trạm tạo mới
   * Số dòng nhiên liệu đã ghi nhận
   * Button về Dashboard
   * Button tiếp tục nhập

XII. Rule hiển thị trong nhập trực tiếp

Phải thể hiện rõ trên UI:

* Ô trống = không cập nhật.
* Số 0 = giá trị hợp lệ.
* Nhiên liệu bổ sung được cộng trước.
* Số giờ chạy dùng để tính tiêu hao.
* Nhiên liệu tồn nếu nhập thì là tồn thực tế cuối cùng.
* Nếu không nhập nhiên liệu tồn thì hệ thống tự tính.
* Không cho tồn cuối âm.
* Không cho tồn cuối vượt dung tích tối đa.
* Trạm mới nếu có nhiên liệu bổ sung hoặc số giờ chạy thì bắt buộc nhập nhiên liệu tồn ban đầu.
* Trạm chưa có lat/long thì không hiện marker trên bản đồ.

XIII. Màn hình Dashboard

Dashboard cần có:

Stat cards:

* Tổng số trạm
* Tổng nhiên liệu tồn hiện tại
* Số trạm xanh
* Số trạm vàng
* Số trạm đỏ
* Số trạm chưa có dữ liệu
* Số trạm cập nhật hôm nay
* Số trạm chưa có tọa độ

Khu vực chính:

* Biểu đồ phân bổ trạng thái nhiên liệu.
* Danh sách trạm nhiên liệu thấp.
* Danh sách trạm mới cập nhật.
* Danh sách trạm chưa có tọa độ.
* Quick action:

  * Nhập dữ liệu trực tiếp
  * Import Excel
  * Thêm trạm

XIV. Component cần thiết kế

Thiết kế đầy đủ các component sau:

* Sidebar
* Topbar
* StatCard
* FuelStatusBadge
* RealtimeStatusIndicator
* StationTable
* StationActionMenu
* FuelEntryModal
* StationFormDrawer
* DeactivateStationDialog
* GeneratorBrandForm
* GeneratorModelForm
* ManualEntryGrid
* EditableCell
* ReadonlyCell
* ValidationBadge
* WarningAlert
* ErrorAlert
* ConfirmImportModal
* MapMarkerPopup
* FilterBar
* EmptyState
* LoadingState
* SuccessModal

XV. Responsive và app-ready

Thiết kế phải dễ chuyển thành mobile app sau này.

Mobile hướng đến bottom tabs:

1. Dashboard
2. Trạm
3. Bản đồ
4. Nhập liệu
5. Tài khoản

Mobile station list:

* Không dùng bảng rộng.
* Dùng card list.
* Mỗi card hiển thị:

  * Mã trạm
  * Tên trạm
  * Nhiên liệu tồn
  * Trạng thái
  * Địa chỉ
  * Button “Nhập nhiên liệu”
  * Menu “Sửa / Vô hiệu hóa”

Mobile nhập dữ liệu trực tiếp:

* Không cần hiển thị bảng Excel đầy đủ.
* Có thể dùng form theo từng trạm hoặc danh sách dòng có thể mở rộng.
* Nhưng desktop vẫn phải có bảng giống Excel.

XVI. Kết quả mong muốn

Tạo bộ giao diện đầy đủ cho hệ thống quản lý nhiên liệu máy phát:

1. Dashboard.
2. Danh sách trạm.
3. Bản đồ trạm.
4. Nhập nhiên liệu từng trạm.
5. Thêm/sửa trạm máy phát.
6. Popup vô hiệu hóa trạm.
7. Quản lý hãng máy phát.
8. Quản lý model máy phát.
9. Nhập dữ liệu trực tiếp giống Excel.
10. Import Excel.
11. Lịch sử import.

Thiết kế cần giúp người dùng hiểu rõ:

* Tên trạm khác với công suất máy phát.
* Hãng/model/công suất là thông tin kỹ thuật của máy phát.
* Định mức tiêu hao và dung tích tối đa ở trạm là dữ liệu thực tế dùng để tính nhiên liệu.
* Nhập trực tiếp trên hệ thống giống Excel nhưng có kiểm tra lỗi, preview và xác nhận trước khi lưu.
