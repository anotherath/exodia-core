# 🔧 Kế hoạch thực hiện: Điều kiện mở lệnh (Margin Validation)

Tài liệu mô tả chi tiết **những gì sẽ được code** để kiểm tra điều kiện mở lệnh trong Exodia.

Tham chiếu:

- [CROSS_MARGIN_REDIS_ARCHITECTURE.md](./CROSS_MARGIN_REDIS_ARCHITECTURE.md)
- [TRADING_LOGIC_FORMULAS.md](./TRADING_LOGIC_FORMULAS.md)

---

## 1. Hiện trạng (Đã có gì?)

### ✅ Đã có

| Thành phần                                         | File                             | Ghi chú                         |
| :------------------------------------------------- | :------------------------------- | :------------------------------ |
| Validate symbol, minVolume, minAmount, maxLeverage | `position-validation.service.ts` | Hoạt động tốt                   |
| Validate SL/TP                                     | `position-validation.service.ts` | Hoạt động tốt                   |
| Validate limit price (long < ask, short > bid)     | `position-validation.service.ts` | Hoạt động tốt                   |
| Verify EIP-712 signature + consume nonce           | `position-validation.service.ts` | Hoạt động tốt                   |
| Tính phí mở lệnh (`calculateFee`)                  | `math.util.ts`                   | `qty * price * feeRate`         |
| Tính Initial Margin (`calculateReceivedAmount`)    | `math.util.ts`                   | `(qty * entryPrice) / leverage` |
| Trừ phí mở lệnh vào `tradeBalance`                 | `position.service.ts`            | Trừ trực tiếp vào MongoDB       |

### ❌ Chưa có (Cần bổ sung)

| Thành phần                                  | Vấn đề                                                    |
| :------------------------------------------ | :-------------------------------------------------------- |
| **Kiểm tra đủ số dư** trước khi mở lệnh     | Hiện tại trừ phí mà không kiểm tra trước → có thể âm tiền |
| **Tính Available Balance** từ Redis         | Chưa có Redis account summary, chỉ có MongoDB             |
| **Reserved Margin** cho lệnh Limit chờ khớp | Lệnh Limit không khóa tiền → user spam vô hạn             |
| **Distributed Lock** chống race condition   | 2 lệnh đồng thời có thể cùng vượt qua check               |
| **Hàm `calculateInitialMargin`** riêng biệt | Đang dùng gián tiếp qua `calculateReceivedAmount`         |

---

## 2. Những gì sẽ làm (theo thứ tự)

### Bước 1: Thêm hàm tính toán vào `math.util.ts`

Thêm 2 hàm mới:

```typescript
// Tính Initial Margin (tiền ký quỹ cần có)
export const calculateInitialMargin = (
  qty: number,
  price: number,
  leverage: number,
): number => {
  return (qty * price) / leverage;
};

// Tính tổng chi phí mở lệnh (margin + phí)
export const calculateOrderCost = (
  qty: number,
  price: number,
  leverage: number,
  feeRate: number,
): number => {
  const margin = calculateInitialMargin(qty, price, leverage);
  const fee = calculateFee(qty, price, feeRate);
  return margin + fee;
};
```

**Lý do:** Tách riêng `calculateInitialMargin` ra khỏi `calculateReceivedAmount` để code rõ ý nghĩa hơn, tránh nhầm lẫn.

---

### Bước 2: Thêm `validateMargin` vào `position-validation.service.ts`

Hàm kiểm tra điều kiện số dư theo 2 trường hợp:

#### Trường hợp A: Lệnh đầu tiên (Redis trống)

```
1. Không tìm thấy key `account:{wallet}` trong Redis
2. Lấy `tradeBalance` từ MongoDB (WalletService)
3. Available Balance = tradeBalance (vì chưa có vị thế nào)
4. So sánh: Available >= calculateOrderCost(qty, price, leverage, feeRate)
```

#### Trường hợp B: Đã có vị thế đang mở (Redis có dữ liệu)

