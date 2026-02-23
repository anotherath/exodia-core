# 🛡️ Rate Limiting & API Spam Prevention

Tài liệu phân tích các rủi ro khi bị spam API và đề xuất giải pháp giới hạn tốc độ (Rate Limiting) cho từng endpoint trong hệ thống Exodia.

---

## ⚠️ Vấn Đề & Rủi Ro Nếu Không Có Rate Limiting

### 1. Nonce Farming (Đặt Nonce Vô Tận)

- **API:** `GET /nonce/get-nonce`
- **Hành vi spam:** Bot gọi liên tục để tạo nonce mới, overwrite nonce cũ.
- **Rủi ro:** Người dùng đang trong quá trình ký sẽ bị invalidate nonce liên tục → không thể thực hiện giao dịch. Chi phí thấp, attack dễ thực hiện.

### 2. Open Order Bombing (Bom Lệnh)

- **API:** `POST /orders/market`, `POST /orders/limit`
- **Hành vi spam:** Bot đặt hàng trăm lệnh trong vài giây.
- **Rủi ro:**
  - Server xử lý quá tải (Distributed Lock sẽ chặn race condition nhưng không giảm được số lượng request đến).
  - Redis bị tràn với hàng nghìn key `orders:pending`.
  - MongoDB bị hammer bởi hàng loạt insert.

### 3. Candle Data Scraping (Thu Thập Dữ Liệu Nến)

- **API:** `GET /market/candles`
- **Hành vi spam:** Bot loop liên tục để lấy dữ liệu giá sử dụng cho mục đích khác.
- **Rủi ro:** OKX API bị kéo theo (cache lock không đủ bảo vệ nếu bot biết cách bypass), chi phí server và bandwidth tăng cao.

### 4. Wallet Query Flooding (Flood Query Ví)

- **API:** `GET /wallet`, `GET /positions`, `GET /orders/open`
- **Hành vi spam:** Bot poll giá liên tục để theo dõi P&L, thay vì dùng WebSocket.
- **Rủi ro:** MongoDB bị đọc liên tục thay vì dùng Redis cache, làm chậm toàn hệ thống.

### 5. Position Close Bombing (Spam Đóng Lệnh)

- **API:** `POST /positions/:id/close`
- **Hành vi spam:** Spam nút đóng lệnh cùng một vị thế nhiều lần.
- **Rủi ro:** Nếu logic không atomic, có thể dẫn đến double-close và sai số PnL. Distributed Lock giảm thiểu nhưng không chặn hoàn toàn ở lớp network.

### 6. Admin API Abuse (Lạm Dụng API Admin)

- **API:** `POST /pairs`, `PUT /pairs/:instId/status`, `DELETE /pairs/:instId`
- **Hành vi spam:** Gọi tới endpoint Admin mà không có authentication.
- **Rủi ro:** ⚠️ **NGHIÊM TRỌNG** — Hiện tại các API này hoàn toàn không có Auth. Bất kỳ ai cũng có thể tạo/xóa pair hoặc vô hiệu hóa toàn bộ thị trường.

---

## 🔧 Giải Pháp

Hệ thống sẽ dùng **`@nestjs/throttler`** — built-in Rate Limiter của NestJS, lưu trạng thái trong Redis để chịu tải tốt trong môi trường đa node (scale horizontally).

### Cài đặt

```bash
npm install @nestjs/throttler
```

### Khái niệm cần nắm

| Thuật ngữ | Ý nghĩa                                       |
| --------- | --------------------------------------------- |
| `ttl`     | Khoảng thời gian nhìn lại (giây)              |
| `limit`   | Số request tối đa trong khoảng `ttl`          |
| `skipIf`  | Điều kiện để bỏ qua Rate Limit (ví dụ: admin) |

**Ví dụ:** `ttl: 60, limit: 10` → Tối đa 10 request / 60 giây.

---

## 📋 Giới Hạn Cho Từng API

