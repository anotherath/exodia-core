# 📘 Hướng dẫn: Logic Mở Lệnh & Công thức Tài chính (Cross-Margin)

Tài liệu này quy định các quy tắc tính toán và kiểm tra điều kiện khi người dùng thực hiện mở vị thế trong hệ thống Exodia.

---

## 1. Phân biệt các khái niệm (Tránh nhầm lẫn ⚠️)

| Thuật ngữ          | Ký hiệu | Ý nghĩa                                      | Ví dụ (BTC giá 50,000)      |
| :----------------- | :------ | :------------------------------------------- | :-------------------------- |
| **Quantity**       | `qty`   | Số lượng coin/hợp đồng muốn mua              | `0.1 BTC`                   |
| **Notional Value** | `value` | Giá trị thực của lô hàng (chưa tính đòn bẩy) | `0.1 * 50,000 = 5,000 USDT` |
| **Leverage**       | `lev`   | Đòn bẩy (vay thêm vốn từ sàn)                | `10x`                       |
| **Initial Margin** | `IM`    | Tiền ký quỹ (số tiền thật user phải bỏ ra)   | `5,000 / 10 = 500 USDT`     |
| **Order Fee**      | `fee`   | Phí mở lệnh (trừ vào số dư)                  | `5,000 * 0.05% = 2.5 USDT`  |

---

## 2. Công thức cốt lõi (Core Formulas)

### 🔹 Công thức Mở lệnh

1.  **Giá trị vị thế (Notional Value):**
    > `Value = Quantity * Price`
2.  **Tiền ký quỹ cần thiết (Initial Margin):**
    > `Required Margin = Value / Leverage`
3.  **Tổng chi phí phải có để mở lệnh:**
    > `Total Cost = Required Margin + Open Fee`

### 🔹 Công thức Kiểm tra số dư (Pre-order Check)

Để một lệnh được chấp nhận, hệ thống phải kiểm tra:

> **`Available Balance >= Total Cost`**

Trong đó, **`Available Balance` (Số dư khả dụng)** được tính:

> `Available = Trade Balance + Total Unrealized PnL - Total Locked Margin - Total Reserved Limit Margin`

---

## 3. Các trường hợp cần lưu ý (Edge Cases)

### 🚩 3.1 Đặt lệnh Limit quá nhiều

- **Vấn đề:** User có 1000 USDT, đặt 10 lệnh Limit mua BTC, mỗi lệnh cần 200 USDT ký quỹ. Nếu không khóa tiền, user sẽ đặt được cả 10 lệnh (tổng 2000 USDT).
- **Giải pháp:** Ngay khi đặt lệnh **Limit**, hệ thống phải tính `Reserved Margin` và trừ vào số dư khả dụng ngay lập tức, dù lệnh chưa khớp.

### 🚩 3.2 Đòn bẩy quá cao (Max Leverage)

- **Vấn đề:** User chọn đòn bẩy quá cao dẫn đến giá thanh lý cực gần giá vào lệnh.
- **Lưu ý:** Cần giới hạn đòn bẩy tối đa cho từng cặp tiền dựa trên thanh khoản (BTC cho 100x nhưng Altcoin chỉ cho 20x).

---

## 4. Rủi ro & Giải pháp hệ thống

| Rủi ro                                      | Giải pháp                                                                                                  |
| :------------------------------------------ | :--------------------------------------------------------------------------------------------------------- |
| **Race Condition** (Bấm mở lệnh liên tục)   | Sử dụng **Redis Lock** cho mỗi `walletAddress`. Chỉ xử lý 1 lệnh tại 1 thời điểm cho 1 user.               |
| **Số dư ảo do uPnL** (uPnL tăng/giảm nhanh) | Khi dùng uPnL để mở lệnh mới, có thể áp dụng tỷ lệ chiết khấu (ví dụ chỉ tin dùng 90% uPnL dương).         |
| **Sai số thập phân** (Precision)            | Luôn dùng kiểu dữ liệu **Decimal** (trong Go) hoặc **String** (trong Redis). Tuyệt đối không dùng `float`. |
| **Giá thanh lý quá gần**                    | Nếu `Liquidation Price` cách giá vào lệnh < 1% (hoặc mức an toàn), hệ thống nên từ chối mở lệnh.           |

---

## 5. Quy trình thực hiện (Implementation Flow)

1.  **Xác thực:** Kiểm tra chữ ký EIP-712 và tiêu thụ Nonce để chống replay attack.
2.  **Ràng buộc:**
    - `qty >= minVolume`.
    - `Value >= minAmount` (ví dụ: tối thiểu 5-10 USD).
    - `leverage <= maxLeverage`.
3.  **Tính toán:**
    - Lấy giá thị trường (Mark Price) từ Redis.
    - Tính `Required Margin` + `Open Fee`.
4.  **Kiểm tra ngân sách:**
    - Lấy `Available Balance` real-time từ Redis (được Go Engine cập nhật liên tục).
    - So sánh với `Total Cost`.
5.  **Ghi nhận:**
    - Ghi lệnh vào MongoDB (status: pending/open).
    - Cập nhật Redis để Go Engine bắt đầu theo dõi vị thế.

---

_Tài liệu này là cơ sở để lập trình NestJS API và Go Engine đồng nhất về mặt logic tài chính._
