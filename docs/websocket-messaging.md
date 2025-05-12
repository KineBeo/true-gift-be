# WebSocket Messaging API

TrueGift ứng dụng sử dụng WebSocket để truyền tin nhắn theo thời gian thực, giúp giảm tải cho database và cung cấp trải nghiệm người dùng tốt hơn.

## Kết nối WebSocket

### Địa chỉ WebSocket

```
ws://<server-address>/messages
```

Ví dụ: `ws://localhost:3000/messages`

### Xác thực

Để xác thực kết nối WebSocket, thêm JWT token và userId vào handshake auth:

```javascript
const socket = io('ws://localhost:3000/messages', {
  auth: {
    token: 'your-jwt-token',
    userId: 123 // ID của người dùng hiện tại
  }
});
```

## Sự kiện WebSocket

### Gửi tin nhắn mới

```javascript
// Gửi tin nhắn mới
socket.emit('sendMessage', {
  receiverId: 456, // ID của người nhận
  content: 'Xin chào!', // Nội dung tin nhắn
  imageId: null // ID của hình ảnh (nếu có)
});

// Lắng nghe phản hồi
socket.on('newMessage', (message) => {
  console.log('Đã nhận tin nhắn mới:', message);
});
```

### Đánh dấu tin nhắn đã đọc

```javascript
// Đánh dấu tất cả tin nhắn từ một người dùng là đã đọc
socket.emit('markAsRead', {
  senderId: 456 // ID của người gửi tin nhắn
});

// Lắng nghe sự kiện khi tin nhắn của bạn được đọc
socket.on('messagesRead', (data) => {
  console.log('Tin nhắn đã được đọc bởi người dùng:', data.by);
});
```

### Xử lý lỗi

```javascript
socket.on('error', (error) => {
  console.error('Lỗi WebSocket:', error.message);
});
```

## Luồng xử lý tin nhắn

1. **Gửi tin nhắn**:
   - Client gửi tin nhắn qua WebSocket (`sendMessage`)
   - Server lưu tin nhắn vào database
   - Server gửi tin nhắn đến người nhận qua WebSocket nếu họ đang online
   - Server cũng xóa cache để đảm bảo dữ liệu mới nhất được hiển thị

2. **Nhận tin nhắn**:
   - Client lắng nghe sự kiện `newMessage` để nhận tin nhắn mới
   - Client cập nhật UI để hiển thị tin nhắn mới

3. **Đọc tin nhắn**:
   - Client gửi sự kiện `markAsRead` khi người dùng đọc tin nhắn
   - Server cập nhật trạng thái tin nhắn và thông báo cho người gửi

## Ưu điểm của WebSocket

- **Giảm tải database**: Mỗi tin nhắn không cần phải polling từ client
- **Thời gian thực**: Người dùng nhận tin nhắn ngay lập tức
- **Tiết kiệm băng thông**: Chỉ truyền dữ liệu thực sự cần thiết
- **Trải nghiệm người dùng tốt hơn**: Không có độ trễ khi nhắn tin

## Kết hợp với RESTful API

WebSocket API được thiết kế để bổ sung cho RESTful API hiện có:

- Sử dụng WebSocket cho tin nhắn theo thời gian thực
- Sử dụng RESTful API để tải lịch sử tin nhắn, danh sách cuộc trò chuyện
- Cache Redis được dùng trong cả hai phương pháp để tối ưu hiệu suất 