---
name: Project Memory Retrieval
description: 'CRITICAL MANDATORY SOP FOR EVERY TASK. You MUST ALWAYS view and follow this skill when receiving any bug fix, new feature, code reading, refactoring, or major change request. Quy trình bắt buộc để truy xuất bối cảnh dự án từ SCREENS_MAP.md và cập nhật trí nhớ dài hạn.'
---

# Kỹ năng Truy xuất Bộ nhớ Dự án

Kỹ năng này đảm bảo AI luôn có thông tin chính xác về cấu trúc dự án `traigiamthongminh` mà không cần quét lại toàn bộ mã nguồn.

## 📋 Khi nào cần sử dụng?
BẮT BUỘC thực hiện kỹ năng này khi:
1. Nhận task sửa lỗi (fix bug).
2. Nhận task thêm tính năng mới.
3. Nhận task tìm hiểu code (read/analyze/review).
4. Nhận task refactor hoặc di chuyển file.
5. Trước khi bắt đầu bất kỳ chỉnh sửa lớn nào.

## 🛠️ Các bước thực hiện

### Bước 1: Tra cứu bản đồ (Mandatory)
- Sử dụng `view_file` để đọc file `SCREENS_MAP.md` tại **thư mục gốc** của dự án (cùng cấp với `prison_management/` và `smart_prison_v2/`).
- Tìm kiếm phân mục liên quan đến màn hình, chức năng hoặc module được yêu cầu.
- Ghi chú: URL, file Frontend, Backend Controller, Service, Model, DB table, Middleware, và Bug History.

### Bước 2: Kiểm tra thực tế (Staleness Check)
- Kiểm tra nhanh xem các file được liệt kê trong Map có còn tồn tại không (dùng `view_file_outline` hoặc `find_by_name`).
- Nếu file không tồn tại (đã bị đổi tên hoặc xóa), hãy dùng `find_by_name` để tìm vị trí mới.
- Nếu mục nào có timestamp "Cập nhật lần cuối" quá 30 ngày → chủ động quét lại file code liên quan để verify.

### Bước 3: Tìm kiếm mở rộng (Nếu chức năng chưa có trong Map)
- Dùng `grep_search` quét keyword trong:
  - `prison_management/routes/web.php` và `prison_management/routes/api.php` (tìm route)
  - `prison_management/app/Http/Controllers/` (tìm controller)
  - `prison_management/resources/js/components/` (tìm React component)
  - `prison_management/resources/views/` (tìm Blade view)
  - `smart_prison_v2/services/` và `smart_prison_v2/core/` (tìm module Python)
- Liên kết các file thành luồng xử lý.

### Bước 4: Kiểm tra lịch sử bug
- Đọc phần **Bug History** của module liên quan trong SCREENS_MAP.
- Nếu lỗi hiện tại giống lỗi cũ → ưu tiên kiểm tra cùng nguyên nhân trước.

### Bước 5: Sau khi hoàn thành task — CẬP NHẬT SCREENS_MAP.md
- Thêm module/chức năng mới (nếu là tính năng mới).
- Thêm mục Bug History (nếu là sửa lỗi), format: `[YYYY-MM-DD] Mô tả lỗi → Cách fix`.
- Cập nhật file path nếu có refactor/di chuyển file.
- Cập nhật timestamp "Cập nhật lần cuối" của mục liên quan.

## 🏷️ Quy tắc Annotation
Khi chỉnh sửa file, thêm tag annotation vào đầu file:
- **Laravel (PHP)**:
  ```php
  /**
   * @screen: [TênMànHình]
   * @feature: [Mô tả ngắn]
   * @description: [Mô tả logic]
   * @related_frontend: [đường dẫn tương đối đến frontend component/view]
   * @db_table: [tên bảng DB]
   */
  ```
- **Python**:
  ```python
  """
  @module: [TênModule]
  @feature: [Mô tả ngắn]
  @description: [Mô tả logic]
  @related_services: [đường dẫn tương đối đến service liên quan]
  @config: [file config liên quan]
  """
  ```
