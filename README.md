# Camera API (NestJS + PostgreSQL + FFmpeg)

Backend cung cấp REST API quản lý camera, snapshot, recording, events với JWT + RBAC. Dùng PostgreSQL làm DB (quản trị với pgAdmin 4). Có ví dụ tích hợp FFmpeg để chụp ảnh và ghi file cục bộ. Code có comment tiếng Việt theo khối chức năng.

## Kiến trúc chính
- NestJS: các module Auth, Camera, Stream, Recording, Event, Snapshot.
- PostgreSQL + TypeORM: ánh xạ theo schema dump ở dưới.
- pgAdmin 4: tạo DB, user, theo dõi truy vấn, backup.
- FFmpeg: chụp snapshot, ghi video từ RTSP.
- (Tuỳ chọn) S3/MinIO: có biến môi trường sẵn để mở rộng lưu trữ object, DB chỉ lưu đường dẫn.

## Yêu cầu hệ thống
- Node.js >= 18
- PostgreSQL 14+ (đã cài pgcrypto để có gen_random_uuid) hoặc bật extension tương đương
- FFmpeg trong PATH (hoặc dùng gói ffmpeg-static đi kèm)
- Windows PowerShell v5.1 (theo môi trường người dùng)

## Cài đặt
1) Cài dependencies
```powershell
npm install
```

2) Tạo file .env từ mẫu và chỉnh thông số
```powershell
Copy-Item src\.env.example .env
```

3) Tạo DB bằng pgAdmin 4
- Tạo database `camera_db` (hoặc tên khác, nhớ sửa .env)
- Đảm bảo extension `pgcrypto` có sẵn (để dùng gen_random_uuid) hoặc chuyển sang uuid-ossp.

4) Seed tài khoản admin
```powershell
npm run seed
```

5) Chạy dev
```powershell
npm run start:dev
```
API chạy tại http://localhost:3000

## Đăng nhập
- Sau khi seed: username `admin` / password `admin123`
- Gọi POST /auth/login -> nhận `accessToken`
- Đính kèm `Authorization: Bearer <token>` cho các API còn lại

## Các API chính (tóm tắt)
- Auth: POST /auth/register (dev), POST /auth/login
- Camera: GET /cameras, GET /cameras/:id, POST /cameras, PATCH /cameras/:id, DELETE /cameras/:id
- Snapshot: POST /snapshots/capture, GET /snapshots?cameraId=..., GET /snapshots/:id
- Recording: POST /recordings/start, GET /recordings?cameraId=..., GET /recordings/:id
- Stream (minh hoạ URL): GET /streams/:cameraId/url?protocol=HLS|DASH

Lưu ý: Stream cần hạ tầng streaming thực tế (SRS/nginx-rtmp/HLS segmenter); service hiện trả về URL mẫu.

## Lược đồ dữ liệu
Phần entity TypeORM tương ứng với dump người dùng cung cấp (bảng users, cameras, recordings, snapshots, events). DB dùng quan hệ n-1 tới camera theo khoá ngoại, xoá camera xoá luôn bản ghi liên quan.

## Ghi chú triển khai
- TypeORM đang bật synchronize=true cho tiện phát triển. Production nên tắt và dùng migration.
- Dùng ffmpeg-static để có binary ffmpeg nếu máy chưa cài sẵn. Trên Windows, nên cấu hình RECORD_DIR và SNAPSHOT_DIR là thư mục tồn tại (ví dụ C:\\tmp).
- Mở rộng S3/MinIO: có thể thay lưu local bằng upload lên S3, lưu key vào storage_path.

## Bảo mật & RBAC
- JWT với các vai trò: ADMIN, OPERATOR, VIEWER. Dùng @Roles + RolesGuard để hạn chế truy cập theo route.

## Khắc phục sự cố
- Lỗi thiếu module: chạy `npm install` lại.
- Lỗi connect Postgres: kiểm tra .env (DB_HOST, DB_PORT...), firewall và user/password.
- FFmpeg lỗi: đảm bảo RTSP hợp lệ, camera có stream, port mở; thử thêm `-rtsp_transport tcp` (đã có sẵn).

## Giấy phép
MIT

## Cách kiểm tra toàn bộ chức năng hệ thống

Phần này hướng dẫn bạn kiểm thử end-to-end cho tất cả module: Health, Auth, RBAC, Camera, Snapshot, Recording, Event, và Stream. Bạn có thể dùng Postman, Insomnia hoặc curl.

### 0) Chuẩn bị token (đăng nhập)
1) Seed admin (nếu chưa): `npm run seed`
2) Đăng nhập:
	- POST /auth/login
	- Body: { "username": "admin", "password": "admin123" }
	- Kết quả: { "accessToken": "..." }
3) Dùng header: Authorization: Bearer <accessToken> cho các API dưới (trừ /health).

### 1) Healthcheck
- GET /health → mong đợi: { ok: true, time: "ISO string" }

### 2) Auth & RBAC
- Đăng ký (chỉ dùng cho dev/seed hoặc hạn chế bởi admin):
  - POST /auth/register
  - Body: { "username": "operator1", "password": "operator123", "role": "OPERATOR" }
  - Mong đợi: trả về id/username/role
- RBAC kiểm tra nhanh:
  - Dùng token VIEWER gọi POST /cameras → mong đợi 403 Forbidden
  - Dùng token ADMIN/OPERATOR gọi POST /cameras → 200 và tạo camera

