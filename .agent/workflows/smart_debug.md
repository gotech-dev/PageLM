---
description: Quy trình debug thông minh: Search trước khi Fix để tránh sửa mò (brute force)
---

# Smart Debug Process
Mục tiêu: Không bao giờ được sửa lỗi dựa trên phỏng đoán. Phải tìm bằng chứng xác thực từ cộng đồng developer trước.

1. **Analyze Error**:
   - Sử dụng `read_terminal` hoặc xem log để lấy chính xác nội dung lỗi (Error Message & Stack Trace).
   - Xác định thư viện/module gây lỗi và phiên bản hiện tại (xem package.json).

2. **Search External Knowledge (BẮT BUỘC)**:
   - Sử dụng `search_web` với query là nguyên văn câu báo lỗi (bỏ bớt path cụ thể của máy user).
   - Ưu tiên các kết quả từ: Github Issues, StackOverflow, Documentation chính chủ.
   - Nếu lỗi liên quan đến version mới, hãy search changelog/migration guide.

3. **Verify Solution**:
   - Sử dụng `read_url_content` để đọc kỹ ít nhất 2 phương án giải quyết từ kết quả tìm kiếm.
   - So sánh code hiện tại của user với giải pháp tìm được.
   - Tự đặt câu hỏi: "Tại sao cách sửa này lại hoạt động?"

4. **Planning & Fix**:
   - Giải thích cho User nguyên nhân lỗi dựa trên thông tin tìm được (kèm link tham khảo).
   - Đưa ra kế hoạch sửa code.
   - Tiến hành sửa code.
