# Tối ưu Message Service

## Vấn đề

- Mỗi lần user nhắn tin là một lần gọi thẳng đến database
- Tạo tải nặng cho database khi có nhiều người dùng cùng nhắn tin
- Kém hiệu quả khi người dùng cần tải lại cùng dữ liệu nhiều lần
- Không có giao tiếp thời gian thực giữa người dùng

## Giải pháp đã triển khai

### 1. Redis Cache

Chúng ta đã triển khai Redis Cache cho Message Service để:

- Cache thread tin nhắn giữa các người dùng
- Cache danh sách cuộc trò chuyện
- Cache tin nhắn đơn lẻ
- Tự động làm mới cache khi dữ liệu thay đổi

Các key cache được thiết kế theo định dạng sau:
- `messages:thread:{userId}:{receiverId}:{page}:{limit}` - Thread tin nhắn
- `messages:conversations:{userId}:{page}:{limit}` - Danh sách cuộc trò chuyện
- `messages:single:{messageId}` - Tin nhắn đơn lẻ

### 2. WebSocket

Chúng ta đã triển khai WebSocket để:

- Gửi và nhận tin nhắn theo thời gian thực
- Thông báo khi tin nhắn được đọc
- Giảm số lượng HTTP request đến server
- Cung cấp trải nghiệm người dùng mượt mà hơn

### 3. Database Optimization

- Thêm các index cho bảng messages để tối ưu query
- Composite index cho các fields thường xuyên query như (`senderId`, `receiverId`, `isDeleted`)
- Index riêng cho các trường thường được filter (`isRead`, `isDeleted`, `createdAt`)

### 4. Redis Adapter cho Socket.IO

- Cho phép scale WebSocket trên nhiều instance
- Đảm bảo tin nhắn được gửi đúng người nhận khi có nhiều server

## Kết quả

Việc triển khai các giải pháp trên mang lại những lợi ích sau:

1. **Giảm tải cho database**:
   - Hầu hết các yêu cầu đọc được phục vụ từ cache
   - Database chỉ được truy cập khi thực sự cần thiết

2. **Hiệu suất cải thiện**:
   - Thời gian phản hồi nhanh hơn nhờ cache
   - Tin nhắn được gửi tức thì qua WebSocket
   - Giảm độ trễ khi tải cuộc trò chuyện

3. **Khả năng scale tốt hơn**:
   - Kiến trúc phân tán với Redis
   - WebSocket có thể scale với sticky sessions và Redis adapter
   - Giảm tải cho database chính

4. **Trải nghiệm người dùng tốt hơn**:
   - Tin nhắn đến tức thì
   - Không cần refresh để xem tin nhắn mới
   - Thông báo đã đọc theo thời gian thực

## Triển khai tiếp theo

Để cải thiện thêm, chúng ta có thể:

1. **Thêm các metrics và monitoring**:
   - Theo dõi cache hit/miss rates
   - Đo lường WebSocket connections
   - Theo dõi memory usage của Redis

2. **Tối ưu hóa lưu trữ cache**:
   - Tinh chỉnh TTL dựa trên patterns sử dụng
   - Áp dụng data compression cho cache

3. **Batch operations**:
   - Đánh dấu đã đọc cho nhiều tin nhắn cùng lúc
   - Bulk insert/update khi có thể

4. **Shard database**:
   - Chia nhỏ dữ liệu tin nhắn theo user IDs
   - Phân tách read/write operations 