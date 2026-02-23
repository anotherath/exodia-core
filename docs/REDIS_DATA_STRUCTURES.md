# 📦 Cấu Trúc Dữ Liệu Redis — Toàn Bộ Hệ Thống Exodia

Tài liệu liệt kê **tất cả** các key được lưu trong Redis, bao gồm cả Trading, Market Data, và Authentication.

---

## Mục Lục

| #   | Key Pattern                             | Kiểu Redis | Chức năng                         |
| --- | --------------------------------------- | ---------- | --------------------------------- |
| 1   | `nonce:{wallet}`                        | String     | Xác thực chữ ký EIP-712           |
| 2   | `market:price:{symbol}`                 | String     | Giá thị trường real-time          |
| 3   | `market:candles:history:{symbol}:{bar}` | Sorted Set | Lịch sử nến (biểu đồ)             |
| 4   | `lock:candles:{symbol}:{bar}`           | String     | Chống stampede khi fetch nến      |
| 5   | `account:{wallet}`                      | Hash       | Tổng hợp tài khoản                |
| 6   | `positions:active:{wallet}`             | Hash       | Vị thế đang mở                    |
| 7   | `orders:pending:{wallet}`               | Hash       | Lệnh Limit chờ khớp               |
| 8   | `lock:position:{wallet}`                | String     | Chống race condition khi đặt lệnh |

**Pub/Sub Channels:**

| Channel                  | Chức năng                                   |
| ------------------------ | ------------------------------------------- |
| `market:prices`          | Phát giá real-time đến frontend (WebSocket) |
| `exodia:position:events` | Thông báo Go Engine có lệnh mới             |

---

## 🔐 1. Nonce (Xác thực EIP-712)

> Mỗi wallet chỉ có **1 nonce hợp lệ** tại một thời điểm. Dùng để xác thực chữ ký trước khi thực hiện bất kỳ thao tác nào.

**Key:** `nonce:{walletAddress}`
**Kiểu:** String
**TTL:** 2 phút (tự xóa)

**Giá trị:** JSON string

```json
{
  "walletAddress": "0x1234abcd...",
  "nonce": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "expiresAt": "2026-02-23T23:52:00.000Z"
}
```

| Thuộc tính      | Mô tả                             |
| --------------- | --------------------------------- |
| `walletAddress` | Địa chỉ ví (lowercase)            |
| `nonce`         | Chuỗi UUID ngẫu nhiên, dùng 1 lần |
| `expiresAt`     | Thời điểm hết hạn                 |

**Ai ghi?** NestJS — `NonceRepository.upsert()`
**Ai đọc?** NestJS — `NonceRepository.findValid()` (khi verify chữ ký)
**Khi nào xóa?** Tự động hết TTL, hoặc xóa ngay sau khi dùng (`NonceRepository.delete()`)

**File:** `src/repositories/cache/nonce.cache.ts`

---

## 📊 2. Giá Thị Trường Real-time

> Lưu snapshot giá mới nhất của từng cặp giao dịch, lấy từ OKX WebSocket.

**Key:** `market:price:{instId}`
**Kiểu:** String
**TTL:** Không có (luôn tồn tại khi hệ thống chạy)

**Ví dụ key:** `market:price:BTC-USDT`

**Giá trị:** JSON string (TickerData từ OKX)

```json
{
  "instType": "SPOT",
  "instId": "BTC-USDT",
  "last": "50123.45",
  "lastSz": "0.01",
  "askPx": "50125.00",
  "askSz": "1.5",
  "bidPx": "50120.00",
  "bidSz": "2.3",
  "open24h": "49000.00",
  "high24h": "51000.00",
  "low24h": "48500.00",
  "volCcy24h": "123456789.00",
  "vol24h": "2500.50",
  "ts": "1708732800000",
  "sodUtc0": "49500.00",
  "sodUtc8": "49800.00"
}
```