### 🔐 Nonce

| Endpoint           | Method | Giới Hạn                     | Lý Do                                                              |
| ------------------ | ------ | ---------------------------- | ------------------------------------------------------------------ |
| `/nonce/get-nonce` | GET    | **5 request / 60 giây / IP** | Nonce chỉ cần lấy 1 lần trước mỗi giao dịch. 5 lần/phút là rất dư. |

---

### 💰 Orders (Lệnh Giao Dịch)

> Đây là nhóm nhạy cảm nhất vì liên quan trực tiếp đến tài chính.

| Endpoint              | Method | Giới Hạn                          | Lý Do                                                                                              |
| --------------------- | ------ | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `POST /orders/market` | POST   | **3 request / 10 giây / wallet**  | Mở lệnh Market là tác vụ nặng (lock, validate, DB write, Redis write). User hợp lệ không cần spam. |
| `POST /orders/limit`  | POST   | **5 request / 10 giây / wallet**  | Limit order nhẹ hơn Market nhưng cần giữ Reserved Margin.                                          |
| `PUT /orders/:id`     | PUT    | **5 request / 10 giây / wallet**  | Chỉnh sửa lệnh chờ, không quá thường xuyên.                                                        |
| `DELETE /orders/:id`  | DELETE | **5 request / 10 giây / wallet**  | Hủy lệnh cần lock, tránh double-cancel.                                                            |
| `GET /orders/open`    | GET    | **30 request / 60 giây / wallet** | Đọc dữ liệu, tương đối nhẹ.                                                                        |
| `GET /orders/history` | GET    | **20 request / 60 giây / wallet** | Đọc DB, có thể nặng nếu user nhiều lịch sử.                                                        |

---

### 📈 Positions (Vị Thế)

| Endpoint                    | Method | Giới Hạn                          | Lý Do                                         |
| --------------------------- | ------ | --------------------------------- | --------------------------------------------- |
| `GET /positions`            | GET    | **30 request / 60 giây / wallet** | Nên dùng WebSocket thay vì poll.              |
| `GET /positions/:id`        | GET    | **30 request / 60 giây / wallet** | Truy vấn đơn, nhẹ.                            |
| `PUT /positions/:id`        | PUT    | **5 request / 10 giây / wallet**  | Điều chỉnh đòn bẩy / SL TP, không cần nhanh.  |
| `POST /positions/:id/close` | POST   | **3 request / 10 giây / wallet**  | Đóng lệnh là tác vụ nặng nhất. Giới hạn chặt. |
| `GET /positions/history`    | GET    | **20 request / 60 giây / wallet** | Đọc DB lịch sử.                               |

---

### 📊 Market (Dữ Liệu Thị Trường)