Vai trò và quyền tóm tắt:
- ADMIN: toàn quyền CRUD camera, snapshot, recording, event
- OPERATOR: như ADMIN trừ xóa user
- VIEWER: chỉ xem (GET) danh sách và chi tiết

### 3) Camera (CRUD)
1) Tạo camera (ADMIN/OPERATOR)
	- POST /cameras
	- Body ví dụ:
	  {
		 "name": "Cam Kho 1",
		 "ipAddress": "192.168.1.10",
		 "username": "user",
		 "password": "pass",
		 "rtspPort": 554,
		 "codec": "H.264",
		 "resolution": "1080p",
		 "enabled": true
	  }
	- Mong đợi: trả về camera id.
2) Danh sách camera (mọi vai trò đã đăng nhập)
	- GET /cameras → mong đợi mảng các camera (đã tối ưu chỉ lấy cột cần xem nhanh).
3) Chi tiết camera
	- GET /cameras/:id → mong đợi object camera.
4) Cập nhật camera (ADMIN/OPERATOR)
	- PATCH /cameras/:id → mong đợi trạng thái cập nhật.
5) Xóa camera (ADMIN)
	- DELETE /cameras/:id → mong đợi { success: true }.

Lưu ý: cột ip_address là unique. Nếu đã tồn tại, tạo mới với ipAddress trùng sẽ lỗi 409 (từ DB). Bạn nên nhập IP khác.

### 4) Snapshot (chụp ảnh từ RTSP)
Yêu cầu: Camera có RTSP hợp lệ.
1) Chụp ảnh (ADMIN/OPERATOR)
	- POST /snapshots/capture
	- Body: { "cameraId": "<id camera>", "filename": "tu_chon.jpg" }
	- Mong đợi: trả về snapshot với storagePath (đường dẫn file). Ảnh được lưu vào SNAPSHOT_DIR (mặc định C:\\tmp).
2) Danh sách snapshot
	- GET /snapshots?cameraId=<id camera> → lọc theo camera.
3) Chi tiết snapshot
	- GET /snapshots/:id → trả về bản ghi và đường dẫn.

Gợi ý xử lý sự cố:
- Nếu lỗi kết nối: kiểm tra `rtspUrl` hoặc thông tin `username/password/ip/rtspPort` của camera.
- Có thể tăng `-stimeout`, `-analyzeduration`, `-probesize` nếu mạng chậm.

### 5) Recording (ghi video từ RTSP)
1) Bắt đầu ghi (ADMIN/OPERATOR)
	- POST /recordings/start
	- Body: { "cameraId": "<id camera>", "durationSec": 60 }
	- Mong đợi: trả về { id, storagePath, status: "PENDING" } sau đó tự cập nhật RUNNING → COMPLETED/FAILED.
2) Danh sách bản ghi
	- GET /recordings?cameraId=<id> → mong đợi mảng, có kèm thông tin camera.
3) Chi tiết bản ghi
	- GET /recordings/:id

Lưu ý hiệu năng:
- Service dùng `-c copy` khi có thể để giảm CPU/độ trễ.
- Thời gian đợi có watchdog kill (duration + 20s) để tránh treo ffmpeg.

### 6) Events (ghi nhận chuyển động/lỗi/cảnh báo)
1) Tạo sự kiện (test/thủ công)
	- POST /events
	- Body: { "cameraId": "<id camera>", "type": "MOTION"|"ERROR"|"ALERT", "description": "..." }
	- Mong đợi: trả về record event.
2) Danh sách
	- GET /events?cameraId=<id>
3) Chi tiết
	- GET /events/:id

Thực tế: sự kiện có thể do pipeline AI/analytics sinh ra và gọi API này hoặc ghi trực tiếp DB.

### 7) Stream (URL phát minh hoạ)
- GET /streams/:cameraId/url?protocol=HLS|DASH
- Mong đợi: trả về URL dạng `STREAM_BASE_URL/<cameraId>/index.m3u8|mpd`.
- Lưu ý: cần triển khai server HLS/DASH (SRS/nginx-rtmp/packager) để phát thực sự. Service này chỉ trả về URL mẫu.

### 8) Kiểm tra trong DB (pgAdmin 4)
- Các bảng: users, cameras, snapshots, recordings, events.
- Tạo camera/snapshot/recording/event xong, mở pgAdmin → Tables → View/Edit Data để xem dữ liệu.
- Unique/Index đã có sẵn theo schema; nếu bạn restore từ dump, tránh bật synchronize tạo index trùng.

### 9) Ma trận lỗi thường gặp
- 401 Unauthorized: Thiếu/Token sai.
- 403 Forbidden: Vai trò không đủ quyền (xem lại @Roles và token).
- 404 Not Found: ID camera/event/recording/snapshot không tồn tại.
- 409/DB error: Vi phạm unique (ví dụ ip_address trùng).
- 500: Lỗi hệ thống (kiểm tra log console, kết nối RTSP, hoặc cấu hình FFmpeg).

### 10) Gợi ý test kịch bản end-to-end
1) Login admin → tạo camera RTSP thật → snapshot → recording 30s → tạo event → list tất cả → check DB → xoá camera → xác nhận cascade xóa bản ghi liên quan.
2) Login viewer → xác nhận chỉ GET được, POST/PATCH/DELETE bị 403.
3) Đổi STREAM_BASE_URL và thử GET stream URL.

---
Nếu bạn cần, mình có thể cung cấp luôn Postman Collection JSON để import và test nhanh tất cả endpoint theo thứ tự.
