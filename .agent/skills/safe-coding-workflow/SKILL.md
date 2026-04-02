---
name: Tự động kiểm tra và sửa lỗi trước PR (Safe Coding Workflow)
description: 'CRITICAL MANDATORY SOP FOR EVERY TASK. You MUST ALWAYS view and follow this skill anytime the user asks to fix a bug, refactor, or add a new feature. Quy trình bắt buộc (SOP) để phân tích ảnh hưởng, tự động chạy Unit Test và tự động vá lỗi kỹ thuật mỗi khi nhận yêu cầu fix bug hoặc thêm chức năng mới, đảm bảo không gây regression bug.'
---

# Tự động kiểm tra và sửa lỗi trước PR (Safe Coding Workflow)

**NGỮ CẢNH KÍCH HOẠT (TRIGGER):**
Skill này BẮT BUỘC ĐƯỢC KÍCH HOẠT MẶC ĐỊNH khi AI Agent (hoặc Developer) nhận được bất kỳ yêu cầu nào liên quan đến: "Fix bug", "Sửa lỗi", "Update chức năng", "Thêm tính năng mới" trong dự án hiện tại.

**MỤC TIÊU:** Đảm bảo việc sửa đổi mã nguồn ở một nơi không làm hỏng các chức năng liên quan ở nơi khác. Tuyệt đối tuân thủ 8 bước sau:

## BƯỚC 1: Kiểm tra điều kiện tiên quyết (Pre-condition check)
- [ ] Kiểm tra `git status` đảm bảo không có uncommitted changes quan trọng hoặc file rác chưa được xử lý.
- [ ] Đảm bảo đang ở đúng branch làm việc, tuân thủ branch naming convention: `feature/`, `bugfix/`, `hotfix/`.
- [ ] Đã fetch origin và lấy (pull) code mới nhất từ nhánh `main` hoặc `develop` để tránh conflict.

## BƯỚC 2: Tiếp nhận và Phân loại yêu cầu
Thu thập đầy đủ các dữ liệu đầu vào và phân loại chính xác:
- **Bug fix**: Yêu cầu reproduction steps (các bước tái hiện), expected behavior (kết quả mong muốn) vs actual behavior (kết quả thực tế), file bị lỗi, mô tả hoặc log lỗi.
- **Feature mới**: Yêu cầu có acceptance criteria (tiêu chí nghiệm thu) rõ ràng.
- **Refactor**: Cần có tiêu chí kiểm tra hoặc benchmark hiệu năng trước/sau thay đổi.

## BƯỚC 3: Lập kế hoạch sửa và Phân tích vùng ảnh hưởng (Impact Analysis)
> **[!] QUAN TRỌNG:** Đây là bước BẮT BUỘC trước khi Agent bắt đầu viết code (Thực thi Tool edit/write file).

1. **Định vị file cần sửa:** Xác định chính xác Core Logic, Controller, Service, hoặc Component UI cần can thiệp.
2. **Quét các điểm tham chiếu (Dependencies):**
    - Agent PHẢI dùng công cụ search code (grep/find) tìm xem nội dung file/đoạn code sắp sửa đang được Import/Use ở những file nào khác.
3. **Lập danh sách màn hình/chức năng bị ảnh hưởng và Test Plan:** Sinh báo cáo theo Template dưới đây:

### 📊 Báo cáo Phân tích Ảnh hưởng (Impact Analysis Report)
| File sửa đổi | Dependencies (Điểm ảnh hưởng) | Mức độ rủi ro (Risk Level) |
|--------------|-------------------------------|----------------------------|
| [Tên file]   | [Liệt kê controllers/jobs...] | High/Medium/Low            |

### 🧪 Kế hoạch Kiểm thử (Test Plan)
- [ ] **Unit Test:** [Liệt kê các test classes bị ảnh hưởng cần chạy lại]
- [ ] **Feature Test:** [Liệt kê các feature tests liên quan]
- [ ] **Manual Test:** [Liệt kê các luồng UI cần kiểm tra bằng tay]

---
> **⚡ DỪNG LẠI CHỜ DUYỆT:** Sau khi hoàn thành BƯỚC 3, Agent sử dụng công cụ giao tiếp phân tích (notify_user) để gửi Báo cáo Phân tích Ảnh hưởng cho người dùng duyệt. CHỈ TIẾP TỤC BƯỚC 4 KHI NGƯỜI DÙNG ĐỒNG Ý.
---

## BƯỚC 4: Thực hiện Coding
- Áp dụng các thay đổi mã nguồn dựa trên phân tích ở Bước 3.
- Nếu việc sửa đổi bắt buộc phải đổi parameter (đầu vào) của hàm gốc, Agent PHẢI chủ động tìm và sửa đồng loạt ở TẤT CẢ các file gọi đến hàm đó (đã tìm ra ở Bước 3).

## BƯỚC 5: Test chức năng và Xử lý lỗi hệ quả (Regression Testing & Auto-Fix)
Bắt buộc thực hiện kiểm thử để chứng minh logic mới hoạt động được và không làm hỏng logic cũ.

