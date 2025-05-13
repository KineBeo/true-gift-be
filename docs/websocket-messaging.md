# WebSocket Messaging API

TrueGift ứng dụng sử dụng WebSocket để truyền tin nhắn theo thời gian thực, giúp giảm tải cho database và cung cấp trải nghiệm người dùng tốt hơn.

## Kết nối WebSocket

### Địa chỉ WebSocket

```
ws://<server-address>/messages
```

Ví dụ: `ws://localhost:3000/messages`

### Xác thực

Để xác thực kết nối WebSocket, thêm JWT token vào handshake auth (Khuyến nghị):

```javascript
const socket = io('ws://localhost:3000/messages', {
  auth: {
    token: 'your-jwt-token' // Token JWT từ đăng nhập
  }
});
```

Hoặc cho tương thích ngược, có thể sử dụng userId (KHÔNG khuyến nghị cho môi trường production):

```javascript
const socket = io('ws://localhost:3000/messages', {
  auth: {
    userId: 123 // ID của người dùng hiện tại
  }
});
```

## Sự kiện WebSocket

### Gửi tin nhắn mới

```javascript
// Gửi tin nhắn mới - Sử dụng Promise với callback
socket.emit('sendMessage', {
  receiverId: 456, // ID của người nhận
  content: 'Xin chào!', // Nội dung tin nhắn
}, (response) => {
  if (response.event === 'messageSent') {
    console.log('Tin nhắn đã được gửi thành công:', response.data);
  } else {
    console.error('Lỗi gửi tin nhắn');
  }
});

// Lắng nghe sự kiện khi có tin nhắn mới đến
socket.on('newMessage', (message) => {
  console.log('Đã nhận tin nhắn mới:', message);
});
```

### Đánh dấu tin nhắn đã đọc

```javascript
// Đánh dấu tất cả tin nhắn từ một người dùng là đã đọc
socket.emit('markAsRead', {
  senderId: 456 // ID của người gửi tin nhắn
}, (response) => {
  if (response.event === 'messagesRead' && response.data.success) {
    console.log('Đánh dấu tin nhắn đã đọc thành công');
  }
});

// Lắng nghe sự kiện khi tin nhắn của bạn được đọc
socket.on('messagesRead', (data) => {
  console.log('Tin nhắn đã được đọc bởi người dùng:', data.by);
});
```

### Trạng thái typing

```javascript
// Gửi trạng thái đang nhập
socket.emit('typing', {
  receiverId: 456, // ID của người nhận
  isTyping: true // true khi bắt đầu nhập, false khi kết thúc
});

// Lắng nghe sự kiện khi người khác đang nhập
socket.on('userTyping', (status) => {
  console.log(`Người dùng ${status.userId} đang nhập: ${status.isTyping}`);
});
```

### Xử lý lỗi

```javascript
socket.on('error', (error) => {
  console.error('Lỗi WebSocket:', error.message);
});
```

### Theo dõi trạng thái kết nối

```javascript
socket.on('connect', () => {
  console.log('Đã kết nối với WebSocket server');
});

socket.on('disconnect', () => {
  console.log('Đã ngắt kết nối với WebSocket server');
});
```

## Luồng xử lý tin nhắn

1. **Xác thực**:
   - Client kết nối với JWT token
   - Server xác thực token và lưu userId vào socket data
   - Client được thêm vào room riêng theo userId

2. **Gửi tin nhắn**:
   - Client gửi tin nhắn qua WebSocket (`sendMessage`)
   - Server lưu tin nhắn vào database
   - Server gửi tin nhắn đến người nhận qua WebSocket nếu họ đang online
   - Server xóa cache để đảm bảo dữ liệu mới nhất được hiển thị
   - Server trả về phản hồi với tin nhắn đã được lưu

3. **Nhận tin nhắn**:
   - Client lắng nghe sự kiện `newMessage` để nhận tin nhắn mới
   - Client cập nhật UI để hiển thị tin nhắn mới

4. **Đọc tin nhắn**:
   - Client gửi sự kiện `markAsRead` khi người dùng đọc tin nhắn
   - Server cập nhật trạng thái tin nhắn và thông báo cho người gửi qua sự kiện `messagesRead`

5. **Trạng thái typing**:
   - Client gửi sự kiện `typing` khi người dùng đang nhập
   - Server chuyển tiếp trạng thái đến người nhận qua sự kiện `userTyping`
   - Client tự động hủy trạng thái typing sau một khoảng thời gian hoặc khi gửi tin nhắn

## Kiến trúc Mở rộng

TrueGift sử dụng Redis Adapter cho Socket.IO, cho phép mở rộng theo chiều ngang:

- Nhiều instance WebSocket server có thể chạy đồng thời
- Redis pub/sub đảm bảo các tin nhắn được chuyển tiếp giữa các instance
- Hỗ trợ cân bằng tải và khả năng chịu lỗi

## Ưu điểm của WebSocket

- **Giảm tải database**: Mỗi tin nhắn không cần phải polling từ client
- **Thời gian thực**: Người dùng nhận tin nhắn và trạng thái typing ngay lập tức
- **Tiết kiệm băng thông**: Chỉ truyền dữ liệu thực sự cần thiết
- **Trải nghiệm người dùng tốt hơn**: Không có độ trễ khi nhắn tin
- **Bảo mật cao**: Xác thực qua JWT token, không lộ thông tin người dùng

## Kết hợp với RESTful API

WebSocket API được thiết kế để bổ sung cho RESTful API hiện có:

- Sử dụng WebSocket cho tin nhắn theo thời gian thực và trạng thái
- Sử dụng RESTful API để tải lịch sử tin nhắn, danh sách cuộc trò chuyện
- Cache Redis được dùng trong cả hai phương pháp để tối ưu hiệu suất 