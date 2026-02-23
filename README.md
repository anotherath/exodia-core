# ⚔️ Exodia Core

**Backend API cho sàn giao dịch phái sinh phi tập trung (Decentralized Perpetual Exchange).**

Exodia Core là lớp API được xây dựng bằng NestJS, chịu trách nhiệm xử lý các yêu cầu giao dịch từ người dùng, quản lý ví, xác thực chữ ký EIP-712, và đồng bộ dữ liệu real-time với Go Engine thông qua Redis.

---

## 📋 Mục Lục

- [Kiến Trúc Tổng Quan](#-kiến-trúc-tổng-quan)
- [Công Nghệ Sử Dụng](#-công-nghệ-sử-dụng)
- [Yêu Cầu Hệ Thống](#-yêu-cầu-hệ-thống)
- [Cài Đặt & Chạy](#-cài-đặt--chạy)
- [Biến Môi Trường](#-biến-môi-trường)
- [Cấu Trúc Thư Mục](#-cấu-trúc-thư-mục)
- [API Reference](#-api-reference)
- [Cách Sử Dụng API](#-cách-sử-dụng-api)
- [Rate Limiting](#-rate-limiting)
- [Testing](#-testing)
- [Tài Liệu Kỹ Thuật](#-tài-liệu-kỹ-thuật)

---

## 🏗️ Kiến Trúc Tổng Quan

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│   Frontend   │────▶│  Exodia Core     │────▶│  Go Engine    │
│  (React/Web) │◀────│  (NestJS API)    │◀────│  (Matching)   │
└─────────────┘     └───────┬──────────┘     └───────┬───────┘
                            │                        │
                     ┌──────▼──────┐          ┌──────▼──────┐
                     │   MongoDB   │          │    Redis    │
                     │ (Persistent)│          │  (Realtime) │
                     └─────────────┘          └─────────────┘
```

### Vai trò của từng thành phần:

| Thành phần               | Vai trò                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Exodia Core (NestJS)** | Nhận request từ frontend, xác thực chữ ký EIP-712, validate margin, ghi dữ liệu vào MongoDB, đồng bộ sang Redis và thông báo cho Go Engine |
| **Go Engine**            | Khớp lệnh Limit, tính toán PnL/Margin real-time, quét thanh lý, cập nhật `account:{wallet}` trong Redis                                    |
| **MongoDB**              | Lưu trữ bền vững (Source of Truth): thông tin ví, lịch sử giao dịch, cấu hình cặp tiền                                                     |
| **Redis**                | Bộ nhớ đệm real-time: giá thị trường, vị thế đang mở, account summary, distributed lock, Pub/Sub                                           |

### Luồng xử lý khi mở lệnh Market:

```
1. User ký EIP-712 trên Frontend
2. Frontend gửi POST /orders/market
3. NestJS xác thực Nonce + Chữ ký
4. NestJS kiểm tra Margin (Redis → MongoDB fallback)
5. NestJS ghi Position vào MongoDB
6. NestJS đồng bộ Position lên Redis
7. NestJS publish event "POSITION_OPENED" qua Redis Pub/Sub
8. Go Engine nhận event → bắt đầu theo dõi PnL & Liquidation
```

---

## 🛠️ Công Nghệ Sử Dụng

| Công nghệ              | Phiên bản | Vai trò                          |
| ---------------------- | --------- | -------------------------------- |
| **NestJS**             | 11.x      | Framework chính                  |
| **TypeScript**         | 5.x       | Ngôn ngữ lập trình               |
| **MongoDB** + Mongoose | 9.x       | Cơ sở dữ liệu chính              |
| **Redis** + ioredis    | 5.x       | Cache, Pub/Sub, Distributed Lock |
| **Socket.IO**          | 4.x       | WebSocket real-time              |
| **Swagger**            | 11.x      | Tài liệu API tự động             |
| **Viem**               | 2.x       | Xác thực chữ ký EIP-712          |
| **Jest**               | 30.x      | Unit Testing                     |

---

## 📦 Yêu Cầu Hệ Thống

- **Node.js** >= 18
- **Docker** & **Docker Compose** (cho MongoDB + Redis)
- **npm** >= 9

---

## 🚀 Cài Đặt & Chạy

### 1. Clone & cài đặt dependencies

```bash
git clone <repository-url>
cd exodia-core
npm install
```

### 2. Khởi động MongoDB & Redis

```bash
docker compose up -d
```

Lệnh này sẽ khởi động:

- **MongoDB** tại `localhost:27017`
- **Redis** tại `localhost:6379`

### 3. Chạy ứng dụng

```bash
# Development (hot-reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

Server sẽ chạy tại: **http://localhost:3000**

### 4. Truy cập Swagger UI

Mở trình duyệt và vào: **http://localhost:3000/api**

Tại đây anh có thể xem và thử tất cả API trực tiếp.

---

## 🔐 Biến Môi Trường

Tạo file `.env` tại thư mục gốc:

```env
# --- CẤU HÌNH DỰ ÁN ---
PROJECT_NAME=exodia
NETWORK_NAME=exodia-network

# --- MONGODB ---
MONGO_IMAGE=mongo:latest
MONGO_CONTAINER_NAME=exodia-mongodb
MONGO_PORT=27017
MONGO_ROOT_USER=<username>
MONGO_ROOT_PASSWORD=<password>
MONGO_DB_NAME=exodia-database
MONGODB_URI=mongodb://<username>:<password>@localhost:27017/exodia-database?authSource=admin

# --- REDIS ---
REDIS_IMAGE=redis:alpine
REDIS_CONTAINER_NAME=exodia-redis
REDIS_PORT=6379
REDIS_HOST=127.0.0.1

# --- APP ---
PORT=3000
```

---

## 📂 Cấu Trúc Thư Mục

```
exodia-core/
├── src/
│   ├── config/                    # Cấu hình tập trung
│   │   ├── balance.config.ts      # Độ chính xác số thập phân
│   │   ├── mongodb.config.ts      # URI kết nối MongoDB
│   │   ├── okx.config.ts          # API OKX & khung nến hỗ trợ
│   │   ├── redis.config.ts        # Host & Port Redis
│   │   └── throttler.config.ts    # Giới hạn Rate Limit cho từng API
│   │
│   ├── infra/                     # Hạ tầng (Database adapters)
│   │   ├── mongodb/               # Kết nối MongoDB
│   │   └── redis/                 # Kết nối Redis & WebSocket adapter
│   │
│   ├── modules/                   # Các module nghiệp vụ
│   │   ├── market/                # Dữ liệu thị trường (nến, giá)
│   │   ├── nonce/                 # Quản lý Nonce cho EIP-712
│   │   ├── pair/                  # Danh sách cặp giao dịch
│   │   ├── position/              # Mở/đóng/sửa lệnh & vị thế
│   │   ├── user/                  # Kích hoạt người dùng
│   │   └── wallet/                # Quản lý ví & số dư
│   │
│   ├── repositories/              # Lớp truy cập dữ liệu
│   │   ├── cache/                 # Redis repositories
│   │   ├── wallet/                # MongoDB wallet repository
│   │   └── position/              # MongoDB position repository
│   │
│   ├── shared/                    # Code dùng chung
│   │   ├── filters/               # Exception filters (429, ...)
│   │   ├── types/                 # TypeScript interfaces
│   │   └── utils/                 # Hàm tiện ích (math, web3, ...)
│   │
│   ├── app.module.ts              # Module gốc
│   └── main.ts                    # Entry point
│
├── docs/                          # Tài liệu kỹ thuật
├── test/                          # E2E tests
├── docker-compose.yml             # MongoDB + Redis containers
└── package.json
```

---

## 📡 API Reference

### 🔐 Nonce — `/nonce`

| Method | Endpoint                               | Mô tả                                                                   |
| ------ | -------------------------------------- | ----------------------------------------------------------------------- |
| `GET`  | `/nonce/get-nonce?walletAddress=0x...` | Lấy mã nonce để ký giao dịch EIP-712. Mỗi nonce có hiệu lực **2 phút**. |

---

### 💰 Orders — `/orders`

| Method   | Endpoint                              | Mô tả                                         |
| -------- | ------------------------------------- | --------------------------------------------- |
| `POST`   | `/orders/market`                      | Mở lệnh Market (khớp ngay tại giá thị trường) |
| `POST`   | `/orders/limit`                       | Mở lệnh Limit (đợi giá chạm mới khớp)         |
| `PUT`    | `/orders/:id`                         | Chỉnh sửa lệnh Limit đang chờ                 |
| `DELETE` | `/orders/:id`                         | Hủy lệnh Limit đang chờ                       |
| `GET`    | `/orders/open?walletAddress=0x...`    | Lấy danh sách lệnh đang chờ                   |
| `GET`    | `/orders/history?walletAddress=0x...` | Lấy lịch sử lệnh đã đóng/hủy                  |

---

### 📈 Positions — `/positions`

| Method | Endpoint                                 | Mô tả                            |
| ------ | ---------------------------------------- | -------------------------------- |
| `GET`  | `/positions?walletAddress=0x...`         | Lấy các vị thế đang mở           |
| `GET`  | `/positions/:id`                         | Lấy chi tiết một vị thế          |
| `PUT`  | `/positions/:id`                         | Cập nhật vị thế (đòn bẩy, SL/TP) |
| `POST` | `/positions/:id/close`                   | Đóng vị thế toàn phần            |
| `GET`  | `/positions/history?walletAddress=0x...` | Lấy lịch sử vị thế đã đóng       |

---

### 📊 Market — `/market`

| Method | Endpoint                                           | Mô tả                  |
| ------ | -------------------------------------------------- | ---------------------- |
| `GET`  | `/market/candles?instId=BTC-USDT&bar=1m&limit=100` | Lấy dữ liệu nến K-line |

Khung nến hỗ trợ: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1D`, `1W`, `1M`

---

### 👤 User — `/user`

| Method | Endpoint                                      | Mô tả                                    |
| ------ | --------------------------------------------- | ---------------------------------------- |
| `GET`  | `/user/get-active-status?walletAddress=0x...` | Kiểm tra trạng thái kích hoạt            |
| `POST` | `/user/post-active-user`                      | Kích hoạt người dùng bằng chữ ký EIP-712 |

---

### 💳 Wallet — `/wallet`

| Method | Endpoint                                | Mô tả                            |
| ------ | --------------------------------------- | -------------------------------- |
| `GET`  | `/wallet?walletAddress=0x...&chainId=1` | Lấy thông tin ví và số dư        |
| `POST` | `/wallet/deposit-trade`                 | Nạp tiền vào tài khoản giao dịch |
| `POST` | `/wallet/withdraw-trade`                | Rút tiền từ tài khoản giao dịch  |

---

### 🔧 Pairs — `/pairs`

| Method | Endpoint        | Mô tả                      |
| ------ | --------------- | -------------------------- |
| `GET`  | `/pairs`        | Lấy tất cả cặp giao dịch   |
| `GET`  | `/pairs/active` | Lấy các cặp đang hoạt động |

---

## 📖 Cách Sử Dụng API

### Luồng cơ bản: Mở lệnh Market (Long BTC)

#### Bước 1: Lấy Nonce

```bash
GET /nonce/get-nonce?walletAddress=0xABC123...
```

Response:

```json
{
  "nonce": "0xa1b2c3d4e5f6..."
}
```

#### Bước 2: Ký bản tin EIP-712 trên Frontend

Frontend sẽ dùng nonce vừa nhận để tạo bản tin EIP-712, sau đó yêu cầu người dùng ký bằng ví MetaMask.

#### Bước 3: Gửi lệnh mở vị thế

```bash
POST /orders/market
Content-Type: application/json

{
  "walletAddress": "0xABC123...",
  "symbol": "BTC-USDT",
  "side": "long",
  "qty": 0.01,
  "leverage": 10,
  "stopLoss": 60000,
  "takeProfit": 72000,
  "typedData": { ... },
  "signature": "0x..."
}
```

Response (thành công):

```json
{
  "_id": "6654abc...",
  "walletAddress": "0xABC123...",
  "symbol": "BTC-USDT",
  "side": "long",
  "qty": 0.01,
  "entryPrice": 67500.25,
  "leverage": 10,
  "status": "open",
  "openFee": 0.675,
  "createdAt": "2026-02-24T00:00:00.000Z"
}
```

Response (lỗi margin không đủ):

```json
{
  "statusCode": 400,
  "message": "Không đủ số dư. Cần 68.175 USDT (Margin: 67.5 + Phí: 0.675). Khả dụng: 50.00 USDT"
}
```

#### Bước 4: Theo dõi vị thế

```bash
GET /positions?walletAddress=0xABC123...
```

#### Bước 5: Đóng vị thế

```bash
POST /positions/6654abc.../close
Content-Type: application/json

{
  "pnl": 125.50,
  "typedData": { ... },
  "signature": "0x..."
}
```

---

### Nạp tiền vào Trade Balance

```bash
POST /wallet/deposit-trade
Content-Type: application/json

{
  "walletAddress": "0xABC123...",
  "chainId": 1,
  "amount": 1000
}
```

---

### Lấy dữ liệu nến biểu đồ

```bash
# Lấy 200 nến 1 phút của BTC-USDT
GET /market/candles?instId=BTC-USDT&bar=1m&limit=200

# Lấy nến trước một thời điểm (phân trang)
GET /market/candles?instId=BTC-USDT&bar=1h&limit=100&before=1708819200000
```

---

## 🛡️ Rate Limiting

Hệ thống sử dụng **2 lớp giới hạn** chạy đồng thời:

| Lớp        | Đối tượng       | Mục đích                    |
| ---------- | --------------- | --------------------------- |
| **IP**     | Địa chỉ IP mạng | Chặn DDoS, bot cào dữ liệu  |
| **Wallet** | walletAddress   | Chặn spam giao dịch từ 1 ví |

### Giới hạn cho các API quan trọng:

| API            | IP Limit     | Wallet Limit |
| -------------- | ------------ | ------------ |
| Mở lệnh Market | 10 / 10s     | **3 / 10s**  |
| Đóng vị thế    | 10 / 10s     | **3 / 10s**  |
| Mở lệnh Limit  | 15 / 10s     | **5 / 10s**  |
| Lấy Nonce      | **60 / 60s** | 60 / 60s     |
| Nạp/Rút tiền   | 15 / 60s     | **5 / 60s**  |

Khi vượt giới hạn, API trả về:

```json
HTTP 429 Too Many Requests
{
  "statusCode": 429,
  "message": "Bạn đang gửi quá nhiều yêu cầu, vui lòng thử lại sau"
}
```

> Chi tiết đầy đủ: [`docs/RATE_LIMITING.md`](docs/RATE_LIMITING.md)

---

## 🧪 Testing

```bash
# Chạy Unit Tests
npm test

# Chạy E2E Tests
npm run test:e2e
```

Hiện tại: **20 test suites, 158 tests** — tất cả PASS ✅

---

## 📚 Tài Liệu Kỹ Thuật

| Tài liệu                                                                             | Nội dung                                               |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| [`docs/REDIS_DATA_STRUCTURES.md`](docs/REDIS_DATA_STRUCTURES.md)                     | Tất cả Redis keys, data types, và mục đích sử dụng     |
| [`docs/REDIS_IMPLEMENTATION.md`](docs/REDIS_IMPLEMENTATION.md)                       | Kế hoạch triển khai Redis theo từng giai đoạn          |
| [`docs/RATE_LIMITING.md`](docs/RATE_LIMITING.md)                                     | Phân tích rủi ro spam API & giới hạn cho từng endpoint |
| [`docs/IMPL_MARGIN_VALIDATION.md`](docs/IMPL_MARGIN_VALIDATION.md)                   | Chi tiết triển khai kiểm tra Margin trước khi mở lệnh  |
| [`docs/CANDLE_HISTORY_CACHE.md`](docs/CANDLE_HISTORY_CACHE.md)                       | Chiến lược cache dữ liệu nến biểu đồ bằng Redis ZSET   |
| [`docs/TRADING_LOGIC_FORMULAS.md`](docs/TRADING_LOGIC_FORMULAS.md)                   | Công thức tính PnL, Margin, Liquidation Price          |
| [`docs/CROSS_MARGIN_REDIS_ARCHITECTURE.md`](docs/CROSS_MARGIN_REDIS_ARCHITECTURE.md) | Kiến trúc Cross Margin với Redis                       |
| [`docs/MARKET_CACHE_FLOW.md`](docs/MARKET_CACHE_FLOW.md)                             | Luồng cache dữ liệu thị trường                         |

---

## 🔑 Xác Thực EIP-712

Exodia **không dùng JWT hay session**. Thay vào đó, mỗi giao dịch được bảo vệ bằng chữ ký số EIP-712:

1. User gọi `/nonce/get-nonce` → nhận mã nonce duy nhất (hết hạn sau 2 phút)
2. Frontend tạo bản tin EIP-712 chứa nonce + thông tin giao dịch
3. User ký bằng ví (MetaMask, WalletConnect, ...)
4. Backend xác thực chữ ký bằng thư viện `viem` → đảm bảo đúng người, đúng nội dung
5. Nonce bị xóa ngay sau khi sử dụng → không thể replay

Mô hình này đảm bảo:

- ✅ Không lưu mật khẩu hay private key trên server
- ✅ Không thể giả mạo giao dịch (phải có private key mới ký được)
- ✅ Không thể replay (nonce dùng 1 lần)

---

## 📄 License

UNLICENSED — Private project.