| Thuộc tính           | Mô tả                                  |
| -------------------- | -------------------------------------- |
| `last`               | Giá giao dịch cuối cùng                |
| `askPx`              | Giá bán tốt nhất (dùng cho lệnh Long)  |
| `bidPx`              | Giá mua tốt nhất (dùng cho lệnh Short) |
| `high24h` / `low24h` | Giá cao/thấp nhất 24h                  |
| `vol24h`             | Khối lượng giao dịch 24h               |
| `ts`                 | Timestamp (ms)                         |

**Ai ghi?** NestJS — `RealtimeMarketPriceRepository.update()`
**Ai đọc?** NestJS — `RealtimeMarketPriceRepository.get()` (khi mở lệnh, validate giá)

**Khi ghi, đồng thời publish sang channel `market:prices`** để frontend nhận giá qua WebSocket.

**File:** `src/repositories/cache/realtime-market-price.cache.ts`

---

## 🕯️ 3. Lịch Sử Nến (Candle History)

> Dữ liệu biểu đồ nến, lưu bằng Sorted Set để truy vấn theo khoảng thời gian.

**Key:** `market:candles:history:{instId}:{bar}`
**Kiểu:** Sorted Set (ZSET)
**Score:** Timestamp (ms) của nến
**TTL:** 24 giờ (gia hạn mỗi khi truy cập)
**Giới hạn:** Tối đa 10,000 nến / key

**Ví dụ key:** `market:candles:history:BTC-USDT:1m`

**Mỗi member trong ZSET:** JSON string theo format OKX

```json
[
  "1708732800000",
  "50000.0",
  "50500.0",
  "49800.0",
  "50200.0",
  "125.5",
  "6275000.0",
  "1"
]
```

| Vị trí | Ý nghĩa                        | Ví dụ             |
| ------ | ------------------------------ | ----------------- |
| `[0]`  | Timestamp (ms) — cũng là Score | `"1708732800000"` |
| `[1]`  | Open (giá mở)                  | `"50000.0"`       |
| `[2]`  | High (giá cao nhất)            | `"50500.0"`       |
| `[3]`  | Low (giá thấp nhất)            | `"49800.0"`       |
| `[4]`  | Close (giá đóng)               | `"50200.0"`       |
| `[5]`  | Volume (khối lượng)            | `"125.5"`         |
| `[6]`  | Volume USD                     | `"6275000.0"`     |
| `[7]`  | Confirm (`"1"` = đã đóng)      | `"1"`             |

**Ai ghi?** NestJS — `MarketHistoryCacheRepository.addCandles()`
**Ai đọc?** NestJS — `MarketHistoryCacheRepository.getCandles()` (API biểu đồ)

**File:** `src/repositories/cache/market-history.cache.ts`

---

## 🔒 4. Lock Nến (Chống Cache Stampede)

> Khi nhiều user cùng request biểu đồ cho 1 cặp tiền, chỉ 1 request được gọi API OKX. Các request khác đợi kết quả từ cache.

**Key:** `lock:candles:{instId}:{bar}`
**Kiểu:** String
**TTL:** 5 giây

**Ví dụ key:** `lock:candles:BTC-USDT:1m`

| Giá trị | Mô tả              |
| ------- | ------------------ |
| `"1"`   | Lock đang được giữ |

**Ai ghi?** NestJS — `MarketHistoryCacheRepository.acquireLock()`
**Khi nào xóa?** `MarketHistoryCacheRepository.releaseLock()` hoặc tự hết TTL

**File:** `src/repositories/cache/market-history.cache.ts`

---

## 👤 5. Account Summary (Tổng hợp tài khoản)

> Bức tranh toàn cảnh về tài chính của 1 user. **Go Engine** cập nhật liên tục.

**Key:** `account:{walletAddress}`
**Kiểu:** Hash
**TTL:** Không có

**Ví dụ key:** `account:0x1234abcd...`