```
1. Lấy account summary từ Redis: account:{wallet}
2. Available Balance = tradeBalance + totalUnrealizedPnL - totalInitialMargin - totalReservedMargin
3. So sánh: Available >= calculateOrderCost(qty, price, leverage, feeRate)
```

```typescript
async validateMargin(params: {
  walletAddress: string;
  qty: number;
  price: number;         // entryPrice cho Limit, askPx/bidPx cho Market
  leverage: number;
  feeRate: number;
}): Promise<void> {
  const { walletAddress, qty, price, leverage, feeRate } = params;

  // Tính chi phí mở lệnh
  const orderCost = calculateOrderCost(qty, price, leverage, feeRate);

  // Lấy Available Balance
  const availableBalance = await this.getAvailableBalance(walletAddress);

  if (availableBalance < orderCost) {
    const initialMargin = calculateInitialMargin(qty, price, leverage);
    const openFee = calculateFee(qty, price, feeRate);
    throw new BadRequestException(
      `Không đủ số dư. Cần: ${orderCost.toFixed(2)} USDT ` +
      `(Ký quỹ: ${initialMargin.toFixed(2)} + Phí: ${openFee.toFixed(2)}). ` +
      `Số dư khả dụng: ${availableBalance.toFixed(2)} USDT`
    );
  }
}
```

**Hàm `getAvailableBalance` bên trong:**

```typescript
private async getAvailableBalance(walletAddress: string): Promise<number> {
  // Thử lấy từ Redis trước (nhanh hơn, có dữ liệu real-time)
  const account = await this.redis.hgetall(`account:${walletAddress}`);

  if (account && account.tradeBalance) {
    // Đã có vị thế → tính từ Redis
    return (
      parseFloat(account.tradeBalance) +
      parseFloat(account.totalUnrealizedPnL || '0') -
      parseFloat(account.totalInitialMargin || '0') -
      parseFloat(account.totalReservedMargin || '0')
    );
  }

  // Chưa có vị thế → lấy MongoDB
  const wallet = await this.walletService.getWallet(walletAddress, chainId);
  return wallet?.tradeBalance ?? 0;
}
```

---

### Bước 3: Gắn `validateMargin` vào `position.service.ts`

#### Trong `openMarket()`:

```
Vị trí: SAU khi validate symbol/params, SAU khi có entryPrice
         TRƯỚC khi trừ phí và tạo position

1. validateSymbolAndParams() ← đã có
2. Lấy ticker, tính entryPrice ← đã có
3. validateSLTP() ← đã có
4. ★ validateMargin(walletAddress, qty, entryPrice, leverage, pair.openFeeRate) ← MỚI
5. updateTradePnL(-openFee) ← đã có
6. repo.create() ← đã có
```

#### Trong `openLimit()`:

```
1. validateSymbolAndParams() ← đã có
2. validateLimitPrice() ← đã có
3. ★ validateMargin(walletAddress, qty, data.entryPrice, leverage, pair.openFeeRate) ← MỚI
4. repo.create() ← đã có
```

---

### Bước 4: Distributed Lock (chống race condition)

Bọc toàn bộ flow mở lệnh trong một lock:

```typescript
// Trong position.service.ts
async openMarket(data, typedData, signature) {
  const lockKey = `lock:position:${data.walletAddress}`;
  const lockId = uuid();

  const acquired = await this.redis.set(lockKey, lockId, 'NX', 'EX', 5);
  if (!acquired) {
    throw new ConflictException('Đang xử lý lệnh khác, vui lòng thử lại');
  }

  try {
    // ... toàn bộ logic hiện tại + validateMargin
  } finally {
    // Xóa lock (chỉ xóa nếu lock vẫn là của mình)
    await this.redis.eval(
      `if redis.call("get",KEYS[1])==ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end`,
      1, lockKey, lockId
    );
  }
}
```

**Áp dụng cho:** `openMarket`, `openLimit`, `updateOpen` (partial close), `close`.

---