| Endpoint              | Method | Giới Hạn                      | Lý Do                                                                                                 |
| --------------------- | ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /market/candles` | GET    | **30 request / 60 giây / IP** | Cache Redis đã có, nhưng cần giới hạn để tránh scraping. Dùng IP thay vì wallet vì đây là public API. |

---

### 👤 User

| Endpoint                      | Method | Giới Hạn                         | Lý Do                                                             |
| ----------------------------- | ------ | -------------------------------- | ----------------------------------------------------------------- |
| `GET /user/get-active-status` | GET    | **20 request / 60 giây / IP**    | Kiểm tra trạng thái, nhẹ.                                         |
| `POST /user/post-active-user` | POST   | **3 request / 60 giây / wallet** | Kích hoạt user chỉ cần làm 1 lần. Giới hạn chặt để tránh spam DB. |

---

### 💳 Wallet

| Endpoint                      | Method | Giới Hạn                          | Lý Do                                           |
| ----------------------------- | ------ | --------------------------------- | ----------------------------------------------- |
| `GET /wallet`                 | GET    | **20 request / 60 giây / wallet** | Đọc số dư, không nên poll liên tục.             |
| `POST /wallet/deposit-trade`  | POST   | **5 request / 60 giây / wallet**  | Nạp tiền vào Trade Balance, không thường xuyên. |
| `POST /wallet/withdraw-trade` | POST   | **5 request / 60 giây / wallet**  | Rút tiền, cần giới hạn để an toàn.              |

---

### 🔧 Pairs (Admin Only)

> ⚠️ **Cần bổ sung Auth (API Key hoặc JWT Admin) trước khi deploy production.**

| Endpoint                    | Method | Giới Hạn                      | Lý Do                                     |
| --------------------------- | ------ | ----------------------------- | ----------------------------------------- |
| `GET /pairs`                | GET    | **60 request / 60 giây / IP** | Public, chỉ đọc.                          |
| `GET /pairs/active`         | GET    | **60 request / 60 giây / IP** | Public, chỉ đọc.                          |
| `POST /pairs`               | POST   | **10 request / 60 giây / IP** | Admin only. Cần Auth.                     |
| `PUT /pairs/:instId/status` | PUT    | **10 request / 60 giây / IP** | Admin only. Cần Auth.                     |
| `DELETE /pairs/:instId`     | DELETE | **5 request / 60 giây / IP**  | Admin only. Cần Auth, giới hạn chặt nhất. |

---

## 🏗️ Hướng Dẫn Triển Khai

### Bước 1: Cài đặt ThrottlerModule trong `AppModule`

```typescript
// src/app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        // Mức global mặc định (fallback)
        name: 'global',
        ttl: 60_000, // 60 giây
        limit: 60,
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Áp dụng cho toàn bộ app
    },
  ],
})
export class AppModule {}
```

### Bước 2: Override giới hạn cho từng endpoint

```typescript
// Ví dụ: position.controller.ts
import { Throttle, SkipThrottle } from '@nestjs/throttler';

@Post('orders/market')
@Throttle({ default: { ttl: 10_000, limit: 3 } }) // 3 request / 10 giây
openMarket(@Body() body: OpenMarketDto) { ... }

@Get('orders/open')
@Throttle({ default: { ttl: 60_000, limit: 30 } }) // 30 request / 60 giây
getOpenOrders(...) { ... }

@Get('positions')
@SkipThrottle() // Bỏ qua nếu đã có Auth middleware riêng
getPositions(...) { ... }
```

### Bước 3: Xác định "ai" bị giới hạn (Key Generator)

Mặc định NestJS Throttler dùng **IP**. Với các API Trading, mình muốn giới hạn theo **walletAddress**:

```typescript
// src/shared/guards/throttler-by-wallet.guard.ts
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class ThrottlerByWalletGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Lấy wallet từ body hoặc query, fallback về IP
    const wallet =
      req.body?.walletAddress ||
      req.body?.typedData?.walletAddress ||
      req.query?.walletAddress;
    return wallet ?? req.ip;
  }
}
```

---

## ⚡ Phản Hồi Khi Bị Giới Hạn

Khi vượt giới hạn, API trả về:

```json
HTTP 429 Too Many Requests
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

Header bổ sung:

```
Retry-After: 45  ← Số giây còn lại trước khi được thử lại
```

---

## ✅ Tóm Tắt Ưu Tiên Triển Khai

| Ưu tiên         | Việc cần làm                                                                   |
| --------------- | ------------------------------------------------------------------------------ |
| 🔴 Ngay lập tức | Thêm Auth (API Key) cho `/pairs` POST/PUT/DELETE                               |
| 🔴 Ngay lập tức | Triển khai Rate Limit cho `POST /orders/market` và `POST /positions/:id/close` |
| 🟡 Sớm          | Triển khai `ThrottlerByWalletGuard` cho toàn bộ Trading API                    |
| 🟡 Sớm          | Giới hạn `POST /user/post-active-user`                                         |
| 🟢 Sau          | Giới hạn các `GET` endpoint                                                    |
