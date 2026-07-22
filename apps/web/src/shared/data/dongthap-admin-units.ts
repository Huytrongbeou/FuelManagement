/**
 * Đơn vị hành chính cấp xã của tỉnh Đồng Tháp (mới) sau sắp xếp năm 2025.
 *
 * Theo Nghị quyết 1663/NQ-UBTVQH15 (hiệu lực 01/7/2025), Tiền Giang sáp nhập vào Đồng Tháp thành
 * tỉnh Đồng Tháp mới, bỏ cấp huyện, còn 102 đơn vị cấp xã: 20 phường + 82 xã.
 * Nguồn: Cổng Thông tin điện tử Chính phủ (xaydungchinhsach.chinhphu.vn) — "Danh sách 102 xã,
 * phường của tỉnh Đồng Tháp mới".
 *
 * Danh sách đầy đủ để đối chiếu; hiển thị đã sắp xếp theo bảng chữ cái tiếng Việt.
 */

const PHUONG_RAW = [
  'Phường Mỹ Tho', 'Phường Đạo Thạnh', 'Phường Mỹ Phong', 'Phường Thới Sơn', 'Phường Trung An',
  'Phường Gò Công', 'Phường Long Thuận', 'Phường Bình Xuân', 'Phường Sơn Qui', 'Phường An Bình',
  'Phường Hồng Ngự', 'Phường Thường Lạc', 'Phường Cao Lãnh', 'Phường Mỹ Ngãi', 'Phường Mỹ Trà',
  'Phường Sa Đéc', 'Phường Mỹ Phước Tây', 'Phường Thanh Hòa', 'Phường Cai Lậy', 'Phường Nhị Quý',
]

const XA_RAW = [
  'Xã Tân Hồng', 'Xã Tân Thành', 'Xã Tân Hộ Cơ', 'Xã An Phước', 'Xã Thường Phước', 'Xã Long Khánh',
  'Xã Long Phú Thuận', 'Xã An Hòa', 'Xã Tam Nông', 'Xã Phú Thọ', 'Xã Tràm Chim', 'Xã Phú Cường',
  'Xã An Long', 'Xã Thanh Bình', 'Xã Tân Thạnh', 'Xã Bình Thành', 'Xã Tân Long', 'Xã Tháp Mười',
  'Xã Thanh Mỹ', 'Xã Mỹ Quí', 'Xã Đốc Binh Kiều', 'Xã Trường Xuân', 'Xã Phương Thịnh',
  'Xã Phong Mỹ', 'Xã Ba Sao', 'Xã Mỹ Thọ', 'Xã Bình Hàng Trung', 'Xã Mỹ Hiệp', 'Xã Mỹ An Hưng',
  'Xã Tân Khánh Trung', 'Xã Lấp Vò', 'Xã Lai Vung', 'Xã Hòa Long', 'Xã Phong Hòa', 'Xã Tân Dương',
  'Xã Phú Hựu', 'Xã Tân Nhuận Đông', 'Xã Tân Phú Trung', 'Xã Tân Phú', 'Xã Thanh Hưng',
  'Xã An Hữu', 'Xã Mỹ Lợi', 'Xã Mỹ Đức Tây', 'Xã Mỹ Thiện', 'Xã Hậu Mỹ', 'Xã Hội Cư', 'Xã Cái Bè',
  'Xã Mỹ Thành', 'Xã Thạnh Phú', 'Xã Bình Phú', 'Xã Hiệp Đức', 'Xã Long Tiên', 'Xã Ngũ Hiệp',
  'Xã Tân Phước 1', 'Xã Tân Phước 2', 'Xã Tân Phước 3', 'Xã Hưng Thạnh', 'Xã Tân Hương',
  'Xã Châu Thành', 'Xã Long Hưng', 'Xã Long Định', 'Xã Bình Trưng', 'Xã Vĩnh Kim', 'Xã Kim Sơn',
  'Xã Mỹ Tịnh An', 'Xã Lương Hòa Lạc', 'Xã Tân Thuận Bình', 'Xã Chợ Gạo', 'Xã An Thạnh Thủy',
  'Xã Bình Ninh', 'Xã Vĩnh Bình', 'Xã Đồng Sơn', 'Xã Phú Thành', 'Xã Long Bình', 'Xã Vĩnh Hựu',
  'Xã Gò Công Đông', 'Xã Tân Điền', 'Xã Tân Hòa', 'Xã Tân Đông', 'Xã Gia Thuận', 'Xã Tân Thới',
  'Xã Tân Phú Đông',
]

const byVietnamese = (a: string, b: string) => a.localeCompare(b, 'vi')

/** 20 phường, đã sắp xếp A→Z. */
export const DONG_THAP_PHUONG: readonly string[] = [...PHUONG_RAW].sort(byVietnamese)

/** 82 xã, đã sắp xếp A→Z. */
export const DONG_THAP_XA: readonly string[] = [...XA_RAW].sort(byVietnamese)
