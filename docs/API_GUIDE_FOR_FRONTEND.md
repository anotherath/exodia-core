# 📖 Exodia Core — API Reference Guide for Frontend (exodia-ui)

> **Mục đích:** Tài liệu này dành cho AI code assistant triển khai frontend `exodia-ui` kết nối với backend `exodia-core`. Bao gồm toàn bộ endpoint, data types, luồng xác thực EIP-712, WebSocket realtime, và code examples.

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Base URL & CORS](#2-base-url--cors)
3. [Xác thực bằng EIP-712](#3-xác-thực-bằng-eip-712)
4. [Data Types & Interfaces](#4-data-types--interfaces)
5. [API Endpoints](#5-api-endpoints)
   - [5.1 Nonce](#51-nonce)
   - [5.2 User](#52-user)
   - [5.3 Wallet](#53-wallet)
   - [5.4 Pairs](#54-pairs)
   - [5.5 Market](#55-market)
   - [5.6 Orders (Position)](#56-orders-position)
   - [5.7 Positions](#57-positions)
6. [WebSocket Realtime](#6-websocket-realtime)
7. [Rate Limiting](#7-rate-limiting)
8. [Luồng nghiệp vụ Frontend](#8-luồng-nghiệp-vụ-frontend)
9. [Công thức tính toán phía Frontend](#9-công-thức-tính-toán-phía-frontend)
10. [Error Handling](#10-error-handling)

---

## 1. Tổng quan kiến trúc

```
┌────────────────┐     REST API (HTTP)      ┌──────────────────┐
│   exodia-ui    │ ◄──────────────────────► │   exodia-core    │
│   (Frontend)   │     WebSocket (WS)       │   (NestJS API)   │
│                │ ◄──────────────────────► │                  │
└────────────────┘                          └──────────────────┘
                                                    │
                                            ┌───────┴───────┐
                                            │               │
                                        MongoDB          Redis
                                       (Persist)       (Cache/RT)
```

- **exodia-core** là NestJS backend, cung cấp REST API + WebSocket
- **Authentication**: Sử dụng EIP-712 typed data signature (không dùng JWT)
- **Realtime**: WebSocket qua Socket.IO (namespace `/realtime`)
- **Port mặc định**: `3000`
- **Swagger UI**: `http://localhost:3000/api`

---

## 2. Base URL & CORS

```typescript
const BASE_URL = 'http://localhost:3000'; // Development
const WS_URL = 'http://localhost:3000'; // WebSocket
```

CORS được bật cho tất cả origin (`*`).

---

## 3. Xác thực bằng EIP-712

### 3.1 EIP-712 Domain (QUAN TRỌNG — phải khớp chính xác)

```typescript
const EIP712_DOMAIN = {
  name: 'Exodia',
  version: '1',
  chainId: 1,
} as const;
```

### 3.2 Luồng xác thực chung

Mọi thao tác ghi (mở/sửa/đóng lệnh, kích hoạt user) đều phải qua luồng:

```
┌──────────┐        GET /nonce/get-nonce           ┌──────────┐
│ Frontend │ ─────────────────────────────────────► │ Backend  │
│          │ ◄───────────────── { nonce } ───────── │          │
│          │                                        │          │
│  Ký EIP-712 message bằng wallet (MetaMask...)    │          │
│  → Tạo signature                                  │          │
│          │                                        │          │
│          │     POST /endpoint (data + signature)  │          │
│          │ ─────────────────────────────────────► │          │
│          │ ◄───── { result / error } ───────────── │          │
└──────────┘                                        └──────────┘
```

**Lưu ý:**

- Nonce chỉ dùng được **1 lần** (one-time use) → Mỗi thao tác ghi cần request nonce mới
- Nonce có **thời hạn** (expire), nếu hết hạn phải request lại
- Các giá trị số trong `typedData` phải truyền dưới dạng **BigInt string** (e.g., `"100000000"`)

### 3.3 Cách ký EIP-712 trên Frontend (viem/wagmi)

```typescript
import { signTypedData } from '@wagmi/core';

// Ví dụ: Ký lệnh mở Market
const signature = await signTypedData({
  domain: {
    name: 'Exodia',
    version: '1',
    chainId: 1,
  },
  types: {
    OpenOrder: [
      { name: 'walletAddress', type: 'address' },
      { name: 'symbol', type: 'string' },
      { name: 'side', type: 'string' },
      { name: 'type', type: 'string' },
      { name: 'qty', type: 'uint256' },
      { name: 'entryPrice', type: 'uint256' },
      { name: 'leverage', type: 'uint256' },
      { name: 'sl', type: 'uint256' },
      { name: 'tp', type: 'uint256' },
      { name: 'nonce', type: 'string' },
    ],
  },
  primaryType: 'OpenOrder',
  message: {
    walletAddress: '0x...',
    symbol: 'BTC-USDT',
    side: 'long',
    type: 'market',
    qty: BigInt('100000000'), // Scaled value
    entryPrice: BigInt('50000000000'),
    leverage: BigInt('10'),
    sl: BigInt('45000000000'),
    tp: BigInt('60000000000'),
    nonce: 'abc123...', // Lấy từ API
  },
});
```

### 3.4 Tất cả EIP-712 Type Definitions

```typescript
// ===== OPEN ORDER =====
const OpenOrderTypes = {
  OpenOrder: [
    { name: 'walletAddress', type: 'address' },
    { name: 'symbol', type: 'string' },
    { name: 'side', type: 'string' },
    { name: 'type', type: 'string' },
    { name: 'qty', type: 'uint256' },
    { name: 'entryPrice', type: 'uint256' },
    { name: 'leverage', type: 'uint256' },
    { name: 'sl', type: 'uint256' },
    { name: 'tp', type: 'uint256' },
    { name: 'nonce', type: 'string' },
  ],
};

// ===== UPDATE ORDER (sửa lệnh Limit đang chờ) =====
const UpdateOrderTypes = {
  UpdateOrder: [
    { name: 'walletAddress', type: 'address' },
    { name: 'orderId', type: 'string' },
    { name: 'qty', type: 'uint256' },
    { name: 'entryPrice', type: 'uint256' },
    { name: 'leverage', type: 'uint256' },
    { name: 'sl', type: 'uint256' },
    { name: 'tp', type: 'uint256' },
    { name: 'nonce', type: 'string' },
  ],
};

// ===== CANCEL ORDER =====
const CancelOrderTypes = {
  CancelOrder: [
    { name: 'walletAddress', type: 'address' },
    { name: 'orderId', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
};

// ===== CLOSE POSITION =====
const ClosePositionTypes = {
  ClosePosition: [
    { name: 'walletAddress', type: 'address' },
    { name: 'positionId', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
};

// ===== UPDATE POSITION (điều chỉnh SL/TP, đóng 1 phần) =====
const UpdatePositionTypes = {
  UpdatePosition: [
    { name: 'walletAddress', type: 'address' },
    { name: 'positionId', type: 'string' },
    { name: 'leverage', type: 'uint256' },
    { name: 'qty', type: 'uint256' },
    { name: 'sl', type: 'uint256' },
    { name: 'tp', type: 'uint256' },
    { name: 'nonce', type: 'string' },
  ],
};

// ===== ACTIVATE USER (đăng ký / đăng nhập) =====
const ActivateUserTypes = {
  ActivateUser: [
    { name: 'walletAddress', type: 'address' },
    { name: 'nonce', type: 'string' },
    { name: 'timestamp', type: 'string' },
  ],
};
```

---

## 4. Data Types & Interfaces

### 4.1 Core Types (dùng trong Frontend)

```typescript
// --- Cơ bản ---
type HexString = `0x${string}`;

// --- User ---
interface User {
  walletAddress: string;
  isActive: boolean;
  role: 'user' | 'admin';
  chainId?: number;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// --- Wallet ---
interface Wallet {
  walletAddress: string;
  chainId: number;
  balance: number; // USDT khả dụng (số dư ví chính)
  tradeBalance: number; // USDT trong tài khoản giao dịch
  totalDeposited: number;
  totalWithdrawn: number;
  updatedAt?: Date;
  createdAt?: Date;
}

// --- Pair (Cặp giao dịch) ---
interface Pair {
  instId: string; // VD: "BTC-USDT", "ETH-USDT"
  maxLeverage: number; // Đòn bẩy tối đa (VD: 100)
  minVolume: number; // Khối lượng tối thiểu (VD: 0.001)
  minAmount: number; // Giá trị lệnh tối thiểu (USD) (VD: 10)
  openFeeRate: number; // Phí mở lệnh (VD: 0.0001 = 0.01%)
  closeFeeRate: number; // Phí đóng lệnh (VD: 0.0001 = 0.01%)
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// --- Position ---
type PositionStatus = 'pending' | 'open' | 'closed';
type PositionSide = 'long' | 'short';
type PositionType = 'market' | 'limit';

interface Position {
  _id?: string;
  walletAddress: string;
  symbol: string; // VD: "BTC-USDT"
  side: PositionSide; // 'long' | 'short'
  type: PositionType; // 'market' | 'limit'
  status: PositionStatus; // 'pending' | 'open' | 'closed'
  qty: number; // Khối lượng
  entryPrice?: number | null; // Giá vào lệnh
  leverage: number;
  pnl: number; // PnL hiện tại hoặc cuối cùng
  exitPrice?: number | null; // Giá đóng lệnh
  tp?: number | null; // Take Profit
  sl?: number | null; // Stop Loss
  openFee?: number; // Phí mở lệnh (USDT)
  closeFee?: number; // Phí đóng lệnh (USDT)
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// --- Ticker (Giá realtime) ---
interface TickerData {
  instType: string;
  instId: string; // VD: "BTC-USDT"
  last: string; // Giá cuối cùng
  lastSz: string;
  askPx: string; // Giá Ask (bán)
  askSz: string;
  bidPx: string; // Giá Bid (mua)
  bidSz: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volCcy24h: string;
  vol24h: string;
  ts: string; // Timestamp
  sodUtc0: string;
  sodUtc8: string;
}
```

---

## 5. API Endpoints

### 5.1 Nonce

#### `GET /nonce/get-nonce`

Lấy Nonce để ký bản tin EIP-712. **Phải gọi trước mỗi thao tác ghi.**

| Param         | Type   | Required | Mô tả              |
| ------------- | ------ | -------- | ------------------ |
| walletAddress | string | ✅       | Địa chỉ ví (0x...) |

**Request:**

```http
GET /nonce/get-nonce?walletAddress=0x1234567890abcdef1234567890abcdef12345678
```

**Response (200):**

```json
{
  "nonce": "a1b2c3d4e5f6..."
}
```

**Lưu ý:**

- Nếu nonce cũ còn hợp lệ, sẽ trả lại nonce cũ
- Nếu không có hoặc đã hết hạn, sẽ tạo mới
- `walletAddress` phải là hex string hợp lệ (bắt đầu bằng `0x`)

---

### 5.2 User

#### `GET /user/get-active-status`

Kiểm tra trạng thái kích hoạt (đã đăng ký chưa) của người dùng.

| Param         | Type   | Required | Mô tả              |
| ------------- | ------ | -------- | ------------------ |
| walletAddress | string | ✅       | Địa chỉ ví (0x...) |

**Request:**

```http
GET /user/get-active-status?walletAddress=0x123...
```

**Response (200):**

```json
{
  "walletAddress": "0x123...",
  "isActive": true
}
```

---

#### `POST /user/post-active-user`

Kích hoạt người dùng (đăng ký) bằng chữ ký EIP-712.

**Request Body:**

```json
{
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "nonce": "a1b2c3d4e5f6...",
  "timestamp": "2024-03-20T10:00:00Z",
  "signature": "0x..."
}
```

| Field         | Type   | Required | Mô tả                                     |
| ------------- | ------ | -------- | ----------------------------------------- |
| walletAddress | string | ✅       | Địa chỉ ví                                |
| nonce         | string | ✅       | Nonce lấy từ `/nonce/get-nonce`           |
| timestamp     | string | ✅       | Thời điểm ký (ISO string)                 |
| signature     | string | ✅       | Chữ ký EIP-712 (dùng `ActivateUser` type) |

**EIP-712 message cần ký:**

```typescript
{
  types: ActivateUserTypes,
  primaryType: 'ActivateUser',
  message: { walletAddress, nonce, timestamp }
}
```

**Response (201):**

```json
{
  "walletAddress": "0x123...",
  "isActive": true
}
```

---

### 5.3 Wallet

#### `GET /wallet`

Lấy thông tin ví và số dư. Nếu ví chưa tồn tại sẽ tự tạo mới (upsert).

| Param         | Type   | Required | Mô tả                |
| ------------- | ------ | -------- | -------------------- |
| walletAddress | string | ✅       | Địa chỉ ví (0x...)   |
| chainId       | number | ✅       | ID của chain (VD: 1) |

**Request:**

```http
GET /wallet?walletAddress=0x123...&chainId=1
```

**Response (200):**

```json
{
  "walletAddress": "0x123...",
  "chainId": 1,
  "wallet": {
    "walletAddress": "0x123...",
    "chainId": 1,
    "balance": 1000,
    "tradeBalance": 500,
    "totalDeposited": 1500,
    "totalWithdrawn": 0
  }
}
```

---

#### `POST /wallet/deposit-trade`

Nạp tiền từ `balance` vào `tradeBalance` (tài khoản giao dịch).

**Request Body:**

```json
{
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "chainId": 1,
  "amount": 100
}
```

| Field         | Type   | Required | Mô tả                  |
| ------------- | ------ | -------- | ---------------------- |
| walletAddress | string | ✅       | Địa chỉ ví             |
| chainId       | number | ✅       | ID chain               |
| amount        | number | ✅       | Số tiền cần nạp (USDT) |

**Response (201):**

```json
{ "success": true }
```

**Lỗi có thể xảy ra:**

- `400 Bad Request` — `Insufficient balance` (balance không đủ)

---

#### `POST /wallet/withdraw-trade`

Rút tiền từ `tradeBalance` về `balance`.

**Request Body:** (Giống deposit-trade)

```json
{
  "walletAddress": "0x123...",
  "chainId": 1,
  "amount": 50
}
```

**Response (201):**

```json
{ "success": true }
```

**Lỗi có thể xảy ra:**

- `400 Bad Request` — `Insufficient trade balance`

---

### 5.4 Pairs

#### `GET /pairs`

Lấy danh sách **tất cả** cặp giao dịch (bao gồm cả inactive).

**Response (200):**

```json
[
  {
    "instId": "BTC-USDT",
    "maxLeverage": 100,
    "minVolume": 0.001,
    "minAmount": 10,
    "openFeeRate": 0.0001,
    "closeFeeRate": 0.0001,
    "isActive": true
  },
  {
    "instId": "ETH-USDT",
    "maxLeverage": 50,
    "minVolume": 0.01,
    "minAmount": 10,
    "openFeeRate": 0.0001,
    "closeFeeRate": 0.0001,
    "isActive": true
  }
]
```

---

#### `GET /pairs/active`

Lấy danh sách các cặp **đang hoạt động** (`isActive = true`). Frontend nên dùng endpoint này để hiển thị danh sách cặp giao dịch cho user.

**Response (200):** (Giống `/pairs` nhưng chỉ có cặp active)

---

### 5.5 Market

#### `GET /market/candles`

Lấy dữ liệu nến (K-line / candlestick) cho biểu đồ.

| Param  | Type   | Required | Mô tả                                      | Default |
| ------ | ------ | -------- | ------------------------------------------ | ------- |
| instId | string | ✅       | ID cặp giao dịch (VD: `BTC-USDT`)          | —       |
| bar    | string | ❌       | Khung thời gian nến                        | `1m`    |
| limit  | number | ❌       | Số lượng nến tối đa                        | `100`   |
| before | string | ❌       | Timestamp (ms) lấy nến trước thời điểm này | —       |

**Khung nến hỗ trợ:** `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1D`, `1W`, `1M`

**Request:**

```http
GET /market/candles?instId=BTC-USDT&bar=1h&limit=200
```

**Response (200):**

Trả về mảng các nến, mỗi nến là một tuple (theo format OKX):

```json
[
  [
    "1709251200000", // [0] Timestamp (ms) - Thời điểm mở nến
    "51234.56", // [1] Open price
    "51500.00", // [2] High price
    "51000.00", // [3] Low price
    "51350.00", // [4] Close price
    "100.5", // [5] Volume (coin)
    "5150000", // [6] Volume (currency, USDT)
    "1" // [7] Confirm (1 = nến đã đóng)
  ]
]
```

**Phân trang (Infinite scroll cho biểu đồ):**

```typescript
// Lấy nến cũ hơn (scroll left trên chart)
const oldestCandleTimestamp = candles[candles.length - 1][0];
const olderCandles = await fetch(
  `/market/candles?instId=BTC-USDT&bar=1h&limit=200&before=${oldestCandleTimestamp}`,
);
```

---

### 5.6 Orders (Position)

> **Lưu ý quan trọng:** Orders và Positions dùng chung model `Position` nhưng khác `status`:
>
> - **Order (Pending)**: `status = 'pending'` — Lệnh Limit đang chờ khớp
> - **Position (Open)**: `status = 'open'` — Vị thế đang mở (đã khớp)
> - **Closed**: `status = 'closed'` — Đã đóng

#### `POST /orders/market` — Mở lệnh Market (khớp ngay)

**Request Body:**

```json
{
  "walletAddress": "0x123...",
  "symbol": "BTC-USDT",
  "side": "long",
  "qty": 0.1,
  "leverage": 10,
  "sl": 45000,
  "tp": 60000,
  "typedData": {
    "walletAddress": "0x123...",
    "symbol": "BTC-USDT",
    "side": "long",
    "type": "market",
    "qty": "100000000",
    "entryPrice": "50000000000",
    "leverage": "10",
    "sl": "45000000000",
    "tp": "60000000000",
    "nonce": "abc123..."
  },
  "signature": "0xsignature..."
}
```

| Field         | Type   | Required | Mô tả                                  |
| ------------- | ------ | -------- | -------------------------------------- |
| walletAddress | string | ✅       | Địa chỉ ví                             |
| symbol        | string | ✅       | Cặp giao dịch (VD: `BTC-USDT`)         |
| side          | string | ✅       | `long` hoặc `short`                    |
| qty           | number | ✅       | Khối lượng (số thực, VD: `0.1`)        |
| leverage      | number | ✅       | Đòn bẩy (VD: `10`)                     |
| sl            | number | ❌       | Stop Loss price                        |
| tp            | number | ❌       | Take Profit price                      |
| typedData     | object | ✅       | Dữ liệu EIP-712 đã ký (BigInt strings) |
| signature     | string | ✅       | Chữ ký EIP-712 hex                     |

**Khác biệt giữa `body data` và `typedData`:**

- `body data`: Giá trị thực tế (number) dùng để xử lý business logic
- `typedData`: Giá trị BigInt string dùng để verify chữ ký EIP-712

**Response (201):** Trả về Position object mới tạo với `status: "open"`

```json
{
  "_id": "665a1b2c3d4e5f...",
  "walletAddress": "0x123...",
  "symbol": "BTC-USDT",
  "side": "long",
  "type": "market",
  "status": "open",
  "qty": 0.1,
  "entryPrice": 50250.5,
  "leverage": 10,
  "pnl": 0,
  "sl": 45000,
  "tp": 60000,
  "openFee": 0.5,
  "createdAt": "2024-03-20T10:00:00Z"
}
```

---

#### `POST /orders/limit` — Mở lệnh Limit (chờ khớp)

**Request Body:** (Tương tự Market, thêm `entryPrice`)

```json
{
  "walletAddress": "0x123...",
  "symbol": "BTC-USDT",
  "side": "long",
  "qty": 0.1,
  "entryPrice": 48000,
  "leverage": 10,
  "sl": 45000,
  "tp": 60000,
  "typedData": {
    "walletAddress": "0x123...",
    "symbol": "BTC-USDT",
    "side": "long",
    "type": "limit",
    "qty": "100000000",
    "entryPrice": "48000000000",
    "leverage": "10",
    "sl": "45000000000",
    "tp": "60000000000",
    "nonce": "abc123..."
  },
  "signature": "0xsignature..."
}
```

| Field      | Type   | Required | Mô tả                      |
| ---------- | ------ | -------- | -------------------------- |
| entryPrice | number | ✅       | Giá đặt lệnh (Limit Price) |

**Quy tắc giá Limit:**

- **Long Limit**: `entryPrice` phải **thấp hơn** giá Ask hiện tại
- **Short Limit**: `entryPrice` phải **cao hơn** giá Bid hiện tại

**Response (201):** Position object với `status: "pending"`

---

#### `PUT /orders/:id` — Sửa lệnh Limit đang chờ

**URL Param:** `id` = Position ID (chỉ sửa được lệnh có `status: "pending"`)

**Request Body:**

```json
{
  "qty": 0.2,
  "entryPrice": 49000,
  "leverage": 20,
  "sl": 46000,
  "tp": 61000,
  "typedData": {
    "walletAddress": "0x123...",
    "orderId": "665a1b2c3d4e5f...",
    "qty": "200000000",
    "entryPrice": "49000000000",
    "leverage": "20",
    "sl": "46000000000",
    "tp": "61000000000",
    "nonce": "nonce124"
  },
  "signature": "0xsignature..."
}
```

**Response (200):** Updated Position object

---

#### `DELETE /orders/:id` — Hủy lệnh Limit đang chờ

**URL Param:** `id` = Position ID

**Request Body:**

```json
{
  "typedData": {
    "walletAddress": "0x123...",
    "orderId": "665a1b2c3d4e5f...",
    "nonce": "nonce125"
  },
  "signature": "0xsignature..."
}
```

**Response (200):** Position object với `status: "closed"`

---

#### `GET /orders/open` — Lấy lệnh đang chờ (Pending Orders)

| Param         | Type   | Required | Mô tả   |
| ------------- | ------ | -------- | ------- |
| walletAddress | string | ✅       | Ví user |

**Response (200):**

```json
[
  {
    "_id": "665a...",
    "symbol": "BTC-USDT",
    "side": "long",
    "type": "limit",
    "status": "pending",
    "qty": 0.1,
    "entryPrice": 48000,
    "leverage": 10,
    ...
  }
]
```

---

#### `GET /orders/history` — Lịch sử lệnh đã đóng/hủy

| Param         | Type   | Required | Mô tả   |
| ------------- | ------ | -------- | ------- |
| walletAddress | string | ✅       | Ví user |

**Response (200):** Mảng Position objects với `status: "closed"`

---

### 5.7 Positions

#### `GET /positions` — Lấy vị thế đang mở (Active Positions)

| Param         | Type   | Required | Mô tả   |
| ------------- | ------ | -------- | ------- |
| walletAddress | string | ✅       | Ví user |

**Response (200):**

```json
[
  {
    "_id": "665a...",
    "symbol": "BTC-USDT",
    "side": "long",
    "type": "market",
    "status": "open",
    "qty": 0.1,
    "entryPrice": 50000,
    "leverage": 10,
    "pnl": 0,
    "sl": 45000,
    "tp": 60000,
    "openFee": 0.5
  }
]
```

---

#### `GET /positions/:id` — Chi tiết một vị thế

**URL Param:** `id` = Position ID

**Response (200):** Single Position object

---

#### `PUT /positions/:id` — Cập nhật vị thế (SL/TP, đóng 1 phần)

**URL Param:** `id` = Position ID (chỉ `status: "open"`)

**Request Body:**

```json
{
  "leverage": 10,
  "qty": 0.05,
  "sl": 46000,
  "tp": 62000,
  "typedData": {
    "walletAddress": "0x123...",
    "positionId": "665a...",
    "leverage": "10",
    "qty": "50000000",
    "sl": "46000000000",
    "tp": "62000000000",
    "nonce": "nonce127"
  },
  "signature": "0xsignature..."
}
```

**Các kịch bản:**

| Kịch bản         | Điều kiện                      | Hành vi                                         |
| ---------------- | ------------------------------ | ----------------------------------------------- |
| Chỉ sửa SL/TP    | `qty` = qty hiện tại           | Validate rồi cập nhật SL/TP                     |
| Đóng 1 phần      | `qty` < qty hiện tại           | Tính PnL phần đóng, tạo record closed, giảm qty |
| Tăng qty (❌)    | `qty` > qty hiện tại           | `400 Bad Request` — Không cho phép              |
| Đổi đòn bẩy (❌) | `leverage` ≠ leverage hiện tại | `400 Bad Request` — Không cho phép khi đang mở  |

**Quy tắc SL/TP:**

| Side  | SL               | TP               |
| ----- | ---------------- | ---------------- |
| Long  | SL < Entry Price | TP > Entry Price |
| Short | SL > Entry Price | TP < Entry Price |

**Response (200):** Updated Position object

---

#### `POST /positions/:id/close` — Đóng vị thế toàn phần

**URL Param:** `id` = Position ID

**Request Body:**

```json
{
  "pnl": 100,
  "typedData": {
    "walletAddress": "0x123...",
    "positionId": "665a...",
    "nonce": "nonce126"
  },
  "signature": "0xsignature..."
}
```

| Field     | Type   | Required | Mô tả                              |
| --------- | ------ | -------- | ---------------------------------- |
| pnl       | number | ✅       | PnL ước tính (backend sẽ tính lại) |
| typedData | object | ✅       | Dữ liệu EIP-712                    |
| signature | string | ✅       | Chữ ký                             |

> **Lưu ý:** `pnl` trong body chỉ mang tính tham khảo. Backend sẽ tính lại PnL thực tế dựa trên giá thị trường tại thời điểm đóng.

**Response (200):** Position object với `status: "closed"`, `exitPrice`, `pnl`, `closeFee`

---

#### `GET /positions/history` — Lịch sử vị thế đã đóng

| Param         | Type   | Required | Mô tả   |
| ------------- | ------ | -------- | ------- |
| walletAddress | string | ✅       | Ví user |

**Response (200):** Mảng Position objects với `status: "closed"`

---

## 6. WebSocket Realtime

### 6.1 Kết nối

Dùng **Socket.IO** (không phải WebSocket thuần), namespace `/realtime`.

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/realtime', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected to realtime');
});
```

### 6.2 Events

| Event    | Direction       | Data Type    | Mô tả                                         |
| -------- | --------------- | ------------ | --------------------------------------------- |
| `ticker` | Server → Client | `TickerData` | Giá thị trường realtime cho tất cả cặp active |

```typescript
socket.on('ticker', (ticker: TickerData) => {
  console.log(`${ticker.instId}: ${ticker.last}`);
  // VD: "BTC-USDT: 51234.56"
});
```

### 6.3 Dữ liệu Ticker

```typescript
// Dữ liệu nhận được từ event 'ticker'
interface TickerData {
  instId: string; // "BTC-USDT"
  last: string; // Giá cuối: "51234.56"
  askPx: string; // Giá Ask: "51235.00"
  bidPx: string; // Giá Bid: "51234.00"
  open24h: string; // Giá mở 24h
  high24h: string; // Giá cao nhất 24h
  low24h: string; // Giá thấp nhất 24h
  vol24h: string; // Volume 24h (coin)
  volCcy24h: string; // Volume 24h (USDT)
  ts: string; // Timestamp
  // ... các trường khác
}
```

**Gợi ý Frontend:**

- Subscribe vào event `ticker` ngay khi kết nối
- Lọc theo `instId` để hiển thị giá cho từng cặp
- Dùng `last` cho giá hiển thị chính, `askPx`/`bidPx` cho form order
- Tính % thay đổi 24h: `((last - open24h) / open24h) * 100`

---

## 7. Rate Limiting

Hệ thống rate limit 2 lớp: theo **IP** và theo **Wallet Address**.

### 7.1 Bảng Rate Limit theo Endpoint

| Module      | Endpoint                                        | IP Limit   | Wallet Limit |
| ----------- | ----------------------------------------------- | ---------- | ------------ |
| **Nonce**   | `GET /nonce/get-nonce`                          | 60 req/60s | 60 req/60s   |
| **User**    | `GET /user/get-active-status`                   | 20 req/60s | 20 req/60s   |
| **User**    | `POST /user/post-active-user`                   | 10 req/60s | 3 req/60s    |
| **Wallet**  | `GET /wallet`                                   | 40 req/60s | 20 req/60s   |
| **Wallet**  | `POST /wallet/deposit-trade`                    | 15 req/60s | 5 req/60s    |
| **Wallet**  | `POST /wallet/withdraw-trade`                   | 15 req/60s | 5 req/60s    |
| **Pairs**   | `GET /pairs`, `/pairs/active`                   | 60 req/60s | 60 req/60s   |
| **Market**  | `GET /market/candles`                           | 30 req/60s | 30 req/60s   |
| **Trading** | `POST /orders/market`                           | 10 req/10s | 3 req/10s    |
| **Trading** | `POST /orders/limit`                            | 15 req/10s | 5 req/10s    |
| **Trading** | `PUT /orders/:id`                               | 15 req/10s | 5 req/10s    |
| **Trading** | `DELETE /orders/:id`                            | 15 req/10s | 5 req/10s    |
| **Trading** | `POST /positions/:id/close`                     | 10 req/10s | 3 req/10s    |
| **Trading** | `GET /positions`, `GET /orders/open`            | 60 req/60s | 30 req/60s   |
| **Trading** | `GET /positions/history`, `GET /orders/history` | 40 req/60s | 20 req/60s   |

### 7.2 Response khi bị Rate Limit

```
HTTP 429 Too Many Requests
```

**Gợi ý Frontend:**

- Đặt debounce/throttle cho các action buttons (đặc biệt nút mở/đóng lệnh)
- Cache response của `/pairs/active` (ít thay đổi)
- Hiển thị thông báo "Vui lòng thử lại sau" khi nhận 429

---

## 8. Luồng nghiệp vụ Frontend

### 8.1 Luồng Onboarding (Đăng ký / Đăng nhập)

```
1. User kết nối ví (MetaMask/WalletConnect)
2. GET /user/get-active-status?walletAddress=0x...
   └─ Nếu isActive = true → Đã đăng ký → Vào app
   └─ Nếu isActive = false → Chưa đăng ký → Bước 3
3. GET /nonce/get-nonce?walletAddress=0x...
4. Ký EIP-712 message (ActivateUser) bằng wallet
5. POST /user/post-active-user { walletAddress, nonce, timestamp, signature }
6. GET /wallet?walletAddress=0x...&chainId=1 (lấy số dư)
```

### 8.2 Luồng Mở Lệnh Market

```
1. User chọn cặp, side, qty, leverage, SL/TP
2. GET /nonce/get-nonce?walletAddress=0x...
3. Frontend tạo typedData (BigInt strings) rồi ký EIP-712
4. POST /orders/market {
     walletAddress, symbol, side, qty, leverage, sl, tp,
     typedData: { ...signed data },
     signature: "0x..."
   }
5. Backend verify signature → Validate params → Kiểm tra margin → Mở lệnh
6. Frontend nhận Position object → Cập nhật UI
```

### 8.3 Luồng Mở Lệnh Limit

```
Giống Market, nhưng:
- Thêm trường entryPrice
- type = "limit" trong typedData
- Response có status = "pending"
- Backend khóa Reserved Margin cho lệnh này
```

### 8.4 Luồng Đóng Lệnh

```
1. User nhấn đóng vào 1 vị thế đang mở
2. GET /nonce/get-nonce?walletAddress=0x...
3. Ký EIP-712 message (ClosePosition) với positionId
4. POST /positions/:id/close { pnl, typedData, signature }
5. Backend tính PnL thực tế dựa trên giá thị trường → Đóng lệnh
6. Frontend cập nhật danh sách positions
```

### 8.5 Luồng Deposit / Withdraw Trade Balance

```
1. GET /wallet?walletAddress=0x...&chainId=1 (xem số dư hiện tại)
2. User nhập số tiền
3. POST /wallet/deposit-trade { walletAddress, chainId, amount }
   hoặc POST /wallet/withdraw-trade { walletAddress, chainId, amount }
4. Cập nhật UI
```

---

## 9. Công thức tính toán phía Frontend

Frontend nên tính các giá trị này **trước** khi hiển thị cho user:

```typescript
// ── Giá trị vị thế (USD) ──
const notionalValue = qty * price;
// VD: 0.1 BTC * 50,000 USD = 5,000 USD

// ── Tiền ký quỹ (Initial Margin) ──
const initialMargin = notionalValue / leverage;
// VD: 5,000 / 10 = 500 USDT

// ── Phí mở lệnh ──
const openFee = notionalValue * openFeeRate;
// VD: 5,000 * 0.0001 = 0.5 USDT

// ── Tổng chi phí ──
const orderCost = initialMargin + openFee;
// VD: 500 + 0.5 = 500.5 USDT

// ── PnL (Profit/Loss) ──
// Long: PnL = (exitPrice - entryPrice) * qty
// Short: PnL = (entryPrice - exitPrice) * qty
const calculatePnL = (
  side: 'long' | 'short',
  qty: number,
  entryPrice: number,
  exitPrice: number,
): number => {
  return side === 'long'
    ? (exitPrice - entryPrice) * qty
    : (entryPrice - exitPrice) * qty;
};

// ── PnL % ──
const pnlPercent = (pnl / initialMargin) * 100;

// ── Phí đóng lệnh ──
const closeFee = qty * exitPrice * closeFeeRate;

// ── PnL ròng (sau phí) ──
const netPnl = rawPnl - closeFee;

// ── % Thay đổi giá 24h ──
const priceChange24h =
  ((parseFloat(ticker.last) - parseFloat(ticker.open24h)) /
    parseFloat(ticker.open24h)) *
  100;
```

---

## 10. Error Handling

### 10.1 HTTP Status Codes

| Code | Ý nghĩa               | Mô tả                                 |
| ---- | --------------------- | ------------------------------------- |
| 200  | OK                    | Thành công (GET, PUT)                 |
| 201  | Created               | Tạo thành công (POST)                 |
| 400  | Bad Request           | Lỗi validation (dữ liệu không hợp lệ) |
| 409  | Conflict              | Đang xử lý lệnh khác cho wallet này   |
| 429  | Too Many Requests     | Bị rate limit                         |
| 500  | Internal Server Error | Lỗi server                            |

### 10.2 Các lỗi thường gặp

```json
// Nonce không hợp lệ
{ "statusCode": 400, "message": "Nonce không hợp lệ hoặc đã hết hạn" }

// Chữ ký không hợp lệ
{ "statusCode": 400, "message": "Chữ ký không hợp lệ" }

// Không đủ số dư
{
  "statusCode": 400,
  "message": "Không đủ số dư để mở lệnh. Cần: 500.50 USDT (Ký quỹ: 500.00 + Phí: 0.50). Số dư khả dụng: 300.00 USDT"
}

// Race condition (spam lệnh)
{ "statusCode": 409, "message": "Đang xử lý lệnh khác cho tài khoản này, vui lòng thử lại sau" }

// Không có giá thị trường
{ "statusCode": 400, "message": "Hiện chưa có giá thị trường cho cặp tiền này" }

// Cặp giao dịch không tồn tại
{ "statusCode": 400, "message": "Cặp giao dịch 'XXX-USDT' không tồn tại trong hệ thống" }

// Cặp giao dịch tạm dừng
{ "statusCode": 400, "message": "Cặp giao dịch 'BTC-USDT' hiện đang tạm dừng giao dịch" }

// Khối lượng quá nhỏ
{ "statusCode": 400, "message": "Khối lượng tối thiểu cho BTC-USDT là 0.001" }

// Giá trị lệnh quá nhỏ
{ "statusCode": 400, "message": "Giá trị lệnh tối thiểu cho BTC-USDT là 10 USD (Hiện tại: 5.00 USD)" }

// Đòn bẩy vượt quá
{ "statusCode": 400, "message": "Đòn bẩy tối đa cho BTC-USDT là 100x" }

// SL/TP không hợp lệ
{ "statusCode": 400, "message": "Cắt lỗ (SL) của Long phải thấp hơn giá tham chiếu" }

// Giá Limit không hợp lệ
{ "statusCode": 400, "message": "Giá Long Limit phải thấp hơn giá thị trường hiện tại" }

// Insufficient balance (wallet)
{ "statusCode": 400, "message": "Insufficient balance" }

// Khung nến không hợp lệ
{ "statusCode": 400, "message": "Khung nến 'abc' không được hỗ trợ. Các khung hợp lệ: 1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W, 1M" }
```

### 10.3 Gợi ý xử lý lỗi Frontend

```typescript
async function apiCall(url: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${url}`, options);

  if (!res.ok) {
    const error = await res.json();

    switch (res.status) {
      case 400:
        // Hiển thị error.message cho user (validation error)
        showToast(error.message, 'error');
        break;
      case 409:
        // Race condition → disable button, retry sau 2s
        showToast('Đang xử lý lệnh trước đó...', 'warning');
        break;
      case 429:
        // Rate limit → disable button tạm thời
        showToast('Bạn thao tác quá nhanh, vui lòng chờ...', 'warning');
        break;
      default:
        showToast('Đã có lỗi xảy ra', 'error');
    }

    throw new Error(error.message);
  }

  return res.json();
}
```

---

## Appendix: Quick Reference Card

### Tất cả Endpoints

| Method   | Endpoint                  | Auth       | Mô tả                    |
| -------- | ------------------------- | ---------- | ------------------------ |
| `GET`    | `/nonce/get-nonce`        | ❌         | Lấy nonce                |
| `GET`    | `/user/get-active-status` | ❌         | Kiểm tra đăng ký         |
| `POST`   | `/user/post-active-user`  | ✅ EIP-712 | Kích hoạt user           |
| `GET`    | `/wallet`                 | ❌         | Lấy số dư ví             |
| `POST`   | `/wallet/deposit-trade`   | ❌         | Nạp vào trade balance    |
| `POST`   | `/wallet/withdraw-trade`  | ❌         | Rút từ trade balance     |
| `GET`    | `/pairs`                  | ❌         | Tất cả cặp giao dịch     |
| `GET`    | `/pairs/active`           | ❌         | Cặp đang active          |
| `GET`    | `/market/candles`         | ❌         | Dữ liệu nến (K-line)     |
| `POST`   | `/orders/market`          | ✅ EIP-712 | Mở lệnh Market           |
| `POST`   | `/orders/limit`           | ✅ EIP-712 | Mở lệnh Limit            |
| `PUT`    | `/orders/:id`             | ✅ EIP-712 | Sửa lệnh pending         |
| `DELETE` | `/orders/:id`             | ✅ EIP-712 | Hủy lệnh pending         |
| `GET`    | `/orders/open`            | ❌         | Lệnh đang chờ            |
| `GET`    | `/orders/history`         | ❌         | Lịch sử lệnh             |
| `GET`    | `/positions`              | ❌         | Vị thế đang mở           |
| `GET`    | `/positions/:id`          | ❌         | Chi tiết vị thế          |
| `PUT`    | `/positions/:id`          | ✅ EIP-712 | Cập nhật vị thế          |
| `POST`   | `/positions/:id/close`    | ✅ EIP-712 | Đóng vị thế              |
| `GET`    | `/positions/history`      | ❌         | Lịch sử vị thế           |
| `WS`     | `/realtime` → `ticker`    | ❌         | Giá realtime (Socket.IO) |
