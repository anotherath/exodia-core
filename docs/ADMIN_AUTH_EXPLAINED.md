# 🔐 Admin Login — Giải thích đơn giản

> Tài liệu này giải thích chức năng đăng nhập Admin mà chúng ta vừa code. Đọc xong bạn sẽ hiểu toàn bộ hệ thống hoạt động như thế nào.

---

## Tại sao cần module Admin riêng?

Hệ thống Exodia có **2 loại người dùng** với cách đăng nhập khác nhau:

| Người dùng        | Cách đăng nhập                  | Mục đích                 |
| ----------------- | ------------------------------- | ------------------------ |
| **Trader (User)** | Kết nối ví MetaMask + ký chữ ký | Giao dịch (mở/đóng lệnh) |
| **Admin**         | Nhập username + password        | Quản lý hệ thống         |

Admin **không dùng MetaMask** để đăng nhập vì:

- Không cần ví để quản lý hệ thống
- Cần mức bảo mật khác (mật khẩu + token hết hạn)
- Dễ quản lý tài khoản admin hơn (tạo/khóa/phân quyền)

---

## Hệ thống hoạt động như thế nào?

### Bước 1: Tạo admin đầu tiên (chạy 1 lần duy nhất)

```
npx ts-node -r tsconfig-paths/register src/scripts/seed-admin.ts
```

Script này tạo tài khoản admin mặc định:

- Username: `admin`
- Password: `Admin@123456`
- Role: `super_admin`

> ⚠️ Nên đổi mật khẩu ngay sau khi đăng nhập lần đầu.

### Bước 2: Admin đăng nhập

```
Admin nhập username + password
        │
        ▼
Server kiểm tra:
  1. Username có tồn tại không? → Không → Lỗi
  2. Tài khoản có bị khóa không? → Bị khóa → Lỗi
  3. Password có đúng không? → Sai → Lỗi
  4. Tất cả OK → Tạo JWT token → Trả về cho FE
        │
        ▼
FE lưu token → Chuyển vào Dashboard
```

### Bước 3: Mọi thao tác sau đó

```
FE gửi request + kèm token trong header
        │
        ▼
Server kiểm tra token:
  - Token hợp lệ? → Cho phép truy cập
  - Token hết hạn? → Trả lỗi 401 → FE đá về trang login
  - Admin bị khóa? → Trả lỗi 401 → FE đá về trang login
```

---

## Các file đã tạo và chức năng

### 📁 Config

| File                         | Chức năng                                                                  |
| ---------------------------- | -------------------------------------------------------------------------- |
| `src/config/admin.config.ts` | Cấu hình JWT secret, thời gian hết hạn token (8h), số vòng mã hóa mật khẩu |

### 📁 Types

| File                             | Chức năng                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `src/shared/types/admin.type.ts` | Định nghĩa kiểu dữ liệu Admin: username, passwordHash, role, isActive, lastLoginAt |

### 📁 Database (Repository + Model)

| File                                         | Chức năng                                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/repositories/admin/admin.model.ts`      | Schema MongoDB cho bảng `admins` — định nghĩa các cột trong database                           |
| `src/repositories/admin/admin.repository.ts` | Các hàm truy vấn database: tìm admin, tạo mới, cập nhật mật khẩu, cập nhật thời gian đăng nhập |

### 📁 Logic nghiệp vụ (Service + Controller)

| File                                         | Chức năng                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/modules/admin/admin-auth.service.ts`    | **Bộ não chính** — xử lý logic đăng nhập, tạo token, xác thực token, tạo admin, đổi mật khẩu |
| `src/modules/admin/admin-auth.controller.ts` | **Cổng vào** — nhận request từ FE, gọi service xử lý, trả kết quả                            |
| `src/modules/admin/dto/admin-login.dto.ts`   | Mô tả dữ liệu request login (cho Swagger docs)                                               |
| `src/modules/admin/admin.module.ts`          | Nối tất cả lại với nhau: controller + service + repository + JWT module                      |

### 📁 Bảo vệ (Guard & Cache)