### Bước 5: Cập nhật Redis sau khi mở lệnh thành công

Sau khi `repo.create()` thành công:

```typescript
// 1. Lưu position vào Redis
await this.redis.hset(
  `positions:active:${data.walletAddress}`,
  position._id,
  JSON.stringify({ ...position, initialMargin, markPrice: entryPrice }),
);

// 2. Cập nhật account summary
//    (nếu là lệnh đầu tiên → khởi tạo key mới)
//    (nếu đã có → cập nhật lại các trường)
await this.updateAccountSummary(data.walletAddress);

// 3. Publish event cho Go Engine
await this.redis.publish(
  'exodia:position:events',
  JSON.stringify({
    event: 'POSITION_OPENED',
    walletAddress: data.walletAddress,
    positionId: position._id,
  }),
);
```

---

### Bước 6: Reserved Margin cho lệnh Limit

Khi mở lệnh Limit (chưa khớp), cần **đặt cọc margin**:

```typescript
// Trong openLimit(), sau khi tạo position:
const reservedMargin = calculateOrderCost(
  data.qty,
  data.entryPrice!,
  data.leverage,
  pair.openFeeRate,
);

await this.redis.hset(
  `orders:pending:${data.walletAddress}`,
  position._id,
  JSON.stringify({ ...position, reservedMargin }),
);
```

Khi hủy lệnh Limit (`cancelOrder`), cần **trả lại margin**:

```typescript
// Trong cancelOrder(), xóa khỏi Redis:
await this.redis.hdel(`orders:pending:${data.walletAddress}`, id);
```

---

## 3. Tổng kết thay đổi theo file

| File                             | Thay đổi                                                      |
| :------------------------------- | :------------------------------------------------------------ |
| `math.util.ts`                   | + `calculateInitialMargin()`, + `calculateOrderCost()`        |
| `position-validation.service.ts` | + `validateMargin()`, + `getAvailableBalance()`               |
| `position.service.ts`            | + Gọi `validateMargin()` trong `openMarket` và `openLimit`    |
| `position.service.ts`            | + Distributed Lock bọc tất cả operations                      |
| `position.service.ts`            | + Ghi Redis (`positions:active`, `orders:pending`, `account`) |
| `position.service.ts`            | + Publish event cho Go Engine                                 |
| `position.module.ts`             | + Inject Redis (`InjectRedis`)                                |

---

## 4. Luồng hoàn chỉnh sau khi implement

```
User bấm "Mở lệnh Market" (Long BTC, qty=0.1, leverage=10x)
│
├─ 1. Acquire Lock → lock:position:{wallet}
├─ 2. Verify signature + nonce
├─ 3. Validate symbol (BTC-USDT active? qty >= minVolume?)
├─ 4. Lấy giá Ask = 50,000
├─ 5. Validate SL/TP
├─ 6. ★ Tính orderCost:
│      Notional  = 0.1 × 50,000 = 5,000 USDT
│      IM        = 5,000 / 10   = 500 USDT
│      Open Fee  = 5,000 × 0.05%= 2.5 USDT
│      Total     = 502.5 USDT
│
├─ 7. ★ Lấy Available Balance:
│      Redis account:{wallet} tồn tại?
│      ├─ Có → Available = tradeBalance + uPnL - lockedIM - reservedMargin
│      └─ Không → Available = MongoDB.tradeBalance
│
├─ 8. ★ Check: Available (1000) >= Total (502.5)? → ✅ OK
├─ 9. Trừ openFee vào MongoDB tradeBalance (-2.5)
├─ 10. Tạo Position trong MongoDB (status: open)
├─ 11. Ghi Position vào Redis (positions:active:{wallet})
├─ 12. Cập nhật Account Summary trong Redis
├─ 13. Publish POSITION_OPENED cho Go Engine
├─ 14. Release Lock
└─ 15. Trả kết quả cho User
```

---

_Khi code xong phần này, Go Engine sẽ bắt đầu đọc Redis và tính toán uPnL real-time._
