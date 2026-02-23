# Chiến lược Cache Lịch Sử Nến (Candle History Caching)

Tài liệu này tổng hợp nghiên cứu toàn diện về việc cache dữ liệu nến (OHLC/K-line) cho hệ thống trading, bao gồm các vấn đề tiềm ẩn, nguy cơ, và phương án khuyến nghị.

---

## 1. Triết lý cốt lõi

Hệ thống chia dữ liệu nến thành 2 loại rõ ràng:

| Loại                             | Nguồn cung cấp        | Đặc điểm                              |
| :------------------------------- | :-------------------- | :------------------------------------ |
| **Nến đã đóng** (Closed Candles) | REST API (có Cache)   | Bất biến - giá không bao giờ thay đổi |
| **Nến đang chạy** (Live Candle)  | WebSocket (Real-time) | Thay đổi liên tục từng giây           |

> [!IMPORTANT]
> API chỉ phục vụ nến đã đóng. Nến đang chạy (live) được FE nhận trực tiếp qua WebSocket.
> Điều này giúp toàn bộ dữ liệu trên API là **bất biến (Immutable)**, cực kỳ dễ cache.

---

## 2. Giải pháp lưu trữ: Redis Sorted Set (ZSET)

Thay vì lưu cả mảng nến vào một String Key (dễ bị trùng lặp khi tham số khác nhau), chúng ta sử dụng **Sorted Set**:

- **Key:** `market:candles:history:{instId}:{bar}`
  - Ví dụ: `market:candles:history:BTC-USDT:1m`
- **Score:** Timestamp (thời gian mở nến) → Redis tự sắp xếp theo thời gian.
- **Member:** `JSON.stringify({ ts, o, h, l, c, vol })` → Dữ liệu chi tiết của nến.

**Tại sao ZSET tốt hơn String Cache?**

| Tiêu chí           | String Cache                                  | Sorted Set (ZSET)                       |
| :----------------- | :-------------------------------------------- | :-------------------------------------- |
| Trùng lặp dữ liệu  | Cao (mỗi tổ hợp `limit/before` = 1 key riêng) | Không có (mỗi nến chỉ lưu 1 lần)        |
| Linh hoạt tham số  | Kém (sai tham số = gọi lại API)               | Tuyệt vời (lấy khoảng thời gian bất kỳ) |
| Tốn RAM            | Nhiều (dữ liệu trùng nhau giữa các key)       | Ít (dữ liệu thống nhất, không trùng)    |
| Hiệu năng truy vấn | O(1)                                          | O(log(N) + M) - vẫn rất nhanh           |

---

## 3. Quy trình xử lý (Workflow)

Khi người dùng gọi `GET /candles?instId=BTC-USDT&bar=1m&before=X&limit=Y`:

1. **Kiểm tra ZSET:** Dùng `ZREVRANGEBYSCORE` lấy `Y` nến có timestamp < `X`.
2. **Đủ dữ liệu?** → Trả về ngay (Cache Hit, ~1-2ms).
3. **Thiếu dữ liệu?** → Gọi API OKX → Lọc bỏ nến chưa đóng → `ZADD` vào ZSET → Trả về.

---

## 4. Các vấn đề có thể xảy ra & Giải pháp

### 4.1. Lỗ hổng dữ liệu (Cache Gaps)

**Vấn đề:** Nến từ 1-5 có trong cache, 6-10 không có, 11-16 lại có. Khi một người yêu cầu nến từ 1-17, Redis trả về thiếu.

**Giải pháp: Self-Healing (Tự vá)**

- Khi phát hiện số nến trả về từ Redis < `limit` yêu cầu: **Gọi API OKX lấy đủ dữ liệu.**
- Dùng `ZADD` đổ toàn bộ kết quả vào ZSET. Redis tự động:
  - Bỏ qua nến đã có (không trùng lặp).
  - Chèn thêm nến mới vào đúng vị trí (lấp đầy lỗ hổng 6-10).