| Field                 | Kiểu        | Mô tả                             | Ví dụ       |
| --------------------- | ----------- | --------------------------------- | ----------- |
| `tradeBalance`        | string (số) | Số dư quỹ giao dịch               | `"1000.50"` |
| `totalUnrealizedPnL`  | string (số) | Tổng lãi/lỗ chưa chốt             | `"-25.30"`  |
| `totalInitialMargin`  | string (số) | Tổng ký quỹ vị thế đang mở        | `"500.00"`  |
| `totalReservedMargin` | string (số) | Tổng tiền đang giữ cho lệnh Limit | `"200.00"`  |

**Công thức:**

```
Available = tradeBalance + totalUnrealizedPnL - totalInitialMargin - totalReservedMargin
```

**Ai ghi?** Go Engine (tính toán rồi cập nhật)
**Ai đọc?** NestJS — `getAvailableBalance()` trong `PositionValidationService`

**File:** `src/modules/position/position-validation.service.ts`

---

## 📈 6. Active Positions (Vị thế đang mở)

> Danh sách vị thế đã khớp và đang chạy. Mỗi field trong Hash = 1 vị thế.

**Key:** `positions:active:{walletAddress}`
**Kiểu:** Hash
**Field:** `{positionId}` → JSON string

**Ví dụ key:** `positions:active:0x1234abcd...`

**Cấu trúc JSON:**

| Thuộc tính          | Kiểu           | Mô tả                           |
| ------------------- | -------------- | ------------------------------- |
| `symbol`            | string         | Cặp giao dịch (`"BTC-USDT"`)    |
| `side`              | string         | `"long"` hoặc `"short"`         |
| `qty`               | number         | Khối lượng                      |
| `entryPrice`        | number         | Giá vào lệnh                    |
| `leverage`          | number         | Đòn bẩy                         |
| `sl`                | number \| null | Giá cắt lỗ                      |
| `tp`                | number \| null | Giá chốt lời                    |
| `markPrice`         | number         | Giá thị trường hiện tại         |
| `unrealizedPnL`     | number         | Lãi/lỗ chưa chốt                |
| `initialMargin`     | number         | Ký quỹ ban đầu                  |
| `maintenanceMargin` | number         | Ký quỹ duy trì (Go Engine tính) |
| `liquidationPrice`  | number         | Giá thanh lý (Go Engine tính)   |

**Ai ghi?**

- NestJS: Tạo mới khi `openMarket` thành công
- Go Engine: Cập nhật `markPrice`, `unrealizedPnL`, `maintenanceMargin`, `liquidationPrice`

**File:** `src/modules/position/position.service.ts` → `syncPositionToRedis()`

---

## ⏳ 7. Pending Orders (Lệnh Limit chờ khớp)

> Danh sách lệnh Limit đang đợi giá chạm mục tiêu. Tiền bị "xí phần" (reserved).

**Key:** `orders:pending:{walletAddress}`
**Kiểu:** Hash
**Field:** `{positionId}` → JSON string

**Ví dụ key:** `orders:pending:0x1234abcd...`

**Cấu trúc JSON:**

| Thuộc tính       | Kiểu   | Mô tả                               |
| ---------------- | ------ | ----------------------------------- |
| `symbol`         | string | Cặp giao dịch                       |
| `side`           | string | `"long"` hoặc `"short"`             |
| `qty`            | number | Khối lượng                          |
| `entryPrice`     | number | Giá mong muốn                       |
| `leverage`       | number | Đòn bẩy                             |
| `reservedMargin` | number | Tổng tiền bị tạm giữ (margin + fee) |

**Ai ghi?** NestJS — `openLimit()` trong `PositionService`
**Ai đọc?** Go Engine (tính `totalReservedMargin`, theo dõi khớp lệnh)
**Khi nào xóa field?**

- Lệnh khớp → chuyển sang `positions:active`
- Lệnh bị hủy → xóa và trả lại `reservedMargin`

