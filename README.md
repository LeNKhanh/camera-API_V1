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
- Tạo database `Camera_api` (hoặc tên khác, nhớ sửa .env)
- Đảm bảo extension `uuid-ossp` hoặc `pgcrypto` có sẵn (để tạo UUID). Có thể chạy lệnh: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

4) Seed tài khoản admin
```powershell
npm run seed
```

5) Chạy dev
```powershell
npm run start:dev
```
API chạy tại http://localhost:3000

## Cấu hình Database (PostgreSQL) và Migration

1) Biến môi trường DB (trong `.env`)

```properties
DB_HOST=localhost
DB_PORT=5432
```

2) Tạo DB và extension (tuỳ chọn chạy bằng psql)

```sql
-- Tạo database nếu chưa có
CREATE DATABASE "Camera_api";

-- Bật extension UUID (chạy trong database Camera_api)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Hoặc dùng pgcrypto nếu bạn thích
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

3) Chạy migration (khuyến nghị cho môi trường staging/production)

```powershell
# Sinh migration khi thay đổi entity (nếu cần)
npm run migration:generate

# Áp dụng migration vào DB hiện tại
npm run migration:run
```

Ghi chú:
- Ở môi trường dev bạn có thể để `synchronize=true` cho nhanh, nhưng production nên tắt và chỉ dùng migration.
- Nếu PowerShell chặn script, xem mục "Khắc phục sự cố" để bật RemoteSigned hoặc dùng cmd.exe.

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
 - NetSDK (PTZ giả lập):
	 - POST /netsdk/sessions (login tạo session)
	 - GET /netsdk/sessions (danh sách session)
	 - GET /netsdk/sessions/:handle (chi tiết session)
	 - PUT /netsdk/sessions/:handle/ptz (gửi lệnh PTZ)
	 - DELETE /netsdk/sessions/:handle (logout)
	 - POST /netsdk/sessions/:handle/snapshots (snapshot – hiện báo không hỗ trợ)

Lưu ý: Stream cần hạ tầng streaming thực tế (SRS/nginx-rtmp/HLS segmenter); service hiện trả về URL mẫu.

## Lược đồ dữ liệu
Phần entity TypeORM tương ứng với dump người dùng cung cấp (bảng users, cameras, recordings, snapshots, events). DB dùng quan hệ n-1 tới camera theo khoá ngoại, xoá camera xoá luôn bản ghi liên quan.

Các bổ sung nhỏ để hỗ trợ NetSDK:
- cameras:
	- sdk_port (int, nullable): cổng SDK (ví dụ Dahua 37777), khác với rtsp_port.
	- vendor (varchar, nullable): tên nhà sản xuất (Dahua/Hikvision/Onvif...).
- recordings:
	- status mặc định PENDING khi mới tạo, service sẽ cập nhật RUNNING/COMPLETED/FAILED.

## Ghi chú triển khai
- TypeORM đang bật synchronize=true cho tiện phát triển. Production nên tắt và dùng migration.
- Dùng ffmpeg-static để có binary ffmpeg nếu máy chưa cài sẵn. Trên Windows, nên cấu hình RECORD_DIR và SNAPSHOT_DIR là thư mục tồn tại (ví dụ C:\\tmp).
- Mở rộng S3/MinIO: có thể thay lưu local bằng upload lên S3, lưu key vào storage_path.
- Auto-cache RTSP: bật `SNAPSHOT_CACHE_RTSP=1` để khi module snapshot dò được URL hợp lệ sẽ lưu vào cột `rtsp_url` của camera. Bật `SNAPSHOT_CACHE_OVERRIDE=1` nếu muốn ghi đè cả khi đã có `rtsp_url` (cẩn thận khi production).

## Bảo mật & RBAC
- JWT với các vai trò: ADMIN, OPERATOR, VIEWER. Dùng @Roles + RolesGuard để hạn chế truy cập theo route.

## Khắc phục sự cố
- Lỗi thiếu module: chạy `npm install` lại.
- Lỗi connect Postgres: kiểm tra .env (DB_HOST, DB_PORT...), firewall và user/password.
- FFmpeg lỗi: đảm bảo RTSP hợp lệ, camera có stream, port mở; thử thêm `-rtsp_transport tcp` (đã có sẵn).
- PowerShell chặn npm.ps1: nếu gặp lỗi "running scripts is disabled", mở PowerShell với quyền người dùng và chạy:
	- `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
	- Hoặc dùng Command Prompt (cmd.exe) thay vì PowerShell để chạy lệnh npm.

## Giấy phép
MIT

## Cách kiểm tra toàn bộ chức năng hệ thống

