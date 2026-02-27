# Báo Cáo Triển Khai Module Admin - Exodia Core

Tài liệu này tổng hợp các tính năng và cấu trúc kỹ thuật đã được triển khai cho Module Admin, không bao gồm phần Unit Test.

---

## 1. Hệ Thống Phân Quyền (RBAC - Role Based Access Control)

Hệ thống đã được thiết kế mở rộng dựa trên nguyên tắc cấp quyền linh hoạt, đảm bảo an toàn tuyệt đối cho các chức năng quản trị.

- **Khởi tạo `@Roles()` Decorator** (`src/shared/decorators/roles.decorator.ts`): Cung cấp API trực quan bằng siêu dữ liệu (metadata) để gán quyền tối thiểu (Ví dụ: `operator`, `support`) cho từng API Endpoint theo thiết kế.
- **Triển khai `RolesGuard`** (`src/shared/guards/roles.guard.ts`): Middleware chịu trách nhiệm xét duyệt quyền hạn. Guard này đánh giá `role` từ đối tượng truy cập `req.admin` (được định danh bởi `AdminAuthGuard`) và thiết lập các quy định:
  - Luôn luôn cấp phép ngoại lệ (Bypass) cho tài khoản có quyền `super_admin` trên mọi endpoint.
  - Phê duyệt truy cập nếu `role` của quản trị viên nằm trong danh sách khai báo tại `@Roles()`.
  - Phản hồi HTTP 403 (ForbiddenException) khi tài khoản thiếu phân quyền yêu cầu.

---

## 2. API Quản Trị Hệ Thống (Admin Controllers)

Toàn bộ các Controller đã được triển khai áp dụng nghiêm ngặt nguyên lý 2 Lớp Bảo Vệ: `AdminAuthGuard` (xác thực danh tính bằng Token) đi kèm `RolesGuard` (xác minh quyền hạn), sử dụng tiền tố định tuyến `/admin/`.

### 2.1. Quản lý Cặp Giao Dịch (`AdminPairController`)

Tương tác trực tiếp và chuyên sâu với cơ sở dữ liệu Pair qua `PairRepository`.

- **`GET /admin/pairs`**: Lấy danh sách cặp tiền có tính năng phân trang đồng thời lọc trạng thái hoạt động (Quyền yêu cầu: `operator` hoặc `support`).
- **`POST /admin/pairs`**: Lệnh khởi tạo một cặp giao dịch nội bộ mới (Quyền yêu cầu: `operator`).
- **`PATCH /admin/pairs/:instId`**: Cập nhật thông số trọng yếu của cặp giao dịch, bao gồm các cấu hình giới hạn đòn bẩy, tỷ lệ phí thu và các ràng buộc khối lượng (Quyền yêu cầu: `operator`).
- **`DELETE /admin/pairs/:instId`**: Phủ quyết và xoá hẳn cặp tiền khỏi hệ thống (Quyền yêu cầu: `operator`).

### 2.2. Quản lý Người Dùng (`AdminUserController`)

Giao diện quản lý cấu hình người chơi bằng các API đặc thù từ `UserRepository`.

- **`GET /admin/users`**: Trích xuất hồ sơ tệp khách hàng theo bộ lọc điều kiện với phân trang. Đặc biệt, có khả năng nhìn thấy mọi User đã bị đình chỉ (soft-delete) (Quyền yêu cầu: `operator` hoặc `support`).
- **`PATCH /admin/users/:walletAddress`**: Thực hiện chuyển đổi trạng thái người dùng (active/inactive) và can thiệp cấu hình phân quyền cá thể (Quyền yêu cầu: `operator`).
- **`DELETE /admin/users/:walletAddress`**: Xoá sổ dữ liệu tài khoản vĩnh viễn (hard-delete) dành riêng cho các kịch bản kiểm thử hay xử lí vi phạm (Quyền yêu cầu: `operator`).

### 2.3. Quản lý Vị Thế Giao Dịch (`AdminPositionController`)

