# Redis Implementation Plan - Exodia Core

Tài liệu này phác thảo kế hoạch tích hợp Redis vào hệ thống Exodia Core để tối ưu hóa hiệu năng, tính toán real-time và khả năng mở rộng.

## 1. Mục tiêu (Motivation)

- **Tốc độ:** Xử lý các dữ liệu tạm thời (nonce, market prices) với độ trễ thấp nhất.
- **Real-time:** Hỗ trợ tính toán Unrealized PnL (uPnL) và số dư tạm thời mà không gây tải cho MongoDB.
- **Tính nhất quán:** Đảm bảo dữ liệu đồng bộ giữa các instance khi hệ thống scale-out.
- **An toàn:** Sử dụng Distributed Lock để tránh race condition trong các giao dịch tài chính.

## 2. Phân loại lưu trữ dữ liệu

| Loại dữ liệu   | Dữ liệu cụ thể                  | Storage         | Cấu trúc Redis                     |
| :------------- | :------------------------------ | :-------------- | :--------------------------------- |
| **Xác thực**   | Nonce, Session                  | Redis           | `String` (key: `nonce:address`)    |
| **Thị trường** | Tickers, Mark Price             | Redis           | `Hash` (key: `market:prices`)      |
| **Giao dịch**  | Open Positions, Pending Orders  | Redis + MongoDB | `Hash` (key: `active:pos:address`) |
| **Hệ thống**   | Mutex Locks                     | Redis           | `String` (set with `NX`)           |
| **Lịch sử**    | Trade History, Closed Positions | MongoDB         | -                                  |
| **Tài sản**    | Wallet Balance (Master)         | MongoDB         | -                                  |

## 3. Kiến trúc giao tiếp

- **Nội bộ (Backend - Backend):** Sử dụng **Redis Pub/Sub** để giao tiếp giữa Trading Engine và Web API.
- **Người dùng (Backend - Frontend):** Sử dụng **WebSockets (Socket.io)**. Redis đóng vai trò là "Adapter" để đồng bộ tin nhắn giữa các instance server.

## 4. Danh sách công việc (Checklist)

### Giai đoạn 1: Hạ tầng & Cơ bản

- [ ] Cài đặt `ioredis` và cấu hình `RedisModule` trong NestJS.
- [ ] Thiết lập biến môi trường `.env` cho Redis.
- [ ] Chuyển đổi **Nonce Service** từ MongoDB sang Redis (Sử dụng TTL 2 phút).

### Giai đoạn 2: Market & WebSocket

- [ ] Chuyển đổi `MarketPriceCache` sang Redis để dùng chung cho toàn bộ hệ thống.
- [ ] Tích hợp `Redis Adapter` cho Socket.io.
- [ ] Cập nhật `RealTimeService` để đẩy giá vào Redis Pub/Sub.

### Giai đoạn 3: Position & PnL

- [ ] Triển khai lưu song song Open Positions vào Redis.
- [ ] Viết script đồng bộ (Sync Task) dữ liệu từ MongoDB sang Redis khi server khởi động.
- [ ] Xây dựng logic tính uPnL dựa trên dữ liệu từ Redis.

### Giai đoạn 4: Bảo mật & Tối ưu

- [ ] Triển khai `Distributed Lock` cho luồng Đóng/Mở/Thanh lý vị thế.
- [ ] Thiết lập cơ chế Fallback (nếu Redis die, hệ thống vẫn hoạt động dựa trên MongoDB).

## 5. Cấu trúc dữ liệu mẫu (Gợi ý)

### Active Position

```bash
KEY: positions:active:{walletAddress}
TYPE: Hash
FIELD: {positionId}
VALUE: JSON.stringify({ symbol, side, qty, entryPrice, leverage, ... })
```

### Market Ticker

```bash
KEY: market:tickers
TYPE: Hash
FIELD: BTC-USDT
VALUE: JSON.stringify({ last, bidPx, askPx, timestamp, ... })
```

---

_Ghi chú: Luôn coi MongoDB là Source of Truth. Dữ liệu trên Redis có thể bị xóa và tái tạo lại từ MongoDB bất cứ lúc nào._