- **Kết quả:** Từ lần sau, mọi request trong khoảng 1-17 đều được phục vụ 100% từ Redis.

---

### 4.2. Tràn bộ nhớ (Memory Overflow)

**Vấn đề:** Nếu cache nến cho hàng chục cặp tiền × nhiều khung giờ, ZSET có thể phình to vô hạn, chiếm hết RAM của Redis.

**Giải pháp:**

1. **Giới hạn số lượng nến:** Dùng `ZREMRANGEBYRANK` để giữ tối đa N nến cũ nhất (ví dụ: 10,000 nến/set).
2. **TTL trên Key:** Đặt TTL 24h-7 ngày cho mỗi ZSET Key. Tự động gia hạn mỗi khi có người truy cập (`EXPIRE` sau mỗi lần đọc/ghi).
3. **Eviction Policy:** Cấu hình Redis với `maxmemory-policy: allkeys-lru` → Khi hết RAM, Redis tự xóa các Key ít được truy cập nhất.

**Ước tính bộ nhớ:**

- 1 cây nến ≈ 150 bytes (JSON).
- 10,000 nến ≈ 1.5 MB.
- 10 cặp tiền × 9 khung giờ × 10,000 nến ≈ **135 MB** → Hoàn toàn chấp nhận được.

---

### 4.3. Member Uniqueness (Trùng Member trong ZSET)

**Vấn đề:** ZSET yêu cầu `member` phải là duy nhất. Nếu 2 cây nến khác thời điểm nhưng có cùng giá OHLCV, chúng sẽ bị gộp thành 1.

**Giải pháp:** Luôn nhúng `timestamp` vào trong chuỗi JSON của member:

```json
{
  "ts": 1708675200000,
  "o": "42150.5",
  "h": "42200.0",
  "l": "42100.0",
  "c": "42180.0",
  "vol": "125.5"
}
```

Vì mỗi nến có timestamp khác nhau → member tự khắc là duy nhất, không bao giờ bị gộp.

---

### 4.4. Cache Stampede (Cuộc đổ xô)

**Vấn đề:** Khi cache hết hạn hoặc chưa có, hàng trăm request đồng thời cùng gọi API OKX → Quá tải API, lãng phí tài nguyên.

**Giải pháp: Distributed Lock (Khóa phân tán)**

- Khi phát hiện Cache Miss, chỉ **1 request duy nhất** được phép gọi API OKX (sử dụng Redis `SET NX` làm lock).
- Các request còn lại chờ khoảng vài trăm ms, sau đó đọc lại từ cache (lúc này đã được request đầu tiên ghi vào).

```
Request 1 → Cache Miss → Acquire Lock ✅ → Gọi OKX → Ghi Cache → Release Lock
Request 2 → Cache Miss → Acquire Lock ❌ → Chờ 200ms → Đọc Cache ✅
Request 3 → Cache Miss → Acquire Lock ❌ → Chờ 200ms → Đọc Cache ✅
```

---

### 4.5. Hot Key (Key nóng)

**Vấn đề:** Key `market:candles:history:BTC-USDT:1m` sẽ bị truy cập rất nhiều (vì BTC là cặp phổ biến nhất) → Gây nghẽn trên 1 node Redis trong môi trường Cluster.

**Giải pháp:**

- **Hiện tại (Single Redis):** Không cần lo, Redis đơn xử lý được hàng trăm nghìn request/giây.
- **Khi scale (Redis Cluster):** Thiết kế Key theo cặp tiền → Mỗi cặp tiền nằm trên shard khác nhau, tải được phân bổ đều.

---

### 4.6. Dữ liệu nến cuối cùng chưa đóng

**Vấn đề:** OKX API thường trả về cây nến cuối cùng là cây đang chạy (chưa đóng). Nếu cache cây nến này, dữ liệu sẽ bị sai (vì giá còn thay đổi).

**Giải pháp: Sanitization (Lọc dữ liệu)**

