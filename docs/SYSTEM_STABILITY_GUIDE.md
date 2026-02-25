# Hướng dẫn Chống Crash và Tăng Cường Độ Ổn Định Hệ Thống (Exodia Core)

Tài liệu này phân tích các rủi ro kỹ thuật có thể dẫn đến việc hệ thống bị treo, crash hoặc hoạt động sai lệch, cùng với các giải pháp tương ứng cho dự án Exodia Core.

---

## 1. Rủi ro từ Phụ thuộc Bên ngoài (External Dependencies)

### 1.1. Treo Request do API OKX

- **Vấn đề:** Các hàm trong `OkxRest` gọi API bên ngoài nhưng hiện chưa cấu hình `timeout`. Nếu OKX bị lag hoặc mạng chập chờn, request của Node.js sẽ ở trạng thái "pending" vô thời hạn.
- **Rủi ro:** Tràn số lượng connection, memory leak, treo Event Loop dẫn đến crash toàn bộ app.
- **Giải pháp:** Cấu hình timeout cho toàn bộ instance Axios (mức khuyến nghị: 5s - 10s).

### 1.2. Mất kết nối Database (MongoDB/Redis)

- **Vấn đề:** Nếu mạng nội bộ gặp sự cố hoặc database restart, các hàm truy vấn sẽ ném lỗi hoặc treo.
- **Rủi ro:** Dữ liệu không được ghi (mất lệnh của khách), app bị crash nếu không có try-catch bọc quanh các lệnh DB quan trọng.
- **Giải pháp:**
  - Sử dụng cơ chế `MongooseModule` và `IORedisModule` của NestJS để tự động quản lý retry.
  - Implement **Circuit Breaker** cho các tác vụ DB nặng.

---

## 2. Rủi ro ở Mức Ứng dụng (Application Logic)

### 2.1. Lỗi chưa xử lý (Unhandled Exceptions/Rejections)

- **Vấn đề:** Khi code gặp lỗi runtime (ví dụ: `TypeError: Cannot read property of undefined`), NestJS có thể catch ở tầng Controller, nhưng các hàm chạy ngầm (async tasks) thì không.
- **Rủi ro:** Khi gặp lỗi chưa xử lý ở tầng thấp, toàn bộ process Node.js có thể bị tắt đột ngột.
- **Giải pháp:**
  - Triển khai **Global Exception Filter** để đảm bảo lỗi luôn được format và trả về cho user thay vì crash app.
  - Lắng nghe sự kiện `uncaughtException` và `unhandledRejection` trong `main.ts`.

### 2.2. Rò rỉ bộ nhớ WebSocket (Memory Leaks)

- **Vấn đề:** Class `OkxWs` khởi tạo kết nối WebSocket và gắn các event listener. Khi kết nối bị lỗi và `reconnect`, nếu không dọn dẹp (clean up) các listener cũ, chúng sẽ tích tụ trong RAM.
- **Rủi ro:** RAM tăng dần theo thời gian (Memory Leak), sau vài ngày server sẽ hết RAM và bị OS kill.
- **Giải pháp:** Đảm bảo hàm `initWebSocket` gọi `ws.terminate()` và `removeAllListeners()` đối với instance cũ trước khi tạo instance mới.

---

## 3. Rủi ro về Tài nguyên & Hạ tầng (Infrastructure)

### 3.1. Crash do quá tải (OOM - Out of Memory)

- **Vấn đề:** Chạy app trực tiếp bằng lệnh `node dist/main.js` không cung cấp khả năng tự phục hồi.
- **Rủi ro:** Nếu app crash vì bất kỳ lý do gì, nó sẽ chết luôn cho đến khi có người vào bật lại thủ công.
- **Giải pháp:**
  - Sử dụng **PM2** để chạy app ở chế độ Cluster.
  - Cấu hình `max_memory_restart` trong PM2 để tự động restart app nếu RAM vượt ngưỡng nguy hiểm.

### 3.2. Race Condition khi giao dịch

- **Vấn đề:** User gửi nhiều request cùng 1 mili-giây để lợi dụng độ trễ của DB nhằm mở lệnh khi số dư không đủ.
- **Rủi ro:** Tài khoản bị âm tiền, logic trading bị sai lệch nghiêm trọng.
- **Giải pháp:** Sử dụng **Distributed Lock** (Redlock) đã được triển khai trong `PositionService` (chống race condition theo từng Wallet Address).

---

## 4. Chiến lược Giám sát & Phục hồi (Monitoring & Recovery)

### 4.1. Health Checks

- **Giải pháp:** Triển khai endpoint `/health` (sử dụng `@nestjs/terminus`). Endpoint này sẽ kiểm tra tình trạng sống/chết của:
  - MongoDB
  - Redis
  - Kết nối OKX
  - Dung lượng RAM còn trống.

### 4.2. Logging & Alerting

- **Vấn đề:** Hiện tại logs chỉ in ra console, sẽ bị mất khi app restart hoặc server crash.
- **Giải pháp:**
  - Sử dụng **Winston** hoặc **Pino** để lưu logs vào file hoặc dịch vụ tập trung.
  - Tích hợp **Sentry** để bắn thông báo lỗi ngay lập tức về Telegram/Email khi hệ thống xảy ra Exception.

### 4.3. Graceful Shutdown

- **Giải pháp:** Khi hệ thống nhận tín hiệu tắt (SIGTERM), cần đợi app xử lý xong các lệnh giao dịch dở dang rồi mới đóng kết nối Database và tắt hẳn.
  ```typescript
  // Trong main.ts
  app.enableShutdownHooks();
  ```

---

## Danh sách công việc cần làm ngay (Action Items)

1. [ ] Thêm `timeout: 10000` vào tất cả các call của `axios`.
2. [ ] Tạo `GlobalExceptionFilter` để bọc toàn bộ ứng dụng.
3. [ ] Cài đặt PM2 và file `ecosystem.config.js` cho môi trường production.
4. [ ] Tích hợp Sentry để theo dõi lỗi 24/7.
5. [ ] Thêm cơ chế `/health` để Docker/Load Balancer có thể tự động kiểm tra.