| File                                         | Chức năng                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/shared/guards/admin-auth.guard.ts`      | **Bảo vệ** — kiểm tra token trong mọi request admin. Nếu token sai/hết hạn → chặn lại       |
| `src/repositories/cache/admin-auth.cache.ts` | **Chống Spam** — Đếm số lần admin nhập sai mật khẩu qua Redis. Nếu sai 5 lần, khóa 15 phút. |

### 📁 Tiện ích (Scripts)

| File                        | Chức năng                                         |
| --------------------------- | ------------------------------------------------- |
| `src/scripts/seed-admin.ts` | Script tạo admin đầu tiên khi triển khai hệ thống |

### 📁 Tests

| File                                                        | Số tests | Chức năng                                       |
| ----------------------------------------------------------- | -------- | ----------------------------------------------- |
| `src/repositories/admin/__tests__/admin.repository.spec.ts` | 13       | Test các hàm truy vấn database                  |
| `src/modules/admin/__tests__/admin-auth.service.spec.ts`    | 15+      | Test logic đăng nhập, tạo admin, khóa tài khoản |

---

## Giải thích các khái niệm

### JWT (JSON Web Token) là gì?

JWT giống như một **tấm vé vào cửa** có thời hạn:

- Admin đăng nhập đúng → Server phát cho 1 tấm vé (JWT token)
- Mỗi lần admin muốn làm gì đó → Trình tấm vé
- Server kiểm tra vé: còn hạn không? vé thật không? → Cho vào hoặc từ chối
- Hết hạn (8 giờ) → Phải đăng nhập lại để lấy vé mới

### Bcrypt là gì?

Bcrypt là thuật toán **mã hóa một chiều** cho mật khẩu:

- Khi tạo admin: `"Admin@123456"` → `"$2a$12$x7kJ9q..."` (không thể giải ngược)
- Khi đăng nhập: Lấy mật khẩu nhập vào → mã hóa → so sánh với giá trị trong DB
- Ngay cả nếu database bị lộ, hacker cũng không đọc được mật khẩu gốc

### Phân quyền (Roles)

| Role          | Quyền hạn (dự kiến)                |
| ------------- | ---------------------------------- |
| `super_admin` | Toàn quyền — quản lý cả admin khác |
| `operator`    | Quản lý positions, orders, pairs   |
| `support`     | Chỉ xem thông tin (read-only)      |

> Hiện tại phân quyền chưa được áp dụng chi tiết — cần thêm `RolesGuard` khi triển khai các tính năng admin cụ thể.

---

## API Endpoints tóm tắt

| Method | URL                 | Auth            | Mô tả                           |
| ------ | ------------------- | --------------- | ------------------------------- |
| `POST` | `/admin/auth/login` | ❌ Không cần    | Đăng nhập, trả về JWT token     |
| `GET`  | `/admin/auth/me`    | ✅ Bearer Token | Kiểm tra token + lấy info admin |

---

## Biến môi trường cần thiết

Thêm vào file `.env`:

```env
ADMIN_JWT_SECRET=mot-chuoi-ngau-nhien-dai-kho-doan
ADMIN_JWT_EXPIRES_IN=8h
```

- `ADMIN_JWT_SECRET`: Chìa khóa để server ký token. **Phải giữ bí mật tuyệt đối.**
- `ADMIN_JWT_EXPIRES_IN`: Token hết hạn sau bao lâu (8h = 8 tiếng).

---

## Packages đã cài thêm

| Package           | Mục đích                         |
| ----------------- | -------------------------------- |
| `bcryptjs`        | Mã hóa mật khẩu (hash + so sánh) |
| `@types/bcryptjs` | TypeScript types cho bcryptjs    |
| `@nestjs/jwt`     | Tạo và xác thực JWT token        |

---

## Tóm lại

Chúng ta đã tạo một hệ thống đăng nhập admin hoàn chỉnh:

1. ✅ **Database:** Bảng `admins` lưu username + mật khẩu đã mã hóa
2. ✅ **Đăng nhập:** Nhập username/password → nhận JWT token (hết hạn 8h)
3. ✅ **Bảo vệ routes:** Mọi API admin đều phải gửi token hợp lệ
4. ✅ **Bảo mật:** Mật khẩu bcrypt, token JWT, không tiết lộ lý do lỗi cụ thể
5. ✅ **Script seed:** Tạo admin đầu tiên khi triển khai
6. ✅ **Tests:** 28 tests đều pass
7. ✅ **Swagger:** Tự động hiển thị docs tại `/api`
