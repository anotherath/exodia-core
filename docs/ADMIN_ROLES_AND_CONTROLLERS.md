# Vai trò và Danh mục Admin Controllers - Exodia Core

Tài liệu này quy định các quyền hạn của Admin và danh sách các Controller cần được bảo vệ để quản trị hệ thống Exodia. Các endpoint này **BẮT BUỘC** phải có guard xác thực (ví dụ `AdminGuard` hoặc `RolesGuard`).

---

## 1. Tổng quan vai trò của Admin

Admin trong hệ thống Exodia không tham gia giao dịch trực tiếp bằng tiền của mình nhưng giữ quyền điều phối "luật chơi":

- **Quản lý thị trường**: Quyết định cặp tiền nào được giao dịch.
- **Quản lý rủi ro**: Đình chỉ giao dịch khi có biến động mạnh.
- **Quản trị người dùng**: Kích hoạt hoặc hạn chế người dùng tham gia hệ thống.
- **Giám sát hệ thống**: Theo dõi trạng thái các lệnh và vị thế đang mở toàn hệ thống.

---

## 2. Danh mục các Admin Controller

### 2.1. AdminPairController (Quản lý cặp giao dịch)

Đây là controller quan trọng nhất để điều khiển luồng dữ liệu của Engine.

- **`POST /admin/pairs`**: Thêm cặp giao dịch mới (BTC-USDT, ETH-USDT...). Gọi `PairService.upsertPair`.
- **`PATCH /admin/pairs/:instId/status`**: Bật/Tắt một cặp tiền. Khi Admin tắt một cặp, hệ thống phải tự động hủy các subscription WebSocket để tiết kiệm tài nguyên. Gọi `PairService.updateStatus`.
- **`DELETE /admin/pairs/:instId`**: Xóa hoàn toàn một cặp tiền khỏi DB và ngừng nhận giá. Gọi `PairService.deletePair`.

### 2.2. AdminUserController (Quản lý người dùng)

- **`GET /admin/users`**: Lấy danh sách tất cả người dùng trong hệ thống.
- **`POST /admin/users/:walletAddress/activate`**: Kích hoạt người dùng mới (sau khi xác minh Nonce/Signature).
- **`PATCH /admin/users/:walletAddress/limits`**: Thiết lập giới hạn giao dịch riêng cho từng user (ví dụ: đòn bẩy tối đa, volume tối đa).

### 2.3. AdminPositionController (Giám sát rủi ro)

- **`GET /admin/positions/active`**: Xem tất cả các vị thế (`Positions`) đang mở của toàn bộ người dùng để tính toán rủi ro hệ thống.
- **`POST /admin/positions/:id/close-force`**: Cưỡng chế đóng một vị thế trong trường hợp khẩn cấp hoặc xử lý sự cố.
- **`GET /admin/positions/history`**: Truy xuất lịch sử lệnh của bất kỳ user nào để giải quyết tranh chấp.

### 2.4. AdminSystemController (Cấu hình hệ thống)

- **`GET /admin/system/health`**: Kiểm tra trạng thái kết nối WebSocket tới OKX, trạng thái Redis và MongoDB.
- **`PATCH /admin/system/throttler`**: Điều chỉnh Rate Limit (Throttler) động mà không cần restart server (nếu đã tập trung hóa config).
- **`POST /admin/system/maintenance`**: Bật chế độ bảo trì (Maintenance Mode) - tạm dừng tất cả các API cho phép mở lệnh mới.

---

## 3. Quy tắc triển khai (Rules)

1. **Prefix Phân biệt**: Tất cả các Admin endpoint nên bắt đầu bằng `/admin/`.
2. **Thứ tự Validation vs Auth**:
   - `AuthGuard (Admin)` chạy đầu tiên.
   - `ValidationPipe` chạy thứ hai để kiểm tra dữ liệu đầu vào.
3. **Audit Log**: Mọi hành động của Admin (đặc biệt là thêm/xóa Pair hoặc đóng vị thế) **PHẢI** được log lại (`Logger` hoặc `AuditLogModel`) để phục vụ kiểm toán.
4. **Tách biệt Controller**: Không gộp Admin methods vào Controller chung của User (ví dụ: `PairController` hiện tại chỉ nên có `GET`, còn `AdminPairController` sẽ giữ `POST/PATCH/DELETE`).

---

## 4. Kế hoạch Refactor Test

Dựa trên tài liệu này, chúng ta sẽ:

1. Tạo các Admin Controller tương ứng.
2. Di chuyển logic `POST/PATCH/DELETE` từ các Controller hiện tại sang Admin Controller.
3. Cập nhật lại Test Suites để đảm bảo kiểm tra đúng cả quyền Admin (ví dụ: Test trường hợp user thường gọi API admin phải trả về `403 Forbidden`).
