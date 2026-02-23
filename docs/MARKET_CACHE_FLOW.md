# Luồng Hoạt Động Hệ Thống Cache Lịch Sử Nến

Tài liệu này giải thích nhanh cách phối hợp giữa `MarketService` và `MarketHistoryCacheRepository` để tối ưu hóa việc lấy dữ liệu nến.

## 1. Các Thành Phần Chính

- **MarketService**: Điều phối logic, kiểm tra tính đầy đủ của dữ liệu và lọc nến.
- **MarketHistoryCacheRepository**: Giao tiếp với Redis bằng cấu trúc dữ liệu **Sorted Set (ZSET)** và xử lý **Distributed Lock**.

## 2. Luồng Xử Lý Chi Tiết (Step-by-Step)

### Bước 1: Kiểm Tra Cache

Khi có request, `MarketService` gọi `cacheRepo.getCandles()`:

- Redis sử dụng `ZREVRANGEBYSCORE` để tìm các nến trong khoảng thời gian yêu cầu.
- **Nếu đủ số lượng (Limit):** Trả về ngay lập tức (~1ms). Đây là trường hợp lý tưởng.

### Bước 2: Xử Lý Khi Thiếu Cache (Cache Miss)

Nếu không đủ nến, hệ thống thực hiện cơ chế chống **Cache Stampede** (nhiều người cùng lúc làm sập API):

- Request đầu tiên sẽ giành được một "Khóa" (**Distributed Lock**) qua Redis `SET NX`.
- Các request đến sau (không có khóa) sẽ phải **chờ và thử lại** (`waitAndRetryFromCache`). Sau khi chờ, chúng thường sẽ lấy được dữ liệu mà request đầu tiên đã kịp lưu vào cache.

### Bước 3: Lấy Dữ Liệu Từ Sàn OKX

Request giữ khóa sẽ gọi API OKX:

- Lấy dữ liệu thô (Raw data).
- **Lọc dữ liệu:** `MarketService` loại bỏ các cây nến chưa đóng (của phút/giờ hiện tại) để đảm bảo dữ liệu trong cache là bất biến và chính xác.

### Bước 4: Tự Vá Dữ Liệu (Self-Healing)

Backend gọi `cacheRepo.addCandles()` để đổ dữ liệu mới vào Redis:

- Redis ZSET tự động hợp nhất nến mới vào kho dữ liệu hiện có dựa trên timestamp.
- Các "lỗ hổng" dữ liệu cũ sẽ tự động được lấp đầy.
- Hệ thống cắt bớt các nến quá cũ nếu vượt giới hạn (10.000 nến) để tiết kiệm RAM.

### Bước 5: Giải Phóng Khóa

Sau khi dữ liệu đã được lưu an toàn vào Redis, khóa được xóa để sẵn sàng cho các lần cập nhật tiếp theo.

---

## 3. Tóm Tắt Ưu Điểm

1. **Siêu nhanh:** Tuy truy cập ZSET là $O(\log n)$, nhưng thực tế phản hồi vẫn ở mức millisecond.
2. **Tiết kiệm:** Chỉ gọi OKX khi thực sự cần.
3. **Chính xác:** Loại bỏ nến live giúp biểu đồ không bị "sai" khi load lại.
4. **Ổn định:** Cơ chế Lock giúp server không bị quá tải khi traffic tăng đột biến.