Cung cấp khả năng thi hành những điều chỉnh đặc biệt vượt qua mô-đun thị trường vật lý cơ sở với `PositionRepository`.

- **`GET /admin/positions`**: Tra cứu và rà soát mọi lịch sử hợp đồng vị thế trên hệ thống, kèm quy tắc hiển thị các bản ghi đã được xoá cho mục đích điều tra (Quyền yêu cầu: `operator` hoặc `support`).
- **`PATCH /admin/positions/:id`**: Kích hoạt việc sửa đổi thô vào cấu trúc lệnh (Override). Điều chỉnh bất cứ giá trị nào từ lãi/lỗ tài chính (PnL), điểm chạm (SL/TP) đến trạng thái hiện hành (Quyền yêu cầu: `operator`).
- **`POST /admin/positions/:id/close-force`**: Trực tiếp ra lệnh cưỡng chế thanh lý hoặc đóng giao dịch. Tính năng này cho phép ấn định mức PnL tức thời của phiên ép đóng (Quyền yêu cầu: `operator`).

### 2.4. Quản lý Số dư, Tài sản (`AdminWalletController`)

Cơ cấu điều phối tiền tệ khẩn cấp nhằm xử lí thất thoát/nhầm lẫn tài sản qua `WalletRepository`.

- **`GET /admin/wallets`**: Hệ thống theo dõi số dư phân định theo mảng (Balance và Trade Balance) dựa vào định danh mạng Blockchain (chainId) (Quyền yêu cầu: `operator` hoặc `support`).
- **`POST /admin/wallets/:walletAddress/adjust`**: Tăng hoặc trừ phi tuyến tính với giá trị tương đối (`delta`) lên tài sản thực tế. Đây là phương thức bù trừ tài sản linh hoạt (Quyền yêu cầu: `operator`).
- **`PATCH /admin/wallets/:walletAddress/override`**: Phương pháp tối cao cài đặt tĩnh lại các cột số dư. Cho phép phá vỡ các luồng tài chính quy chuẩn, thiết lập lại hệ số cân bằng khi xảy ra biến cố dữ liệu (Quyền yêu cầu: `operator`).

---

## 3. Hệ Thống Audit Logging Nội Bộ

Nhằm tuân thủ các chính sách bảo mật, một lớp cơ chế **Audit Log** đã được tích hợp song song với mọi hành vi có tính chất đột biến tài nguyên nội sinh (Mutations).

Mỗi luồng ghi, sửa, hay xoá (POST, PATCH, DELETE) đi vào vùng chia sẻ của Admin đều tạo một file trace với định dạng `logger.warn` hoặc `logger.log` bao hàm các chứng cứ bắt buộc:

1. **Dấu vết định danh**: Chủ thể nào (Lấy username qua biến `req.admin.username`) đã ra lệnh.
2. **Loại rủi ro mục tiêu**: Thực thể chịu tác động (ví ID, địa chỉ người dùng hay ID giao dịch/cặp tiền).
3. **Payload gốc**: Chụp snapshot toàn phần dữ liệu được áp dụng (Payload nội dung `body` stringify).

---

## 4. Sơ Đồ Tiêm Phụ Thuộc (Dependency Injection)

Cấu trúc nội trú của Module hệ thống `src/modules/admin/admin.module.ts` đã được thiết kế lại:

- Nhúng và bảo vệ các Service lõi.
- Xác thực khai báo cho 4 tập API Controller phân nhóm chuyên biệt.
- Thay vì định tuyến và tạo các lớp bao nặn (Wrapper Services) có thể làm cồng kềnh dự án, ta phân bổ tập Repo chia sẻ (`PairRepository`, `UserRepository`, `PositionRepository`, `WalletRepository`) đi thẳng vào quyền xử lý luồng HTTP cục bộ của các Admin Controllers. Giúp tối đa hoá độ trễ và rút ngắn vòng lập kỹ thuật.