1. **Kiểm tra chức năng gốc:** Test xem chức năng yêu cầu đã đúng chưa.
2. **Kiểm thử vùng ảnh hưởng:**
    - Chạy Unit Test và Feature Test cho **chính xác** các file liệt kê ở Bước 3.
    **Ví dụ lệnh Test:**
    - PHP/Laravel: `php artisan test --filter=[TestName]` hoặc `./vendor/bin/phpunit --coverage-html coverage`
    - JavaScript/React: `npm test -- --watchAll=false` hoặc `npm run test:coverage`
    - Bắt Error Log hoặc Stacktrace nếu test fail.
3. **Tự động Fix lỗi ảnh hưởng (Có giới hạn Scope):**
    - **Áp dụng Auto-fix:** Agent tự động đọc log và sửa code cho các lỗi mang tính kỹ thuật/cú pháp đơn giản (VD: Thiếu param, thiếu import, sai kiểu dữ liệu).
    - **Cảnh báo (Dừng lại):** Đối với các lỗi logic nghiệp vụ phức tạp làm test fail, Agent KHÔNG TỰ Ý ĐOÁN LOGIC. Hãy dừng lại, báo cáo nguyên nhân test fail cho User và yêu cầu can thiệp.
4. **Vòng lặp hoàn thiện:** Lặp lại Bước 5 cho đến khi tất cả các bài test cho chức năng gốc và chức năng liên đới đều Pass.

## BƯỚC 6: Cập nhật tài liệu (Documentation)
- Nếu thay đổi ảnh hưởng đến Interface/API, cập nhật ngay Swagger / Postman / API Docs.
- Viết / cập nhật lại Block Comments/Type definitions (PHPDoc/JSDoc/TypeScript) cho các hàm vừa thay đổi signature.
- Nhắc nhở cập nhật `README.md` nếu có ENV mới.

## BƯỚC 7: Kiểm tra cuối cùng (Pre-PR Checklist)
Agent rà soát lại:
- [ ] Code đã được format đúng chuẩn và pass linting (PHP-CS-Fixer, ESLint, Prettier).
- [ ] KHÔNG còn tồn tại lệnh debug code (`dd()`, `var_dump`, `print_r`, `console.log`, `die()`, `exit()`, `debug()`).
- [ ] KHÔNG còn TODO comments chưa được giải quyết.
- [ ] KHÔNG có hardcoded credentials (mật khẩu, token gán cứng trong code).
- [ ] Type definitions đầy đủ (TypeScript/PHPDoc).
- [ ] Đã pass Security check cơ bản (Ngừa SQL injection, XSS).
- [ ] Tin nhắn Commit mô tả đúng nghiệp vụ (Ví dụ: `fix(auth): correct token parsing issue`).

## BƯỚC 8: Tổng kết và Khuyến nghị PR
- Cung cấp cho User một bản tóm tắt công việc dạng text để copy paste làm PR Description (Bao gồm: Lỗi gốc, Cách sửa, Danh sách file ảnh hưởng đã test pass).
- Yêu cầu User chuẩn bị Evidence (Screenshot/Video) nếu dính đến thay đổi UI.

---

## 🛑 Xử lý Lỗi & Ngoại lệ (Exception Handling)
- **Khi test fail liên tục (Lặp loop quá 3 lần):** Dừng auto-fix, rollback về commit trước để an toàn và báo cáo trực tiếp cho User.
- **Khi phát hiện Git conflict trong lúc Pull:** Dừng ngay workflow, thông báo file bị conflict và hướng dẫn/đợi User resolve.
- **Khi module bị ảnh hưởng hoàn toàn không có test coverage:** Agent phải cảnh báo rủi ro cao và kiến nghị/tự động viết thêm test outline trước khi sửa code gốc.

---

## 📚 Ví dụ (Examples)

### Ví dụ 1: Fix bug đơn giản (Thiếu param)
1. User yêu cầu fix lỗi "Undefined array key" ở `UserService.php`.
2. Agent phân tích tìm thấy `UserController.php` gọi `UserService`.
3. Báo cáo Impact Analysis cho User. User duyệt.
4. Agent sửa logic trong `UserService`, kéo theo việc phải truyền thêm biến `$role`. Agent tự mở `UserController` và truyền thêm `$role`.
5. Chạy `php artisan test --filter=UserTest`. Xanh -> Báo cáo xong.

### Ví dụ 2: Thêm feature phức tạp
1. User yêu cầu "Thêm chức năng xuất Excel cho Visitor".
2. Agent tìm thấy cần tạo `ExportService` mới và sửa `VisitorController`.
3. Agent xuất báo cáo, báo cần viết thêm `ExportVisitorTest`. User duyệt.
4. Agent code xong chức năng + viết test mới kèm theo cập nhật PHPDoc.
5. Kiểm tra Checklist: Pass Prettier/CS-Fixer, bỏ đi các lệnh `dd()` nếu có. Báo cáo PR Description gọn gàng.