Phần này hướng dẫn bạn kiểm thử end-to-end cho tất cả module: Health, Auth, RBAC, Camera, Snapshot, Recording, Event, và Stream. Bạn có thể dùng Postman, Insomnia hoặc curl.
## ID dạng UUID chuẩn RFC
Đây là UUID (Universally Unique Identifier) dạng chuẩn RFC 4122, gồm 32 ký tự hex và 4 dấu gạch ngang (tổng 36 ký tự) theo mẫu 8-4-4-4-12.
Ở ví dụ của bạn, nhóm thứ 3 bắt đầu bằng “4” → version 4 (UUID v4, sinh ngẫu nhiên). Nhóm thứ 4 bắt đầu bằng “9” → biến thể RFC 4122.
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
	- Body tối thiểu: { "cameraId": "<id camera>", "filename": "tu_chon.jpg" }
	- Override trực tiếp RTSP: { "cameraId": "<id>", "rtspUrl": "rtsp://user:pass@ip:554/...", "filename": "test.jpg" }
	- Chọn chiến lược:
	  - "RTSP" (mặc định)
	  - "SDK_NETWORK" / "SDK_LOCAL" (mock – chưa có native SDK, sẽ fallback RTSP nếu ENABLE_SDK_SNAPSHOT!=1)
	  - "FAKE" (tạo ảnh test không cần RTSP bằng ffmpeg testsrc2) → dùng khi bạn CHƯA có camera thật.
	    Ví dụ body: { "cameraId": "<id>", "strategy": "FAKE", "filename": "fake1.jpg" }
	    Có thể chỉnh kích thước bằng ENV: FAKE_SNAPSHOT_SIZE=800x600.
	- Mong đợi: trả về snapshot với storagePath (đường dẫn file). Ảnh được lưu vào SNAPSHOT_DIR (mặc định C:\\tmp).
2) Danh sách snapshot
	- GET /snapshots?cameraId=<id camera> → lọc theo camera.
3) Chi tiết snapshot
	- GET /snapshots/:id → trả về bản ghi và đường dẫn.

Gợi ý xử lý sự cố:
- Nếu lỗi kết nối: kiểm tra `rtspUrl` hoặc thông tin `username/password/ip/rtspPort` của camera.
- Có thể tăng `-stimeout`, `-analyzeduration`, `-probesize` nếu mạng chậm.
- Bật dò & cache RTSP tự động: `SNAPSHOT_CACHE_RTSP=1` (ghi vào cột rtsp_url). Ghi đè: `SNAPSHOT_CACHE_OVERRIDE=1`.
- Thử thêm cổng RTSP phụ: cấu hình `ALT_RTSP_PORTS=8554,10554` (ví dụ) để service thử thêm các port đó.

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

## PTZ nội bộ (phiên bản giản lược – không dùng bridge)

Trước đây phần này mô tả tích hợp NetSDK thông qua một "bridge" native. Hiện tại dự án đã loại bỏ phụ thuộc bridge để giữ mọi thứ thuần REST + TypeScript. Module `netsdk` giờ chỉ cung cấp các endpoint mô phỏng login và PTZ ở mức logic, lưu phiên (session) trong bộ nhớ, phục vụ cho việc tích hợp UI hoặc kiểm thử luồng quyền hạn.

Giới hạn hiện tại:
- "login" chỉ tạo handle giả lập, không thật sự kết nối SDK.
- PTZ trả về JSON xác nhận lệnh; không gửi tới thiết bị thật.
- Snapshot qua SDK bị vô hiệu (trả lỗi `SNAPSHOT_UNSUPPORTED_NO_SDK`). Bạn vẫn có thể dùng RTSP + FFmpeg snapshot trong module `snapshot`.

Endpoints REST hiện tại (JWT + RBAC):
- POST /netsdk/sessions { ip, port, username, password } → tạo session (handle)
- GET /netsdk/sessions → liệt kê tất cả session trong bộ nhớ
- GET /netsdk/sessions/:handle → chi tiết 1 session
- DELETE /netsdk/sessions/:handle → logout (huỷ session)
- PUT /netsdk/sessions/:handle/ptz { channel, cmd, p1?, p2?, p3?, stop? } → lệnh PTZ giả lập
- POST /netsdk/sessions/:handle/snapshots { channel, filePath } → hiện trả `{ ok:false, error: 'SNAPSHOT_UNSUPPORTED_NO_SDK' }`

Định hướng mở rộng (nếu cần thật sự nói chuyện với thiết bị):
1) Tích hợp ONVIF: dùng thư viện onvif để thực hiện PTZ/snapshot thật. Thay logic giả lập trong `NetSdkService` bằng gọi ONVIF profile.
2) Viết adapter SDK riêng bằng Node-API (C++ addon) hoặc quay lại mô hình bridge nếu cần hiệu năng cao.
3) Thêm persistent store cho sessions (Redis) nếu muốn scale nhiều instance.

Việc loại bỏ bridge giúp repo nhẹ, không cần biên dịch C++ và tránh lỗi DLL. Tuy nhiên muốn PTZ thật bạn phải triển khai một trong các hướng mở rộng trên.

