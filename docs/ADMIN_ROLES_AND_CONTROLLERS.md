# Vai trò và Danh mục Admin Controllers - Exodia Core

Tài liệu này định nghĩa hệ thống phân quyền (RBAC), các vai trò của Admin và danh sách các phương thức quản trị đã được tích hợp trong Repository cũng như kế hoạch triển khai Controller.

---

## 1. Hệ thống Vai trò (Admin Roles)

Hệ thống Exodia phân tách thực thể **Admin** (đăng nhập bằng username/password) và thực thể **User** (đăng nhập bằng Wallet). Thực thể Admin có 3 cấp bậc quyền hạn chính:

- **`super_admin`**: Toàn quyền hệ thống. Có khả năng tạo, chỉnh sửa hoặc vô hiệu hóa các Admin khác. Có quyền can thiệp vào cấu hình lõi.
- **`operator`**: Điều hành viên. Có quyền quản lý các cặp giao dịch (Pairs), xử lý các vị thế cố định (Positions) và điều chỉnh số dư ví (Wallets) để xử lý sự cố.
- **`support`**: Nhân viên hỗ trợ. Chủ yếu là quyền đọc (Read-only) để kiểm tra lịch sử, trạng thái người dùng và vị thế để giải đáp thắc mắc khách hàng.

> **Lưu ý**: Thực thể `User` cũng có trường `role` (user/admin) nhưng đây là quyền hạn trong ngữ cảnh Wallet, khác với hệ thống Admin Account.

---

## 2. Các Repository hỗ trợ Admin

Các Repository đã được nâng cấp để cung cấp các phương thức chuyên biệt dành cho Admin, cho phép can thiệp sâu vào dữ liệu mà không bị ràng buộc bởi các logic validation của User thông thường.

### 2.1. AdminRepository

- Quản lý tài khoản Admin (tạo mới, đổi mật khẩu, quản lý role).
- Xác thực JWT và kiểm tra trạng thái hoạt động của Admin.

### 2.2. PairRepository (Admin Methods)

- `findAllPaginated`: Lấy danh sách cặp tiền có phân trang và lọc theo trạng thái.
- `updatePair`: Cập nhật các thông số đòn bẩy, phí, khối lượng tối thiểu.
- `bulkActivate / bulkDeactivate`: Bật/tắt hàng loạt cặp giao dịch.
- `bulkDelete`: Xóa hàng loạt cặp giao dịch.

### 2.3. UserRepository (Admin Methods)

- `findAllIncludeDeleted`: Xem danh sách tất cả user (kể cả những user đã bị soft-delete).
- `updateUser / setRole`: Thay đổi thông tin cơ bản và vai trò của user.
- `activate / deactivate`: Kích hoạt hoặc vô hiệu hóa tài khoản user.
- `hardDelete`: Xóa vĩnh viễn user khỏi hệ thống.

### 2.4. PositionRepository (Admin Methods)

- `findAllIncludeDeleted`: Giám sát toàn bộ vị thế của hệ thống (kể cả đã xóa).
- `adminUpdate`: Cho phép Admin ghi đè (override) các thông số: SL, TP, Leverage, Status, PnL, Entry/Exit Price.
- `bulkClose`: Cưỡng chế đóng hàng loạt vị thế trong trường hợp khẩn cấp.
- `hardDelete`: Xóa vĩnh viễn vị thế khỏi cơ sở dữ liệu.

### 2.5. WalletRepository (Admin Methods)

- `setBalance / setTradeBalance`: Thiết lập trực tiếp số dư (Override) cho mục đích điều chỉnh sai sót.
- `adjustBalance / adjustTradeBalance`: Cộng hoặc trừ số dư một cách linh hoạt.
- `resetTotals`: Đặt lại tổng số tiền đã nạp/rút về 0.
- `deleteWallet`: Xóa ví người dùng.

---

## 3. Danh mục các Admin Controller (Kế hoạch triển khai)

Mọi Admin Controller **PHẢI** được bảo vệ bởi `AdminAuthGuard` và sử dụng tiền tố `/admin/`.

### 3.1. AdminAuthController (Đã triển khai)

- `POST /admin/auth/login`: Đăng nhập lấy JWT.
- `GET /admin/auth/me`: Kiểm tra thông tin admin hiện tại.

### 3.2. AdminPairController

- `GET /admin/pairs`: Danh sách cặp tiền.
- `POST /admin/pairs`: Thêm cặp tiền mới.
- `PATCH /admin/pairs/:instId`: Cập nhật cấu hình cặp tiền.
- `DELETE /admin/pairs/:instId`: Xóa cặp tiền.

### 3.3. AdminUserController

- `GET /admin/users`: Danh sách người dùng hệ thống.
- `PATCH /admin/users/:walletAddress`: Cập nhật trạng thái/vai trò.
- `DELETE /admin/users/:walletAddress`: Xóa người dùng.

### 3.4. AdminPositionController

- `GET /admin/positions`: Tra cứu tất cả vị thế đang mở/đã đóng.
- `PATCH /admin/positions/:id`: Điều chỉnh thông số vị thế (Admin Override).
- `POST /admin/positions/:id/close-force`: Cưỡng chế đóng lệnh.

### 3.5. AdminWalletController

- `GET /admin/wallets`: Xem số dư của tất cả các ví.
- `POST /admin/wallets/:walletAddress/adjust`: Điều chỉnh số dư (Cộng/Trừ).
- `PATCH /admin/wallets/:walletAddress/override`: Thiết lập lại số dư chính xác.

---

## 4. Quy tắc bảo mật và triển khai

1. **Guard layers**:
   - Tầng 1: `AdminAuthGuard` (Kiểm tra JWT và tính hợp lệ của Admin ID).
   - Tầng 2: `RolesGuard` (Kiểm tra quyền hạn cụ thể: `super_admin` vs `operator`).
2. **Audit Logging**: Mọi hành động can thiệp vào `Mutation` của Admin (setBalance, forceClose, updatePair) **BẮT BUỘC** phải ghi log chi tiết (Ai thực hiện, khi nào, giá trị cũ/mới).
3. **Tách biệt Service**: Các Admin Controller có thể gọi trực tiếp Repository hoặc thông qua các `AdminService` riêng biệt để tránh làm phình to (bloat) các Service chính dành cho người dùng.
4. **Environment Safety**: Các API nguy hiểm (hardDelete, overrideBalance) có thể bị vô hiệu hóa trong môi trường Production thông qua biến môi trường nếu cần thiết.