**File:** `src/modules/position/position.service.ts` → `openLimit()`

---

## 🔒 8. Position Lock (Chống Race Condition)

> Đảm bảo mỗi wallet chỉ xử lý 1 thao tác giao dịch tại 1 thời điểm.

**Key:** `lock:position:{walletAddress}`
**Kiểu:** String
**TTL:** 5 giây

**Ví dụ key:** `lock:position:0x1234abcd...`

| Giá trị                 | Mô tả                                 |
| ----------------------- | ------------------------------------- |
| UUID (`"a1b2c3d4-..."`) | ID duy nhất của request đang giữ lock |

**Cách hoạt động:**

1. Acquire: `SET lock:position:{wallet} {uuid} NX EX 5`
2. Release: Lua script so sánh UUID trước khi xóa (an toàn)
3. Nếu lock đang bị giữ → trả về lỗi 409 Conflict

**Ai ghi?** NestJS — `withLock()` trong `PositionService`

**File:** `src/modules/position/position.service.ts`

---

## 📡 Pub/Sub Channels

### Channel: `market:prices`

> Phát giá real-time đến frontend qua WebSocket.

```json
{
  "instId": "BTC-USDT",
  "last": "50123.45",
  "askPx": "50125.00",
  "bidPx": "50120.00",
  ...
}
```

**Publisher:** NestJS (`RealtimeMarketPriceRepository.update()`)
**Subscriber:** Frontend (WebSocket Gateway)

---

### Channel: `exodia:position:events`

> Thông báo cho Go Engine về sự kiện giao dịch.

**Event `POSITION_OPENED`** (Lệnh Market khớp):

```json
{
  "event": "POSITION_OPENED",
  "walletAddress": "0x1234abcd...",
  "positionId": "pos_abc123",
  "symbol": "BTC-USDT",
  "side": "long"
}
```

**Event `ORDER_PLACED`** (Lệnh Limit được đặt):

```json
{
  "event": "ORDER_PLACED",
  "walletAddress": "0x1234abcd...",
  "positionId": "pos_def456",
  "symbol": "ETH-USDT"
}
```

**Publisher:** NestJS (`PositionService`)
**Subscriber:** Go Engine

---

## 🗺️ Tổng Quan

```
Redis
│
├── 🔐 Authentication
│   └── nonce:0x1234...                          ← String (TTL 2m)
│       └── {"walletAddress", "nonce", "expiresAt"}
│
├── 📊 Market Data
│   ├── market:price:BTC-USDT                    ← String (no TTL)
│   │   └── {instId, last, askPx, bidPx, ...}
│   │
│   ├── market:candles:history:BTC-USDT:1m       ← Sorted Set (TTL 24h)
│   │   ├── score:1708732800000 → [ts, o, h, l, c, vol, ...]
│   │   └── score:1708732860000 → [ts, o, h, l, c, vol, ...]
│   │
│   └── lock:candles:BTC-USDT:1m                 ← String (TTL 5s)
│       └── "1"
│
├── 💰 Trading
│   ├── account:0x1234...                        ← Hash (no TTL)
│   │   ├── tradeBalance: "1000.50"
│   │   ├── totalUnrealizedPnL: "-25.30"
│   │   ├── totalInitialMargin: "500.00"
│   │   └── totalReservedMargin: "200.00"
│   │
│   ├── positions:active:0x1234...               ← Hash
│   │   └── {posId}: {symbol, side, qty, entryPrice, ...}
│   │
│   ├── orders:pending:0x1234...                 ← Hash
│   │   └── {posId}: {symbol, side, qty, reservedMargin, ...}
│   │
│   └── lock:position:0x1234...                  ← String (TTL 5s)
│       └── "uuid-value"
│
└── 📡 Pub/Sub
    ├── [Channel] market:prices                  ← Giá real-time → Frontend
    └── [Channel] exodia:position:events         ← Sự kiện → Go Engine
```