- Trước khi lưu vào ZSET, Backend **loại bỏ (pop) cây nến cuối cùng** nếu nó chưa đóng.
- Cách xác định nến chưa đóng: So sánh timestamp của nến + khoảng thời gian khung nến (bar duration) với thời gian hiện tại.
  - Nếu `candle.ts + barDuration > Date.now()` → Nến chưa đóng → Loại bỏ.

---

## 5. Phương án khuyến nghị

### Kiến trúc tổng thể

```
┌──────────────┐     Initial Load      ┌──────────────┐     Cache Miss      ┌──────────────┐
│   Frontend   │ ──── REST API ──────→ │   Backend    │ ──── HTTP ────────→ │   OKX API    │
│  (Chart UI)  │                       │  (NestJS)    │                     │              │
│              │ ←─── Closed Candles ── │              │ ←─── Raw Data ───── │              │
│              │                       │     │        │                     └──────────────┘
│              │                       │     ▼        │
│              │     Live Updates      │  ┌────────┐  │
│              │ ←─── WebSocket ────── │  │ Redis  │  │
│              │     (Nến đang chạy)   │  │ (ZSET) │  │
└──────────────┘                       │  └────────┘  │
                                       └──────────────┘
```

### Cấu hình Redis khuyến nghị

| Tham số            | Giá trị       | Lý do                                 |
| :----------------- | :------------ | :------------------------------------ |
| `maxmemory`        | 256MB - 512MB | Đủ cho hàng triệu nến                 |
| `maxmemory-policy` | `allkeys-lru` | Tự xóa Key ít dùng khi đầy            |
| TTL mỗi ZSET Key   | 24 giờ        | Tự gia hạn khi có truy cập            |
| Max nến/ZSET       | 10,000        | Cắt bớt nến cũ bằng `ZREMRANGEBYRANK` |

### Code xử lý tóm tắt

```typescript
async getCandles({ instId, bar, limit, before }) {
  const key = `market:candles:history:${instId}:${bar}`;

  // 1. Lấy từ ZSET
  const cached = before
    ? await redis.zrevrangebyscore(key, before, '-inf', 'LIMIT', 0, limit)
    : await redis.zrevrangebyscore(key, '+inf', '-inf', 'LIMIT', 0, limit);

  // 2. Đủ dữ liệu → Trả về
  if (cached.length >= limit) {
    await redis.expire(key, 86400); // Gia hạn TTL
    return cached.map(JSON.parse);
  }

  // 3. Thiếu → Gọi OKX (có lock chống stampede)
  const data = await this.fetchFromOKXWithLock(instId, bar, limit, before);

  // 4. Lọc nến chưa đóng + Lưu vào ZSET
  const closedCandles = this.filterClosedCandles(data, bar);
  const zadd = closedCandles.flatMap(c => [c.ts, JSON.stringify(c)]);
  await redis.zadd(key, ...zadd);
  await redis.expire(key, 86400);

  return closedCandles;
}
```

---

## 6. Tổng kết rủi ro & Giải pháp

| #   | Rủi ro                            | Mức độ                       | Giải pháp                               |
| :-- | :-------------------------------- | :--------------------------- | :-------------------------------------- |
| 1   | Lỗ hổng dữ liệu (Cache Gaps)      | Trung bình                   | Self-healing qua `ZADD`                 |
| 2   | Tràn bộ nhớ Redis                 | Cao                          | TTL + `ZREMRANGEBYRANK` + `allkeys-lru` |
| 3   | Trùng Member trong ZSET           | Thấp                         | Nhúng timestamp vào member              |
| 4   | Cache Stampede                    | Cao                          | Distributed Lock (`SET NX`)             |
| 5   | Hot Key (nghẽn 1 node)            | Thấp (khi dùng single Redis) | Phân tách Key theo cặp tiền             |
| 6   | Cache nến chưa đóng (sai dữ liệu) | Cao                          | Lọc bỏ nến cuối trước khi lưu           |
