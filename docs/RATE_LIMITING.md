# 🛡️ Rate Limiting & Chống Spam API

Tài liệu phân tích rủi ro khi bị spam API và đề xuất giới hạn tốc độ cho từng endpoint.

---

## Mục Lục

1. [Rủi Ro Khi Không Có Rate Limiting](#-rủi-ro-khi-không-có-rate-limiting)
2. [Giải Pháp Tổng Quan](#-giải-pháp-tổng-quan)
3. [Bảng Giới Hạn Cho Từng API](#-bảng-giới-hạn-cho-từng-api)
4. [Hướng Dẫn Triển Khai](#-hướng-dẫn-triển-khai)
5. [Ưu Tiên Triển Khai](#-ưu-tiên-triển-khai)

---

## ⚠️ Rủi Ro Khi Không Có Rate Limiting

### 1. Order Bombing (Bom Lệnh)

- **API bị ảnh hưởng:** `POST /orders/market`, `POST /orders/limit`
- **Kịch bản:** Bot gửi hàng trăm lệnh mỗi giây.
- **Hậu quả:**
  - MongoDB bị hammer bởi insert liên tục.
  - Redis tràn key `orders:pending`, `positions:active`.
  - Distributed Lock chỉ serialize request, **không giảm số lượng** → server vẫn bị ngẽn.
- **Mức độ nguy hiểm:** 🔴 Nghiêm trọng

### 2. Close Position Spam (Spam Đóng Lệnh)

- **API bị ảnh hưởng:** `POST /positions/:id/close`
- **Kịch bản:** User spam nút đóng cùng 1 vị thế.
- **Hậu quả:** Nếu không atomic → double-close, PnL bị tính sai.
- **Mức độ nguy hiểm:** 🔴 Nghiêm trọng

### 3. Nonce Flooding

- **API bị ảnh hưởng:** `GET /nonce/get-nonce`
- **Kịch bản:** Bot gọi liên tục tạo nonce mới, overwrite nonce đang chờ ký.
- **Hậu quả:** User đang ký giao dịch bị invalidate nonce → không thể trade.
- **Lưu ý quan trọng:** Mỗi giao dịch (mở, đóng, sửa, hủy) đều cần lấy nonce trước → giới hạn nonce phải **đủ cao** để không block luồng giao dịch hợp lệ.
- **Mức độ nguy hiểm:** 🟡 Trung bình

### 4. Candle Data Scraping

- **API bị ảnh hưởng:** `GET /market/candles`
- **Kịch bản:** Bot scrape dữ liệu nến liên tục for free.
- **Hậu quả:** OKX API bị kéo theo khi cache miss, bandwidth tăng.
- **Mức độ nguy hiểm:** 🟡 Trung bình

### 5. Wallet & Position Polling

- **API bị ảnh hưởng:** `GET /wallet`, `GET /positions`, `GET /orders/open`
- **Kịch bản:** Frontend poll REST mỗi giây thay vì dùng WebSocket.
- **Hậu quả:** MongoDB bị đọc liên tục, tăng latency cho mọi người.
- **Mức độ nguy hiểm:** 🟢 Thấp

### 6. Admin API Không Có Auth

- **API bị ảnh hưởng:** `POST /pairs`, `PUT /pairs/:instId/status`, `DELETE /pairs/:instId`
- **Kịch bản:** Bất kỳ ai cũng gọi được API tạo/xóa pair.
- **Hậu quả:** ⚠️ Toàn bộ thị trường bị vô hiệu hóa hoặc config sai.
- **Mức độ nguy hiểm:** 🔴🔴 Cực kỳ nghiêm trọng — **Cần Auth trước khi lên production.**

---

## 🔧 Giải Pháp Tổng Quan

### Công nghệ

Sử dụng **`@nestjs/throttler`** với Redis storage để hoạt động trong môi trường multi-instance.

```bash
npm install @nestjs/throttler
```

### Hai kiểu giới hạn

| Kiểu            | Giới hạn theo                    | Dùng cho                                |
| --------------- | -------------------------------- | --------------------------------------- |
| **Theo IP**     | Địa chỉ IP của client            | API public (market, pairs, nonce)       |
| **Theo Wallet** | `walletAddress` trong body/query | API trading (orders, positions, wallet) |

### Phản hồi khi bị giới hạn

```
HTTP 429 Too Many Requests
Retry-After: 8

{
  "statusCode": 429,
  "message": "Bạn đang gửi quá nhiều yêu cầu, vui lòng thử lại sau"
}
```

---

## 📋 Bảng Giới Hạn Cho Từng API

> **Quy ước:**
>
> - `ttl` = khoảng thời gian (giây)
> - `limit` = số request tối đa trong khoảng đó
> - 🔑 = Cần chữ ký EIP-712 (đã có nonce)
> - 🔒 = Cần Admin Auth (chưa có, cần bổ sung)

---

### 🔐 Nonce

> ⚠️ **Lưu ý:** Nonce là bước bắt buộc trước MỌI giao dịch. Giới hạn nonce phải >= tổng giới hạn các write API.

| Endpoint           | Method | Limit  | TTL | Theo | Lý do                                                                  |
| ------------------ | ------ | ------ | --- | ---- | ---------------------------------------------------------------------- |
| `/nonce/get-nonce` | GET    | **60** | 60s | IP   | Mỗi giao dịch cần 1 nonce. Worst-case user trade liên tục vẫn đủ dùng. |

---

### 💰 Orders (Lệnh Giao Dịch) 🔑

| Endpoint          | Method | Limit  | TTL | Theo   | Lý do                                                     |
| ----------------- | ------ | ------ | --- | ------ | --------------------------------------------------------- |
| `/orders/market`  | POST   | **3**  | 10s | Wallet | Tác vụ nặng nhất: lock + validate + DB + Redis + Pub/Sub. |
| `/orders/limit`   | POST   | **5**  | 10s | Wallet | Nhẹ hơn market nhưng vẫn ghi DB + reserve margin.         |
| `/orders/:id`     | PUT    | **5**  | 10s | Wallet | Sửa lệnh chờ, không cần quá nhanh.                        |
| `/orders/:id`     | DELETE | **5**  | 10s | Wallet | Hủy lệnh, cần lock + release reserved margin.             |
| `/orders/open`    | GET    | **30** | 60s | Wallet | Đọc dữ liệu, nhẹ. Nên dùng WebSocket.                     |
| `/orders/history` | GET    | **20** | 60s | Wallet | Query DB lịch sử, có thể nặng.                            |

---

### 📈 Positions (Vị Thế)

| Endpoint               | Method  | Limit  | TTL | Theo   | Lý do                               |
| ---------------------- | ------- | ------ | --- | ------ | ----------------------------------- |
| `/positions`           | GET     | **30** | 60s | Wallet | Nên chuyển sang WebSocket dần.      |
| `/positions/:id`       | GET     | **30** | 60s | Wallet | Truy vấn đơn, nhẹ.                  |
| `/positions/:id`       | PUT 🔑  | **5**  | 10s | Wallet | Chỉnh leverage/SL/TP, cần lock.     |
| `/positions/:id/close` | POST 🔑 | **3**  | 10s | Wallet | Đóng lệnh nặng, giới hạn chặt nhất. |
| `/positions/history`   | GET     | **20** | 60s | Wallet | Query DB lịch sử.                   |

---

### 📊 Market (Public)

| Endpoint          | Method | Limit  | TTL | Theo | Lý do                                    |
| ----------------- | ------ | ------ | --- | ---- | ---------------------------------------- |
| `/market/candles` | GET    | **30** | 60s | IP   | Có Redis cache, nhưng cần chặn scraping. |

---

### 👤 User

| Endpoint                  | Method  | Limit  | TTL | Theo   | Lý do                     |
| ------------------------- | ------- | ------ | --- | ------ | ------------------------- |
| `/user/get-active-status` | GET     | **20** | 60s | IP     | Kiểm tra trạng thái, nhẹ. |
| `/user/post-active-user`  | POST 🔑 | **3**  | 60s | Wallet | Kích hoạt chỉ cần 1 lần.  |

---

### 💳 Wallet

| Endpoint                 | Method | Limit  | TTL | Theo   | Lý do                         |
| ------------------------ | ------ | ------ | --- | ------ | ----------------------------- |
| `/wallet`                | GET    | **20** | 60s | Wallet | Đọc số dư.                    |
| `/wallet/deposit-trade`  | POST   | **5**  | 60s | Wallet | Nạp tiền, không thường xuyên. |
| `/wallet/withdraw-trade` | POST   | **5**  | 60s | Wallet | Rút tiền, cùng mức với nạp.   |

---

### 🔧 Pairs (Admin) 🔒

> ⚠️ **CHƯA CÓ AUTH. Cần bổ sung API Key hoặc JWT Admin trước khi deploy.**

| Endpoint                | Method    | Limit  | TTL | Theo | Lý do                           |
| ----------------------- | --------- | ------ | --- | ---- | ------------------------------- |
| `/pairs`                | GET       | **60** | 60s | IP   | Public, chỉ đọc.                |
| `/pairs/active`         | GET       | **60** | 60s | IP   | Public, chỉ đọc.                |
| `/pairs`                | POST 🔒   | **10** | 60s | IP   | Admin only.                     |
| `/pairs/:instId/status` | PUT 🔒    | **10** | 60s | IP   | Admin only.                     |
| `/pairs/:instId`        | DELETE 🔒 | **5**  | 60s | IP   | Admin only, giới hạn chặt nhất. |

---

## 🏗️ Hướng Dẫn Triển Khai

### Bước 1: Đăng ký ThrottlerModule (Global)

```typescript
// src/app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000, // 60 giây — mức mặc định
        limit: 60, // 60 request / 60 giây — mức global
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

### Bước 2: Override từng endpoint bằng `@Throttle`

```typescript
// position.controller.ts
import { Throttle } from '@nestjs/throttler';

@Post('orders/market')
@Throttle({ default: { ttl: 10_000, limit: 3 } })
openMarket(@Body() body: OpenMarketDto) { ... }

@Post('positions/:id/close')
@Throttle({ default: { ttl: 10_000, limit: 3 } })
closePosition(@Param('id') id: string, @Body() body: ClosePositionDto) { ... }
```

### Bước 3: Custom Guard — Giới hạn theo Wallet

```typescript
// src/shared/guards/throttler-by-wallet.guard.ts
import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';

@Injectable()
export class ThrottlerByWalletGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const wallet =
      req.body?.walletAddress ||
      req.body?.typedData?.walletAddress ||
      req.query?.walletAddress;

    // Nếu có walletAddress → limit theo wallet
    // Nếu không → fallback về IP
    return wallet?.toLowerCase() ?? req.ip;
  }
}
```

Sử dụng cho controller cụ thể:

```typescript
@UseGuards(ThrottlerByWalletGuard)
@Controller()
export class PositionController { ... }
```

### Bước 4: Custom Error Message (Tiếng Việt)

```typescript
// src/shared/filters/throttler-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    response.status(429).json({
      statusCode: 429,
      message: 'Bạn đang gửi quá nhiều yêu cầu, vui lòng thử lại sau',
      error: 'Too Many Requests',
    });
  }
}
```

---

## ✅ Ưu Tiên Triển Khai

| #   | Ưu tiên | Việc cần làm                                                        |
| --- | ------- | ------------------------------------------------------------------- |
| 1   | 🔴 Ngay | Thêm **Admin Auth** cho `/pairs` POST/PUT/DELETE                    |
| 2   | 🔴 Ngay | Rate Limit cho `POST /orders/market` và `POST /positions/:id/close` |
| 3   | 🟡 Sớm  | Triển khai `ThrottlerByWalletGuard` cho toàn bộ Trading API         |
| 4   | 🟡 Sớm  | Giới hạn `POST /wallet/deposit-trade` và `/withdraw-trade`          |
| 5   | 🟢 Sau  | Giới hạn các `GET` endpoint                                         |
| 6   | 🟢 Sau  | Monitoring & Dashboard để theo dõi lượng request bị reject          |
